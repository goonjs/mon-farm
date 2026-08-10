# Story: Event log and projection

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither of
which is authorized.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Architecture: `docs/architecture.md`

## Description

`src/core/types.ts` and `src/core/project.ts`. Implements the transition table
in `docs/ux/pile-zone-sale-lifecycle.md` §8: pile not-started → counting →
closed with reopen, zone open/closed without cascading into closed piles, and
the sale as a hard boundary above both.

## Acceptance criteria

- [x] Every transition-table row has a passing test (19 tests).
- [x] Folding is by `seq`; a scrambled wall clock changes nothing.
- [x] A duplicate `seq` is rejected rather than guessed at.
- [x] Projection is idempotent.
- [x] A clock anomaly flags and never reorders or blocks.
- [x] Closing a zone force-closes piles still counting in it.
- [x] Reopening a zone does NOT reopen its closed piles.
- [x] A closed sale blocks reopening anything beneath it.

## Offline / sync behavior

Offline is the only mode. The log is the single source of truth and is
append-only; corrections are new events pointing at a `seq`, never mutations.
That is what makes a future sync an append of missing events rather than a
merge — see `docs/architecture.md` §Sync engine.

## Test plan

- [x] Covered by `npm run verify` — 32 core tests, 6 component tests, 24 e2e
      across two viewports.

## Verification

- [x] Sandbox run: exported web build served statically and driven in a real
      browser.
- [x] Screenshots: `docs/ux/screenshots/phone-landscape/` and
      `docs/ux/screenshots/phone-landscape-floor/`
- [ ] **Never run on a device or emulator.** Web only.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

Unchecked boxes above are real gaps, not oversights. They are the honest
boundary of what this story delivered.
