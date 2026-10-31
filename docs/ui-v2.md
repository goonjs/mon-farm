# UI v2: design system and shell (D-82)

**D-83: v2 is the app.** The v1 UI (old routes, `src/components`, their
tests and e2e specs) was removed on 2026-10-10. `/` is a short splash that
replaces itself with the v2 home at `/v2`; farm settings are built, the other
sections are still "กำลังสร้าง" placeholders.

Each screen is rebuilt from the v1.1.0 mockups
(`docs/ux/mockups/flow-farm-v1.1.0.html`, `flow-sale-v1.1.0.html`) using only
the components in `src/ui/`. The new screens reuse logic only: `src/core`, the
event-log stores in `src/store`, `src/sync`, the i18n strings, and the tokens
through `src/theme`.

## Import rule

`src/ui/**`, `src/v2/**` and `src/app/v2/**` must not reach old UI:
`src/components/**`, `src/constants/theme.ts`, the template hooks
`src/hooks/use-theme.ts` and `use-color-scheme(.web).ts`, or any screen in
`src/app/**` outside `src/app/v2/**`. The `import/no-restricted-paths` rule in
`eslint.config.js` enforces this. It matches the **resolved** path, so it
catches relative and `@/` imports, `export … from`, `require()` and dynamic
`import()`. A folder that is only named `components`, such as a future
`src/ui/components`, is not blocked. `scripts/ui-import-rule.test.ts` lints one
fixture for each kind of violation, plus the allowed imports. Screens import
components from `src/ui` (the `index.ts`) and nowhere else.
Colours come from `theme.color.<role>` only; `scripts/no-raw-colour.test.ts`
fails on any hex, `rgb()` or `hsl()` value in `src/`, in any letter case.

## Components (`import { … } from '../ui'`)

The index exports the requested set only: the components the shell and the
placeholders use, plus the ones the FARM and MONEY teams asked for (review S7).
Other files stay internal until a screen needs them: `top-bar.tsx` (the thin
counter bar), `Num` in `type.tsx`, and `FieldLabel`/`FieldError` in `form.tsx`.

