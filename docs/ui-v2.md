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
| `ScreenHeader` | `src/ui/screen-header.tsx` | `title`, `subtitle?`, `back?: {label, href? \| onPress?, testID?}`, `menu?: {onPress}`, `sync?: SyncStatus \| null`, `right?` |
| `SyncPill` | `src/ui/sync-pill.tsx` | `status: SyncStatus` (shape + word + colour) |
| `Drawer`, `MenuSection`, `MenuItem` | `src/ui/drawer.tsx` | Drawer `open`, `onClose`; MenuSection `title`; MenuItem `label`, `leading?` (an `IconTile`), `trailing?` (a badge before the chevron), `detail?` or children (one `FactRow` per fact, D-70), `href?`, `onPress?`, `testID?` |
| `ActionTile` | `src/ui/action-tile.tsx` | `label`, `icon`, `tone?`, `main?` (thick action edge), `href?` \| `onPress?`, `testID?`. The home's three action cards; lay them in a row |
| icons | `src/ui/icons.tsx` | `color`, `size?`. ChevronLeft/Right, MenuIcon, Plus, Minus, Check, Undo, Scale, MoneyIn/Out, Person, Calendar, Receipt, Debt, Bank, Farm, ScaleIcon; farm set (D-83): PinIcon, TagIcon, TrashIcon, GearIcon, PercentIcon, SwapIcon |
| `IconTile`, `FactRow` | `src/ui/icon-tile.tsx` | IconTile `icon: (colour) => node`, `tone?` (`accept`, `action` = mockup t-blue, `cream` = t-cream, `warn`, `neutral`, `category1`–`6`); FactRow `icon?`, children |
| `Button`, `CTA`, `PinnedActions` | `src/ui/button.tsx` | `variant?: primary \| ghost \| destructive \| row`, `size?: regular \| large`, `icon?`, `disabled?`, `onPress?`; CTA = primary + large |
| `SegmentedControl`, `RadioCard` | `src/ui/form.tsx` | Segmented `options`, `value`, `onChange`, `testID` (radiogroup of radios); RadioCard `selected`, `title`, `detail?`, `onPress`, `disabled?` |
| `TextField` | `src/ui/text-field.tsx` | `label`, `required?` (red *), `hint?` (soft note beside the label), `helper?`, `error?`, `aside?` (unit or "ไม่ทราบ" beside the input), `testID`, plus TextInput props |
| `FieldError` | `src/ui/form.tsx` | inline red error with a diamond; `testID?` |
| `BottomSheet` | `src/ui/bottom-sheet.tsx` | `open`, `onClose`, `title?`, `testID?` |
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
mark, name and tagline for under a second, then `router.replace('/v2')`, so
Back never returns to it. Deep links are their own static pages and open
directly with no splash or home first (e2e-checked). Each placeholder shows a
`ScreenHeader` (back button and sync pill) and a "กำลังสร้าง" card. The table lives in
`src/v2/routes.ts`. A real screen gets its own static route file, which takes
precedence over the dynamic one.

| Path | Screen |
|---|---|
| `/v2` | Home: the card home and the ☰ drawer (farm mockup screens 9 and 1) |
| `/` | Splash, then `/v2` |
| `/v2/farm` | ข้อมูลฟาร์ม hub (mockup 2). Built |
| `/v2/people`, `/v2/person/<id\|new>` (`?edit=1`) | คน: list, form, detail, delete (mockup 4–7). Built |
| `/v2/buyers` | คนรับซื้อยาง, form in a sheet (mockup 8). Built |
| `/v2/accounts` | บัญชีรับเงิน (placeholder; MONEY) |
| `/v2/farms`, `/v2/property/<id\|new>` (`?edit=1`) | สวนและจุดชั่ง: list, form, detail with area history, delete (mockup 9–12). Built |
| `/v2/points`, `/v2/point/<id\|new>` (`?property=`, `?edit=1`, `?plan=1`) | จุดชั่ง: all points, add + offer to assign, detail, tapper plan (mockup 14–16). Built |
| `/v2/points-wizard` | ตัวช่วยตั้งค่าจุดชั่ง (mockup 13, 13b). Built |
| `/v2/shares`, `/v2/share/<tapperId>` | ส่วนแบ่ง (mockup 17). Built |
| `/v2/sale-settings` | ตั้งค่าวันขาย (mockup 3). Built |
| `/v2/expenses` | ค่าใช้จ่ายทั้งหมด |
| `/v2/debts` | บัญชีหนี้ |
| `/v2/device` | เครื่องนี้: theme, hold time, spoken count, date era, language (device-only). Built |
| `/v2/sales` | การขายทั้งหมด, with links to every sale step |
| `/v2/sync` | ซิงก์และข้อมูลขัดกัน |
| `/v2/sale/start` | เริ่มการขาย |
| `/v2/sale/point` | เลือกจุดชั่ง |
| `/v2/sale/zero-tare` | ขึ้นศูนย์และตะกร้าเปล่า |
| `/v2/sale/counter` | นับเข่ง (recorder) |
| `/v2/sale/public` | จอให้คนรับซื้อดู (public) |
| `/v2/sale/partial` | เข่งไม่เต็ม |
| `/v2/sale/backfill` | บันทึกย้อนหลัง |
| `/v2/sale/reconcile` | ตรวจยอด |
| `/v2/sale/settlement` | สรุปยอดส่วนแบ่ง |
| `/v2/sale/rounding` | ปัดเศษ |
| `/v2/sale/payment` | จ่ายเงิน |

Files: `src/app/v2/_layout.tsx`, `index.tsx`, one file per built screen,
`[section].tsx` for the placeholders (`BUILT_SECTIONS` in `src/v2/routes.ts`
keeps them apart), `sale/[step].tsx`. Farm screens are in `src/v2/farm/`;
they read and write farm master data through `peopleStore` (`MasterStore`
over the local event log), so all of it works offline and survives a reload.
Dynamic routes render a neutral shell while hydrating (`useMounted`) so the
exported `[id]` page never mismatches (React error 418). Screen code is in `src/v2/`. `generateStaticParams`
pre-renders one page per slug for the static web export. The local
`scripts/serve-dist.mjs` serves the home at `/v2/` (with the trailing slash).

Screenshots at 390×844, light and dark: `docs/ux/screenshots/ui-v2/`.

## Farm settings (D-83)

Built against `docs/ux/mockups/flow-farm-v1.1.0.html` sections 1–6 and 10.
Tests: `src/__tests__/v2-farm-*.test.tsx`; e2e `e2e/v2-farm.spec.ts` (offline
add/edit of every kind, reload) and `e2e/v2-store.spec.ts` (IndexedDB, no
storage warning, two tabs, v0.4 keys).

Not as drawn yet: GPS is typed as "lat, lng" (no location or map picker
installed); the durian lease file upload (needs Cloud Storage); a buyer's
"ขายล่าสุด" date and the per-row "ขัดกัน" chip (no sales or conflict detection
on v2 yet); the group name under the header (no groups, E02); text size on
เครื่องนี้ (the v2 theme has no text scale yet).

Screenshots, 412×915 (`docs/ux/screenshots/ui-v2/farm/`, written by the e2e run):

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
