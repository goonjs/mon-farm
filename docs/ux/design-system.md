# Design system — mon-farm

Status: **Draft v0.2** · Authored 2026-08-10 · FarmMate visual language
adopted 2026-10-03 (§12) · Companion gallery:
[`design-system.html`](design-system.html)

> **Read §12 first.** On 2026-10-03 the FarmMate brand tokens were mapped into
> `design/tokens.ts`. Where §1–§11 conflict with §12, §12 wins and the older
> text is marked *Superseded*. Field rules (contrast floors, the public
> numeral, colour-never-alone, 48pt targets) are kept unless the owner
> overrides them via the questions in §12.9.

Source of truth for all values: [`design/tokens.ts`](../../design/tokens.ts).
Nothing in this document restates a number that isn't in that file — where a
figure appears here, it's quoted from the source or computed by
`scripts/check-contrast.mjs`.

---

## 1. The thesis

**This is an instrument, not a document.**

Two people stand around a scale in a farm yard and watch a number that decides
how much money changes hands. The buyer never touches the device. The design
job is not to present information attractively — it is to make one number
unmistakable at ten metres, in direct sun, to someone who is not holding it.

Everything follows from that:

- **Achromatic ground.** Colour in the background competes with colour that
  carries state. The stage is pure white; panels are a neutral grey that
  recedes.
- **Numerals dominate.** The count is sized as a fraction of the viewport, not
  in points, because the constraint is physical millimetres (§4).
- **Colour is reserved entirely for state.** No brand colour, no decorative
  accent, no gradient. *Superseded 2026-10-03 (§12): FarmMate brand accents
  are allowed as decorative fills off the public stage; the public register
  stays achromatic.*
- **No web fonts, ever.** *(Still true for runtime fetching; bundling
  FarmMate's fonts as app assets is owner question §12.9 Q1.)* The app must be fully usable offline on first launch
  (NFR-1). A font that fails to load is a count nobody can read.

The prototypes this system replaces used a warm cream ground, a serif display
face, and a terracotta accent. That is a good editorial look and the wrong look
for a measuring instrument — it was also, candidly, the default. The shift to
an instrument language is the one large move in this system; everything else is
restraint around it.

---

## 2. The three registers

Finding F-1 divides the screen into three registers by **who the element is
for and from how far away**. Every element belongs to exactly one. If you can't
name an element's register, it doesn't belong on the screen.

| Register | Audience | Distance | What lives here |
|---|---|---|---|
| **Public** | The buyer (ล้ง), watching | ~10 m | The count. The dial. Accept/reject feedback. Nothing else. |
| **Operator** | The person counting | ~0.4 m | Pile identity, expected reading, running totals, every control, every state indicator. |
| **Announced** | Both parties, by ear | Audible across a yard | Spoken count, read-back, corrections, pile totals. |

### The rule that makes it work

**Nothing may be added to the Public register.** It is a fixed budget, already
spent. F-9.7's arithmetic: three digits at the largest numeral a 6.1″ phone can
physically produce leaves roughly 35 mm of width for everything else — which is
why the operator information lives behind tabs (F-19) rather than beside the
count.

When someone later asks to "just add a small total under the number," the
answer is the Pile tab. That is what it is for.

### Announced is a register, not a feature

Anything spoken is designed here, not bolted on. Two consequences:

1. **Every announcement writes an event**, whether or not audio succeeded
   (FR-12.2). The log records what was *attempted* plus a success flag.
2. **The screen must be trustworthy silent** (F-17). Audio is the likeliest
   thing to fail — no voice on the device, muted phone, noisy yard. Nothing is
   communicated by sound alone.

---

## 3. Colour

### The four signal hues are disjoint

No hue does double duty. This is the load-bearing decision in the palette.

*Superseded in part 2026-10-03 (§12.2): blue → FarmMate navy; signal
values darkened FarmMate hues; contrast now 96 pairings × 2 schemes × 2
palettes (E01-S17). The disjoint-roles
rule itself is kept.*

| Hue | Token | Means | Never means |
|---|---|---|---|
| Blue | `action` | **Interactive.** Touch this. | A state. Blue never reports anything. |
| Green | `accept` | **Counted.** This basket is in. | ~~A control. Nothing green is pressable.~~ *ยกเลิก 2026-10-03 (§12.10 Q2): ปุ่มสีเขียว (`brandStrong`) ใช้ได้ แต่ความหมาย "นับแล้ว" ต้องมี ✓ + คำเสมอ* |
| Red | `reject` | **Not counted** — rejected, voided, destructive. | Merely "important". |
| Amber | `warn` | **Flagged.** Recorded, visible, never blocking. | An error that stops you. |

Blue is drawn from the tarpaulins in every Thai farm yard — the one colour in
that working environment that never reads as good or bad. Green and red are
unavoidable for accept/reject; amber sits between them without being either.

Because the hues are disjoint, F-16's non-colour encodings (shape, icon,
position, motion) **agree with** colour instead of competing with it. A rejected
basket is red *and* struck through *and* marked `✗` *and* announced. Any one of
those four channels alone carries the meaning.