| Component | File | Props (main) |
|---|---|---|
| `ScreenHeader` | `src/ui/screen-header.tsx` | `title`, `subtitle?`, `back?: {label, href? \| onPress?, testID?}`, `menu?: {onPress}`, `sync?: SyncStatus \| null`, `right?`, `action?: {label, onPress?, testID?, disabled?, saving?, savingLabel?}` (the Save pill, right of the sync pill) |
| `SyncPill` | `src/ui/sync-pill.tsx` | `status: SyncStatus` (shape + word + colour) |
| `Drawer`, `MenuSection`, `MenuItem` | `src/ui/drawer.tsx` | Drawer `open`, `onClose`; MenuSection `title`; MenuItem `label`, `leading?` (an `IconTile`), `trailing?` (a badge before the chevron), `detail?` or children (one `FactRow` per fact, D-70), `href?`, `onPress?`, `testID?` |
| `ActionTile` | `src/ui/action-tile.tsx` | `label`, `icon`, `tone?`, `main?` (thick action edge), `href?` \| `onPress?`, `testID?`. The home's three action cards; lay them in a row |
| icons | `src/ui/icons.tsx` | `color`, `size?`. ChevronLeft/Right, MenuIcon, Plus, Minus, Check, Undo, Scale, MoneyIn/Out, Person, Calendar, Receipt, Debt, Bank, Farm, ScaleIcon; farm set (D-83): PinIcon, TagIcon, TrashIcon, GearIcon, PercentIcon, SwapIcon; home set: ListIcon, BasketIcon, BoxIcon, ChartIcon, ClockIcon, DeviceIcon, SpeakerIcon, UsersIcon, WalletIcon, WeatherIcon |
| `IconTile`, `FactRow` | `src/ui/icon-tile.tsx` | IconTile `icon: (colour) => node`, `tone?` (`accept`, `action` = mockup t-blue, `cream` = t-cream, `warn`, `neutral`, `category1`–`6`), `size?: regular \| sm` (48 / 36, mockup `.tile.sm`); FactRow `icon?`, children |
| `Button`, `CTA`, `PinnedActions` | `src/ui/button.tsx` | `variant?: primary \| ghost \| destructive \| row`, `size?: regular \| large`, `icon?`, `disabled?`, `onPress?`; CTA = primary + large |
| `SegmentedControl`, `RadioCard` | `src/ui/form.tsx` | Segmented `options`, `value`, `onChange`, `testID` (radiogroup of radios); RadioCard `selected`, `title`, `detail?`, `onPress`, `disabled?` |
| `TextField` | `src/ui/text-field.tsx` | `label`, `required?` (red *), `hint?` (soft note beside the label), `helper?`, `error?`, `aside?` (unit or "ไม่ทราบ" beside the input), `testID`, plus TextInput props |
| `FieldError` | `src/ui/form.tsx` | inline red error with a diamond; `testID?` |
| `BottomSheet` | `src/ui/bottom-sheet.tsx` | `open`, `onClose`, `title?`, `action?` (same Save pill, in the title row), `testID?` |
| `Card`, `CardLabel`, `cardStyle` | `src/ui/card.tsx` | Card `style?`, `testID?` |
| `Chip` | `src/ui/chip.tsx` | `label`, `tone?: accept \| warn \| reject \| neutral` (drawn icon + word) |
| `MoneyText` | `src/ui/money-text.tsx` | `amount` (preformatted, no sign), `direction: in \| out`, `word?`, `size?` |
| `DateText` | `src/ui/date-text.tsx` | `value: string \| Date`, `format?: (date, locale) => string` |
| `AppText`, `typeStyle` | `src/ui/type.tsx` | `variant?: display \| title \| heading \| body \| bodySm \| label \| caption` |

Rules every component follows:

- Thai text is set in the sans family. No Thai label uses the monospace family.
- No text glyphs (✓ ✗ ⚖ ◐ ◑ ▸ ↺ ← ›). Icons are drawn.
- Status is never shown by colour alone. Each status also has a shape or icon,
  plus a word or sign.
- Touch targets are at least 48pt.
- `Drawer` and `BottomSheet` are modal. They sit in a transparent RN `Modal`,
  which moves focus inside and hides the content behind them. The Android back
  button and web Escape close them.

**Sync pill count (review S8).** The number N in "รอส่ง N" counts the raw
pending events in the local log, not records or sales. The owner has not yet
decided what N should mean. Until then the count stays as it is.

## Route map

`/` (`src/app/index.tsx`, `src/v2/splash-screen.tsx`) shows the FarmMate
mark, name and tagline (flow-v1 screen 1 sizes) for under a second, then `router.replace('/v2')`, so
Back never returns to it. Deep links are their own static pages and open
directly with no splash or home first (e2e-checked). Each placeholder shows a
`ScreenHeader` (back button and sync pill) and a "กำลังสร้าง" card. The table lives in
`src/v2/routes.ts`. A real screen gets its own static route file, which takes
precedence over the dynamic one.

