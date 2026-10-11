# Story: Persistence — EventStore port and adapters

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither of
which is authorized.

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- Architecture: `docs/architecture.md`

## Description

`EventStore` interface with `store.native.ts` (expo-sqlite, WAL,
`PRIMARY KEY (sale_id, seq)`) and `store.web.ts` (localStorage). Metro resolves
by filename. `SaleProvider` is the one write path: append → persist → re-project.

## Acceptance criteria

- [x] Append then reload restores an identical log (proven in Playwright).
- [x] A duplicate `seq` is rejected by the store, not only by JS.
- [x] `pending()` returns unsynced rows — the outbox query.
- [x] A storage failure never blocks counting (quota errors are swallowed).
- [ ] **The native adapter has never been run.** It is written and typed but
      unexercised; no device or emulator has executed this code.

## Offline / sync behavior

Local-only and sync-ready. Every row carries `synced_at`; nothing is sent
anywhere. Conflict resolution and retry are undesigned — see
`docs/checklists/offline-sync-checklist.md`, which is **not yet completed for
this story** because the sync half does not exist to check.

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
