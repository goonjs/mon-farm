# Story: v2 splash and home as drawn

Status: In Progress

## Context

- Epic: `docs/epics/` E03 (farm master data) and the v2 shell (D-82, D-83)
- Related PRD section(s): D-3 (offline-first), D-65, D-70, D-74 F5/F11/F12, D-83
- Related architecture section(s): `docs/ui-v2.md` (components, route map)
- Mockups: `docs/ux/mockups/flow-v1.html` section 1 (screen 1 เข้าสู่ระบบ,
  screen 3 หน้าแรก) and `docs/ux/mockups/flow-farm-v1.1.0.html` section 1
  (screen 1 เมนู ☰) and screen 25 (หน้าแรก ส่วนล่าง). Where they differ,
  v1.1.0 wins.
- Owner priority 2026-10-10: splash → home → sell. The owner said the home
  did not look like the design yet.

## Description

The splash and the v2 home are rebuilt to look like the mockups, using only
`src/ui` and the tokens. The home shows live figures where the logic already
exists, and a tidy empty state where it does not. Selling is the prominent
entry. Two small fixes ride along: the people screens no longer show the
"ผู้จ่าย" role, and the drawer label "สวนและโซน" becomes "สวนและจุดชั่ง".

## Acceptance criteria

Splash (`/`, flow-v1 screen 1):

- [x] The FarmMate mark (112 px: sun, two leaves, hill), the word "FarmMate"
      (38 px, weight 800, tight tracking) and the tagline "แอปบริหารสวนยาง" in
      soft ink, centred, 12 px apart.
- [x] It still replaces itself with `/v2` after under a second, so Back never
      returns to it, and a deep link such as `/v2/farm` opens with no splash
      or home first.
- [x] Not shown: the Google sign-in button and the "ครั้งแรกต้องต่ออินเทอร์เน็ต"
      banner (E02 sign-in is not built).

Home (`/v2`, flow-v1 screen 3 + v1.1.0 screens 1 and 25), top to bottom:

- [x] Header: ☰, the title with today's date under it ("ส. 3 ต.ค. 2569"
      style, the device's era), and the sync pill.
- [x] Cover: the drawn rubber-farm scene (sun, hills, trees) in a rounded
      card, 148 px high.
- [x] Three action cards in a row: เตรียมขาย · **เริ่มการขาย** (main, thick
      action edge) · บันทึกค่าใช้จ่าย, each an icon tile over the word.
      เริ่มการขาย opens `/v2/sale/start`; บันทึกค่าใช้จ่าย opens a new expense;
      เตรียมขาย opens a placeholder.
- [x] "ควรรู้ / ควรจัดการ" with "สำคัญก่อน" beside it: one card of rows that
      appear only when they apply, most urgent first:
  - the unfinished sale, when there is one (date · kg; chip "กำลังชั่ง"
    while a pile is being counted, else "เปิดอยู่") → `/v2/sales`. flow-v1
    screen 3 lists "การขายที่ยังไม่ปิด" among the rows that appear "มีเมื่อเกิดขึ้น";
  - and the latest finished sale (date · kg, chip "ปิดแล้ว") → `/v2/sales`,
    the mockup's "การขายล่าสุด" row. Both show when both exist;
  - money the farm owes back (total in บาท and who) → `/v2/owed`.
  With none of these, the card says so in one line.
- [x] Under the card, "ดูการขายทั้งหมด" links to the sale list `/v2/sales`.
- [x] "ไปที่": the module grid in v1.1.0 order — รายงานการขายย้อนหลัง ·
      พยากรณ์อากาศ (เปิดภายนอก) · รายการที่ต้องจ่าย (wide, total in บาท) ·
      ค่าใช้จ่ายทั้งหมด · รายการ stock · ข้อมูลคนงาน (wide, number of
      คนกรีดยาง). ข้อมูลคนงาน opens คน filtered to คนกรีดยาง (v1.1.0 screen 26).
      Modules with no screen yet open a "กำลังสร้าง" placeholder.