### Contrast is verified, not asserted

`node scripts/check-contrast.mjs --strict` checks all 96 pairings the system
actually uses, in both schemes and in **every** palette (E01-S17: 96 × 2 × 2 =
384 checks), each against a floor chosen for its use:

- **7:1 (AAA)** — the count, and all primary operator text
- **4.5:1 (AA)** — secondary text, chips, button labels
- **3:1** — control boundaries and the dial track (WCAG 1.4.11)

Current state: all 46 pass. The count reads **19.70:1** in light and 19.24:1 in
dark.

Two pairings sit at AA rather than AAA by choice — `inkSoft` on `surface`
(6.35:1) and the reject chip (6.46:1). Both are secondary; pushing them to AAA
would flatten the tonal separation that makes the operator register scannable.

### Light is the field mode

Light is the default. F-15: phone displays are additive, so dark-ink-on-white at
full brightness is the brightest, highest-contrast thing a phone can put in
direct sun. Dark exists for evening and indoor weighing at the ล้ง and is
opt-in.

The battery cost of full brightness on white is real and **has not been
measured**. F-15 flags it as needing a field test; it is not resolved here.

### `rule` vs `ruleStrong`

`rule` is decorative — dividers, separators, things that carry no meaning and
are deliberately below 3:1. `ruleStrong` is for boundaries that tell you where a
control begins: input borders, unfilled buttons, the dial track. If the line is
the only thing defining a target, it must be `ruleStrong`.

### วิธีเปลี่ยนสี (ข้อเสนอ — รอ E01-S17)

*ข้อเสนอ ยังไม่ใช่กติกา — เจ้าของยังไม่ได้ตกลง AC ของ [`stories/e01-s17-semantic-color-tokens.md`](../stories/e01-s17-semantic-color-tokens.md)*

- **วันนี้ (mockup เท่านั้น):** mockup v1.1.0 อ่านสีจาก `tokens.css` + [`mockups/palette-proposal.css`](mockups/palette-proposal.css) ผ่าน `var(--color-<บทบาท>)` เท่านั้น ไม่มี hex ในไฟล์ mockup
  สลับชุดสีด้วย `data-palette="b"` / โหมดด้วย `data-theme="dark"` บน `<html>` — ปุ่มมุมขวาล่าง หรือ `?palette=b&theme=dark`
- `palette-proposal.css` เขียนมือ ไม่ได้ generate และ CI ไม่ตรวจ — ลบ/แทนด้วยไฟล์จาก `emit-tokens.mjs` เมื่อ E01-S17 ตกลงแล้ว
- **หลัง E01-S17 ตกลง (แอป):** เปลี่ยนทั้งชุดด้วยค่าคงที่ตัวเดียว `ACTIVE_PALETTE` ใน `design/tokens.ts` (`'farmmate'` / `'instrument'`) แล้ว `npm run tokens` + `npm run contrast`
- หน้าจอใช้แค่ชื่อบทบาท (`theme.color.<ชื่อ>` / `var(--color-<ชื่อ>)`) — เปลี่ยนสีที่เดียว ไม่ต้องแก้หน้าจอ
- สีไม่เป็นตัวบอกความหมายอย่างเดียว: สถานะมีไอคอน + คำ, เงินมี + / − และคำ, สีประจำกลุ่มมีชื่อกำกับเสมอ

---

## 4. The public numeral

**Sized as a fraction of the short viewport dimension. Never in points.**

F-9.7 is arithmetic about physical millimetres:

| | Height |
|---|---|
| Comfortable reading at 10 m | ~83 mm |
| Threshold legibility at 10 m | ~40 mm |
| Largest a 6.1″ phone can produce | ~59 mm |
| 6.7″ phone | ~65 mm |
| 8.7″ tablet | ~110 mm |

A phone **cannot** reach comfortable. It can clear threshold with room to spare.
That gap is the reason the cross-check is also spoken aloud — the number alone
was never going to be enough on a phone, and the design says so honestly rather
than pretending otherwise.

The only way to spend the device's full height is to express the numeral as a
proportion of it:

```
heightRatio  1–2 digits  0.72
             3 digits    0.66
             4 digits    0.50
minHeightRatio          0.62   ← Playwright asserts this at 3 digits
```

**Do not convert these to fixed sizes.** Doing so silently gives back the
millimetres the entire cross-check depends on. There is an automated assertion
against exactly this regression.

Numerals are set with `tabular-nums`, weight 800, tracking `-0.04em`,
line-height 1. Tabular figures matter: a count that changes width as it
increments reads as unstable at distance.

---

## 5. The signature: the bezel sweep

The 3-second hold is drawn as a **stroke travelling the stage's perimeter** —
starting at the top-left corner, closing the loop as the hold completes.

