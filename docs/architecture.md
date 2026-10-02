# Architecture / SDD — mon-farm

> Status: **Draft v0.1**, authored 2026-08-10 alongside epic 1. Records what was
> actually built and why. Pending owner review — the decisions here were made to
> unblock implementation, not agreed in advance, so treat every one as a
> proposal with its reasoning attached rather than as settled.

## System overview

A single-device, offline-first app for running one rubber sale end to end. All
state is an **append-only event log**; every entity, status and total in the
app is a projection of that log. There is no backend yet, and nothing is sent
anywhere.

```
┌────────────── src/app (expo-router) ──────────────┐
│  index.tsx  counter  ·  settlement.tsx            │
└───────────────────┬───────────────────────────────┘
                    │ useSale()
┌───────────────────▼───────────────────────────────┐
│  SaleProvider — the ONE write path                │
│    events[]  +  append()  +  memoised projection  │
└───────────────────┬───────────────────────────────┘
        ┌───────────┴────────────┐
        ▼                        ▼
┌───────────────┐      ┌──────────────────────────┐
│  src/core     │      │  EventStore (port)       │
│  pure, no RN  │      │   .native → expo-sqlite  │
│  project()    │      │   .web    → localStorage │
│  totals()     │      └──────────────────────────┘
│  settle()     │
└───────────────┘
```

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

**Platform target**: phone, **landscape locked** (`app.json`), Android and iOS.
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

**One table.** No piles table, no zones table, no totals column.

```sql
CREATE TABLE events (
  sale_id TEXT, seq INTEGER, ts INTEGER, mono INTEGER,
  kind TEXT, payload TEXT, actor TEXT, synced_at INTEGER,
  PRIMARY KEY (sale_id, seq)
);
CREATE INDEX events_pending ON events(synced_at) WHERE synced_at IS NULL;
```

One table means no migration surface, and no way for a cached total to disagree
with the log — which is the failure NFR-3 exists to prevent.

### expo-sqlite over AsyncStorage, on native

| | AsyncStorage | expo-sqlite |
|---|---|---|
| Write per basket | re-serialise and rewrite the **whole** log | one `INSERT` |
| Force-quit mid-write | a torn blob can lose **the entire sale** | loses at most the row in flight; WAL protects the rest |
| Duplicate `seq` | a JS-only invariant | `PRIMARY KEY` violation, enforced by the engine |
| Outbox query | manual bookkeeping | `WHERE synced_at IS NULL`, free |

Row 2 decides it. NFR-1 requires counts to survive force quit and calls a lost
count "money lost and trust lost"; a whole-blob rewrite per basket is precisely
the write pattern that loses a sale.

### localStorage on web, deliberately

Metro resolves `store.native.ts` / `store.web.ts` by filename. The web adapter
uses `localStorage` and accepts the same write amplification criticised above.

That is not an oversight. **The web build is the verification surface, not the
field surface** — it needs to survive a reload so Playwright can prove
persistence, and it needs to be impossible to break in a way that blocks the
build. `expo-sqlite` does ship a web implementation, but it is the
least-travelled path in the stack and can require cross-origin isolation
headers. Keeping it off web entirely means a failure there blocks nothing.

**Do not "simplify" this to one adapter.** The cost is ~60 lines.

## Sync engine

**Not built.** The shape is prepared and nothing more:

- Every row carries `synced_at`; `store.pending()` is the outbox query.
- Events are immutable and totally ordered per sale, so a future sync is an
  append of missing events rather than a merge — which is what makes NFR-2's
  "never silently overwrite a count" achievable later.
- Conflict resolution, retry and backoff are **undesigned**.

## Backend API

None. Out of scope for epic 1.

## Security

- No network, no credentials, no auth. One device, one operator.
- **Dependency audit** (CLAUDE.md gate): `npm audit` reports 22 findings that
  resolve to **3 distinct advisories** — two `image-size` DoS parsers and one
  `uuid` buffer bounds check. All reach the tree through Expo's own build
  tooling (`@expo/config-plugins`, `@expo/prebuild-config`), none are reachable
  at runtime on device, and `npm audit fix --force` would downgrade Expo itself.
  Re-check when the SDK updates.

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
(one project, a `dev` site and a `prod` site, PR preview channels with 7-day
expiry) — see `docs/adr/0001-firebase-hosting.md`. It is decided but **not
wired yet**: `scripts/deploy.sh` fails closed until the project, domains and
deploy credential exist. Locally,
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
4. **Sync, conflict resolution, multi-tenancy, RBAC** — all undesigned.
5. **Battery cost** of white-at-full-brightness in the field (F-15) is
   unmeasured.
