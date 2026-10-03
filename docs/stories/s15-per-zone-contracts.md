# Story: Per-zone worker contracts in the event model and settle()

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: Legacy (PRD v0.4) — superseded by `docs/epics/e03-master-data.md` (per-zone contracts and `basis` retired)
- Related PRD section(s): FR-8.6 (workers per zone), FR-8.5 (no safe default)
- Owner feedback that prompted this story: "I need worker per zone... user
  uses same 50:50 for all workers now but this should be able to vary."

## Description

`split_set` was a single sale-wide owner/worker percentage. It is now the
**default**, and a new `zone_contract_set { zoneId, personId, workerName,
ownerPct }` event overrides it per zone. `settle()` resolves each zone's
percentage as `zone.contract?.ownerPct ?? sale.split.ownerPct`, and refuses
per zone — not just per sale — when neither exists (FR-8.5).

`personId` and `workerName` are both stored: the id is what groups a worker's
zones into one payout total; the name is a snapshot of what it was at the time
the contract was agreed, so renaming a person later cannot silently rewrite a
past settlement — the same reasoning that made `accept` snapshot `netG`.

Sale-level default changed from 60/40 to **50/50** per the owner's stated
practice; the worked example fixture now gives each zone its own contract at
50/50 to prove the two zones vary independently rather than sharing one
sale-wide number.

## Acceptance criteria

- [x] `zone_contract_set` recorded on the correct zone only; a later one for
      the same zone replaces the earlier one.
- [x] A zone with no contract shows `contract: null` and falls back to the
      sale default in `settle()`.
- [x] A zone's own contract overrides the sale default when both exist.
- [x] `settle()` refuses (throws `SettlementUnavailable`, naming the zone)
      when a zone has neither its own contract nor a sale default.
- [x] `settle()` succeeds with zone contracts alone and no `split_set` at all.
- [x] Per-zone rounding still closes exactly: owner + worker = gross, per zone
      and overall.
- [x] `perWorker` groups zones by `personId`; two zones paying the same person
      produce one row summing both.
- [x] A zone using the sale default has `personId: null` and is excluded from
      `perWorker` — no one was named to attribute it to.
- [x] The worked example fixture reproduces exact hand-calculated figures for
      two zones each with their own 50/50 contract.

## Offline / sync behavior

N/A — pure functions over the log, no data or network involvement beyond what
S3/S5 already established.

## Test plan

- [x] 3 new `project.test.ts` cases: recorded, replaced, isolated per zone.
- [x] 7 new `settle.test.ts` cases: override, default fallback, refusal,
      contracts-alone, worker grouping, shared-worker grouping.
- [x] Updated worked-example assertions for the new 50/50-per-zone figures.
- [x] `settlement.tsx` compile-fixed to the new `Settlement` shape (owner
      total + per-zone rows with worker name and %); full per-worker screen
      redesign is S18, not this story.

## Verification

- [x] `npm run verify` green: 40 core tests, 6 component tests, 24 e2e across
      both viewports.
- [x] e2e settlement test updated: the demo seed's single zone has no
      contract, so it now correctly asserts against the sale default (60/40,
      unchanged in `demo.ts` — S17 removes the seed entirely).

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

The settlement screen shown right now is a minimal compile-fix, not the
finished design. It shows an aggregate owner total and per-zone rows with each
zone's own worker and percentage, but no dedicated per-worker payout view yet
— that is `docs/stories/s18-settlement-per-zone-workers.md` (not written until
S16/S17 land, since it needs the people picker to be meaningful).

`docs/ux/mvp-screens.html` screen 7 still shows the old single 60/40 mockup —
refreshed in S18 alongside the real screen, so both change together rather
than the mockup drifting ahead of the app.