It earns its place three ways:

1. **It costs the numeral nothing.** §4 is the tightest constraint in the
   product; a control that takes width from the count is a control that makes
   the count less readable.
2. **It makes the delay legible as duration.** F-6 requires the hold be slow
   enough to resist accidental taps. A travelling stroke says "this is
   deliberately taking time" rather than "this is slow."
3. **It gives rejection somewhere visible to happen.** An early release
   collapses the stroke back to the start over 200ms — readable from the public
   distance, which is what F-7 requires, since a silently rejected tap turns a
   phantom count into a missed count.

This was a centred dial first. A dial competes with the numeral for width — at
three digits they collide — and the perimeter is also simply the longest path
available on the screen, so progress stays visible at a distance where a small
centred ring would not be. The dial's tick marks went with it: they encoded
nothing, and the numeral should be undisputed.

Implementation note: the SVG rect carries `pathLength="100"`, so
`stroke-dashoffset` is a percentage and the dash maths never needs to know the
real perimeter at any viewport size.

Everything else in the system is deliberately quiet so this reads.

---

## 6. Type

*Superseded in part 2026-10-03 (§12.3): ramp re-mapped onto FarmMate's scale
(`body` 15→16, `lead` 19→20, `title` 26→24; `figure` 44 kept).*

System stacks only (see §1). `sans` carries the entire app. The serif in the
documentation pages is for documents — the instrument does not use it.

| Token | Size | Use |
|---|---|---|
| `micro` | 11 | Mono labels, tick captions |
| `small` | 13 | Secondary operator text |
| `body` | 15 | Default operator body |
| `lead` | 19 | Running totals, panel headings |
| `title` | 26 | Pile/zone identity on transition cards |
| `figure` | 44 | Settlement figures, pile totals |

The public numeral is not in this ramp — see §4.

**Thai and Latin are set in the same stack.** `"Noto Sans Thai"` sits in the
family list ahead of the generic fallback so Thai renders with matching weight
rather than dropping to a system default that looks lighter beside Latin. Thai
has taller ascenders and descenders than Latin at the same point size; the
`snug` line-height (1.25) exists so Thai UI strings don't collide.

---

## 7. States that must not rely on colour

F-16 names five states that need non-colour encoding. Each gets a shape, a
position, and a word — colour is the fourth channel, never the first.

| State | Shape | Position | Word |
|---|---|---|---|
| Counting | Filled dot | Topbar left | `กำลังนับ` |
| Paused / not ready | Hollow dot | Topbar left | `หยุด` |
| Audio degraded | Slashed speaker | Topbar right | `ไม่มีเสียง` |
| Clock anomaly | Clock glyph in a flag chip | Topbar right | `เวลาผิด` |
| Unsynced | Half-filled dot + count | Topbar right | `รอส่ง N` |

ป้ายสถานะ sync ภาพรวม (คำตอบเจ้าของ 2026-10-03, แทน `ค้าง N` เดิม):
`ซิงก์แล้ว` / `รอส่ง N` / `ขัดกัน N` / `ส่งไม่สำเร็จ · ลองใหม่` (E01-S10)

The last three are non-blocking by design. They report; they never gate
counting. A screen that stops you counting because its clock is wrong has
misunderstood which of the two is more important.

---

## 8. Touch targets

`target.min` is **48pt**, above the 44pt platform floor. *(FarmMate's 44
minimum is not adopted — §12.9 Q6.)* NFR-4: one-handed, in a
yard, possibly wet or gloved hands. `target.comfortable` is 56pt for anything
used repeatedly.

The stage itself is the hold target and fills the panel — it is the largest
touch target in the app because it is the one pressed hundreds of times.

Destructive and irreversible controls (close pile, close zone, close sale, void)
are **never** placed adjacent to the stage or to each other, and always require
a second confirm.

---

## 9. Layout: tabbed, any orientation

**As of S19, both orientations are allowed on phone and tablet** —
`app.json`'s orientation lock is `"default"`, not `"landscape"`. Portrait is
genuinely better for most of this app: setup, log and settlement are row-heavy
and were being crammed into ~390px of height in landscape.

Reference viewports:

- `844 × 390` — modern 6.1″ phone, landscape
- `740 × 360` — the NFR-4 low-end Android floor, landscape; layout must hold here
- `390 × 844` — the same phone, portrait
- `820 × 1180` — a ~10.9″ tablet, portrait
- Tablet landscape is not separately verified — nothing in this layout is
  viewport-driven in a way orientation could break for a device that size, so
  it shares the phone-landscape layout rather than getting its own case.

Three tabs (F-19): **Count** / **Pile & Zone** / **Log**. When any tab other
than Count is active, a persistent mini-count stays in the topbar — leaving the
Count tab must never mean losing sight of the number.

### The one screen orientation actually constrains

