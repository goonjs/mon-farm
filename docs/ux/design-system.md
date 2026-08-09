# Design system — mon-farm

Status: **Draft v0.1** · Authored 2026-08-10 · Companion gallery:
[`design-system.html`](design-system.html)

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
  accent, no gradient.
- **No web fonts, ever.** The app must be fully usable offline on first launch
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

| Hue | Token | Means | Never means |
|---|---|---|---|
| Blue | `action` | **Interactive.** Touch this. | A state. Blue never reports anything. |
| Green | `accept` | **Counted.** This basket is in. | A control. Nothing green is pressable. |
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

`node scripts/check-contrast.mjs --strict` checks all 46 pairings the system
actually uses, each against a floor chosen for its use:

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
| Unsynced | Half-filled dot + count | Topbar right | `ค้าง N` |

The last three are non-blocking by design. They report; they never gate
counting. A screen that stops you counting because its clock is wrong has
misunderstood which of the two is more important.

---

## 8. Touch targets

`target.min` is **48pt**, above the 44pt platform floor. NFR-4: one-handed, in a
yard, possibly wet or gloved hands. `target.comfortable` is 56pt for anything
used repeatedly.

The stage itself is the hold target and fills the panel — it is the largest
touch target in the app because it is the one pressed hundreds of times.

Destructive and irreversible controls (close pile, close zone, close sale, void)
are **never** placed adjacent to the stage or to each other, and always require
a second confirm.

---

## 9. Layout: landscape, tabbed

Landscape only, locked on native. Reference viewports:

- `844 × 390` — modern 6.1″ phone
- `740 × 360` — the NFR-4 low-end Android floor; layout must hold here

Three tabs (F-19): **Count** / **Pile & Zone** / **Log**. When any tab other
than Count is active, a persistent mini-count stays in the topbar — leaving the
Count tab must never mean losing sight of the number.

Web has no orientation lock. A portrait browser window gets an explicit "rotate
your device" state rather than a collapsed layout, so a human opening it in the
wrong shape sees an explanation instead of a bug.

---

## 10. Motion

Motion is functional here, and there is very little of it.

| Token | Duration | Use |
|---|---|---|
| `flash` | 180ms | Accept/reject wash |
| `move` | 160ms | Tab and panel transitions |
| `hold` | 3000ms | The dial sweep — this *is* the anti-mistap budget |
| `toast` | 2400ms | Transient confirmations |

`prefers-reduced-motion` removes the dial's sweep animation but **not the
3-second delay** — the delay is a safety mechanism, not decoration. Under
reduced motion the dial steps through discrete tick states instead of sweeping
continuously, so duration stays visible without continuous animation.

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
