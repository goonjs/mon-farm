# Story: Remove app-side seed, seed e2e via storage, add the sale list

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Depends on: S15 (per-zone contracts), S16 (people store)
- Owner instruction: no hardcoded or seeded data in the app.

## Description

`src/demo.ts` and the `?baskets=` seam are deleted. The app no longer writes
anything on its own — a sale with no events is a real, legitimate state, not a
placeholder waiting for demo data.

That required a route restructure, since a single global `SaleProvider`
wrapping the whole app assumed exactly one (seeded) sale existed:

```
src/app/_layout.tsx              theme only, no sale in context
src/app/index.tsx                NEW — sale list, the app's front door
src/app/sale/[id]/_layout.tsx    NEW — SaleProvider, keyed by the route param
src/app/sale/[id]/counter.tsx    moved from src/app/index.tsx
src/app/sale/[id]/settlement.tsx moved from src/app/settlement.tsx
src/app/sale/[id]/setup.tsx      NEW — stub; the real screen is S6
```

The sale list shows only sales that genuinely exist in the store (via
`store.listSales()`), resumes an open one into the counter and a closed one
into settlement, and starts a new one by generating an id and navigating to
the setup stub — writing no event until setup (S6) actually records something,
so an abandoned "new sale" leaves no trace.

e2e seeding moved entirely into the test layer. `e2e/fixtures.ts`'s `seedSale`
writes directly into `localStorage`, matching `store.web.ts`'s exact schema,
using real `SaleEvent[]` built from `src/core/fixtures.ts`'s `LogBuilder` and
`workedExample()` — the same fixture `settle.test.ts` already checks to the
satang, so the e2e settlement assertions cannot drift from the unit-tested
figures.

## Acceptance criteria

- [x] `src/demo.ts` deleted; nothing references it.
- [x] `SaleProvider` takes no `seed` prop.
- [x] Sale list shows the true empty state with nothing seeded.
- [x] An open sale resumes into the counter screen at its real count.
- [x] A closed sale resumes into settlement, not the counter.
- [x] Starting a new sale writes no event; leaving the stub loses nothing.
- [x] e2e seeds via `localStorage` directly, no app code involved.
- [x] `LogBuilder`/`workedExample()` accept a real sale id, so seeded events
      carry the same id the route and store key by.

## Offline / sync behavior

Unchanged from S5/S15 — this story only removes a seeding shortcut, it
doesn't touch persistence itself.

## Test plan

- [x] `e2e/sale-list.spec.ts` (new): empty state, open-sale resume, closed-sale
      resume, start-new-sale round trip.
- [x] `e2e/counter.spec.ts` and `e2e/settlement.spec.ts` rewritten against
      `seedSale`/`openPileScenario`/`workedExample` instead of the app seed.

## Verification

- [x] `npm run verify` green: 46 core, 10 component, **32 e2e** (24 existing +
      8 new), both viewports.
- [x] Screenshots refreshed — `docs/ux/screenshots/*/counter-*.png` and
      `settlement.png` now show real seeded data via the new fixtures, not the
      old demo sale.

## Dev notes — three bugs found and fixed, none of them the story's actual scope

**1. `expo export`'s static output writes dynamic routes at their literal
`[id]` path**, not one file per possible id — `/sale/[id]/counter` becomes the
literal file `dist/sale/[id]/counter.html`. Every e2e test against a real
per-test sale id 404'd until `scripts/serve-dist.mjs` learned to match request
paths against bracket-segment patterns, the same way a real static host
(Vercel, Netlify, an S3+CloudFront rewrite) would. This is exactly the kind of
thing that only surfaces once routes stop being hardcoded — worth knowing
before S6 adds more dynamic-adjacent routes.

**2. `.expo/types/router.d.ts` (gitignored, generated) goes stale across a
route restructure and `expo export` does not regenerate it** — only the dev
server does. A fresh checkout never has this problem (the file doesn't exist,
and `tsc` falls back to a loose, unvalidated `Href` type rather than erroring),
so this is a local-dev annoyance, not a CI risk — confirmed by typechecking
with the file both present and absent.

**3. Real navigation bug, not a test artifact**: the settlement/setup screens'
"back" buttons were `<Link>`s pushing a fresh copy of the screen the user came
from, rather than popping back to the existing one. `replace` was tried first
and doesn't fix it — it swaps the *current* stack entry, but the original
instance further down the stack (list → setup → "back", pushed originally)
is still there, so repeated toggling still accumulates hidden screen
instances. The actual fix is `router.back()`: a real pop, reusing whatever
screen is already on the stack. Left as `Link` (a genuine forward push, not a
toggle) for `list → setup`, `list → resume a sale`, and `counter → settlement`
("close sale"); converted to `router.back()` for `setup → list` and
`settlement → counter` (both instances) — the round-trip pairs that get
toggled repeatedly in normal use and would otherwise leak a screen instance
per cycle.

## Known, deliberately unresolved

**`?holdMs=` is not gated to be inert in a "production" web build**, though the
original plan for this round said it should be. On investigation: native is
already safe (no `window`, so the seam is structurally unreachable), and for
web there is no way to distinguish "someone testing the exported build" from
"someone testing the deployed production site" without a build-time flag —
and `expo export`'s output is used for *both* right now, since there is no
separate deployment pipeline yet (`docs/architecture.md`: "Local only"). Fully
solving this needs a build-time env flag threaded through the export step,
which is more than this story's scope justifies before a real deployment
exists. Flagging it here rather than silently doing nothing.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.
