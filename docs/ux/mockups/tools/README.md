# Mockup generators (proposal — the lead decides whether to keep them)

Two one-off Python scripts that wrote mockups from the head + icon sprite of an existing mockup, so a screen is a function call, not hand-copied HTML.

| Script | Writes | Starts from |
|---|---|---|
| `gen_choice_tiles.py` | `docs/ux/mockups/flow-choice-tiles.html` (E01-S25/S26, 53 phones) | `flow-farm-v1.1.0.html` |
| `gen_e05_s12.py` | `docs/ux/mockups/e05-s12-tapper-money.html` (E05-S12, 4 phones) | `flow-sale-v1.1.0.html` |

Run from the repo root: `python3 docs/ux/mockups/tools/gen_choice_tiles.py`, then `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run check:mockup -- <file.html> <outDir> 2` (must give 0 FAIL).

## Rule if these stay
Edit the script and regenerate. Never edit the generated HTML by hand, or the script goes stale.

## What is reusable
The helpers: take head + sprite from a base mockup, phone/screen/app-bar builders, before/after figure with a label, and the choice-style helpers (A B E F H I). The screen content (numbers, names, texts) is specific to each story.

## Weak points
- They cut the base file by text position, so they break if the base mockup changes shape.
- `gen_choice_tiles.py` and `gen_e05_s12.py` repeat the helpers; a shared module would be better than two copies.
