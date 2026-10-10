# UI v2: design system and shell (D-82)

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
| `Drawer`, `MenuSection`, `MenuItem` | `src/ui/drawer.tsx` | Drawer `open`, `onClose`; MenuSection `title`; MenuItem `label`, `leading?` (an `IconTile`), `detail?` or children (one `FactRow` per fact, D-70), `href?`, `onPress?`, `testID?` |
| `ActionTile` | `src/ui/action-tile.tsx` | `label`, `icon`, `tone?`, `main?` (thick action edge), `href?` \| `onPress?`, `testID?`. The home's three action cards; lay them in a row |
| icons | `src/ui/icons.tsx` | `color`, `size?`. ChevronLeft/Right, MenuIcon, Plus, Minus, Check, Undo, Scale, MoneyIn/Out, Person, Calendar, Receipt, Debt, Bank, Farm, ScaleIcon |
| `IconTile`, `FactRow` | `src/ui/icon-tile.tsx` | IconTile `icon: (colour) => node`, `tone?` (`accept`, `action` = mockup t-blue, `cream` = t-cream, `warn`, `neutral`, `category1`–`6`); FactRow `icon?`, children |
| `Button`, `CTA`, `PinnedActions` | `src/ui/button.tsx` | `variant?: primary \| ghost \| destructive \| row`, `size?: regular \| large`, `icon?`, `disabled?`, `onPress?`; CTA = primary + large |
| `SegmentedControl`, `RadioCard` | `src/ui/form.tsx` | Segmented `options`, `value`, `onChange`, `testID` (radiogroup of radios); RadioCard `selected`, `title`, `detail?`, `onPress`, `disabled?` |
| `TextField` | `src/ui/text-field.tsx` | `label`, `required?` (red *), `helper?`, `error?`, `testID`, plus TextInput props |
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

`/v2` sits beside the old UI and is **not** the default entry. The e2e suite
opens `/` and expects the old sale list, so making `/v2` the default would mean
changing how the old UI behaves. Each placeholder shows a `ScreenHeader` (back
button and sync pill) and a "กำลังสร้าง" card. The table lives in
`src/v2/routes.ts`. A real screen gets its own static route file, which takes
precedence over the dynamic one.

| Path | Screen |
|---|---|
| `/v2` | Home: the card home and the ☰ drawer (farm mockup screens 9 and 1) |
| `/v2/farm` | ข้อมูลฟาร์ม |
| `/v2/people` | คน |
| `/v2/buyers` | คนรับซื้อยาง |
| `/v2/accounts` | บัญชีรับเงิน |
| `/v2/farms` | สวนและโซน |
| `/v2/points` | จุดชั่ง |
| `/v2/shares` | ส่วนแบ่ง |
| `/v2/expenses` | ค่าใช้จ่ายทั้งหมด |
| `/v2/debts` | บัญชีหนี้ |
| `/v2/device` | เครื่องนี้. The light/dark choice already works here; the rest is a placeholder |
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

Files: `src/app/v2/_layout.tsx`, `index.tsx`, `device.tsx`, `[section].tsx`,
`sale/[step].tsx`. Screen code is in `src/v2/`. `generateStaticParams`
pre-renders one page per slug for the static web export. The local
`scripts/serve-dist.mjs` serves the home at `/v2/` (with the trailing slash).

Screenshots at 390×844, light and dark: `docs/ux/screenshots/ui-v2/`.