- [x] ☰ menu (v1.1.0 screen 1): "ของกลุ่ม · ทุกเครื่องเห็นเหมือนกัน" with
      ข้อมูลฟาร์ม (facts: สวนและจุดชั่ง · คน · คนรับซื้อยาง · บัญชีรับเงิน ·
      ตั้งค่าวันขาย) and ค่าใช้จ่ายทั้งหมด; "เฉพาะเครื่องนี้ · ไม่ส่งไปเครื่องอื่น"
      with เครื่องนี้ (facts: ขนาดตัวอักษร · เวลากดค้าง · เสียง). Every farm
      section stays reachable from the home or the menu.
- [x] Every string comes from `src/i18n/messages.ts` with an English entry.

People and drawer fixes:

- [x] The people list, its role filters and the person form no longer offer
      or show the "ผู้จ่าย" role. The data model keeps the role: a person who
      has it keeps it on save, it just isn't shown. MONEY's expense payer
      field is untouched.
- [x] The drawer and section title `v2.farms` reads "สวนและจุดชั่ง"
      ("Farms and weighing points").

## Offline / sync behavior

Read-only screen over the local event log: sales (`store`), farm master data
(`peopleStore`) and finance (`financeStore`), all local, so the home works the
same offline. It writes nothing. Figures refresh when the screen regains
focus. The sync pill and the conflict row read the same local sync status.

## Test plan

_Tests below are written to fail first (TDD), then implemented to green._

- [x] Unit (jest): splash look and hand-over; home order, copy, links, live
      rows and the empty state; drawer rows; people screens without ผู้จ่าย.
- [x] Unit (vitest): the home's pure summaries (open/latest sale, owed).
- [x] e2e: `/` → splash → home offline, with seeded data, then a reload;
      the deep-link test stays green.

## Verification

- [x] Sandbox run performed: web build (`npm run build:web`) in Playwright at 412×915, full e2e green.
- [x] Screenshots — splash, home (empty and with data), menu, and
      mockup-vs-build pairs in `docs/ux/screenshots/ui-v2/home/`.

## Dev notes

Not as drawn (no data or feature yet): the farm group name in the header
(E02 groups — the title is "หน้าแรก"); the "เปลี่ยนรูปปก" button and a picked
cover photo (Cloud Storage); the cover's slow motion; the group block and
"สลับกลุ่ม" in the menu (E02); "งานถึงกำหนด" rows (E08 tasks); the
พยากรณ์อากาศ target (open question ?23); เตรียมขาย has no screen yet (?22),
so it opens a "กำลังสร้าง" placeholder like the other unbuilt modules.

The open and latest sale rows go to `/v2/sales`, still the placeholder list
with links to the sale steps: there is no way yet to resume the unfinished
sale from home. That comes with the sale screens (separate builder).

The header date is read again when home regains focus and when the app
comes back to the front, so it never shows yesterday.

The ผู้จ่าย role (owner 2026-10-10) is hidden in the people list, its
filters, the detail and the form only. `BUILTIN_ROLES` and the stored roles
are unchanged; a person who has it keeps it on save. MONEY's PayerPicker
"+ คนอื่น" still adds people with that role, so they show with no role line.
On the form, such a payer-only person has no role ticked, yet saving passes
(the hidden role still counts) and the role cannot be taken off there.

The menu keeps จุดชั่ง, ส่วนแบ่ง, บัญชีหนี้, การขายทั้งหมด and ซิงก์ under the
mockup rows: those built lists are reachable from nowhere else yet.

The header keeps the shared `ScreenHeader` (20 bold with a hairline; the
mockup appbar is 18 semibold, no rule) — changing it touches every screen.

## Code review

- Reviewer (separate agent/session): independent review of b1a54a5..1bc7cd3
- Findings: `?filter=` lost on a direct load; header date went stale; the
  sale-row AC disagreed with code; the mockup-vs-build e2e ran in CI; the
  e2e did not prove the tapper filter; nits (separator, chip word, links,
  icons, splash hill, seeded dates).
- Resolution: all should-fix items and the listed nits fixed with tests;
  the reload-every-sale-log on focus (same as `use-live-sales`) left as is.

## QA notes
