# Counter Screen — UX Findings

> Status: **Findings for owner review.** Not decisions, and not PRD
> content. This document analyses the counter screen requirements already
> agreed in `docs/prd.md` v0.4 (FR-5, FR-9, FR-11, FR-12, NFR-4) against
> the three goals the owner named: **easy to use, transparent, hard to get
> wrong.**
>
> Nothing here changes a requirement. Findings marked **[GAP]** are things
> the PRD does not currently answer and that need an owner decision.
> Findings marked **[TEST]** are the ones the PRD already says are settled
> by prototype testing rather than on paper (see *"UX decisions are settled
> by testing, not by this document"*), and are written as variants to try,
> not as recommendations to adopt.
>
> 18 findings: 7 gaps, 7 to settle by testing, and 4 design consequences
> that follow from constraints already agreed.

## Method

Read FR-5 (counter screen), FR-9 (social cross-check), FR-11 (voice),
FR-12 (timestamps/audit) and NFR-4 (field usability) against each other,
looking for places where two agreed requirements compete for the same
resource — screen area, operator attention, or the one tap per basket.
Where they compete, something has to give, and it is cheaper to decide
that now than to discover it at a scale.

---

## The constraint that orders everything else

FR-9.1 requires the count to be readable by the ล้ง at ~10 m. FR-9.7
already acknowledges this is the binding physical constraint. Working the
numbers through gives a sharper answer than the PRD currently carries, and
it reorganises the whole screen.

**How tall the numeral must be.** The standard signage rule is roughly
25 mm of character height per 3 m of viewing distance for *comfortable*
reading — about **83 mm at 10 m**. The bare *threshold* of legibility is
around distance/250, about **40 mm at 10 m**. So FR-9.7's stated 50–80 mm
range is really "marginal at the bottom, comfortable at the top", which is
worth knowing when choosing where in that range to land.

**How tall a numeral the device can actually carry.** In landscape, the
limit is the screen's short dimension:

| Device | Landscape short dimension | Usable numeral height (less ~6 mm margins) |
| --- | --- | --- |
| 6.1" phone (19.5:9) | 65 mm | **~59 mm** |
| 6.7" phone (19.5:9) | 71 mm | **~65 mm** |
| 8.7" tablet (16:10) | 117 mm | **~110 mm** |
| 11" tablet (16:10) | 148 mm | **~140 mm** |

**Consequence:** a phone physically cannot reach the comfortable end of
FR-9.7's own range. Even a large phone tops out around 65 mm, which is
adequate-but-marginal at 10 m and gets worse in glare, at an angle, or for
an older ล้ง's eyes. A small tablet clears it with room to spare.

**Width is not the binding constraint; height is.** At 59 mm tall, a digit
in a tabular/condensed face is ~33 mm wide, so three digits need ~100 mm
of the phone's 143 mm long dimension. Three digits fit. But that leaves
only **~35 mm of width** for everything else on the screen — the operator
strip on a phone is a narrow column, not a panel. This is what forces the
findings in Group A.

---

## Group A — Layout: what earns space on the screen

### F-1 [GAP] Three requirements each ask to be prominent; the screen can carry one

FR-5.1 (the count, readable at 10 m), FR-5.2 (expected scale reading,
"prominently"), and FR-5.3 (running count *and* running net weight,
"visible at all times") all claim priority on a surface that — per the
arithmetic above — has room for one large number and a 35 mm margin.
FR-9.2 already says the count is the only thing that must carry 10 m, but
FR-5.2 and FR-5.3 were written independently and still read as competing
claims.

**Recommendation — name three registers and assign every element to
exactly one.** This resolves F-1 through F-4 together and gives every
future layout variant a rule to be judged against:

| Register | Read by | At | Carries |
| --- | --- | --- | --- |
| **Public** | the ล้ง, worker lead, anyone present | ~10 m, glanced at | The basket count. Nothing else. |
| **Operator** | the person tapping | ~0.4 m, when they can look | Pile identity, expected reading, running net weight, sale total, controls, state indicators |
| **Announced** | everyone present | audible | Read-back, พร้อมค่ะ, each count, corrections, pile totals |

The announced register is what makes the tiny operator strip acceptable:
anything the other party needs but cannot read at 10 m can be **heard**
instead of shown. FR-11 already built that channel — this finding is
mostly about using it deliberately rather than duplicating everything
visually.

### F-2 The expected scale reading is constant per pile and does not need continuous prominence

FR-5.2 asks for the expected reading (e.g. `52 กก.`) to be prominent. But
it is fixed for the whole pile — it is tare plus standard net, and both are
locked before counting starts (FR-3.4, FR-4.1). A number that never changes
does not need to compete with one that changes every basket.

**Recommendation:** establish it loudly *once*, in the read-back (FR-11.1),
where all parties hear it before the first basket; then keep it in the
operator register as a small persistent reminder. It becomes prominent
again only if the tare changes mid-sale (FR-3.4, Open question 4).

### F-3 Running net weight is a derived number, not an observed one

For standard baskets, running net weight is just `count × standard net`.
Showing it at 10 m would invite the ล้ง to verify a number the app
calculated rather than the number they can independently check by watching
baskets. The count is the honest public figure because it corresponds to
something physical the observer can tally themselves.

**Recommendation:** net weight lives in the operator register, and is
**announced** at pile close where it matters (F-11 below). Keep the public
register a count of physical objects.

### F-4 [GAP] Pile transitions make the public number fall off a cliff, with no visual explanation

When pile 1 closes at 87 and pile 2 starts, an observer at 10 m sees the
number go `87 → 1`. To someone who is deliberately not holding a device and
not reading the small print, that reads as data loss — exactly the
impression the transparency model exists to prevent. FR-11.1's read-back
covers the transition *audibly*; the PRD does not say what the public
register does *visually*.

**Recommendation:** treat pile transition as a deliberate, visible event
rather than a silent reset — the count is replaced by a brief full-screen
pile identity, then the new count starts. And per F-11, announce the closing
pile's total aloud before resetting, so the 87 is publicly banked before it
disappears.

### F-5 [TEST] Landscape lock, one-handed use, and aiming the screen at the buyer are three demands on the same pair of hands

FR-9.7 forces landscape. NFR-4 requires one-handed use while standing.
FR-9.3 requires the screen to be turned towards the other party — which
means the operator is holding it at an angle where **they** may not see it
well. A phone held one-handed in landscape, pointed away from you, near a
truck, is also the easiest phone to drop.

**This couples Open question 1 to Open question 2.** If the device ends up
propped or on a stand — which the tablet answer to Q2 makes likely — then
the accidental-tap problem changes shape completely: a stationary device is
far less prone to brush-taps, but also cannot be tapped without reaching
for it. The two questions cannot be tested independently.

**Recommendation:** test held-phone and propped-tablet as whole
configurations, not as a device choice and a tap design chosen separately.

---

## Group B — Error prevention (PRD Open question 1)

### F-6 The two error directions are equally likely but not equally *detectable*, and that should aim the safeguard

- **Phantom count** — a tap with no basket. Inflates the count; the owner
  is paid for rubber that does not exist.
- **Missed count** — a basket weighed with no tap. Deflates the count; the
  owner loses money.

Neither self-corrects: once the count is off by one it stays off by one for
the rest of the pile. What differs is *when someone notices*. An error made
**in rhythm** — while baskets are moving and everyone is listening to the
spoken count (FR-11.3) — is caught socially within a basket or two, because
the announced number stops matching what the people at the scale are
tracking. An error made **out of rhythm** — a pocket tap, a brush while
repositioning, a tap during a lull when nobody is counting along — is
caught by nobody, because at that moment there is no shared count to
contradict it.

**Recommendation:** spend the error-prevention budget on out-of-rhythm
taps, and leave in-rhythm counting frictionless. The social mechanism
(FR-9, FR-11) is already covering the in-rhythm case, and adding friction
there costs speed for protection that is redundant.

### F-7 [GAP] A silently rejected tap converts a phantom count into a missed count

Every debounce-style safeguard rejects some taps. If rejection is silent,
the operator — whose eyes are on the scale, not the phone (FR-5.7) — will
believe the basket was counted. The safeguard then *causes* the error class
it was not designed for, and the missed count is the more expensive one for
the owner.

**Recommendation:** rejection must be as loud as acceptance and
**distinguishable from it** — a different sound, a different haptic
pattern. This is a hard constraint on every variant in F-8, not a
refinement of them. It should be treated as a requirement whichever variant
wins.

### F-8 [TEST] Five variants worth building for Open question 1

The PRD lists tap-based candidates. Two non-tap candidates are worth adding
because they attack the problem at its root — a screen that is not a button
cannot be brushed.

| # | Variant | Why it might win | What it costs / risks |
| --- | --- | --- | --- |
| V1 | **Minimum interval lockout** — reject counts within N ms of the last | Trivial; kills double-taps, the most common mistap | Rejects genuinely fast piles with two loaders; needs F-7's loud rejection; N is a guess until F-10 |
| V2 | **Count immediately, prominent undo on fast repeats** — no rejection, but an implausibly fast repeat surfaces a large cancel affordance | Never blocks a real basket; leans on the spoken count as the detector, matching F-6 | Relies on the operator acting during a window while busy |
| V3 | **Tap-target geometry** — large centred target with dead margins, vs. whole screen | Dead margins block edge brushes from grip; still glove-friendly | On a phone the operator strip already claims 35 mm (see above); a dead margin competes with it |
| V4 | **Swipe to count** — a short deliberate gesture instead of a tap | Very brush-resistant; works with gloves; no precise aim needed | Slower per basket; unfamiliar; needs testing with wet/dirty screens |
| V5 | **Hardware button** (volume key) — screen becomes display only | Eyes-free, tactile confirmation, wet/dirty/gloved hands, and it **frees the entire screen for the 10 m numeral**, resolving Group A's squeeze | Packaging-dependent — see F-9 |

V5 is the one most worth prototyping early, because it is the only variant
that improves the layout problem and the error problem at the same time.

### F-9 [GAP] The hardware-key variant depends on a packaging decision that has not been made

Intercepting hardware volume keys is **not available to a web app or
PWA**. It requires a native wrapper (Capacitor/React Native) or a native
build. NFR-5 leaves packaging as an open architecture decision, and
`docs/architecture.md` is still unwritten.

**Recommendation:** do not finalise the packaging approach before V5 has
been tried. If V5 turns out to be the best answer to the product's sharpest
UX question, it silently removes pure-PWA from the option set — and that is
a decision better made deliberately than discovered later.

### F-10 [TEST] FR-12.4 already provides the instrument for choosing the threshold — use it from the first prototype

FR-12.4 notes that inter-count intervals are evidence, and that they give
the anti-mistap work real data. That only pays off if the **throwaway
prototype variants log intervals too**. A single real sale produces
hundreds of intervals, and the histogram answers directly what no amount of
discussion can: where the real weighing rhythm sits, and therefore what
interval is genuinely implausible.

**Recommendation:** instrument every variant to log `(sequence, timestamp,
accepted/rejected, variant)` from day one, even though prototypes are
otherwise exempt from the story/TDD ceremony. It is a few lines, and it
converts Open question 1 from a judgement call into a measurement.

---

## Group C — Corrections, off-standard baskets, and the limits of the record

### F-11 [GAP] Corrections are recorded but never spoken — the heard record and the stored record can diverge

FR-12.2 lists what the app speaks: read-back, พร้อมค่ะ, each count,
ต่อไปค่ะ. FR-12.3 says corrections are timestamped. **Nothing says a
correction is announced.** So if the operator undoes basket 42, everyone at
the scale has heard "สี่สิบสอง" and the record says 41 — and the next
announced count is "สี่สิบสอง" again, which sounds to the room like a
double-count rather than a correction.

This is the transparency model failing in exactly the place it is most
needed, because a correction is precisely the moment a suspicious
counterparty is paying attention.

**Recommendation:** speak corrections — something to the effect of
"ยกเลิก เหลือ สี่สิบเอ็ด" — and add them to FR-12.2's list of announcements
that are recorded. Also announce pile totals at close (F-3, F-4). Exact
wording belongs with Open question 6.

### F-12 [TEST] Undo needs two tiers; a reason prompt mid-weighing is the interruption FR-12.7 warns against

FR-5.4 requires corrections to carry a reason. FR-12.7 argues — about clock
anomalies — that a modal mid-count "would cause exactly the kind of error
the counter screen exists to prevent". The same logic applies to a reason
prompt: a mistap happens *during* the rhythm, and stopping to categorise it
is worse than the mistap.

**Recommendation:** two distinct affordances.
- **Undo last** — one action, no prompt, no modal, recorded with a default
  reason (e.g. `mistap`). Available only for the most recent count and only
  briefly. Frictionless because it is used in rhythm.
- **Void a specific count** — reached deliberately from the pile's count
  list, in a lull, and *there* a reason is prompted for, because there is
  time and because a targeted void is a considered act.

Both remain append-only events per NFR-3. Neither rewrites history.

### F-13 [TEST] Off-standard entry breaks the one-tap rhythm at the busiest moment, and a keypad would hide the count at the most disputable one

FR-5.6 requires recording an actual scale reading for a basket that is not
standard. That is a numeric keypad — a completely different interaction
from a single tap — and the most common occasion for it is the short-filled
**last basket of a pile**, i.e. the moment the operator is also closing out
and reading totals. Worse, a keypad overlay would cover the public count at
precisely the basket most likely to be argued about.

**Recommendation:** keep the public register visible during off-standard
entry rather than covering it, announce the entered figure aloud ("ใบ
สุดท้าย สี่สิบสาม กิโล"), and consider making "close this pile" a flow
that *offers* the final-basket reading as a step — turning the most
predictable exception into part of the path rather than an interruption to
it.

### F-14 [GAP] The app is blind to the scale — this is the largest remaining money-accuracy gap, and it is not a technical one

For every standard basket the app records the *agreed* standard net weight,
not a measured one. It has no idea what the scale actually read. FR-5.6
handles the case where somebody **notices** a basket is off-standard. The
unhandled case is the basket that is off-standard and **nobody notices** —
it is silently recorded as standard, and the settlement then asserts, with
full audit trail and timestamps, a weight that was never measured. The
record looks exactly as trustworthy as a correct one.

This is not solvable in software as long as the scale is not connected. It
is solvable *socially*, by the same mechanism as the count:

**Recommendation:**
- The read-back (FR-11.1) stating the expected reading aloud is what makes
  a deviation noticeable in the room — this is load-bearing for money
  accuracy, not just ceremony, and is an argument for keeping the expected
  reading in the read-back even if it is trimmed elsewhere (Open question 6).
- Make **"ไม่ตรง" (doesn't match) a sibling of the count button, not a mode
  buried in a menu.** One extra tap, available at all times, used only when
  needed. If capturing an off-standard basket is harder than counting a
  standard one, it will not happen at speed, and the gap stays open.

---

## Group D — Field conditions

### F-15 [TEST] The sunlight-contrast choice trades directly against battery, and both are requirements

NFR-4 makes sunlight legibility load-bearing: a washed-out screen removes
the product's guarantee of a fair count, not merely its convenience. Phone
screens are additive, so the brightest thing available is a **white
background at maximum brightness** — dark-numeral-on-white beats
white-on-black outdoors. But maximum brightness on a white full-screen for
the duration of a large sale is the worst case for battery and heat, and
NFR-4 also requires tolerating low-end Android devices and poor battery.

Both cannot be maximised. **Recommendation:** measure it — screen-on time
at full brightness on the actual target device, against actual sale
duration — rather than choosing a palette on aesthetics. If the device is
propped rather than held (F-5), keeping it plugged into a power bank
becomes practical and the trade-off largely dissolves.

### F-16 [GAP] Five states need non-colour encoding, and the operator strip is 35 mm wide

FR-9.6 forbids colour as the sole carrier of meaning. Collecting the states
the counter screen must express:

1. Counting / active
2. Between piles / paused
3. Audio degraded — muted, TTS unavailable (FR-11.10)
4. Clock anomaly flagged (FR-12.7)
5. Unsynced / sync error (NFR-2)

Each needs a shape, position or text difference, not just a colour. On a
phone, all five compete for the narrow column left over from the numeral
(see the width arithmetic above).

**Recommendation:** decide which of these belong on the *counting* screen
at all. States 4 and 5 are explicitly non-urgent — FR-12.7 says a bad clock
must not interrupt a weighing, and sync status is required only "at least
at the sale level" (NFR-2), which is not the counter screen. Both could be
deferred to the pile-close or sale screen without violating either
requirement. States 1–3 are the ones that change how the operator behaves
in the next ten seconds, and are the ones that have earned their place.

### F-17 Audio is the primary confirmation and also the likeliest thing to fail — so the fallback is the normal case, not the degraded one

FR-5.7 makes the spoken count the primary confirmation, with visual and
haptic as backup "for when audio is unavailable or inaudible". But NFR-4
already anticipates a working yard with engines, wind and people, and
FR-11.9 anticipates volume being the limiting factor. Realistically, audio
will be partially inaudible for a meaningful share of real sales.

**Recommendation:** design the haptic and visual confirmation as a
first-class confirmation path that works on its own, and validate the
screen against the assumption that **nobody can hear it**. If the counter
is usable and trustworthy silent, it is comfortably usable with sound. The
reverse does not hold. This also strengthens F-7 — rejection feedback in
particular cannot be audio-only.

---

## Group E — Setting the norm

### F-18 [TEST] The first-count popup lands at the worst possible moment

FR-9.3 puts a popup and animation on the **first count of a sale**,
prompting the operator to turn the screen towards the other party. But the
first count happens with a basket on the scale and the rhythm just
starting. Interrupting there is the one thing FR-12.7's reasoning says not
to do, and it trains the operator to dismiss popups fast — which is the
opposite of the norm the popup exists to establish.

**Recommendation:** move it to **Ready / พร้อมค่ะ** (FR-11.2), which is
already the designated pause where both sides are attending, terms have
just been read aloud, and nothing is on the scale. The intent of FR-9.3 —
establish on basket 1 that the screen is theirs to watch — is better served
by doing it just *before* basket 1 than by interrupting it.

---

## Suggested testing sequence

The PRD is right that these are settled at a scale, not on paper. Two of
them can be settled much sooner and much more cheaply than the rest.

1. **This week, with a printer and no code — settles Open question 2.**
   Print `1`, `42`, `187` at 40, 50, 60, 80 and 110 mm. Take them to your
   own yard, in the sun, and have your ล้ง read them from where they
   actually stand. That single test tells you whether the counting device
   is a phone or a tablet — which per F-5 governs the tap-design work, and
   per F-9 feeds the packaging decision. Doing it first avoids prototyping
   the tap variants for the wrong device.
2. **Then build the counter variants** (F-8) on whatever device step 1
   selected, instrumented per F-10, with F-7's loud rejection in all of
   them.
3. **Run them at a real sale**, and use the interval histogram to set the
   threshold rather than choosing it beforehand.
4. **Test silent** (F-17) — at least one variant run with the volume off,
   to see whether the screen alone carries it.

## What this changes

Nothing yet — this is analysis of an agreed PRD, not an amendment to it.
For the seven **[GAP]** findings (F-1, F-4, F-7, F-9, F-11, F-14, F-16)
the PRD does not currently give an answer, and F-11 and F-14 in particular
look like genuine holes in the transparency model rather than matters of
taste.
Those are the ones worth a decision before epics are sharded. The **[TEST]**
findings need no decision now — they need variants and a scale.