F-9.7's arithmetic is about physical millimetres, so it was re-run per
orientation rather than assumed to carry over from §4. **A phone in portrait
cannot reach the legibility threshold at three digits** — the count becomes
width-limited, and a phone in portrait is not wide enough, regardless of its
height. Tablets clear the threshold in both orientations across this MVP's
digit range; one and two digit counts clear it on a phone in portrait too — it
is specifically 100+ baskets in a pile.

The counter screen measures this directly at runtime (`HoldStage.tsx`) rather
than branching on orientation: it compares the numeral's achieved size against
the device's short physical edge, and shows a small, **non-blocking** hint —
"turn the phone for a clearer count" — exactly when that comparison fails.
Nothing is ever blocked by it; someone mid-sale must not be stopped by a layout
opinion. Two rejected alternatives, for the record: silently shrinking the
numeral (hides a money-accuracy problem — the exact thing F-7 and F-14 warn
against), and rotating the glyph 90° in portrait (a count that reads sideways
is not one two people can agree on at a glance).

One caveat worth naming: the ratio this measurement uses (rendered numeral
height ÷ device short edge) is calibrated against phone point-density and does
not transfer directly to a tablet's — an iPad's logical points map to more
physical millimetres each than an iPhone's do. The rotate-hint logic accounts
for this with a size-based tablet threshold (Material Design's own 600px
breakpoint) rather than trusting the ratio across device classes; see the
comment on `tokens.publicNumeral.minHeightRatio` for the measured numbers that
motivated it.

---

## 10. Motion

Motion is functional here, and there is very little of it.

| Token | Duration | Use |
|---|---|---|
| `flash` | 180ms | Accept/reject wash |
| `move` | 160ms | Tab and panel transitions |
| `hold` | 1500ms | The dial sweep — this *is* the anti-mistap budget |
| `toast` | 2400ms | Transient confirmations |

`prefers-reduced-motion` removes the dial's sweep animation but **not the
hold delay** — the delay is a safety mechanism, not decoration. Under reduced
motion the dial steps through discrete tick states instead of sweeping
continuously, so duration stays visible without continuous animation.

`hold` shipped at 3000ms and was lowered to 1500ms on 2026-08-11 after
hands-on testing found 3 seconds too slow for a real counting rhythm — still
long enough to be a deliberate hold rather than a stray tap, per F-6.

---

## 11. Open questions

Carried from the PRD and findings; not resolved by this document.

1. **Battery cost** of white-at-full-brightness in the field (F-15). Unmeasured.
2. **Real readable distance** on a 6.1″ phone. §4's numbers are arithmetic, not
   observation — the findings page has a millimetre calibration tool built for
   exactly this test, and it hasn't been run in a yard yet.
3. **Thai voice persona** — the prototypes use `ค่ะ` throughout, which assumes a
   female voice. Not confirmed with the owner.
4. **Tablet** remains unexplored. It is the only way to reach comfortable 10 m
   legibility, and this system is phone-only by decision, not by finding.

---

## 12. FarmMate adoption (2026-10-03)

Inputs: the owner's FarmMate design tokens (CSS + JSON, v1.0) and two screen
drafts (0.1: overview/dashboard/production/sales/tasks; 0.2: the rubber
weighing flow). **The drafts are visual language, not layout** — screens and
flows are decided per epic. What was extracted: colour, type, spacing, radius,
elevation, iconography. Every value lives in `design/tokens.ts`;
`docs/ux/tokens.css` is regenerated from it.

### 12.1 What changed in one paragraph

The app moves from an achromatic instrument palette to FarmMate's brand:
navy text and primary controls, green for done/counted, a warm yellow accent,
softly rounded cards on a near-white ground. Three things do **not** move: the
public weighing numeral (near-black on white, CI floor 15:1), the contrast
floors on every pairing, and the rule that colour is never the only carrier
of state. Where a FarmMate colour failed a floor, its hue was kept and only
its lightness reduced.

### 12.2 Palette (light — field mode)