| Path | Screen |
|---|---|
| `/v2` | Home as drawn (flow-v1 screen 3, farm v1.1.0 screens 1 and 25): cover, three actions, ควรรู้ / ควรจัดการ (open sale, latest sale, money owed back — only when they apply), ดูการขายทั้งหมด, the ไปที่ grid, and the ☰ menu. Story `docs/stories/e03-v2-splash-home.md` |
| `/` | Splash, then `/v2` |
| `/v2/farm` | ข้อมูลฟาร์ม hub (mockup 2). Built |
| `/v2/people`, `/v2/person/<id\|new>` (`?edit=1`) | คน: list, form, detail, delete (mockup 4–7). Built |
| `/v2/buyers` | คนรับซื้อยาง, form in a sheet (mockup 8). Built |
| `/v2/accounts` | บัญชีรับเงิน (placeholder; MONEY) |
| `/v2/farms`, `/v2/property/<id\|new>` (`?edit=1`) | สวนและจุดชั่ง: list, form, detail with area history, delete (mockup 9–12). Built |
| `/v2/points`, `/v2/point/<id\|new>` (`?property=`, `?edit=1`, `?plan=1`) | จุดชั่ง: all points, add + offer to assign, detail, tapper plan (mockup 14–16). Built |
| `/v2/points-wizard` | ตัวช่วยตั้งค่าจุดชั่ง (mockup 13, 13b). Built. Always offered from สวนและจุดชั่ง and จุดชั่ง (not only when empty); can be run again on a farm that has points, which it lists, and a name already used in that farm is refused. While sync is running the helper waits for this device's first pull before it creates points (E01-S09, decision 2026-10-10, was `showStarterButton`), or two offline phones can both create "จุด 1"; a build without sync is not held |
| `/v2/shares`, `/v2/share/<tapperId>` | ส่วนแบ่ง (mockup 17). Built |
| `/v2/sale-settings` | ตั้งค่าวันขาย (mockup 3). Built |
| `/v2/expenses` | ค่าใช้จ่ายทั้งหมด |
| `/v2/debts` | บัญชีหนี้ |
| `/v2/device` | เครื่องนี้: theme, hold time, spoken count, date era, language (device-only). Built |
| `/v2/sales` | การขายทั้งหมด (sale mockup 4). Built |
| `/v2/sync` | ซิงก์และข้อมูลขัดกัน |
| `/v2/sale/start` | เริ่มการขาย (sale mockup 5). Built — mints the sale id, writes on ถัดไป |
| `/v2/sale/<id>/point` (`?mode=switch\|backfill`, `?farm=`, `?tapper=`, `?pair=`) | เลือกจุดชั่ง / เปลี่ยนจุด / first steps of บันทึกย้อนหลัง (6, 12). Built |
| `/v2/sale/<id>/zero-tare?point=` | ก่อนชั่ง, wait for a scale, accept a skew, move check (7, 7a–7c, 8c). Built |
| `/v2/sale/<id>/counter?point=` (`?fill=full\|part`) | นับเข่ง (8, 8a, 8b, 11, 13, 12b). Built |
| `/v2/sale/<id>/partial?point=` | นับเข่ง with the short-basket sheet open (10). Built |
| `/v2/sale/<id>/public?point=` | โหมดสาธารณะ (9). Built |
| `/v2/sale/<id>/backfill?point=` | บันทึกย้อนหลัง (14). Built |
| `/v2/sale/<id>/check` | ตรวจยอดกับคนรับซื้อยาง (16). Built |
| `/v2/sale/<id>/settlement` | สรุปจ่ายเงิน: หนี้, สวนค้างจ่าย, การ์ดคนกรีด, แถบตรวจยอด (E05-S11; replaced 17, 17a, 18a). Built |
| `/v2/sale/<id>/cash` | จัดเงินสดกับคนรับซื้อยาง: ทางรับเงินคืนหนี้ + ปัดเศษ (E05-S11 CO-19; replaced 18). Built |
| `/v2/sale/<id>/buyer-view` | ให้คนรับซื้อดู (E05-S11 CO-20). Built |
| `/v2/sale/<id>/payment` | จ่ายเงิน · ปิดการขาย (E05-S11 CO-10; replaced 19). Built |
| `/v2/sale/<id>/show-account` | ให้คนรับซื้อยางดูบัญชี (17b, 17c). Built |
| `/v2/prepare`, `/v2/reports`, `/v2/weather`, `/v2/payables`, `/v2/stock` | Home actions and modules with no screen yet: เตรียมขาย, รายงานการขายย้อนหลัง, พยากรณ์อากาศ, รายการที่ต้องจ่าย, รายการ stock (placeholders) |
| `/v2/sale/<step>` | old reserved sale-step addresses: redirect to `/v2/sales` |

