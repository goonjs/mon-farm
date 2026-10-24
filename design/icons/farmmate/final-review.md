# FarmMate icon pilot: final independent review

Date: 2026-10-24. Reviewer: independent agent (had not seen any prior work).

## Method

- Source of truth: `references/farmmate-icon-pack.png`, top row, three panels (nav, farm, sale).
  The pre-made 6x crops were checked against a fresh crop of the original sheet and match it.
- Each `design/icons/farmmate/<id>.svg` was rendered with `resvg` at 400px wide on white and placed
  above the matching 6x source crop for a side-by-side check of silhouette, proportions,
  composition and colour family.
- Colour was checked by sampling dominant source pixels and computing CIEDE2000 against the SVG fills.
- The accepted exceptions were honoured: legend snap at ΔE2000 ≤ 10, `#1A9CF2` back mountain in
  farm.photos, `#FEAB1E` coin sides in sale.rubberPrice, and edge blur.

## Results

| Icon | Verdict | Note |
|---|---|---|
| nav.home | PASS | Navy roof chevron over a blue house with an arched door. Matches. |
| nav.myFarm | PASS | Same three-lobe canopy, forked trunk and colours. |
| nav.reports | PASS | Three ascending rounded bars. Blue snapped to legend (ΔE 5.3). |
| nav.settings | PASS | 8-tooth navy-outlined gear, pale fill, ring hub. |
| nav.notifications | **FAIL** | Wrong colour family. The source bell is orange-amber (`#F8A828`, ΔE 10.3 to `#FECB56`, 1.4 to `#FEAB1E`). The SVG is the paler legend yellow. The shape is correct. |
| nav.profile | PASS | Head and shoulders silhouette and proportions match. |
| nav.help | PASS | Navy ring with a "?" whose weight matches. |
| nav.more | PASS | Three navy dots, evenly spaced. The viewBox is tight to the dots, which is fine. |
| farm.allFarms | PASS | Big and small tree pair overlap the same way. The small tree is legend green (ΔE 7.4). |
| farm.plotZone | PASS | Red pin with a white halo over a striped green parallelogram field. |
| farm.map | PASS | Navy tri-fold outline map. |
| farm.weighPoint | PASS | Three trees, tallest in the centre, on a yellow mound. |
| farm.info | PASS | Teal doc outline with blue lines and a tree in the bottom right that overlaps the doc. |
| farm.treeCondition | PASS | Two-leaf sprout with lighter inner veins on a green mound (ΔE 8.0). |
| farm.activity | PASS | Navy clipboard with a clip, two green checks and three blue lines. |
| farm.photos | PASS | Navy frame, sun disc, two overlapping mountains. |
| sale.recordYield | PASS | Brown basket with a white rubber-sheet mound and the dot/dash weave. |
| sale.weigh | PASS (note) | Navy pan, green body, white dial. The dial accents are legend yellow where the source is slightly orange. They are small enough to accept, but should be aligned if the colour fix below is made. |
| sale.sale | **FAIL** | Wrong colour family on the coin. The source coin is orange (face `#FEB022`, side `#FFA71A`; side ΔE 11.3 to `#FECB56`). The SVG coin is flat legend yellow, so it reads paler and no longer matches the sibling sale.rubberPrice coins. Cart shape and composition are correct. |
| sale.yieldStats | PASS | Three green bars with a rising blue arrow. |
| sale.rubberPrice | PASS | Stack of 3 coins plus a stack of 2, with yellow faces and orange sides (accepted exception). |
| sale.comparePrice | PASS | Rotated red tag with a hole, string and loop knob. |
| sale.receipt | PASS | Navy doc with 3 lines (the third is lighter blue) and a green $ badge. |
| sale.salesReport | PASS | Blue pie with an offset red quarter slice. |

## Overall verdict

**NOT YET APPROVED: 22 of 24 pass, 2 need one more fix round.**

Every silhouette, proportion and composition is a faithful match. None of the 24 has a missing
element, a wrong shape or an unrecognisable form. The two failures are colour only, and they share
one cause: the sheet's orange accent (about `#F8A828` / `#FFA71A`) was snapped to the legend's
Yellow `#FECB56`. That gap is just over the ΔE ≤ 10 snap tolerance, and it is visible at a glance
next to the source.

- **nav.notifications**: bell fill `#FECB56` → `#FEAB1E`.
- **sale.sale**: coin `#FECB56` → `#FEAB1E` (or face `#FECB56` with side `#FEAB1E`, to match sale.rubberPrice).
- Optional, for consistency: sale.weigh dial accents → `#FEAB1E`.

Using `#FEAB1E`, the measured orange already accepted for sale.rubberPrice, keeps the set
consistent. After that recolour, the set can be approved.

## Re-check after the colour fix (2026-10-24)

The coordinator changed the orange accents from `#FECB56` to `#FEAB1E`. Only the fill hex changed. I re-rendered the three files and compared them to their source crops again.

| Icon | Verdict | ΔE2000 to source, after the fix |
|---|---|---|
| nav.notifications | **PASS** | bell `#F8A828` vs `#FEAB1E`: 1.4 (was 10.3) |
| sale.sale | **PASS** | coin face `#FEB022`: 1.7; side `#FFA71A`: 1.5 (side was 11.3) |
| sale.weigh | **PASS** | dial needle and ticks now orange, matching the source and the other icons |

Shapes are unchanged and still match. All three now sit well inside the ΔE ≤ 10 tolerance.
The 21 icons that already passed were not re-reviewed.

## Final verdict

**APPROVED: all 24 match the source design.**