| Token | Value | FarmMate source | Role |
|---|---|---|---|
| `stage` | `#FFFFFF` | surfaceBackground | Public stage, white screens |
| `surface` | `#F7FAFC` | surfaceSubtle | Screen ground behind cards |
| `surfaceSunk` | `#F1F3F5` | surfaceGray | Inputs, wells, segmented track |
| `surfaceRaised` | `#FFFFFF` | surfaceCard | Cards |
| `numeral` | `#0A0B0C` | — (kept from instrument system) | **Public numeral only** |
| `ink` | `#002858` | textPrimary / brandNavy | Primary text |
| `inkSoft` | `#52657A` | textSecondary | Secondary text |
| `inkFaint` | `#7A8998` | textMuted | Placeholder, disabled (decorative) |
| `rule` / `ruleFaint` | `#CBD4DC` / `#E4E9EE` | borderStrong / borderDefault | Decorative dividers |
| `ruleStrong` | `#7A8998` | textMuted (no FarmMate border reaches 3:1) | Control boundaries |
| `action` / `actionHover` | `#002858` / `#002850` | brandNavy / brandNavyDeep | Interactive |
| `actionSunk` | `#EAF5FC` | surfaceBlue | Selected rows |
| `accept` / `acceptSunk` | `#006F52` / `#E8F8F2` | success (darkened) / surfaceGreen | Counted, done |
| `reject` / `rejectSunk` | `#BB1C1C` / `#FDECEC` | error (darkened) / derived tint | Rejected, voided, conflict |
| `warn` / `warnSunk` | `#815908` / `#FFF5D8` | warning (darkened) / surfaceYellow | Flagged, pending |
| `statusSynced` / `statusPending` / `statusConflict` | = accept / warn / reject | success / warning / error | SYNC-3 status (new) |
| `brand` / `brandStrong` | `#00AA7D` / `#008F6C` | brandGreen / brandGreenDark | Decorative fills; FAB fill (new) |
| `brandYellow` / `brandCream` | `#FECB56` / `#FFF8E8` | brandYellow / brandCream | Illustration, charts, warm ground (new) |

Not adopted as tokens: `brandGreenBright #48C090` (used as the dark-theme
green instead), `textDisabled #A8B2BC` (YAGNI — `inkFaint` + `opacity.disabled`
cover it), `info #1689C7` (§12.9 Q7).

**Contrast adjustments (hue kept, lightness lowered, recorded per field-first
rule).** Target was ≥5.5:1 against every ground the colour sits on, not just
the 4.5 floor, for margin in direct sun:

| FarmMate | As text on white | Adopted | On white | Worst ground |
|---|---|---|---|---|
| success `#00AA7D` | 2.98 ✗ | `#006F52` | 6.18 | 5.56 (surfaceSunk) |
| error `#E55353` | 3.69 ✗ | `#BB1C1C` | 6.37 | 5.58 (rejectSunk) |
| warning `#F2B233` | 1.88 ✗ | `#815908` | 6.24 | 5.61 (surfaceSunk) |
| borderStrong `#CBD4DC` as control edge | 1.50 ✗ | `#7A8998` | 3.58 | 3.42 (surface) |
| white on brandGreen `#00AA7D` (FAB) | 2.98 ✗ (3:1 glyph) | fill `#008F6C` | 4.08 | — |

FarmMate navy text (`#002858`) passes at 14.54:1 on white, so `ink` takes it
unchanged. `npm run contrast` checked **72 pairings (36 × 2 themes)** at
adoption; since E01-S17 it checks **384 (96 pairings × 2 themes × 2 palettes)**,
all passing.

**Dark theme.** FarmMate has none; the dark palette is this repo's,
re-derived from FarmMate hues (navy-tinted grounds `#0B1520`, light navy
action `#8FB4EC`, brandGreenBright `#48C090` as accept, brandYellow
`#FECB56` as warn). Still opt-in.

### 12.3 Type scale

FarmMate names were added; the pre-FarmMate names stay as aliases (consumed
by `src/`) mapped to the nearest FarmMate step.

| FarmMate | px | Alias | Change |
|---|---|---|---|
| displayXl | 32 | — | |
| displayLg | 28 | — | |
| headingXl | 24 | `title` | 26 → 24 |
| headingLg | 20 | `lead` | 19 → 20 |
| headingMd | 18 | — | |
| headingSm / bodyLg | 16 | `body` | 15 → 16 |
| bodyMd | 14 | — | FarmMate default body (see Q5) |
| bodySm | 13 | `small` | unchanged |
| caption | 12 | — | |
| micro | 11 | `micro` | unchanged |
| — | 44 | `figure` | kept: field extension above FarmMate's top step |