Files: `src/app/v2/_layout.tsx`, `index.tsx`, one file per built screen,
`[section].tsx` for the placeholders (`BUILT_SECTIONS` in `src/v2/routes.ts`
keeps them apart). `sale/[step].tsx` now only sends an old sale-step address to the sale list (the placeholders are gone; the file waits on the owner for removal). The home opens the real sale screens: เริ่มการขาย → `/v2/sale/start`, the open sale → its counter (or the picker), the latest sale → its payment, ดูการขายทั้งหมด → `/v2/sales` (`SALE_START`, `saleHref` in `src/v2/routes.ts`). Farm screens are in `src/v2/farm/`;
they read and write farm master data through `peopleStore` (`MasterStore`
over the local event log), so all of it works offline and survives a reload.
Dynamic routes render a neutral shell while hydrating (`useMounted`) so the
exported `[id]` page never mismatches (React error 418). Screen code is in `src/v2/`. `generateStaticParams`
pre-renders one page per slug for the static web export. The local
`scripts/serve-dist.mjs` serves the home at `/v2/` (with the trailing slash).

Screenshots at 390×844, light and dark: `docs/ux/screenshots/ui-v2/`.

## Sign-in and farm group (e02-v2-login-groups)

`AccountGate` (`src/v2/account/`) wraps the whole route tree in
`src/app/_layout.tsx`, so no route renders before it has read the device's
stored account (only the mark shows meanwhile). Three screens, flow-v1
screens 1 and 2 and `docs/ux/flows/e02-access-and-sync-states.md` §2–3:

| State | Screen |
|---|---|
| No stored user | `SignInScreen` (`testID signin`): mark, name, the first-sign-in-needs-internet note, the Google button. No skip, no offline mode, no sign-out (D-23) |
| User, no group of theirs | `GroupStartScreen` (`group-start`): a required name and สร้างกลุ่มฟาร์ม; เข้าร่วมด้วยรหัสเชิญ is shown but disabled until E02-S03 |
| User and one group | the app, straight in: splash → `/v2`. No picker (ACC-3) |

The signed-in user and the open group are set in `src/store/session.ts` before
the app renders. Every write path stamps `actor.userId` and `groupId` from there
in the one function each store writes through: `stamp`/`writerNow`
(`record.ts`: sale events and soft delete), `MasterStore.append` (people, farm
data, sale settings), `writeFinance` (finance log). No screen passes a
`groupId`. The farm profile (`farm.*.ts`) is device configuration, not events,
and is not group-scoped yet. An append with no group or no user throws and
stores nothing, and both event stores refuse a groupless event as well.

The sign-in and group screens are shown in light only: the app has no way to
switch to dark yet (`ThemeProvider initial="light"`), and the screens use
colour roles only. Screenshots: `docs/ux/screenshots/ui-v2/account/`. e2e specs
start from a preloaded signed-in device (`e2e/session.ts`); real Google sign-in
is only tried by hand on the dev and preview sites.

## Splash and home (e03-v2-splash-home)

Built against `docs/ux/mockups/flow-v1.html` section 1 (screens 1 and 3) and
`flow-farm-v1.1.0.html` screens 1 and 25. e2e `e2e/v2-home.spec.ts` (empty,
then seeded sales, people and money, read offline; the selling entries) also
writes mockup-vs-build pairs (that test runs only with
`UPDATE_SCREENSHOTS=1`, so a mockup edit never fails CI). Screenshots, 412×915, in
`docs/ux/screenshots/ui-v2/home/` (same `UPDATE_SCREENSHOTS=1` rule as below).

