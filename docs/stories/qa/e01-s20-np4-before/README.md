# E01-S20 NP-4: payload tests on the code before the pad

Proof that the NP-4 payload tests pass on the old text boxes, so the values
saved did not change when the fields moved to the app pad. Re-run on
2026-11-17 because the first run (`.expo/before-run.txt`) was never in git.

## What is here

The four test files as first committed with the pad (`0faf83c` for money,
farm and sale; `fb94a7d` for debt), with **only the typing helper** switched
back to the old text box (`fireEvent.changeText`; the old % box in the share
sheet opens from its chip first). Every assertion is unchanged; `diff` against
those commits shows only the helper lines. They are `.tsx.txt` so jest and
TypeScript in this repo do not pick them up.

## Run it

From the repo root (the worktree stays inside the repo and is git-ignored
through `.git/info/exclude`):

```bash
echo ".np4-before/" >> .git/info/exclude
git worktree add .np4-before 3ccbbe9          # dev just before the pad (0faf83c)
ln -s ../node_modules .np4-before/node_modules
for f in money farm sale debt; do
  cp docs/stories/qa/e01-s20-np4-before/v2-numpad-$f.test.tsx.txt \
     .np4-before/src/__tests__/v2-numpad-$f.test.tsx
done
(cd .np4-before && npx jest src/__tests__/v2-numpad- --verbose)
```

## Result (2026-11-17, at `3ccbbe9`)

| File | Passed | Failed | What failed |
|---|---|---|---|
| money | 35 | 4 | all in "on the pad (NP-5, NP-6)": words under the figure, ตกลง shut with a reason — pad only |
| farm | 28 | 10 | NP-5/6, NP-12, NP-13 (era on the card), row 16 "on the pad", and two "the other way" checks that call pad code (`scaledToEntry`, `plantedProblem`) not yet written |
| sale | 16 | 9 | NP-12/14/15 pad sheets, ตกลง on a closed sale, the 4 · 3 decimal pad |
| debt | 15 | 1 | the plan prefill round-trip presses the pad's ตกลง |

Every test that types a value and checks the event or payload (satang,
0.01 ไร่, grams, พ.ศ., %, including blank, 0, too many decimals and the
largest value) passes on the old code. The ones that fail test the pad
itself, which did not exist yet. The same files, with the pad helper, pass on
`dev` today (`npm run test:ui`).