Weights: `semibold 600` added (FarmMate headings). `black 800` kept for the
public numeral only. Families: system stacks; FarmMate's Noto Sans Thai is
already named in `sans` (it is Android's system Thai face); Inter is not added
— Q1.

Draft observation: figures are set large and bold with a smaller, lighter
unit beside them (`2,450 กก.`, `24,960 บาท`). Keep that pattern: figure in
`ink`, unit in `inkSoft` one or two steps down.

### 12.4 Spacing

FarmMate's 4px grid, emitted under FarmMate's own CSS names `--space-1` …
`--space-16` (4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64). The named aliases
(`xxs`…`xxl`) sit on the same grid and remain for existing code. New code may
use either; prefer the numeric keys. Layout dimensions are tokens under
`layout`: screen padding 16, top bar 56, bottom nav 72, button and input
height 48, FAB 56.

### 12.5 Radius

FarmMate's scale replaces the old one: `sm 8 · md 12 · lg 16 · xl 20 ·
xxl 24 (FarmMate "2xl") · pill`. (Old: sm 4, md 8, lg 14.) This visibly
softens existing chips and buttons — intended. Drafts: cards ≈ lg, icon tiles
and inputs ≈ md, primary buttons and segmented-tab active state ≈ pill.

### 12.6 Elevation

FarmMate uses soft navy-tinted shadows (card 6%, floating/button 10%). They
are recorded as tokens (`shadow.card|floating|button` = `{y, blur, color}`,
consumable by both RN and CSS) but **not applied**: `elevation` stays flat
until Q4 is answered. Reason: a 6% shadow is invisible in direct sun, so a
card edge drawn only by shadow disappears exactly where the app is used.

### 12.7 Iconography (from the drafts)

- **Line icons** (≈1.5–2px stroke, rounded joins) for navigation, form-row
  leading icons (calendar, price tag, basket) and the bottom nav.
- **Filled, full-colour illustrative icons in tinted rounded-square tiles**
  (≈40–48px, radius `md`, ground `acceptSunk` / `warnSunk` / `brandCream`)
  identify record types: rubber basket, fertilizer bag, leaf, tree.
- **Success** is a large `brand`-green filled circle with a white check —
  shape carries it, not only colour.
- **Trends** are an arrow glyph + signed % (`↑ 12%`, `↓ 5%`) in
  accept/reject — the arrow and sign carry direction; colour only agrees.
- **Bottom nav**: 5 slots, centre raised circular FAB `+`; active tab in
  `ink` with label, inactive in `inkSoft`.
- **Segmented tabs**: navy filled pill for the active segment, text-only for
  the rest.
- **Buttons**: primary = navy filled pill, full width; secondary = navy
  outline pill (outline must use `action`, ≥3:1).
- No icon set is chosen yet — Q11.

### 12.8 Weighing — how public mode keeps its extreme-contrast rules

The weighing flow in draft 0.2 is a *recorder* flow (portrait, cards,
FarmMate language). **Public mode** (SALE-15) is not shown in the drafts and
keeps the instrument rules of §2/§4/§5 unchanged:

1. The count uses `numeral` (`#0A0B0C` on `#FFFFFF` stage, 19.70:1) — not
   brand navy. CI floor for this pairing is now **15:1** (was 7). Wired in
   `HoldStage.tsx`.
2. The stage is pure white, flat: no shadow, no tint, no gradient, no brand
   accent, no illustration.
3. Nothing is added to the public register (§2). Brand chrome — navy
   top bar, buttons — may sit in operator areas around the stage only.
4. Accept/reject feedback keeps its non-colour channels (stroke, ✗, strike,
   voice); `flashAccept`/`flashReject` follow the darkened accept/reject.
5. Numeral sizing (`publicNumeral`) is untouched.

Recorder mode (SALE-14, portrait) adopts FarmMate cards, but its six figures
use `ink` at `figure`/`displayXl` size on `surfaceRaised`, ≥7:1.

### 12.9 คำถามสำหรับเจ้าของ — กฎเดิมจากการทดสอบในสวน vs FarmMate

★ = ข้อแนะนำ · *(ใช้อยู่)* = ค่าที่ token ใช้อยู่ตอนนี้

1. **Font** — FarmMate ใช้ Noto Sans Thai + Inter; กฎเดิม: ห้ามใช้ web font
   (a) ใช้ system font อย่างเดียว *(ใช้อยู่)* · (b) ฝัง Noto Sans Thai ในแอปผ่าน `expo-font` (มีอยู่แล้ว) ใช้ offline ได้เพราะไม่ต้องโหลดจากเน็ต ★ · (c) ฝังทั้งสองตัว
   เหตุผล: UI เป็นภาษาไทยอย่างเดียว (D-20) Inter จะแสดงแค่ตัวเลข; ฝัง font ทำให้ภาษาไทยหน้าตาเหมือนกันทุกเครื่อง ต้องมี story + ตรวจ licence (OFL) + วัดขนาดแอป ค่าที่ใช้อยู่คง (a) จนกว่าจะตัดสิน -> B as long as it is free and free to use for commercial later
2. **สีเขียวบนปุ่ม** — FAB กลางของ FarmMate เป็นสีเขียว; กฎเดิม: อะไรที่เป็นสีเขียวต้องกดไม่ได้ (เขียว = นับแล้ว)
   (a) FAB สี navy รักษากฎเดิม · (b) FAB เขียวเป็นข้อยกเว้นเดียว ใช้ token `brandStrong` (แยกจาก `accept`) และห้ามมีในหน้าชั่ง ★ · (c) ยกเลิกกฎ -> C
3. **สีตัวอักษร navy vs เกือบดำ** — FarmMate ใช้ navy; เดิมใช้เกือบดำ
   (a) ตัวอักษรทั่วไปเป็น navy, ตัวเลขนับบนจอสาธารณะใช้ `numeral` เกือบดำ ★ *(ใช้อยู่)* · (b) เกือบดำทั้งหมด
   เหตุผล: navy บนพื้นขาว = 14.54:1 ผ่าน AAA -> นี่ถามหรือแค่บอก ถ้าถามให้ลองยึดตาม FarmMate ก่อน ตรวจดูถ้าเจอปัญหาค่อยกลับมาคุยกัน
4. **Elevation (เงา)** — FarmMate ใช้เงานุ่ม; กฎเดิม: แบน ใช้เส้น + เปลี่ยนสีพื้น
   (a) แบน + เส้นบาง `ruleFaint` *(ใช้อยู่)* · (b) เงา FarmMate **และ** เส้นบาง `ruleFaint` บน card, ห้ามใช้บนจอสาธารณะ ★ · (c) เงาอย่างเดียว
   เหตุผล: ได้หน้าตาแบรนด์ในร่ม และยังเห็นขอบชัดกลางแดด ต้องตรวจว่า RN กับเว็บแสดงเงาเหมือนกัน -> UX คิดให้อีกที อยากให้ยังสวย แต่ต้องเห็นชัดกลางแดด ถ้าไม่งั้นตรงนี้เราจะทำ preview A/B testing มาให้เทียบ
5. **ขนาดตัวอักษร body** — FarmMate = 14; งานในสวนต้องการใหญ่กว่า
   (a) 16 สำหรับข้อความหลัก, 14 สำหรับข้อมูลรอง, 12/11 เฉพาะ label ★ *(ใช้อยู่: `body` = 16)* · (b) 14 ตาม FarmMate
   เหตุผล: ใส่ถุงมือ, แดดจ้า, อาจารย์สมหวังอายุ 76 -> A และให้ setting ปรับได้ด้วย S (14), M (16), L (18) เลขที่ว่าคือข้อความหลัก สำหรับตัวอื่นลดตามสัดส่วน
6. **Touch target** — FarmMate ขั้นต่ำ 44; งานในสวนขั้นต่ำ 48
   (a) คง 48 ★ *(ใช้อยู่)* · (b) 44 
   เหตุผล: NFR-4 ถุงมือ มือเปียก -> A
7. **สีฟ้า info** — FarmMate มี `info #1689C7` (card ราคา); กฎเดิม: ฟ้า/น้ำเงิน = กดได้
   (a) ไม่มีสี info, card ข้อมูลใช้พื้นกลาง `surfaceRaised` ★ *(ใช้อยู่: ไม่ได้ทำเป็น token)* · (b) เพิ่ม `info` เข้มขึ้นเป็น `#106694` (6.27:1) + ไอคอน ℹ
   เหตุผล: card สีฟ้าที่กดไม่ได้ ทำให้ผู้ใช้เข้าใจผิด -> A
8. **card ไฮไลต์สีเหลือง** — draft ใช้ card เหลืองสำหรับ "ส่วนแบ่งเจ้าของ 50%"; กฎเดิม: amber = ถูกติด flag
   (a) ไฮไลต์ใช้ `brandCream` + ไอคอน + ป้ายคำ; flag ต้องมีไอคอนธง + คำเสมอ ★ · (b) สีเหลืองใช้เฉพาะ flag
   เหตุผล: สองสีนี้แทบเหมือนกัน ความหมายต้องมาจากไอคอนและคำอยู่แล้ว (colour-never-alone) -> ไม่เข้าใจ UX แนะนำเลย
9. **การแสดงสถานะข้อมูลและการเงิน** — FarmMate ไม่มีให้ *เสนอไว้ ยังไม่ทำเป็น token:*
   Unknown = `inkSoft` + "ไม่ทราบ" + ไอคอน "?" + กรอบเส้นประ `ruleStrong` · Estimated = นำหน้า "≈" + ป้าย "ประมาณ" · AI-suggested = ไอคอนประกาย + chip "AI แนะนำ" บนพื้น `surfaceSunk` (ไม่ใช้ฟ้า ไม่ใช้เขียว) · User-provided / System-calculated = ป้ายคำอย่างเดียว · การเงิน: Actual = ทึบ, Committed = มีกรอบ, Planned = กรอบเส้นประ ทุกแบบมีป้ายคำ
   ★ อนุมัติเป็นจุดเริ่มต้น เพิ่ม token เมื่อ story ต้องใช้ -> ok
10. **สีสถานะ Sync** — Synced = เขียว + ✓ วงกลม, Pending = amber + จุดครึ่งวง + จำนวน, Conflict = แดง + ⚠ สามเหลี่ยม ★ *(ใช้อยู่ เป็น alias `status*`)*
    ทางเลือก: Conflict เป็น amber (เพราะไม่ใช่การปฏิเสธ)
    เหตุผลที่แนะนำแดง: conflict เรื่องเงิน/การนับต้องได้รับความสนใจ (SYNC-2) -> OK
11. **ชุดไอคอน** — draft ใช้ไอคอนเส้น + ไอคอนภาพประกอบตามประเภทรายการ ยังไม่ได้เลือก
    (a) `expo-symbols` (iOS เท่านั้น — Android/เว็บมีช่องว่าง) · (b) ชุดไอคอนเส้นแบบ open-licence ฝังในแอป (ต้องตรวจ dependency/ความปลอดภัย) · (c) วาด SVG เองสำหรับ ~10 ประเภทรายการ + ชุดไอคอนเส้น -> B for MVP
    ★ ตัดสินใน UI epic แรก; ประเภทรายการใช้ (c) ไม่ว่าจะเลือกแบบไหน

ค้างอยู่ด้วย: หน้า `design-system.html` และ `mvp-screens.html` ใช้ค่าใหม่จาก `tokens.css` แล้ว แต่ข้อความอธิบายยังเป็น palette เก่า ให้ปรับตอนออกแบบหน้าจอในแต่ละ epic

### 12.10 คำตอบเจ้าของ (2026-10-03) และสิ่งที่ทำแล้ว

| # | คำตอบ | ทำแล้ว / ต่อไป |
|---|---|---|
| 1 Font | **(b)** ฝัง Noto Sans Thai — ฟรีและใช้เชิงพาณิชย์ได้ (SIL Open Font License 1.1: ใช้ ฝังในแอป และขายแอปได้ ห้ามขายตัว font แยก) | story ใน E01: เพิ่มไฟล์ font เป็น asset ผ่าน `expo-font` + วัดขนาดแอป |
| 2 ปุ่มสีเขียว | **(c)** ยกเลิกกฎ "สีเขียวกดไม่ได้" | FAB ใช้ `brandStrong`; สถานะ "นับแล้ว" ต้องมี ✓ + คำเสมอ เพื่อไม่สับสนกับปุ่ม (§3 แก้แล้ว) |
| 3 navy vs ดำ | ยึด FarmMate ก่อน — navy ทุกที่ รวมตัวเลขนับบนจอสาธารณะ | `numeral` = `#002858` (14.54:1, AAA), เกณฑ์ CI ของตัวเลขนับกลับเป็น 7:1; ถ้าทดสอบในสวนแล้วอ่านยาก ค่อยคุยกันใหม่ (เปลี่ยน token เดียว) |
| 4 เงา | ต้องสวยและเห็นชัดกลางแดด | ใช้ (b): เงา FarmMate + เส้นบาง `ruleFaint` บน card, ไม่มีบนจอสาธารณะ (`elevation` card 2 / overlay 6) — ทำ **preview A/B** เทียบกับแบบแบน+เส้น ใน UI epic แรก |
| 5 ขนาดตัวอักษร | **(a)** + ตั้งค่าได้ S (14) / M (16) / L (18) ตัวอื่นย่อ/ขยายตามสัดส่วน | token `textScale` (0.875 / 1 / 1.125); ตัวเลขนับสาธารณะไม่ขยายตาม; การตั้งค่าอยู่ E03 |
| 6 Touch target | **(a)** 48 | คงเดิม |
| 7 สีฟ้า info | **(a)** ไม่มีสี info | คงเดิม |
| 8 card สีเหลือง | ให้ UX แนะนำ | **UX เลือก (a)** — อธิบายง่ายๆ: card เด่น (เช่น "ส่วนแบ่งเจ้าของ") ใช้พื้นครีม `brandCream` ได้เพื่อความสวย แต่ถ้าเป็นการ **เตือน/ติดธง** ต้องมีไอคอนธง 🚩 + คำ เช่น "ต้องตรวจ" เสมอ ผู้ใช้จึงแยกออกจากไอคอน+คำ ไม่ต้องพึ่งสีเหลืองที่หน้าตาเกือบเหมือนกัน |
| 9 สถานะข้อมูล/การเงิน | ok | ใช้ตามที่เสนอ เพิ่ม token เมื่อ story ต้องใช้ |
| 10 สี Sync | ok | คงเดิม (เขียว ✓ / amber / แดง ⚠) |
| 11 ไอคอน | **(b)** ชุดไอคอนเส้น open-licence สำหรับ MVP | story ใน E01 พร้อมตรวจ dependency/ความปลอดภัย — ตัวเลือกที่แนะนำ `@expo/vector-icons` (MIT, ของ Expo เอง, ใช้ `expo-font` ที่มีอยู่) ชุด Feather/Lucide-style |

**ขอบเขตที่รับจากรูปตัวอย่าง FarmMate (เจ้าของ 2026-10-03, U1 b / U2 b):** รับเฉพาะ **การ์ดและไอคอน** —
พื้นการ์ด (`surfaceRaised` + มุม `lg`) พร้อมช่องไอคอนสีอ่อน (`md`) และสไตล์ไอคอน (§12.7); แถบนำทางล่าง FAB
แดชบอร์ด และการชั่งแบบเป็นขั้น ๆ ไม่ใช่ requirement ใช้ทำ mockup วาง flow ก่อน แล้วค่อยเขียน story:
[`mockups/flow-v1.html`](mockups/flow-v1.html)