Not as drawn yet: the farm group name as the header title and the menu's
group block with สลับกลุ่ม (E02-S04); "เปลี่ยนรูปปก", a picked cover photo and the cover's slow
motion; the rubber cups on the cover trees; "งานถึงกำหนด" rows (E08); the
header keeps the shared ScreenHeader (title 20 bold with a hairline, the
mockup appbar is 18 semibold without one). The menu lists จุดชั่ง, ส่วนแบ่ง,
บัญชีหนี้, การขายทั้งหมด and ซิงก์ under the mockup rows, so every built list
stays reachable.

| | |
|---|---|
| Splash | ![](ux/screenshots/ui-v2/home/00-splash.png) |
| Home, empty | ![](ux/screenshots/ui-v2/home/01-home-empty.png) |
| ☰ menu | ![](ux/screenshots/ui-v2/home/02-menu.png) |
| Home, live rows | ![](ux/screenshots/ui-v2/home/03-home-live.png) |
| Mockup vs build: splash | ![](ux/screenshots/ui-v2/home/cmp-splash.png) |
| Mockup vs build: home (flow-v1) | ![](ux/screenshots/ui-v2/home/cmp-home-v1.png) |
| Mockup vs build: home (v1.1.0 screen 25) | ![](ux/screenshots/ui-v2/home/cmp-home-v110.png) |
| Mockup vs build: ☰ menu (v1.1.0 screen 1) | ![](ux/screenshots/ui-v2/home/cmp-menu-v110.png) |

## Farm settings (D-83)

Built against `docs/ux/mockups/flow-farm-v1.1.0.html` sections 1–6 and 10.
Tests: `src/__tests__/v2-farm-*.test.tsx`; e2e `e2e/v2-farm.spec.ts` (offline
add/edit of every kind, reload) and `e2e/v2-store.spec.ts` (IndexedDB, no
storage warning, two tabs, v0.4 keys).

**Save is in the header (owner 2026-10-10).** The on-screen keyboard covered
a bottom Save, so every form puts it top right, with the sync pill on its
left, through `ScreenHeader`'s `action` (disabled, and "กำลังบันทึก" while a
write is in flight). This covers the farm forms (person, farm, point, share),
the wizard's "สร้าง", the money forms (expense, repay, debt add and pay) and,
through `BottomSheet`'s `action`, the sheets that are forms (buyer, new area,
tapper plan, scale pair). Delete and other secondary actions, and the "add"
buttons on lists, stay pinned at the bottom. The sale screens are not changed
here.

Roles (owner 2026-10-10): the people screens neither show nor offer
ผู้จ่าย. The role stays in the data model and is kept on save; who paid is
recorded on each expense (MONEY). A person added from the expense form's
"+ คนอื่น" still gets it, so they show with no role line.

Not as drawn yet: GPS is typed as "lat, lng" (no location or map picker
installed); the durian lease file upload (needs Cloud Storage); a buyer's
"ขายล่าสุด" date and the per-row "ขัดกัน" chip (no sales or conflict detection
on v2 yet); the group name under the header (no groups, E02); text size on
เครื่องนี้ (the v2 theme has no text scale yet).

Screenshots, 412×915 (`docs/ux/screenshots/ui-v2/farm/`), written by the e2e
run only when asked, so an ordinary run (CI, `npm run verify`) never rewrites
these tracked PNGs; without the flag they go to `e2e/.results/` (ignored).
To refresh them after a visible change, rebuild and run:

```sh
npm run build:web && UPDATE_SCREENSHOTS=1 npx playwright test --project=phone-portrait
```

The same flag covers `docs/ux/screenshots/v2/money/` (`e2e/v2-money.spec.ts`).


