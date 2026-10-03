# Architecture / SDD — mon-farm

> Status: **Draft v1.0** (2026-10-03): System overview, Local data layer, Sync
> engine, Backend API and Security rewritten in Thai for E01-S01 — **agreed by the
> owner 2026-10-03**. Other sections remain v0.1, authored 2026-08-10 alongside epic 1. Records what was
> actually built and why. Pending owner review — the decisions here were made to
> unblock implementation, not agreed in advance, so treat every one as a
> proposal with its reasoning attached rather than as settled.

## 2026-10-02 — Direction for PRD v1.0 (supersedes parts of v0.1 below)

PRD v1.0 widens scope to a multi-device, multi-module farm app. The sections
below this one describe what was built for v0.4 and are **partly superseded**;
System overview, Local data layer, Sync engine, Backend API and Security were
rewritten in Thai for E01-S01 (2026-10-03, owner decisions D-23…D-29). Agreed with the owner (PRD
Decision log D-1…D-21):

| Area | Decision | Why |
|---|---|---|
| Backend | **Firestore (Standard) via Firebase JS SDK**, Blaze plan + budget alert, asia-southeast1, **one Firebase project** for MVP (D-34): dev/preview on a named Firestore database `dev` + a dev Storage bucket, prod on `(default)` + the default bucket; split into two projects before commercial launch | Free-tier quotas cover 3 users; RTDB rejected (100-connection cap, weak queries, no offline advantage). Spark can't do Storage, LINE login, scheduled reminders or Cloud Run. |
| Sync unit | **Keep the append-only event log as source of truth and sync unit.** Each event = one immutable Firestore doc (`groups/{gid}/events/{eventId}`), create-only security rules → idempotent re-push, nothing overwritten. Edits are new events carrying `targetId` + `baseEventId`; concurrent edits merge only when they touch different non-money/weight/count/status fields, otherwise **Conflict** surfaced to the user (see §Sync engine). | Firestore is last-write-wins per document and transactions fail offline, so platform defaults can't satisfy "never silently overwrite money". Basket events are additive → different devices merge for free. |
| Pending Sync | Our own outbox (`synced_at IS NULL`), not Firestore's cache | JS SDK persistence on React Native is memory-only; our SQLite store owns durability. Avoids `@react-native-firebase`. |
| IDs & ordering | Globally unique event ids (**UUIDv7**, owner 2026-10-03) + per-device sequence; causal order only, no clock ordering; `(sale_id, seq)` PK retired; `actor` → user id + device id | Two offline phones would collide on per-sale `seq`. |
| Handoff | `handoff`/`claim` events; QR payload carries the sale's event delta at close; duplicate detection on merge (7–10 s window, basket number cross-check) | PRD SYNC-5…7. |
| Web store | IndexedDB replaces localStorage | Web is now a real surface (D-19); localStorage ~5 MB, whole-blob writes, no media. |
| Media | Local file queue → Cloud Storage via the outbox | Offline capture. |
| Auth | Firebase Auth: Google now; LINE later via custom token from a small server endpoint (Cloud Functions / Cloud Run) (or OIDC if a spike passes); `linkWithCredential` for one user | LINE is not a built-in provider. |
| Orientation | Portrait primary; weighing public mode may rotate | D-17; `app.json` is already `default` (S19). |
| PR previews | **Firebase Hosting preview channels** (ADR 0001) on the **dev** site (same project as prod, D-34), wired to the `dev` database and bucket: `expo export` → `firebase hosting:channel:deploy pr-N --expires 7d`; channel deleted on PR close; no container images to retain. *Superseded 2026-10-03: the earlier Cloud Run + Artifact Registry design (PRD D-22).* | ADR 0001; owner rule (7-day previews) |
| CI minutes | Trigger `push: main` + `pull_request` only (today every PR runs twice); docs-only changes skip heavy jobs via a cheap `changes` gate; graph `changes → verify → e2e → preview`, sequential, each with `timeout-minutes`; cache Playwright browsers; e2e reuses the built `dist/`. | Owner rule: save minutes, fail fast. |

Risks carried: native has never run on a device (top risk with Android-first);
new dependencies (firebase, expo-dev-client for Google sign-in, image picker,
location, notifications, camera/QR) each go through the dependency gate in
`CLAUDE.md`; the `npm audit` baseline must be redone.

## System overview

> สถานะ: **v1.0 สำหรับ E01-S01 — เจ้าของตกลงทั้งฉบับ 2026-10-03** แทนที่ภาพรวม v0.1
> ข้อตัดสินใจที่ใช้: PRD D-1, D-3, D-19, D-22…D-33 และคำตอบเจ้าของ 2026-10-03 (UUIDv7, ลำดับเชิงเหตุผล,
> ไม่ย้ายข้อมูลเก่า, รวมอัตโนมัติเฉพาะฟิลด์ที่ไม่ใช่เงิน/น้ำหนัก/จำนวน/สถานะ, รหัสเชิญผ่าน Cloud Functions,
> ไม่เข้ารหัสข้อมูลในเครื่องใน MVP)

mon-farm เป็นแอป **offline-first หลายเครื่อง**: โทรศัพท์สูงสุด 3 เครื่องและเว็บใช้ข้อมูลเชิงตรรกะชุดเดียวกันต่อ
**กลุ่มฟาร์ม** (SYNC-4) ข้อมูลทุกอย่างเป็น **append-only event log** ที่ไม่มีการแก้หรือลบ event — entity สถานะ
และยอดรวมทุกตัวคือ projection ของ log ชุด event เดียวกันใช้เป็น **หน่วยของ sync** ด้วย: event หนึ่งตัวเท่ากับ
Firestore document หนึ่งตัว ที่สร้างได้อย่างเดียว (create-only)

```
┌──────────── src/app (expo-router, UI ภาษาไทย) ────────────┐
│  login → เลือก/สร้างกลุ่ม → การขาย / ข้อมูลหลัก / ...        │
└───────────────┬────────────────────────────┬──────────────┘
                │ append(NewEvent)            │ useProjection()
┌───────────────▼────────────────────────────▼──────────────┐
│  Session (userId, deviceId, activeGroupId) + write path   │
│  ประทับ id / actor / groupId / deviceSeq แล้ว append        │
└───────┬───────────────────────────────────────┬───────────┘
        ▼                                       ▼
┌────────────────────┐              ┌──────────────────────────────┐
│ src/core (pure)    │              │ EventStore port              │
│ project / settle   │◄── events ───│  .native → expo-sqlite (WAL) │
│ conflicts / merge  │              │  .web    → IndexedDB         │
│ field-state        │              │  outbox = synced_at IS NULL  │
└────────────────────┘              └──────────┬───────────────────┘
                                               │ pending() / insertPulled()
                                    ┌──────────▼───────────────────┐
                                    │ src/sync — SyncEngine         │
                                    │ push outbox · pull snapshot   │
                                    │ media queue · membership ops  │
                                    └──────────┬───────────────────┘
                                               │ Firebase JS SDK (memory cache)
                 ┌─────────────────────────────▼─────────────────────────────┐
                 │ Firebase 1 โปรเจกต์ (asia-southeast1, Blaze, D-34)          │
                 │ site dev/prod · Firestore db `dev` / `(default)` · bucket  │
                 │ dev/prod · Auth (Google, ใช้ร่วม) · groups/{gid}/…          │
                 │ Cloud Functions: createInvite / acceptInvite               │
                 └────────────────────────────────────────────────────────────┘
```

หลักที่ทุก story ต้องถือ:

1. **ที่เก็บในเครื่องคือแหล่งความจริง** ไม่ใช่ Firestore cache บันทึกลงเครื่องแล้วถือเป็นบันทึกจริงทันที
   (SYNC-1) เครือข่ายเป็นแค่ทางส่งต่อ
2. **ไม่มี last-write-wins กับเงิน น้ำหนัก จำนวน และสถานะ** Firestore เป็น LWW ต่อ document และ transaction
   ทำงานออฟไลน์ไม่ได้ เราจึงไม่ใช้ค่าเริ่มต้นของแพลตฟอร์ม: event สร้างได้อย่างเดียว การแก้เป็น event ใหม่ที่ชี้
   `baseEventId` และการแก้ซ้อนกันที่รวมอย่างปลอดภัยไม่ได้กลายเป็น **Conflict** (§Sync engine)
3. **ไม่มีลำดับรวมทั้งระบบ และไม่พึ่งนาฬิกาเครื่อง** (NFR-3) ลำดับมีแค่ `deviceSeq` ต่อเครื่อง กับการอ้างถึงกัน
   ผ่าน `baseEventId` ส่วนเวลาจากนาฬิกา (`ts`) ใช้แสดงผลเท่านั้น
4. **ต้อง login และมีกลุ่มก่อนบันทึก** (D-23, D-24) event ทุกตัวจึงมี `actor.userId` และ `groupId` จริง
   ตั้งแต่ตัวแรก ใน type ทั้งสองฟิลด์ไม่เป็น optional
5. **ทำแค่ที่ E01/E02 ใช้** การส่งต่อ/รับช่วง, QR merge และการตรวจนับซ้ำ (SYNC-5…7) อยู่ใน E04
   การ login ด้วย LINE ผ่าน custom token อยู่หลัง MVP — ในเอกสารนี้เป็นแค่ pointer

ลำดับการเปิดแอปครั้งแรก: ยังไม่ login → เห็นแค่หน้า login (ครั้งแรกต้องมีเน็ต) → login ด้วย Google →
ไม่มีกลุ่ม → สร้างกลุ่ม (ทำออฟไลน์ได้) หรือเข้าร่วมด้วยรหัสเชิญ (ต้องมีเน็ต) → มีกลุ่มเดียวเข้าเลย / หลายกลุ่มให้เลือก (ACC-3)
→ บันทึกได้ และหลังจากนี้ใช้ออฟไลน์ได้ทั้งหมด (ACC-6) MVP ไม่มี logout

ตำแหน่งโค้ด:

