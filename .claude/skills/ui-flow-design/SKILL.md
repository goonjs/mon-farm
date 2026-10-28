---
name: ui-flow-design
description: End-to-end method for designing a new or reworked mon-farm screen or flow (UX, owner persona, front-end, QA working together) — from running the real app and finding the real-world workflow, through mockups, role reviews and owner decisions, to shared components and the build checks. Use when the owner asks to redesign a flow, add a UI flow, or when you are about to draw a mockup or build screens. Built from the fertilizer order redesign (E11-S11, 2026-10-27); pairs with phone-form-ux (the per-screen rules).
---

# Designing a UI flow in mon-farm

Order of work. Each step has a gate; do not skip ahead.

## 1. Run the real app first (owner: "ลองรันดูก็จะรู้")

- Build the web export (`npx expo export --platform web --output-dir <scratch>`), serve it with `scripts/serve-dist.mjs` (`DIST_DIR=<scratch>`), drive it with Playwright at 390×844, dpr 2, signed in via `e2e/session.ts` `signedIn`. Seed people/master data with `e2e/fixtures.ts`. Chromium lives in `/opt/pw-browsers/chromium-*/chrome-linux64/chrome` (repo Playwright is a different version: pass `executablePath`). Reading outside the repo needs the owner's yes (AGENTS.md) — ask once, say why.
- Screenshot every step of the CURRENT flow and measure it. Put the old link/preview in doubt: the owner may have used a stale preview — check what HEAD really does before arguing.
- Compare with the home screen: the home is the design reference (cards, tiles with FarmMate icons, big pills).

## 2. Model the real-world workflow, not the data model

Ask "what do they do in life, in what order, with what delay?" The fertilizer flow failed because the app mirrored fields; real life is: phone the shop, order SEVERAL items, goods arrive days later, THEN decide zones/reasons/tappers.
- Split into a quick capture (what you know now) and details-later (per item, any time). Defaults for everything; optional things are small secondary links the owner can still find (underlined grey link, not a button).
- One row/record per real thing (one expense per item, grouped by `orderId`) keeps the money engine, conflicts and reports intact. Ask the solution architect before inventing a model.
- Decide wording from the person's mouth ("สั่งไว้ / ได้ของแล้ว / ของมาแล้ว", not "committed"). Check `docs/ux/glossary.md`.

## 3. Mockup = one PNG per phone, checked by a script

- Generate HTML from a script (`gen.py`-style helpers: appbar, sheet, card, item…) so spacing/tokens stay consistent; use `docs/ux/tokens.css` variables only (no literal colours), FarmMate icons via `<img src=…design/icons/farmmate/…>` for the mockup.
- Gate: `npm run check:mockup -- <file.html> <outDir> 3` must pass (no overflow/"…"/clipped/overlapping content; one PNG per phone at 3×). The owner rule: **nothing is cut off or off-screen**. The first version of this check missed a squeezed flex row — when the owner finds a layout bug, extend the check, don't only fix the screen.
- Look at the PNGs yourself at phone size (montage 4 phones side by side) before showing anything. Read captions as the owner: plain Thai, one idea each, with AC ids.
- Show options side by side when the owner asks "which is better": same task on every phone (e.g. "enter 20 sacks"), count the taps, say which you recommend and why. Keep rejected options out of the build.

## 4. Role reviews in parallel (separate agents, give them PNGs + source, not your conclusion)

- Owner persona (age 50+, one thumb, sun, big text, hates typing): walk 2–3 real scenarios; report hesitation, wrong words, tap counts.
- QA: test-design table (money to the satang, edit/delete/restore, two devices, offline, legacy data), fit checks to run on the real build, undefined rules, a11y (targets ≥ 48, contrast, colour-never-alone).
- Design-system + front-end: tokens/scale/targets/Thai line-height/text-size setting, which components exist vs are new, icon pipeline.
- Architect: data model options and the riskiest points.
Fold the results into the mockup and the story. Reviews catch real things (default stage wrong for real life; icons not in the registry; targets < 48) — but treat agent output as input, verify it yourself.

## 5. Owner decisions → story → build

- Write/refresh the story (`docs/stories/…`) in the same session: AC with ids that the mockup captions cite, open questions with a stated default, test plan, offline/sync section. Status Ready only after the owner says go.
- Capture owner rules immediately where they live (AGENTS.md / this skill / DoD) — e.g. "nothing cut off", "no +/- steppers, no OS keyboard for numbers".
- Reuse before building: shared components in `src/ui` (NumberPad, QuantityField, MoneyField, BottomSheet, Card, IconTile, CTA…). A pattern the owner approved becomes THE component; do not re-invent per screen.
- Split the build into disjoint file sets and run workers in parallel: fix the contract (types + stubs) in a committed file first; one worker owns the pure logic (vitest), one the UI (jest); nobody commits except you; you run the full checks (tsc, eslint, jest, vitest, token/colour rules) and commit.

## 6. Done = measured on the real build

- Run the real web build at 390×844 and record, per screen: scroll height ÷ viewport (≤ 1.0 golden path), no sideways overflow, no clipped text; also at the largest text size (E03-S08). Side-by-side with the mockup PNG; fix the build if it is busier or taller. Put numbers in the story QA notes.
- Independent review by a separate agent/session, then CI green, before asking the owner.

## Things that went wrong here (do not repeat)

- Showing a mockup that was not gate-checked (chips cut off at the edge) — twice.
- Hiding the two-step real workflow behind one long form; defaulting a status that implies money moved.
- A stepper (± by 1) or the OS keyboard for numbers: the owner rejected both; use the in-app NumberPad.
- Unit chips beside a number field: use a dropdown. Discounts and "other items": secondary links, not prominent buttons.
- Compound shell commands (git add && commit && push; many steps in one) get blocked by the safety classifier — run git steps separately.
- A worker that writes tests after code (baht words): ask for the failing run to be shown, or re-verify yourself.

## Where to look

- Per-screen rules: `.claude/skills/phone-form-ux/SKILL.md`; owner rules: `AGENTS.md`; gate script: `scripts/check-mockup-fit.mjs`.
- Worked example: `docs/stories/e11-s11-fertilizer-order.md`, `docs/ux/mockups/flow-fertilizer-order-v2.html`, `docs/ux/mockups/number-input-options.html`, PNGs under `docs/ux/screenshots/v2/money/`.