| | |
|---|---|
| Splash | ![](ux/screenshots/ui-v2/farm/00-splash.png) |
| Home | ![](ux/screenshots/ui-v2/farm/01-home.png) |
| ข้อมูลฟาร์ม | ![](ux/screenshots/ui-v2/farm/02-farm-hub.png) |
| คน | ![](ux/screenshots/ui-v2/farm/03-people.png) |
| เพิ่มคน | ![](ux/screenshots/ui-v2/farm/04-person-form.png) |
| คน — detail | ![](ux/screenshots/ui-v2/farm/05-person.png) |
| ลบคน | ![](ux/screenshots/ui-v2/farm/05b-person-delete.png) |
| คนรับซื้อยาง | ![](ux/screenshots/ui-v2/farm/06-buyers.png) |
| คนรับซื้อยาง — form | ![](ux/screenshots/ui-v2/farm/07-buyer-form.png) |
| สวนและจุดชั่ง | ![](ux/screenshots/ui-v2/farm/08-farms.png) |
| เพิ่มสวน | ![](ux/screenshots/ui-v2/farm/09-farm-form.png) |
| สวน — detail | ![](ux/screenshots/ui-v2/farm/10-farm.png) |
| จุดชั่งทั้งหมด | ![](ux/screenshots/ui-v2/farm/11-points.png) |
| ตัวช่วยตั้งค่าจุดชั่ง | ![](ux/screenshots/ui-v2/farm/12-points-wizard.png) ![](ux/screenshots/ui-v2/farm/13-points-wizard-names.png) |
| เพิ่มจุดชั่ง | ![](ux/screenshots/ui-v2/farm/14-point-form.png) |
| จุดชั่ง — detail | ![](ux/screenshots/ui-v2/farm/15-point.png) |
| วางแผนเปลี่ยนคนกรีดยาง | ![](ux/screenshots/ui-v2/farm/16-point-plan.png) |
| ส่วนแบ่ง | ![](ux/screenshots/ui-v2/farm/17-shares.png) ![](ux/screenshots/ui-v2/farm/18-share.png) |
| ตั้งค่าวันขาย | ![](ux/screenshots/ui-v2/farm/19-sale-settings.png) |
| เครื่องนี้ | ![](ux/screenshots/ui-v2/farm/20-device.png) |
| No storage warning | ![](ux/screenshots/ui-v2/farm/21-storage-warning.png) |

## Sale flow (E04 v2, `docs/stories/e04-v2-sale-flow.md`)