| ส่วน | ที่อยู่ | story |
|---|---|---|
| envelope ของ event, registry ชนิด event + นโยบาย merge | `src/core/event.ts`, `src/core/merge-policy.ts` | E01-S02, E01-S11 |
| ตรวจ Conflict / fold แบบ DAG | `src/core/conflicts.ts` | E01-S11 |
| สถานะข้อมูลรายฟิลด์ (SYNC-12) | `src/core/field-state.ts` | E01-S15 |
| UUIDv7 | `src/lib/id.ts` (แทน `newId()` ที่ใช้ `Math.random`) | E01-S02 |
| store ในเครื่อง | `src/store/store.{native,web}.ts` + `MemoryStore` | E01-S02, E01-S03 |
| sync engine (ผ่าน port `RemoteEvents`) | `src/sync/` | E01-S09…S12 |
| rules / indexes / functions | `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `functions/` | E01-S08, E01-S12, E02-S03 |

## Tech stack

Resolved by scaffolding and `expo install`, then pinned from the lockfile.
**Nothing here was chosen by hand-picking a version** — guessing `expo-sqlite@~57.0.9`
failed the install outright (the SDK ships 57.0.1), which is the argument.

| | Version | Why |
|---|---|---|
| Expo SDK | 57.0.11 | Managed workflow. First-party modules for the native surfaces this needs (SQLite now; speech and haptics later), and `react-native-web` in the box, which is what makes browser verification possible at all. |
| React Native | 0.86.2 | Comes with the SDK. |
| React | 19.2.3 | Comes with the SDK. React Compiler enabled. |
| expo-router | 57.0.11 | Real URLs on web, so Playwright can deep-link to any screen with a seeded fixture instead of clicking through setup first. Typed routes catch route typos at compile time. |
| TypeScript | 6.0.3 | `strict`. |
| expo-sqlite | 57.0.1 | Native persistence — see §Local data layer. |
| Vitest | 3.x | `src/core/**` only. |
| jest-expo + RNTL | 57.x / 13.x | Component tier. |
| Playwright | 1.5x | Against the exported web build. |

**Platform target**: phone, **portrait primary** (D-17; weighing public mode may rotate), Android first, web is a real surface (D-19).
`userInterfaceStyle` is forced to `light` because F-15 makes light the field
mode; dark is an in-app opt-in, not an OS-driven one.

### Rejected

- **PWA / Capacitor** — F-9 notes hardware volume-key interception is impossible
  in a pure web app. V5 was dropped, so that argument weakened, but the other
  native surfaces (offline Thai TTS, haptics, screen-wake-lock, orientation
  lock) are all first-party Expo modules and none of them exist in a PWA.
- **Redux / Zustand / Jotai** — there is exactly one write path (append an
  event) and one read path (fold the log). That *is* a reducer; a library would
  add ceremony to it. YAGNI.

## Client architecture

> **v0.1 — บางส่วนถูกแทนที่แล้ว:** `seq` ต่อการขาย, `actor` แบบชื่อ และ PK `(sale_id, seq)` ด้านล่างถูกแทนด้วย
> §Local data layer และ §Sync engine (E01-S01, 2026-10-03) — เก็บไว้เป็นประวัติของ v0.4 จนกว่า E01-S02 จะเขียนโค้ดใหม่

### State

One `SaleProvider` holding `{ events }`, an `append()` that stamps and persists,
and `useMemo(() => projectSale(events), [events])`.

`append()` must produce a **new array** — the memo is keyed on array identity,
and the event types are `readonly` so TypeScript enforces it.

**Performance, honestly**: this re-folds the entire log on every basket — O(n)
per append, roughly 80k operations across a 400-basket sale. That is nothing.
**Do not build an incremental projection.** If a real device ever shows lag, the
fix is memoising per-pile totals by pile id, and the first step is to measure.

### Units

- **Weights: integer grams.** 50 kg is `50_000`.
- **Money: integer satang.** ฿26.50 is `2650`.
- Rounding happens only at the presentation boundary. Two parties sign off on
  these numbers; `0.30000000000000004 kg` cannot appear in that document.

### Two clocks, kept apart

| Field | Meaning |
|---|---|
| `seq` | Monotonic per sale. **The ordering authority** (FR-12.5). Nothing sorts by time. |
| `ts` | Wall clock. "Roughly when", for a human reading the log. Explicitly untrusted. |
| `mono` | Monotonic uptime, for interval evidence (FR-12.4) — how long a hold lasted. Survives a clock that jumps. |

A clock anomaly is recorded as its own event and surfaced as a non-blocking
indicator. It never reorders anything, and it never stops anyone counting.

### Two snapshot rules that protect agreed money

- `accept` stores `netG` and `tareG` **as snapshots**, not references to the
  pile. Editing standard net later, or re-taring after a reopen, must not
  retroactively rewrite baskets already counted and announced aloud.
- `short` stores the observed **scale reading** and the tare, never a derived
  net. The operator supplies what they can see; the app derives the rest; both
  survive so the arithmetic is checkable by hand (FR-7.4).

## Local data layer

### Event envelope

event ทุกตัวมีรูปร่างเดียวกัน ข้อมูลที่ต่างกันตามชนิดอยู่ใน `payload`

```ts
type EventId = string;   // UUIDv7, ตัวพิมพ์เล็ก รูปแบบ canonical 36 ตัวอักษร
interface EventEnvelope<K extends EventKind = EventKind, P = unknown> {
  readonly schema: 1;
  readonly id: EventId;
  readonly groupId: GroupId;                       // ไม่ optional (D-24)
  readonly actor: { readonly userId: UserId;       // = Firebase Auth uid; ไม่ optional (D-23)
                    readonly deviceId: DeviceId };
  readonly deviceSeq: number;                      // 1,2,3,… ต่อการติดตั้ง ไม่ซ้ำ ไม่ย้อน
  readonly kind: K;
  readonly targetId: RecordId;                     // record ที่ event นี้สร้างหรือเปลี่ยน
  readonly baseEventId: EventId | null;            // head ที่ผู้แก้เห็นตอนแก้; null = สร้าง record
  readonly alsoBasedOn?: readonly EventId[];       // head อื่นที่เห็นพร้อมกัน (หลัง merge หรือตัดสิน Conflict)
  readonly saleId: SaleId | null;                  // ขอบเขตของสถานะ sync ต่อการขาย (D-28)
  readonly source: 'app' | 'line' | 'import' | 'ai'; // ช่องทางต้นทาง (SYNC-11); MVP = 'app'
  readonly ts: number;                             // wall clock — แสดงผลเท่านั้น
  readonly mono?: number;                          // uptime ในเครื่อง ใช้เป็นหลักฐานช่วงเวลา (เช่น heldMs)
  readonly payload: P;
}
```

`alsoBasedOn` ขยายจากโมเดล `targetId` + `baseEventId` ที่เจ้าของตกลง: `baseEventId` ตัวเดียวชี้ได้แค่ head เดียว
ถ้าไม่มีฟิลด์นี้ event `resolve` หรือการแก้ต่อหลัง merge อัตโนมัติจะปิด fork ไม่ได้ และ Conflict จะค้างตลอดไป
(เจ้าของตกลง 2026-10-03)

event มีสองตระกูล และ registry ใน `src/core/merge-policy.ts` กำหนดให้แต่ละ `kind` ว่าอยู่ตระกูลไหน:

- **create** (`baseEventId = null`): สร้าง record ใหม่ที่มี `targetId` ของตัวเอง เช่น เข่ง, การขาย, บุคคล,
  ค่าใช้จ่าย, ธุรกรรมสต็อก, บันทึกตรวจสวน, สื่อ ข้อเท็จจริงแบบสะสม (เข่ง ธุรกรรม การจ่าย) ล้วนเป็น create —
  **ปริมาณไม่ถูกเก็บเป็นตัวนับที่แก้ได้ แต่เป็นผลรวมของ create เสมอ** นี่คือเหตุที่การบันทึกส่วนใหญ่ไม่มีวันเกิด
  Conflict
- **change** (`baseEventId` ไม่เป็น null): `edit` (payload = patch ของฟิลด์ที่เปลี่ยน), `delete`, `restore`
  (Soft Delete ใช้กับทุก record — SYNC-10, D-27) และ `resolve` (ตัดสิน Conflict) เครื่องที่แก้ชี้ไปที่ head
  ปัจจุบันของ record ที่ตัวเองเห็นเสมอ

`correction.targetSeq` ของ v0.4 กลายเป็น change ที่ชี้ `targetId`; `sys` payload ของการขายถูกจัดเข้า registry
ใน E01-S02 การออกแบบโมเดลการขายใหม่ทั้งชุดอยู่ใน E04-S01

**ช่วงเปลี่ยนผ่าน (E01-S02 → E04-S01)**: event การขายของ v0.4 ได้ `id`, `deviceSeq` และ `actor` ใหม่แล้ว แต่ยังไม่มี
`groupId`/`targetId`/`baseEventId` (E02-S02 / E04-S01) `correction` ชี้เข่งด้วย **`targetId` = id ของ event เข่ง**
แล้ว (ไม่ใช่ `seq`) เพราะสองเครื่องที่ออฟไลน์อาจได้ `seq` ต่อการขายเลขเดียวกัน `seq` จึงยังอยู่แต่ไม่ unique และ
ลำดับการ fold คือ `(seq, deviceId, deviceSeq, id)` (`src/core/order.ts`) ไม่อ่าน `ts` ตัวนับ `deviceSeq` มีตัวเดียวทั้งแอป
(`src/store/device-clock.ts`) ไม่ใช่ต่อหน้าจอการขาย `userId` เป็นค่าแทน
`'pre-login'` จนกว่า E02-S01 จะมี login (`src/store/session.ts`) เว็บเป็น IndexedDB ตั้งแต่ E01-S03

**Soft Delete + provenance (E01-S04)**: event `delete` / `restore` ชี้ `targetId` ใดก็ได้ (การขาย, โซน, กอง, รายการหัก,
เข่ง = id ของ event เข่ง) ตัดสินด้วย event ล่าสุดตามลำดับ fold (`src/core/soft-delete.ts`) — ยังไม่มี `baseEventId`/DAG
(E01-S11 จะแทนกฎ "ล่าสุดชนะ" นี้ด้วย Conflict เมื่อสองเครื่องลบ/กู้คืนพร้อมกัน) ลบโซน = ซ่อนกองและเข่งในโซนด้วย envelope
ได้ฟิลด์ `source` (`'app'` ตอนนี้) ตามแบบด้านบน และฟิลด์วิธีป้อนของเข่ง (`hold`/`hold-kbd`) เปลี่ยนชื่อจาก `source`
เป็น `input` เพื่อไม่ชนกัน ลบเขตที่คนกรีดยังมีรายการหักมีผลไม่ได้จนกว่าจะยกเลิกรายการหักก่อน และกู้คืนรายการหักของคนกรีด
ในเขตที่ถูกลบไม่ได้จนกว่าจะกู้คืนเขตก่อน (D-44, `src/core/delete-guard.ts`; ตรวจทุกทางเขียน: `setDeleted` และ
`SaleProvider.append`; E01-S16)

**UUIDv7 (RFC 9562, เจ้าของเลือก 2026-10-03)**: เป็นมาตรฐาน IETF (ULID ไม่ใช่) id ที่สร้างใกล้เวลากันเรียงใกล้กัน
ทำให้ index ของ SQLite/IndexedDB มี locality ดีและ debug ง่าย เขียน generator เองราว 20 บรรทัดใน
`src/lib/id.ts` ไม่ต้องใช้ library uuid **ห้ามใช้ส่วนเวลาใน id เรียงหรือตัดสินอะไร** เพราะมาจากนาฬิกาเครื่อง

- ต้องใช้ random 74 bit ต่อ id จาก **CSPRNG** (`crypto.getRandomValues`) ห้าม fallback ไป `Math.random`
  ถ้าไม่มี CSPRNG ให้ throw ชัด ๆ
- **เว็บ**: เบราว์เซอร์ที่รองรับมี `crypto.getRandomValues` ทุกตัว และ Vitest/Jest บน Node มี `globalThis.crypto`
  — ไม่ต้องเพิ่ม dependency
- **native (RN 0.86 / Hermes)**: Hermes ไม่มี global `crypto` (ข้อมูลจากแหล่งรอง — ยืนยันบนเครื่องจริงใน
  E01-S06) จึงใช้ **`expo-crypto`** (`getRandomValues`, first-party Expo, ไม่มี dependency ย่อย) — เจ้าของอนุมัติ
  ตาม dependency gate 2026-10-03 (E01-S02) อยู่ใน `src/lib/random.native.ts` เท่านั้น เว็บ/เทสต์ใช้
  `src/lib/random.ts`

**`deviceId` + `deviceSeq`**: `deviceId` เป็น UUIDv7 ที่สร้างครั้งเดียวต่อการติดตั้ง (เว็บ = ต่อ browser profile)
เก็บใน `meta` ส่วน `deviceSeq` เพิ่ม **ใน transaction เดียวกับการ insert** จึงไม่ซ้ำและไม่ถูกใช้ซ้ำแม้ถูก
force-close (NFR-2) ติดตั้งใหม่ได้ `deviceId` ใหม่ seq เริ่มที่ 1 ซึ่งไม่เป็นปัญหา `deviceId` เป็นค่าที่เครื่อง
ประกาศเอง **ไม่ใช่ขอบเขตความปลอดภัย** (rules ตรวจแค่ `userId`)

### Schema — native (expo-sqlite, WAL)

ไฟล์ฐานข้อมูลใหม่ `mon-farm-v1.db` (เหตุผลดู "ข้อมูลเก่า" ด้านล่าง)

```sql
CREATE TABLE events (
  id            TEXT PRIMARY KEY,          -- UUIDv7
  group_id      TEXT NOT NULL,
  device_id     TEXT NOT NULL,
  device_seq    INTEGER NOT NULL,
  user_id       TEXT NOT NULL,
  kind          TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  base_event_id TEXT,
  sale_id       TEXT,
  ts            INTEGER NOT NULL,
  body          TEXT NOT NULL,             -- canonical JSON ของ envelope ทั้งตัว = สิ่งที่ส่งขึ้น (นิยามด้านล่าง)
  synced_at     INTEGER,                   -- NULL = อยู่ใน outbox (เฉพาะ event ของเครื่องนี้)
  received_at   INTEGER                    -- เวลาเซิร์ฟเวอร์ (receivedAt) เมื่อรู้แล้ว
);
CREATE INDEX events_outbox ON events(group_id, device_seq) WHERE synced_at IS NULL;
CREATE INDEX events_target ON events(group_id, target_id);
CREATE INDEX events_sale   ON events(group_id, sale_id);
-- ไม่มี UNIQUE (device_id, device_seq) ทั้งตาราง: ความไม่ซ้ำของ seq บังคับใน transaction ของ append (เฉพาะแถวของเครื่องนี้)

CREATE TABLE meta        (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  -- device = JSON {deviceId, nextDeviceSeq} (E01-S02), pull_cursor:<gid>, session (userId, activeGroupId)
CREATE TABLE memberships (group_id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
                          member_count INTEGER, state TEXT NOT NULL);   -- 'active' | 'leaving'
CREATE TABLE pending_ops (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, op TEXT NOT NULL,
                          body TEXT NOT NULL, error TEXT);              -- 'create_group' (การออกกลุ่มใช้ memberships.state)
CREATE TABLE media_queue (media_id TEXT PRIMARY KEY, group_id TEXT NOT NULL, local_uri TEXT NOT NULL,
                          content_type TEXT NOT NULL, bytes INTEGER NOT NULL, uploaded_at INTEGER);
```

การทำ seq + insert เป็น transaction แบบ exclusive (store กำหนด `deviceSeq` ของเครื่องตัวเองใน transaction เหมือนเว็บ):
ตรวจกับ type ของ expo-sqlite 57.0.1 แล้ว (E01-S02) —
`withExclusiveTransactionAsync(txn => …)` มีจริง และระหว่างที่ถือ write lock การเขียนแบบ async อื่นจะล้มด้วย
`database is locked` ดังนั้น `SqliteStore` ส่งการเขียนทุกตัว (append, markSynced, การสร้าง device id) ผ่านคิว
ตามลำดับที่เรียก ตัวนับ seq อยู่ใน `meta` (คีย์ `device`) และ `deviceSeq` ของเครื่องตัวเองที่ต่ำกว่าค่าที่บันทึกไว้
ได้เลขว่างถัดไปแทน (ไม่ถูกปฏิเสธ)

**ทำไมไม่บังคับ `(device_id, device_seq)` unique ทั้งตาราง**: ถ้าสองการติดตั้งเคยได้ `deviceId` เดียวกัน (เช่น
Android Auto Backup restore ลงเครื่องใหม่ขณะเครื่องเก่ายังใช้) `insertPulled` จะชน constraint และ pull ค้างถาวร
จึงกำหนดเลขให้เฉพาะแถวของเครื่องนี้ใน append (เลขที่ใช้แล้วได้เลขว่างถัดไป ไม่ถูกปฏิเสธ — E01-S03); ข้อมูลที่ดึงมาซ้ำ `(deviceId, deviceSeq)` แต่ id ต่างกัน → เก็บไว้และ log
เตือน ไม่หยุด pull และตั้ง `android.allowBackup: false` ใน `app.json` (E01-S06) เพื่อกัน `deviceId` ถูกโคลน

**canonical JSON** (ใช้เทียบ "เนื้อหาเท่ากัน" ทั้งในเครื่องและกับ Firestore): key เรียงตามตัวอักษรทุกระดับ, ฟิลด์
optional ที่ไม่มีค่า **ไม่ใส่** (ห้ามเป็น `null`/`undefined` — Firestore ไม่รับ `undefined`), ตัวเลขเป็นจำนวนเต็ม
เท่านั้น, ไม่นับ `receivedAt` Firestore ไม่รักษาลำดับ key ของ map จึงต้อง canonicalize ทั้งสองฝั่งก่อนเทียบ

### Schema — เว็บ (IndexedDB, D-19)

ฐานข้อมูล `mon-farm-v1` มี object store ชุดเดียวกับ native: `events` (keyPath `id`; index `outbox` บน
`[groupId, pending]` — IndexedDB index ค่า null ไม่ได้ จึงเก็บ `pending: 1|0`; index (ไม่ unique) บน
`[deviceId, deviceSeq]`; index `[groupId, saleId]` และ `[groupId, targetId]`), `meta`, `memberships`,
`pendingOps`, `mediaQueue` (เก็บไฟล์เป็น Blob)

- **สร้างแล้ว (E01-S03)**: record ใน `events` = `{ id, saleId, ts, deviceSeq, pending, event }` (เก็บ event ทั้งตัวใน
  `event`), index `saleId` และ `pending` — index ที่มี `groupId` เพิ่มเมื่อ envelope มี `groupId` (E02-S02); `meta`
  คีย์ `device` = `{ deviceId, nextDeviceSeq, legacyCleanupV1 }`; ยังไม่สร้าง `memberships`/`pendingOps`/`mediaQueue`
  (สร้างใน story ที่ใช้)
- append 1 ครั้ง = transaction `readwrite` เดียวครอบ `events` + `meta` (ตัวนับ seq) ปลอดภัยแม้เปิดหลายแท็บ:
  **store เป็นผู้กำหนด `deviceSeq` ของเครื่องตัวเองใน transaction** (`checkAppend`) — เลขที่หน้าจอเสนอมาใช้ได้ถ้ายังว่าง
  ถ้าแท็บอื่นใช้ไปแล้วจะได้เลขว่างถัดไปแทนการถูกปฏิเสธ IndexedDB เรียง transaction ข้ามแท็บให้ จึงไม่มี event หาย
  และไม่มีเลขซ้ำ (แก้ใน E01-S03 หลังพบว่าตัวนับในหน่วยความจำต่อแท็บทำให้ event หายราวครึ่ง; มี Playwright สองแท็บ)
  ที่ยังเหลือ: แต่ละแท็บเห็นเฉพาะ event ของตัวเองจนกว่าจะ reload และสองแท็บในการขายเดียวกันได้ `seq` ต่อการขายซ้ำกัน
  (ลำดับ fold ตัดสินด้วย `deviceSeq` ตามลำดับที่ commit) — ไม่มีข้อมูลหาย
- เรียก `navigator.storage.persist()` เพื่อลดโอกาสเบราว์เซอร์ลบข้อมูล
- ใช้ IndexedDB ไม่ได้ (เช่น private mode) → ใช้ `MemoryStore` และเตือนเป็นภาษาไทย (E01-S03) — `EventStore.isDurable()`
  + แถบ `StorageWarning` บนทุกหน้าจอ

### กติกาของ `EventStore`

- `append(e)`: id ใหม่ → insert; **id เดิมเนื้อหาเดิม → ไม่ทำอะไร** (idempotent); **id เดิมเนื้อหาต่าง →
  `IntegrityError`** ห้ามเขียนทับ (แทน `DuplicateSeqError`)
- `insertPulled(events)`: กติกาเดียวกันเรื่อง id (idempotent / `IntegrityError`) แต่ **เก็บตามที่ได้รับ ไม่กำหนด
  `deviceSeq` ใหม่** (การกำหนดเลขใช้กับ append ในเครื่องเท่านั้น) ใส่ `synced_at` / `received_at` และไม่เข้า outbox
- `pending(groupId?)`: เรียงตาม `device_seq` · `markSynced(ids, receivedAt)` ทำหลังเซิร์ฟเวอร์ยืนยันแล้วเท่านั้น
- `purgeGroup(gid)`: ลบทุก table ของกลุ่มนั้น + `pull_cursor:<gid>` ใน transaction เดียว แล้วลบไฟล์สื่อของกลุ่ม
  บนดิสก์ เรียกได้ **เฉพาะ** เมื่อเครื่องรู้ว่าผู้ใช้ไม่เป็นสมาชิกกลุ่มนั้นแล้ว (§การดำเนินการด้านสมาชิกภาพ, E02-S04,
  D-26) — การลบแถวจริงกรณีเดียวใน store
- **ความเข้ากันได้ไปข้างหน้า**: event ที่ `kind` หรือฟิลด์ใน payload ไม่รู้จัก (มาจากแอปรุ่นใหม่กว่า) → **เก็บไว้
  เสมอ ห้ามทิ้ง** ข้ามใน projection แล้วแสดง "มีข้อมูลจากแอปรุ่นใหม่ — อัปเดตแอป"; registry ถือ kind/ฟิลด์ที่
  ไม่รู้จักเป็น `strict`
- query ทุกตัวกรองด้วย `group_id` ของกลุ่มที่เปิดอยู่ ข้อมูลกลุ่มอื่นไม่ปนบนหน้าจอ (ACC-5)
- write path รับ `Session` ที่ไม่เป็น null เท่านั้น — ไม่มี session compile ไม่ผ่าน และมี runtime guard ซ้ำ
  (D-23, D-24)

### Projection, Soft Delete, provenance, สถานะรายฟิลด์

- projection ยังเป็น pure fold ใน `src/core` **ผลต้องไม่ขึ้นกับลำดับที่ event มาถึง**: create สลับลำดับได้
  (ผลรวม/เซต) และสถานะของแต่ละ record คำนวณจาก DAG ของ change (§Sync engine) โค้ดวนตามลำดับคงที่ใดก็ได้
  เช่น `(deviceId, deviceSeq)` พร้อม property test ที่สลับลำดับ input แล้วผลต้องเท่าเดิม (E01-S02)
- record ที่ถูก `delete` ซ่อนจากรายการปกติและไม่นับในยอด แต่เห็นในมุมมอง "ที่ลบแล้ว"; `restore` ทำให้กลับมา
  เหมือนเดิม Soft Delete ≠ Cancelled (SYNC-10)
- provenance (SYNC-11) ได้จาก log ไม่ต้องเก็บแยก: สร้างโดย/เมื่อ = `actor` + `ts` ของ create; แก้โดย/เมื่อ =
  head; ช่องทาง = `source`; สถานะการยืนยัน = สถานะรายฟิลด์
- **สถานะข้อมูลรายฟิลด์ (SYNC-12, E01-S15)**: `FieldValue<T>` ที่ `src/core/field-state.ts` เป็น union —
  `{ value: null, state: 'unknown' | 'not-recorded' }` หรือ `{ value: T, state: อีก 4 สถานะ }` (สร้างจริงใน E01-S15;
  "ไม่มีค่า" ตัดสินจาก `state` เสมอ ไม่ใช่จาก `value` เพราะข้อมูลมาเป็น JSON; `sumKnown()` คืน `{ total | null, missing }`)
  ใช้เฉพาะฟิลด์ที่เกี่ยวข้อง อยู่ใน `payload` ของ create/edit การเปลี่ยนสถานะ
  (เช่น Estimated → User provided) เป็น `edit` ปกติ การเทียบ Conflict ดูทั้ง `value` และ `state` และ
  Unknown / Not recorded ไม่ถูกแปลงเป็น 0 เด็ดขาด
- หน่วย: น้ำหนักเป็นกรัมจำนวนเต็ม เงินเป็นสตางค์จำนวนเต็ม (ตามเดิม) และ snapshot `netG`/`tareG` บนเข่งยังเป็น
  กฎเดิม

### สื่อ (ในเครื่อง)

ไฟล์เก็บในเครื่องก่อนเสมอ (native = ไดเรกทอรีของแอป, เว็บ = Blob ใน IndexedDB) พร้อม event `media.add`
(create; `targetId = mediaId`; payload = entity ที่เกี่ยวข้อง, ชนิดไฟล์, ขนาด, เวลาถ่าย, GPS ถ้ามี) ไฟล์ในเครื่อง
ไม่ถูกลบจนกว่าการอัปโหลดยืนยันแล้ว (E01-S12; lib ไฟล์บน native ถ้าต้องใช้ ผ่าน gate)

### ข้อมูลเก่า — ไม่ย้าย (เจ้าของ 2026-10-03)

MVP เริ่มจากศูนย์ ข้อมูล v0.4 (`events (sale_id, seq)`, `farm_zones`/`farm_piles`, `people` และคีย์
localStorage `mon-farm:events:*`, `mon-farm:sales`, `mon-farm:synced`, `mon-farm:farm-profile`,
`mon-farm:people`, `mon-farm:locale`) **ถูกเพิกเฉยแล้วล้าง**:

1. store ใหม่ใช้ชื่อใหม่ทั้งหมด (`mon-farm-v1.db`, IDB `mon-farm-v1`) โค้ดใหม่จึงไม่อ่าน schema เก่าและไม่ล่ม
   เพราะ schema เก่า
2. ล้าง **เฉพาะ log การขายของ v0.4** ครั้งเดียว (ธง `legacy_cleanup_v1` ใน `meta` ของ store ใหม่): เว็บลบคีย์
   `mon-farm:events:*`, `mon-farm:sales`, `mon-farm:synced`, `mon-farm:locale`; native ไม่แตะ `mon-farm.db`
   เพราะ store farm/people ชั่วคราว (ข้อ 4) ยังใช้ไฟล์นั้นและคีย์ `mon-farm:farm-profile`/`mon-farm:people` อยู่ —
   E03 เป็นผู้ลบ `mon-farm.db` และคีย์ farm/people ครั้งเดียวเมื่อแทนที่ด้วยข้อมูลหลักที่ sync ทุกขั้นครอบ
   try/catch ล้มเหลว → log แล้วไปต่อ `mon-farm:speech-on` เป็นค่าตั้งของเครื่อง จึงเก็บไว้
3. ขั้นนี้ **ย้อนกลับไม่ได้** ในทางปฏิบัติ ของเก่ามีแค่ localStorage บนเบราว์เซอร์ (native ยังไม่เคยรัน)
4. ระหว่าง E01–E02 store farm/people แบบเครื่องเดียวของ v0.4 (ไม่มี group id) อยู่เป็นโครงชั่วคราวที่ไม่ sync
   จนกว่า E03 จะแทนที่ด้วยข้อมูลหลักที่ sync; การใช้งานในสวนจริงเริ่มหลัง E03/E04

## Sync engine

### หลักการ

ส่ง outbox ขึ้นเป็น document ที่สร้างได้อย่างเดียว และดึงของคนอื่นลงด้วย snapshot listener โดยไม่พึ่ง cache ของ
Firestore: SDK ตั้งเป็น `memoryLocalCache()` ทั้ง native และเว็บ (บน RN, JS SDK เก็บ persistence ได้แค่ใน
memory อยู่แล้ว; บนเว็บถ้าเปิดจะมีสำเนาถาวรสองชุด) store ของเราเป็นเจ้าของความคงทนผู้เดียว จึงไม่ต้องใช้
`@react-native-firebase` engine ทำงานหลัง port `RemoteEvents` ให้ Vitest ใช้ fake ได้ (E01-S09)

### กฎลำดับ (NFR-3, เจ้าของเลือก 2026-10-03)

1. **ภายในเครื่องเดียว**: `deviceSeq` คือลำดับที่เชื่อได้ของ event จากเครื่องนั้น
2. **ข้ามเครื่อง**: มี **แค่ลำดับเชิงเหตุผล** — B "ตามหลัง" A ก็ต่อเมื่อ B ชี้ถึง A ผ่าน `targetId` (create →
   change) หรือ `baseEventId` / `alsoBasedOn` สองการแก้ที่ไม่ชี้กัน = **เกิดพร้อมกัน (concurrent)**
3. **ไม่มีลำดับรวมทั้งระบบ** ห้ามเรียงหรือตัดสินด้วย `ts`, ส่วนเวลาใน UUIDv7 หรือ `receivedAt`
   (`receivedAt` เป็น cursor ของการดึงเท่านั้น) ไม่ใช้ Hybrid Logical Clock
4. รายการที่ต้องเรียงเพื่อแสดง (ไทม์ไลน์ รายการเข่ง) เรียงตาม `ts` แล้วตาม `id` — **แสดงผลเท่านั้น** ห้ามป้อนเข้า
   ยอดรวม เลขเข่ง หรือการตัดสิน Conflict ดังนั้น **เลขเข่งต้องเป็นฟิลด์บน event** ไม่ใช่ตำแหน่งใน log
   (ข้อบังคับสำหรับ E04-S01)
5. heuristic ที่แค่ *ถามผู้ใช้* (หน้าต่าง 7–10 วินาทีของการนับซ้ำ E04-S14 ที่ตรวจซ้ำกับเลขเข่ง) หรือแค่ *เสนอ
   ค่าเริ่มต้น* (เช่น จำตัวเลือกปัดเศษล่าสุด — D-5) ใช้ `ts` ได้ แต่ห้ามตัดสินค่าที่บันทึกแล้ว
6. การตรวจนาฬิกาผิดปกติ (`clock_anomaly`) ทำต่อเครื่อง เทียบตาม `deviceSeq` ของเครื่องนั้นเอง

### ตาราง: อะไรรวมอัตโนมัติ อะไรเป็น Conflict (SYNC-4)

กฎหลัก (เจ้าของตกลง 2026-10-03, D-30): **การแก้พร้อมกันบน record เดียวกันรวมอัตโนมัติได้ก็ต่อเมื่อแก้คนละฟิลด์ และไม่มี
ฟิลด์ไหนเป็นเงิน น้ำหนัก จำนวน หรือสถานะ** การแก้ที่ได้ผลเหมือนกันทุกประการรวมได้เสมอ นอกนั้นเป็น Conflict
แต่ละฟิลด์ติดธง `strict` (เงิน/น้ำหนัก/จำนวน/สถานะ) ใน registry

| สถานการณ์ (ต่างเครื่อง ออฟไลน์พร้อมกัน) | ผล | เหตุผล |
|---|---|---|
| สร้าง record ใหม่ชนิดใดก็ได้ (การขาย, บุคคล, ค่าใช้จ่าย, บันทึกตรวจสวน, งาน …) | **รวมอัตโนมัติ** | `targetId` ต่างกัน |
| บันทึกเข่ง (เต็ม/ไม่เต็ม/ส่วนของเข่งเชื่อม) ในการขายเดียวกัน | **รวมอัตโนมัติ** (สะสม) | เป็น create; "นับซ้ำไหม" อยู่ใน E04-S14 |
| ข้อเท็จจริงสะสม: ธุรกรรมสต็อก, รายการบัญชีปุ๋ย, การคืนเงิน, จำนวนต้นแต่ละครั้ง, สื่อ | **รวมอัตโนมัติ** | ยอดคำนวณจากผลรวม ไม่มีตัวนับให้ทับ |
| แก้น้ำหนัก/ค่าที่อ่าน/tare ของเข่ง, ราคา/กก., ส่วนแบ่ง %, ยอดหัก, ยอดค่าใช้จ่าย, ยอดจ่าย, จำนวนในธุรกรรม | **Conflict** | ฟิลด์ strict — ห้าม LWW |
| เปลี่ยนสถานะ: การขาย (Completed vs Cancelled), สถานะการจ่าย (SET-6), สถานะงาน | **Conflict** ถ้าค่าต่างกัน; ค่าเหมือนกัน = รวม | ฟิลด์ strict |
| ลบ (Soft Delete) vs แก้ | **Conflict** | เจตนาขัดกัน (E01-S11) |
| ลบ vs ลบ, กู้คืน vs กู้คืน, void เข่งเดียวกันสองครั้ง | **รวมอัตโนมัติ** | ผลเหมือนกัน |
| ฟิลด์บรรยาย (ชื่อ, หมายเหตุ, GPS, ผู้ซื้อ, ป้าย) — คนละฟิลด์ | **รวมอัตโนมัติ** | ไม่มีข้อมูลหาย |
| ฟิลด์บรรยาย — ฟิลด์เดียวกัน ค่าต่างกัน | **Conflict** | ไม่ใช้ LWW แม้กับข้อความ |
| ค่าตั้งกลุ่มฟาร์ม (ค่าตั้งต้นเข่ง, ระยะกดค้าง) ฟิลด์เดียวกัน | **Conflict** | กฎเดียวกัน; การขายแต่ละครั้ง snapshot ค่าไปแล้ว |
| ตัดสิน Conflict เดียวกันต่างกันสองเครื่อง | **Conflict ใหม่** | `resolve` สองตัวบน head ชุดเดียวกัน = fork ใหม่ |
| ส่งต่อ/รับช่วง, QR merge | — | pointer → E04-S12, E04-S13 |

### ตรวจ Conflict และตัดสิน (E01-S11)

ภาษาง่าย: ถ้าสองเครื่องแก้รายการเดียวกันโดยไม่เห็นการแก้ของกันและกัน ระบบรู้ได้จากการที่ทั้งสองการแก้อ้างถึง
"ค่าก่อนแก้" ตัวเดียวกัน — ถ้าแก้คนละช่องที่ไม่ใช่เงิน/น้ำหนัก/จำนวน/สถานะ ก็รวมให้เอง ไม่อย่างนั้นถามเจ้าของ

- ฟังก์ชัน pure ใน `src/core/conflicts.ts` ทำงานเหมือนกันทุกเครื่อง ไม่พึ่งเซิร์ฟเวอร์: แต่ละ `targetId` สร้าง
  กราฟจาก `baseEventId` + `alsoBasedOn` ("ตามหลัง" ถ่ายทอดได้: A ← B ← C แปลว่า C ตามหลัง A) แล้วหา **head**
  = event ของ record นั้น (รวม create ที่ยังไม่มี change) ที่ไม่มี event ใดชี้ถึง
  - head เดียว → ค่า = fold ตามสาย
  - หลาย head → ใช้ตารางข้างบน: รวมได้ → ใส่ทุก patch; รวมไม่ได้ → **Conflict** บนฟิลด์ที่ขัดกัน (ฟิลด์อื่นที่
    รวมได้ยังรวมตามปกติ)
- **ระหว่างยังไม่ตัดสิน (D-29)**: ฟิลด์ที่ขัดกันแสดง **ค่า base** = ผล fold ของชุด event ที่เป็น ancestor ของ
  **ทุก** head (ชุดนี้ปิดลงล่างจึง fold ได้ผลแน่นอนแม้หลัง merge ไขว้กัน) พร้อมธง
  Conflict ทั้งที่ record (เช่น เข่ง) และที่การขาย ยอดรวมคำนวณด้วยค่า base ส่วน delete-vs-edit แสดงเป็น
  "ยังไม่ลบ ค่าก่อนแก้"
- **ปิดกั้น**: `blockingConflicts(saleId)` ใน core ทำให้การปิด/สรุปเงินการขาย และการบันทึกการจ่ายเงิน ถูก
  ปฏิเสธเมื่อมี Conflict **ใดก็ได้** ในการขายนั้น รวมฟิลด์บรรยาย เช่น หมายเหตุ (เจ้าของ 2026-10-03)พร้อมข้อความไทยและทางไปหน้าตัดสิน (E05-S05 ใช้ guard นี้)
- `resolve` = change ที่ `baseEventId` = head หนึ่ง, `alsoBasedOn` = head ที่เหลือ, payload = ค่าที่เลือก →
  เป็น head ใหม่ตัวเดียว ตัดสินได้ออฟไลน์ เครื่องที่แก้ต่อหลังรวมอัตโนมัติก็ใส่ `alsoBasedOn` แบบเดียวกัน
- change ที่มาถึงก่อน base ของมัน → record เป็น "รอข้อมูล" แสดงค่าล่าสุดที่รู้จนกว่า base มาถึง (รูปแบบเดียวกับที่
  `deduction_voided` ทนลำดับสลับอยู่แล้ว)
- การแก้ที่มาถึงหลังการขาย Completed (เช่น เข่งจากเครื่องที่ออฟไลน์) → ติดธงสถานะการจ่ายให้ตรวจใหม่ตาม D-16
  และถ้าเกิด fork ก็เป็น Conflict

### Push (outbox → Firestore)

1. ทำ **ทุกกลุ่มที่มีของค้าง** (ไม่ใช่แค่กลุ่มที่เปิดอยู่ — กลุ่ม `leaving` ถูกซ่อนแต่ยังต้องส่ง) ต่อกลุ่ม: ถ้ามี
   `pending_ops.create_group` ส่งก่อน (rules ต้องการสมาชิกภาพ) → ส่ง `pending()` เรียงตาม `deviceSeq` → ส่ง
   `media_queue` ส่วนการออกจากกลุ่ม **ไม่อยู่ใน `pending_ops`** แต่ขับด้วย `memberships.state = 'leaving'`
   และเริ่มได้หลัง outbox + `media_queue` ของกลุ่มนั้นว่างแล้วเท่านั้น (§การดำเนินการด้านสมาชิกภาพ)
2. ส่งทีละ `writeBatch` (≤ 500 document ตามขีดจำกัด Firestore) และ **มี batch ส่งอยู่ได้ทีละอัน** แต่ละ doc =
   `body` + `receivedAt: serverTimestamp()`
3. รอเซิร์ฟเวอร์ยืนยัน (timeout 30 วินาที) แล้วจึง `markSynced` ใน transaction ของเครื่อง timeout → ยังค้างใน
   outbox (คิว memory ของ SDK หายตอน kill ได้โดยไม่เสียอะไร)
4. **idempotent**: batch ถูกปฏิเสธด้วย `permission-denied` → ส่งทีละ doc แล้วตรวจแต่ละตัว: `getDocFromServer(id)` → มีอยู่
   และ canonical JSON เท่ากัน = สำเร็จ (ack หายระหว่างทาง); มีอยู่แต่เนื้อหาต่าง = **error ด้าน
   ความถูกต้อง** (ห้ามทับ แสดงปุ่มลองใหม่); ไม่มี = rules ปฏิเสธจริง (เช่น ไม่ได้เป็นสมาชิกแล้ว) วิธีนี้ทำให้ rules
   คง `update: false` ได้แบบเข้มงวด
5. ชนิด error:
   - **ชั่วคราว** (`unavailable`, `deadline-exceeded`, เน็ตหลุด, token หมดอายุ → refresh) → retry อัตโนมัติ
     backoff 2 วินาที → เพดาน 60 วินาที + jitter แสดงเป็น *Pending Sync* ไม่ใช่ error
   - **ถาวร** (ถูกปฏิเสธหลังตรวจข้อ 4, `invalid-argument`, ความถูกต้อง) → สถานะ *error* + ปุ่ม "ลองใหม่"
     ข้อมูลในเครื่องไม่ถูกแตะ

**ตัวกระตุ้น** (ไม่เพิ่ม dependency): เปิดแอป/auth พร้อม, `AppState` กลับเป็น `active`, event `online` บนเว็บ,
ทุกครั้งที่ append (debounce ~2 วินาที), ทุกรอบ backoff, snapshot listener ได้ข้อมูลจากเซิร์ฟเวอร์
(`fromCache === false`) และปุ่ม "ลองใหม่" (รีเซ็ต backoff) ใช้งานปกติ **ไม่มีปุ่ม Sync** (D-3) บนเว็บใช้
`navigator.locks` ให้แท็บเดียวทำ sync (ส่งซ้ำก็ปลอดภัย แค่เปลือง)

### Pull (Firestore → store)

- `onSnapshot(query(groups/{gid}/events, where('receivedAt', '>=', cursor − 10 นาที), orderBy('receivedAt')))`
  realtime สำหรับกลุ่มที่เปิดอยู่; กลุ่มอื่นดึงต่อจาก cursor ตอนสลับไป
- เก็บด้วย `insertPulled` (idempotent ตาม id) id ตรงแต่เนื้อหาต่าง → บันทึก error ด้านความถูกต้อง (แสดงที่
  สถานะ sync) **ข้าม doc นั้นแล้วเลื่อน cursor ต่อ** — doc เสียตัวเดียวต้องไม่ทำให้ pull ค้างทั้งกลุ่ม
- เลื่อน cursor ไปที่ `receivedAt` สูงสุด **หลัง** transaction ในเครื่อง commit แล้วเท่านั้น และข้าม doc ที่
  `receivedAt` ยังเป็น null ช่วงซ้อน 10 นาทีกันเวลาเซิร์ฟเวอร์ที่ไม่เรียงตามลำดับ commit; ที่ได้ซ้ำไม่เป็นปัญหา
- เข้ากลุ่มครั้งแรก: cursor = 0 → ดาวน์โหลดทั้งกลุ่มครั้งเดียว
- หลังดึง → re-project แล้วตรวจ Conflict

### สื่อ (E01-S12)

`media.add` เป็น event ปกติ ส่งขึ้นผ่าน outbox ไฟล์อัปโหลดแยกไปที่ `groups/{gid}/media/{mediaId}` ด้วย
retry/backoff ชุดเดียวกัน ถ้า object มีอยู่แล้วและ `md5Hash` ตรงกัน = สำเร็จ (idempotent) เครื่องอื่นเห็น metadata ก่อน
แสดง "ไฟล์รอส่ง" จนไฟล์ขึ้นเสร็จ ไฟล์ที่ยังไม่ขึ้นนับเป็น Pending Sync

### สถานะ sync (E01-S10, D-28)

- **ต่อการขาย** (จาก event ที่มี `saleId` นั้น): มี Conflict ค้าง → **Conflict**; ไม่มีแต่มี error ถาวร →
  **error + ลองใหม่**; มี event/สื่อของเครื่องนี้ค้างส่ง → **Pending Sync**; ที่เหลือ → **Synced** เข่งที่อยู่ใน
  Conflict มีธงของตัวเองด้วย
- **ภาพรวม** (ส่วนหัวแอป): Synced / Pending Sync (+จำนวน) / Conflict (+จำนวน พาไปหน้าตัดสิน) / error
  ไอคอน + ข้อความไทย ไม่ใช้สีอย่างเดียว ออฟไลน์แสดงเป็น Pending Sync ไม่ใช่ error

### การดำเนินการด้านสมาชิกภาพ (E02)

- **สร้างกลุ่ม**: ทำออฟไลน์ได้ `gid` = UUIDv7 สร้างในเครื่อง → แถว `memberships` + `pending_ops.create_group`
  มีเน็ตแล้วส่ง batch `{groups/{gid}, members/{uid}}` (ส่งซ้ำ → ตรวจแบบข้อ 4 ด้วย `getDoc` ของ members/{uid})
- **เข้าร่วม**: ต้องมีเน็ต (callable `acceptInvite`) เสร็จแล้วดึงข้อมูลทั้งกลุ่มลงมา
- **รีเฟรชรายการกลุ่ม**: ตอนเปิดแอปและทุกครั้งที่กลับมาออนไลน์ query collection-group `members` (`uid == me`)
  แล้วอ่าน `groups/{gid}` ของแต่ละกลุ่ม → อัปเดต `memberships` (ชื่อ, `member_count` ที่ใช้คุมปุ่มออก, กลุ่มที่
  เข้าร่วมจากเครื่องอื่นของผู้ใช้เดียวกัน — ACC-3, E02-S04)
- **ออกจากกลุ่ม (D-26)**: ปิดปุ่มเมื่อ `memberCount ≤ 1` (เซิร์ฟเวอร์บังคับซ้ำ) → **หน้ายืนยันเตือนชัดเจน** ว่า
  ข้อมูลที่ยังไม่ได้ส่งจากเครื่องอื่นของคุณในกลุ่มนี้จะหาย (เจ้าของ 2026-10-03) → `state = 'leaving'` (ซ่อนกลุ่ม,
  ห้ามบันทึกเพิ่ม) → ส่ง outbox + media queue ของกลุ่มให้ครบ (ยังเป็นสมาชิก rules จึงยอม)
  - ระหว่างนั้นเจอ error ถาวร → แสดงกลุ่มกลับมาเป็น `active` พร้อม error และปุ่ม "ลองใหม่" (ไม่ซ่อนค้างตลอดไป)
  - ว่างแล้ว → batch `{delete members/{uid}, update groups/{gid} memberCount: increment(-1)}` (ใช้ `increment`
    ไม่คำนวณจากค่าใน cache ที่อาจเก่า)
  - เซิร์ฟเวอร์ยืนยัน → `purgeGroup(gid)`
  - ถ้าถูกปฏิเสธ (หรือ ack หาย แอปถูก kill แล้วลองใหม่) → อ่าน `getDocFromServer(members/{me})`:
    ไม่มี doc = ออกสำเร็จไปแล้ว → `purgeGroup(gid)`; มี doc และ `memberCount ≤ 1` = เป็นคนสุดท้ายจริง (สองคน
    กดพร้อมกัน) → กลับเป็น `active` + ข้อความไทย; นอกนั้น → error + ปุ่ม "ลองใหม่"
  - ออฟไลน์ → ค้างที่ `leaving` จนมีเน็ต
- **เครื่องอื่นของผู้ใช้เดียวกัน**: เครื่องที่รู้ (จากการรีเฟรช หรือ push ถูกปฏิเสธแล้วตรวจแบบเดียวกัน) ว่าผู้ใช้ไม่เป็น
  สมาชิกกลุ่มนั้นแล้ว → แจ้งเป็นภาษาไทย แล้ว `purgeGroup(gid)` รวมรายการที่ยังไม่ได้ส่ง — ความเสี่ยงที่เจ้าของรับแล้ว
  (D-33) โดยมีคำเตือนตอนกดออกเป็นตัวกัน

### คำตอบต่อ `docs/checklists/offline-sync-checklist.md` (ระดับออกแบบ)

| ข้อ | คำตอบ |
|---|---|
| ใช้ได้เต็มที่โดยไม่มีเน็ต | เขียนทุกอย่างลงเครื่องก่อน ที่ต้องมีเน็ตมีแค่ login ครั้งแรก, สร้างรหัสเชิญ, ตอบรับคำเชิญ (และ AI/สภาพอากาศตาม NFR-2) |
| การเขียนตอนออฟไลน์ถูกเก็บถูกต้อง | insert + `deviceSeq` ใน transaction เดียว (SQLite WAL / IDB); outbox = `synced_at IS NULL`; `pending_ops`; `media_queue` |
| sync เมื่อเน็ตกลับ | ตัวกระตุ้นตามข้างบน ไม่มีปุ่ม Sync |
| ล้มเหลว/Conflict มีปุ่มลองใหม่/ตัดสิน | error ถาวร → "ลองใหม่"; Conflict → หน้าตัดสิน (E01-S10/S11) |
| Conflict จัดการตามกลยุทธ์ ไม่ทับเงียบ | ตารางรวม/Conflict; ค่า base + ธงระหว่างรอ; ปิดกั้นการปิดการขาย/การจ่าย; event สร้างได้อย่างเดียว |
| sync ล้มกลางทางแล้วยังสอดคล้องและลองใหม่ได้ | batch สำเร็จหรือล้มทั้งก้อน; `markSynced` หลังยืนยันเท่านั้น; ส่งซ้ำ/ดึงซ้ำ idempotent; cursor เลื่อนหลัง commit; purge หลัง outbox ว่างเท่านั้น |
| เห็นสถานะ sync | ต่อการขาย + ภาพรวม + ธงที่เข่ง |
| ไม่มีกรณีข้อมูลหาย | ไม่มีการลบในเครื่องนอกจาก purge เมื่อไม่เป็นสมาชิกแล้ว (เครื่องที่กดออก purge หลัง outbox ว่าง); เนื้อหาไม่ตรง → error ไม่ทับ ไม่ค้าง pull; การทิ้งโดยเจตนามีสองกรณีที่เจ้าของตัดสินแล้ว: ล้าง log การขาย v0.4 และรายการค้างส่งบนเครื่องอื่นของผู้ใช้ที่ออกจากกลุ่ม (มีคำเตือนตอนกดออก) |

**นอกขอบเขต (pointer)**: ส่งต่อ/รับช่วง (E04-S12), QR delta merge ตอนปิดการขาย (E04-S13), ตรวจนับซ้ำ +
ไทม์ไลน์รายเครื่อง (E04-S14), Bluetooth (SYNC-8, หลัง MVP), snapshot/compaction ของ log (YAGNI — วัดก่อน)

## Backend API

ไม่มี REST API ที่เขียนเอง backend = Firestore + Cloud Storage ที่ป้องกันด้วย rules และ callable function
สองตัว ทั้งหมดอยู่ในโปรเจกต์ Firebase เดียวที่ asia-southeast1 บน Blaze (D-1, D-22, D-34) แยก dev/prod ภายใน
โปรเจกต์: Firestore database `dev` (dev + preview) กับ `(default)` (prod), Storage bucket ของ dev กับ bucket
หลัก (prod), Hosting site `dev` กับ `prod`

### โครง Firestore

```
users/{uid}                     { displayName, identities: [{provider, linkedAt}] }   // E02-S01; uid = userId
groups/{gid}                    { name, createdBy, createdAt, memberCount }
groups/{gid}/members/{uid}      { uid, role: 'owner', displayName, joinedAt }          // ACC-4: role ไว้ขยายภายหลัง
groups/{gid}/events/{eventId}   { …EventEnvelope, receivedAt }                          // สร้างได้อย่างเดียว
invites/{code}                  { groupId, createdBy, createdAt, expiresAt, usedBy, usedAt }  // function เท่านั้น
inviteAttempts/{uid}            { failures, windowStart }                               // function เท่านั้น
```

- "กลุ่มของฉัน" = collection-group query บน `members` ด้วย `where('uid', '==', auth.uid)` ต้องตั้ง field
  override ของ `members.uid` แบบ collection-group ใน `firestore.indexes.json`
- query ของ events ใช้ single-field index อัตโนมัติบน `receivedAt`
- UUIDv7 เพิ่มขึ้นตามลำดับ เสี่ยง hotspot เฉพาะที่เกิน ~500 writes/s — ไม่เกี่ยวกับ 3 คน

### โครง Cloud Storage

`groups/{gid}/media/{mediaId}` (`mediaId` = UUIDv7 มี random 74 bit เดาไม่ได้) อ่านผ่าน SDK ที่ยืนยันตัวตน
แล้วเท่านั้น **ห้ามเก็บหรือแชร์ download URL** (URL แบบมี token ใครถือก็เปิดได้ — NFR-5)

### Callable functions — รหัสเชิญ (เจ้าของตกลง 2026-10-03, D-31, E02-S03)

**ใช้ Cloud Functions สองตัว (`createInvite`, `acceptInvite`, asia-southeast1, min instances 0) ไม่ใช่ rules
อย่างเดียว**

- **rules อย่างเดียวทำได้แค่ส่วนความถูกต้อง**: doc `invites/{code}` + batch ฝั่ง client ที่สร้าง `members/{uid}`
  และตั้ง `usedBy` พร้อมกัน; rules ตรวจด้วย `get()`/`getAfter()` ว่ารหัสมีจริง ยังไม่หมดอายุ และยังไม่ถูกใช้
- **แต่ rules จำกัดอัตราการเดาไม่ได้** — commit ที่ล้มจะ rollback ทั้งก้อน ตัวนับความพยายามที่ล้มจึงเพิ่มไม่ได้
  ใครมีบัญชี Google ก็ login และเดาได้ รหัส 6 หลักมี 10^6 แบบ: เฉลี่ย ~500,000 ครั้งต่อรหัสที่ใช้งานอยู่หนึ่งรหัส
  ที่ ~50 ครั้ง/วินาทีใช้ราว 3 ชั่วโมง — ภายในอายุ 7 วันเหลือเฟือ ผลคืออ่านเอกสารคนงานและข้อมูลการเงินได้ทั้งกลุ่ม
  (NFR-5)
- **function**: `acceptInvite({code})` จำกัดความพยายามที่ล้มต่อ uid (5 ครั้ง/ชั่วโมง — ปรับได้) แล้วทำ
  transaction (Admin SDK): ตรวจว่ามี/ยังไม่หมดอายุ/ยังไม่ถูกใช้/ผู้เรียกยังไม่เป็นสมาชิก → สร้าง `members/{uid}` +
  `memberCount + 1` + ตั้ง `usedBy` คืนรหัส error (`not-found` / `expired` / `used` / `already-member` / `too-many-attempts`) ให้
  client แปลเป็นภาษาไทย `createInvite({groupId})` ตรวจสมาชิกภาพ สุ่ม 6 หลักด้วย CSPRNG ฝั่งเซิร์ฟเวอร์ กันชนกับ
  รหัสที่ยังใช้งานอยู่ ตั้งอายุ 7 วัน ไม่จำกัดจำนวนเจ้าของ (D-25) client อ่าน/เขียน `invites` ไม่ได้เลย การจำกัดต่อ uid หลบได้ด้วยหลายบัญชี Google จึงมีเพดานความพยายามที่ล้ม
  รวมทั้งระบบต่อชั่วโมงอีกชั้น
- ผลที่ตามมา: **การสร้างและตอบรับคำเชิญต้องมีเน็ต**; deploy functions และ dependency ฝั่งเซิร์ฟเวอร์
  (`firebase-functions`, `firebase-admin` ใน `functions/package.json` แยก) ผ่าน gate ตอนทำ E02-S03;
  `httpsCallable` อยู่ใน `firebase` JS SDK อยู่แล้ว
- `functions/` ชุดเดียวกันนี้คือที่ที่ endpoint LINE custom token จะไปอยู่ภายหลัง (pointer — D-2, D-23)

### ค่าใช้จ่าย / quota

ตรวจ 2026-10-02 จาก search excerpt — **firebase.google.com ถูก proxy ของ sandbox บล็อก ต้องตรวจซ้ำที่ต้นทาง
ตอน E01-S07**

| บริการ | ฟรีต่อ | ประมาณการ 3 เครื่อง | แหล่ง |
|---|---|---|---|
| Firestore Standard | 50,000 reads, 20,000 writes, 20,000 deletes/วัน; 1 GiB; egress 10 GiB/เดือน | วันขาย ~1,000 events ≈ 1,000 writes + ~2,000 reads + อ่านจาก rules | [Firestore pricing](https://cloud.google.com/firestore/pricing) |
| Cloud Functions | 2M invocations, 400,000 GB-s/เดือน | หลักสิบครั้ง/เดือน | [Cloud Run functions](https://cloud.google.com/functions) |
| Cloud Storage | **5 GB-month ฟรีเฉพาะ bucket ใน us-central1/us-east1/us-west1** | bucket ใน asia-southeast1 **เสียเงินตั้งแต่ byte แรก** — รูปหลัก GB คาดว่าไม่กี่บาท/เดือน (ต้องยืนยันราคา) | [Storage FAQ Sept 2024](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) |

### สภาพแวดล้อม

build ของ dev/preview ชี้ Firestore database `dev` และ bucket ของ dev เท่านั้น (มี test ยืนยันใน E01-S07)
(กันการพลาด ไม่ใช่ขอบเขตความปลอดภัย — ดู §Security) Auth และ budget alert ใช้ร่วม
ทั้งโปรเจกต์ (เจ้าของรับใน MVP, D-34) แยกเป็น 2 โปรเจกต์ก่อนเปิดเชิงพาณิชย์หรือก่อนมีผู้ใช้ที่ไม่ใช่เจ้าของ
rules/indexes/functions อยู่ใน repo
ทั้งหมด deploy ผ่านสคริปต์: dev อัตโนมัติ, prod ต้องให้เจ้าของอนุมัติทุกครั้ง test ใช้ Firebase Emulator (ต้องใช้
Java นอก repo — ขออนุญาตใน E01-S08)

## Security

### หลักการ

- **การแยกกลุ่มบังคับที่เซิร์ฟเวอร์** (ACC-5, NFR-5): deny ทุกอย่างเป็นค่าเริ่มต้น แล้วเปิดสิทธิ์ตามสมาชิกภาพ
  `groups/{gid}/members/{uid}` UI ไม่ใช่ขอบเขตความปลอดภัย
- **ตัวตน**: Firebase Auth (Google) ต้อง login ก่อนใช้ครั้งแรก `userId` = auth uid ตัวตนที่ผูกเก็บแยกใน
  `users/{uid}` เพื่อผูก LINE ภายหลังได้โดยไม่สร้างผู้ใช้ใหม่ (ACC-1) — รายการนี้ client เขียนได้ จึง function ของ
  LINE ในอนาคตห้ามเชื่อถือ ต้องตรวจจาก Firebase Auth `providerData` เอง session ต้องคงอยู่หลัง force-close: บน RN
  ต้องมี persistence adapter (ผ่าน gate ใน E02-S01) ไม่มี logout ใน MVP บันทึกออฟไลน์ไม่ต้องใช้ ID token ที่ยัง
  ไม่หมดอายุ — token refresh เองเมื่อมีเน็ต
- **`deviceId` ไม่ใช่ตัวตน**: rules ผูก event กับ `actor.userId == request.auth.uid` เท่านั้น
- **ไม่มีอะไรถูกแก้หรือลบที่เซิร์ฟเวอร์**: events และ media สร้างได้อย่างเดียว; การลบ = Soft Delete event

### โครงร่าง Firestore rules (ให้ E01-S08 / E02-S02…S04 แปลงเป็น test บน emulator)

```
rules_version = '2';            // จำเป็นสำหรับ collection-group rule {path=**}
service cloud.firestore {
match /databases/{database}/documents {

function signedIn()        { return request.auth != null; }
function me()              { return request.auth.uid; }
function groupDoc(gid)     { return /databases/$(database)/documents/groups/$(gid); }
function memberDoc(gid)    { return /databases/$(database)/documents/groups/$(gid)/members/$(me()); }
function isMember(gid)     { return signedIn() && exists(memberDoc(gid)); }

match /groups/{gid} {
  allow read:   if isMember(gid);
  allow create: if signedIn() && request.resource.data.createdBy == me()
                && request.resource.data.memberCount == 1 && existsAfter(memberDoc(gid));
  // ออกจากกลุ่ม: ลดได้ทีละ 1 ห้ามต่ำกว่า 1 และ doc สมาชิกของผู้ออกต้องหายใน batch เดียวกัน
  allow update: if isMember(gid)
                && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount'])
                && resource.data.memberCount > 1
                && request.resource.data.memberCount == resource.data.memberCount - 1
                && !existsAfter(memberDoc(gid));
  allow delete: if false;                                   // MVP ไม่มีการลบกลุ่ม

  match /members/{uid} {
    allow read:   if isMember(gid);
    allow get:    if signedIn() && uid == me();   // อ่าน doc ของตัวเอง (หรือรู้ว่าไม่มี) หลังออกกลุ่ม
    // สร้างได้เฉพาะตัวเอง และเฉพาะใน batch ที่สร้างกลุ่มนั้น (คนอื่นเข้าทาง acceptInvite เท่านั้น)
    allow create: if signedIn() && uid == me() && !exists(groupDoc(gid))
                && getAfter(groupDoc(gid)).data.createdBy == me()
                && request.resource.data.uid == me() && request.resource.data.role == 'owner';
    allow delete: if signedIn() && uid == me()
                && getAfter(groupDoc(gid)).data.memberCount == get(groupDoc(gid)).data.memberCount - 1;
    allow update: if false;
  }

  match /events/{eventId} {
    allow read:   if isMember(gid);
    allow create: if isMember(gid)
                && request.resource.data.id == eventId
                && request.resource.data.groupId == gid
                && request.resource.data.actor.userId == me()
                && request.resource.data.receivedAt == request.time
                && request.resource.data.schema == 1;       // + keys().hasOnly([...]) และตรวจชนิดข้อมูล
    allow update, delete: if false;
  }
}
match /{path=**}/members/{uid} { allow read: if signedIn() && resource.data.uid == me(); }
match /users/{uid}             { allow read, write: if signedIn() && uid == me(); }
match /invites/{code}          { allow read, write: if false; }      // Admin SDK ใน functions เท่านั้น
match /inviteAttempts/{uid}    { allow read, write: if false; }
}
}
```

E01-S08 ต้องมี test บน emulator ยืนยันว่า batch 500 event ที่ทุกตัวเรียก `isMember` ไม่ชนเพดาน 20 access call
(การ `exists` doc เดียวกันซ้ำนับครั้งเดียว — ต้องยืนยัน)

สองคนกดออกพร้อมกันตอนเหลือ 2 คน: commit บน `groups/{gid}` ทำทีละตัว ตัวที่สองเห็น `memberCount == 1` แล้ว
ถูกปฏิเสธ (E02-S04 ต้องมี test บน emulator)

### Storage rules

`groups/{gid}/media/{mediaId}`: อ่านและสร้างได้เมื่อ
`firestore.exists(/databases/(default)/documents/groups/$(gid)/members/$(request.auth.uid))` พร้อมเพดานขนาด
+ ชนิดไฟล์ (image/video/audio/pdf; ตัวเลขเพดานกำหนดใน E01-S12) `update, delete: if false` (การตรวจข้ามไป
Firestore นับเป็น Firestore read; ต้องให้สิทธิ์ Storage service agent อ่าน Firestore)

### ข้อมูลในเครื่อง

- SQLite/IndexedDB **ไม่เข้ารหัสระดับแอปใน MVP** — พึ่งการล็อกหน้าจอโทรศัพท์ (YAGNI) **เจ้าของรับทราบความเสี่ยง
  2026-10-03 (D-32)** รวมรูปเอกสารคนงาน; ทบทวนอีกครั้งก่อน E09
- ออกจากกลุ่ม → ลบสำเนาของกลุ่มนั้นหลัง outbox ว่าง (ACC-5) การสลับกลุ่มกรองด้วย `group_id` ทุก query

### สภาพแวดล้อมและความลับ

- dev/prod อยู่โปรเจกต์เดียว (D-34) ลิงก์ preview ต้องไม่แตะข้อมูล prod (NFR-5, D-22) กลไก: build
  dev/preview ตั้งค่าให้ใช้ Firestore database `dev` และ bucket ของ dev และมี test ใน E01-S07 ยืนยันว่า
  bundle dev/preview อ้างถึงเฉพาะ database `dev`
- **ความเสี่ยงที่เจ้าของรับแล้ว (2026-10-03)** (D-34): Auth ใช้ร่วม rules จึงแยก build prod กับ build preview ไม่ได้
  database `dev`/bucket ของ dev กันการพลาด แต่**ไม่ใช่ขอบเขตความปลอดภัย** — build preview ที่ถูกแก้ให้ชี้
  `(default)` อ่าน/เขียนข้อมูลจริงได้ด้วยสิทธิ์ของผู้ใช้ที่ login อยู่ ลดความเสี่ยง: preview build โดย CI ของ
  repo จาก branch ใน repo ของเจ้าของเท่านั้น (ต้องมีสิทธิ์ write) + test bundle ข้างบน; แยก 2 โปรเจกต์จึงปิด
  ความเสี่ยงนี้
- Auth ใช้ร่วมกัน: บัญชีที่ login ใน preview เป็นบัญชีเดียวกับ prod — ยอมรับใน MVP (ผู้ใช้มีแค่เจ้าของ)
- config ของ Firebase web app ไม่ใช่ความลับ ความปลอดภัยอยู่ที่ rules credential สำหรับ deploy 1 ชุด (โปรเจกต์เดียว)
  เก็บใน GitHub secrets ห้ามมี service-account key ใน repo
- ใครมีบัญชี Google ก็สร้างกลุ่มของตัวเองได้ (เปลือง write เล็กน้อย) แต่อ่านกลุ่มคนอื่นไม่ได้ budget alert เป็น
  ตาข่ายรองรับ (D-1) App Check ยังไม่ทำ (YAGNI) พิจารณาเมื่อมีการใช้ผิดจริง

### Dependency gate (CLAUDE.md) ที่การออกแบบนี้ต้องใช้ — ขออนุมัติแยกทีละตัวพร้อมผลตรวจ

`firebase` JS SDK (E01-S08) · แหล่ง CSPRNG บน native (E01-S02 — **ติดตั้งแล้ว** `expo-crypto`) · Google sign-in บน Android + auth persistence
บน RN และ `expo-dev-client` (E01-S06, E02-S01) · `@firebase/rules-unit-testing` (dev) · `firebase-tools` (CI) ·
`firebase-functions` / `firebase-admin` (`functions/`, E02-S03) · `fake-indexeddb` (dev — **ติดตั้งแล้ว** 6.2.5, เจ้าของอนุมัติ D3 2026-10-03; audit ก่อน/หลังเท่ากัน 67) · lib ไฟล์
บน native สำหรับสื่อ (E01-S12) ต้องทำ baseline ของ `npm audit` ใหม่หลังติดตั้ง `firebase`

**audit ปัจจุบัน (2026-10-03, dev หลัง #33)**: 67 รายการ (13 moderate, 54 high, 0 critical) — เพิ่มจาก 22 โดย PR
อื่นใน dev ก่อนการติดตั้ง `fake-indexeddb` (ซึ่งไม่เพิ่มรายการใด) ต้องจัดหมวด advisory ใหม่ (งานของทีม CI) — ย่อหน้าถัดไป
เป็น **baseline เดิมที่ล้าสมัยแล้ว**: `npm audit` รายงาน 22 รายการ รวมเป็น **3 advisory** — `image-size` สองตัว (DoS ใน
parser) และ `uuid` หนึ่งตัว (buffer bounds) ทั้งหมดเข้ามาผ่าน build tooling ของ Expo (`@expo/config-plugins`,
`@expo/prebuild-config`) ไม่มีตัวไหนถูกเรียกตอนรันบนเครื่อง และ `npm audit fix --force` จะ downgrade Expo
ตรวจใหม่เมื่ออัปเดต SDK

## Testing

Three tiers, split by what each can actually see.

| Tier | Runner | Owns | Why not elsewhere |
|---|---|---|---|
| Logic | Vitest | `src/core/**` | No RN imports, so no Babel/Metro transform. Sub-second. Running it under jest-expo would drag `transformIgnorePatterns` into the tightest feedback loop in the project. |
| Component | jest-expo + RNTL | Hold timing with fake timers, gates, panels | Cannot see pixels, so it asserts no layout. |
| Browser | Playwright | Build boots; numeral geometry; real pointer holds; persistence across reload; screenshots | The only tier exercising the react-native-web pointer path and real measurement. |

Playwright runs against `expo export` output served statically, **not** the dev
server: a bundling failure then exits non-zero before a browser opens, instead
of becoming a blank screenshot.

**No pixel-diff screenshot comparison.** Font rendering differs between macOS
and CI's Linux runner; the golden-file churn would cost more than it catches.
Screenshots are evidence for a human, plus computed geometry assertions.

### Deliberate test seams

Both are web-only and documented where they are read:

- `?holdMs=` — shortens the 3s hold. Below ~100ms the press window becomes
  comparable to React's render-and-dispatch latency and holds start missing
  their own timer, so 400ms is the working value and 120ms the floor.
- `?baskets=` — seeds the demo sale at a given size, so the three-digit layout
  assertion does not need 58 UI interactions to set up.

## Deployment / environments

Two long-lived branches, two environments with separate domains: `dev`
(default branch, daily-use MVP environment) and `main` (production). Release
flow is in `docs/process.md` ("Branches and releases"). **Hosting is Firebase Hosting**
(**one project** on Blaze — PRD D-34, ADR 0001 amendment 2: the `dev` site
and PR preview channels with 7-day expiry use the named Firestore database
`dev` and a dev Storage bucket over test data; the `prod` site uses the
`(default)` database and the default bucket over real data; build config (not rules)
keeps dev/preview builds off prod data — a mistake guard, not a security
boundary (§Security); Auth and the budget alert are shared;
split into two projects before commercial launch) — see `docs/adr/0001-firebase-hosting.md`. The sites, deploy
script and workflows are **wired** (ADR 0001, "What was built"): a push to `dev`
deploys the dev site, each same-repo PR gets a preview channel, and CI
authenticates keylessly (GitHub OIDC to a Google service account, no stored
key). **Not yet done:** the `dev` Firestore database and bucket, custom domains,
the two GitHub repo variables, and a first Deploy Prod run. Locally,
`npm run build:web` produces a static `dist/`. No native build has
been produced and no device has run this yet — **the app has only ever been
exercised in a browser.**

## Open and undecided

1. **Native has never been run.** expo-sqlite's adapter is written and typed but
   unexercised; the first `expo run:android` may find things.
2. **Thai speech (FR-11) is not implemented** — `expo-speech` is outside the
   authorized dependency list. The `Speaker` port it needs is not written yet
   either.
3. **Haptics for F-7** likewise. Rejection is currently colour + shape + text,
   which satisfies the finding but is weaker one-handed.
4. **Sync, conflict resolution, multi-tenancy** — designed in §Sync engine / §Security (E01-S01), not built. RBAC beyond `role: 'owner'` is post-MVP.
5. **Battery cost** of white-at-full-brightness in the field (F-15) is
   unmeasured.