Built against `docs/ux/mockups/flow-sale-v1.1.0.html` sections 1–4, on the
existing logic: `src/core` (sale-points, bridge, backfill, scale-check, totals,
sale-status, compact-baht, finance/*) plus three small pure additions —
`point-settle.ts` (a point sale settled per tapper with the share on the sale
day, E05-S01), `sale-move.ts` (what a move to a point asks, closes and checks)
and `sale-list.ts` (list rows, the sale's current point and day). Screens are
in `src/v2/sale/`; the money screens read MONEY's `use-sale-money`, which now
settles point sales with `settlePoints`. Every action is an event in the sale
log or the finance log, so it all works offline and survives a reload. A sale
screen's subtitle stays empty until the log is read, so an exported `[id]`
page hydrates cleanly.

Tests: `src/core/{point-settle,sale-list,sale-move,scale-check}.test.ts`,
`src/__tests__/v2-sale-{list,weigh,money}.test.tsx`; e2e `e2e/v2-sale.spec.ts`
(home → start → point → empty scale → count → short → switch and fill →
reload → public → backfill → another tapper → check → settle → round → tally
→ pay with a reload → close, all offline).

Not as drawn yet:

- Sale list: no group name under the title, no per-row ขัดกัน (no groups and
  no conflict check on v2 yet).
- Start: เวลาเริ่มชั่ง shows ไม่ได้บันทึก only (the log has no field for it);
  the note is text only. The buyer is preselected once a sale has picked one
  (MD-6, as before). The picker's first farm is the first by Thai name.
- "มอบหมายตอนนี้" opens the point's tapper plan (point settings): an
  assignment for this sale only (D-70 S5) has no event yet.
- With a skew, the fill question comes before the move's empty-scale check
  (the mockup shows 8c, then 12-เบี้ยว).
- "เริ่มนับเข่ง 1 ทุกจุด": a move to the same tapper's next point does not ask
  (12-ต่อจุด); the open basket stays at its point.
- 12a (deleting a point an open sale uses) is FARM's delete sheet and asks
  nothing yet; the counter does make the sale pick a new point (12b).
- Backfill evidence photos (15) are off: no picker, uploads wait for Cloud
  Storage (D-48).
- 17a: netting against money the farm owes back is built (owner presses it, part is fine, undo per line); "ต้องแตกเงิน" is a note on
  route 1, without the notes-in-the-pile breakdown.
- 17b/17c: no PromptPay QR (no QR encoder installed) and no copy button (no
  clipboard module); amount, number, bank and name are shown large.
- One open sale at a time (owner 2026-10-11): `/v2/sale/start` opens the sale still open (`StartSaleGate`, `loadHomeSales`) instead of starting another. The ⋯ menu of the point picker and counter (`sale-options.tsx`) adds/changes the agreed price, shows the sale info and deletes the sale. Screenshots `20`–`23` (23 = netting sheet).
- The counter's tools are ย้อนกลับ (hold, same time as a count) · ประวัติ · เข่งไม่เต็ม; โหมดสาธารณะ is in the ⋯ menu; the read-only basket list is `/v2/sale/<id>/history` (E04-S15, screenshots `08`, `8d`).
- Voice announcements (E04-S08) and editing / voiding a basket from the list (E04-S09)
  are not on v2 yet.
- A closed sale is fully read-only on v2: there is no reopen and no
  edit-with-reason (D-16, SALE-21, `money_edit`) yet. Its write screens
  (counter, public, point, zero-tare, backfill, rounding) go to its payment
  page; the money pages show it without actions. The one exception is the
  payment ticks: tick, untick and clearing "ต้องตรวจใหม่" stay open after a
  close, and closing does not need every tick (owner 2026-10-10, N1 option ก).
- Going back to a point already weighed in this sale (at least one basket
  there) goes straight to its counter, skew or not; only a point with no
  baskets yet asks for the empty-scale check (owner 2026-10-10).
- Closing pops the sale's whole stack in one navigation (home → sales). A web
  browser keeps its own history, so going back there reaches the sale's pages
  again, each read-only.

Screenshots, 412×915 (`docs/ux/screenshots/ui-v2/sale/`), written only with
`UPDATE_SCREENSHOTS=1` as above.

| | |
|---|---|
| การขายทั้งหมด | ![](ux/screenshots/ui-v2/sale/04-sales.png) |
| เริ่มการขาย | ![](ux/screenshots/ui-v2/sale/05-start.png) |
| เลือกจุดชั่ง | ![](ux/screenshots/ui-v2/sale/06-point.png) |
| ก่อนชั่ง | ![](ux/screenshots/ui-v2/sale/07-zero-tare.png) |
| นับเข่ง | ![](ux/screenshots/ui-v2/sale/08-counter.png) |
| โหมดสาธารณะ | ![](ux/screenshots/ui-v2/sale/09-public.png) |
| เข่งไม่เต็ม | ![](ux/screenshots/ui-v2/sale/10-short.png) ![](ux/screenshots/ui-v2/sale/11-open-short.png) |
| เปลี่ยนจุด, เติมเข่ง | ![](ux/screenshots/ui-v2/sale/12-switch-same-tapper.png) ![](ux/screenshots/ui-v2/sale/13-fill.png) |
| บันทึกย้อนหลัง | ![](ux/screenshots/ui-v2/sale/14-backfill.png) |
| ตรวจยอด | ![](ux/screenshots/ui-v2/sale/16-check.png) |
| สรุปยอดส่วนแบ่ง, ปัดเศษ | ![](ux/screenshots/ui-v2/sale/17-settlement.png) ![](ux/screenshots/ui-v2/sale/18-rounding.png) |
| เทียบยอด | ![](ux/screenshots/ui-v2/sale/18a-tally.png) |
| การจ่ายเงิน | ![](ux/screenshots/ui-v2/sale/19-payment.png) |
