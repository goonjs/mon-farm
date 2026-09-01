# Epic: Run and settle one sale

Status: **Draft** — authored 2026-08-10, pending owner review.

## Goal

A farm owner can run one complete rubber sale on a phone with no network, and
end it with a settlement both sides can check: the total broken down per zone,
and each side's share shown as arithmetic rather than as a single figure to be
taken on trust.

Concretely, one person can:

1. Set up a sale — buyer, people, agreed ฿/kg, owner/worker split, and the zones
   and piles being sold.
2. Check the scale zero and bucket weight before each pile, and hear the
   expected reading read back before the first basket.
3. Count baskets by press-and-hold, with the count readable at a distance and
   spoken aloud in Thai.
4. Log an off-standard basket by its actual scale reading.
5. Undo a mistake, or void an earlier basket with a reason, without erasing the
   record of what happened.
6. Close piles and zones, and close the sale.
7. Read a settlement: baskets → net weight → × price → gross → per zone → each
   side's share.

## Scope boundaries — deliberately out of this epic

These are in the PRD and are **not** in the MVP. Named here because an
implementer reading `docs/prd.md` will otherwise reasonably build them.

| Excluded                                                 | Why, and where it goes                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **%DRC / grade deduction** pricing (FR-2.5)              | Straight ฿/kg only. Grade assessment brings a second party's judgment into the money chain and needs its own agreement UI.                                         |
| ~~**Adjustments** — later deductions or additions (FR-7.3)~~ **moved to epic 2 (S29), 2026-08-11** | The settlement is a pure function of counts and one price. Adjustments make it a function of counts, price, and an editable list, which changes the audit story. Still true — S29 is designed against that sentence rather than around it: each deduction is its own event with amount, reason and who agreed it, itemised in the derivation and never netted into a total. |
| **Backend and sync** (NFR-2)                             | Local-only. The event log is shaped so a sync layer can be added without reshaping data — every event carries a `synced_at` column — but nothing is sent anywhere. |
| **Multi-tenancy, RBAC** (NFR-6)                          | One farm, one device.                                                                                                                                              |
| **Hardware volume-key counting (V5)**                    | Press-and-hold only.                                                                                                                                               |

~~Per-zone worker contracts (FR-8.6)~~ — **built in S15**, per owner instruction:
multiple zones now resolve independent worker contracts, with a sale-level
default (50/50) as fallback. ~~Tablet layout~~ / ~~phone landscape only~~ —
**built in S19**: orientation is unlocked (phone and tablet, both
orientations); the one screen with a real physical constraint (the counter's
public numeral, phone portrait past two digits) measures it at runtime and
shows a non-blocking hint rather than being excluded from the format
entirely. See `docs/ux/design-system.md` §9.

`settle()` carries this boundary in its own doc comment, because that is where
the implementer is actually looking.

## Related PRD sections

FR-1 (partially — zones and piles only, no roster), FR-2.1–2.4, FR-3, FR-4,
FR-5, FR-6, FR-7.1–7.5, FR-8.1–8.5, FR-9, FR-11, FR-12, NFR-1, NFR-3, NFR-4.

## Related design

- [`docs/ux/design-system.md`](../ux/design-system.md) — registers, palette, the numeral constraint
- [`docs/ux/mvp-screens.html`](../ux/mvp-screens.html) — the seven screens this epic implements
- [`docs/ux/pile-zone-sale-lifecycle.md`](../ux/pile-zone-sale-lifecycle.md) — §8 transition table is the test list for S3 and S13
- [`docs/ux/counter-screen-findings.md`](../ux/counter-screen-findings.md) — F-1, F-6, F-7, F-9, F-11, F-12, F-13, F-15, F-16, F-19, F-21, F-22

## Story order

Stories 1–5 have **no UI**. That is deliberate: it front-loads every piece of
tooling risk while the money model is being proven, and it means the valuable,
hard-to-redo half exists before anything renders. Stopping between stories
leaves a green tree; stopping mid-story does not.

At `Review` — implemented, verified in a browser, awaiting sign-off and CI:

- [x] `docs/stories/s1-tech-stack-and-ci.md` — scaffold, test tooling, CI
- [x] `docs/stories/s2-design-tokens-in-app.md` — tokens shared with the app
- [x] `docs/stories/s3-event-log-and-projection.md` — types, log, lifecycle
- [x] `docs/stories/s4-totals-and-settlement.md` — rollups, split, derivation
- [x] `docs/stories/s5-persistence.md` — EventStore port + adapters
- [x] `docs/stories/s7-counter-shell.md` — tabs, numeral, mini-count
- [x] `docs/stories/s8-hold-to-count.md` — the hold, accept and reject
- [x] `docs/stories/s12-undo-and-void.md` — undo tier only
- [x] `docs/stories/s14-settlement-screen.md` — the derivation and shares
- [x] `docs/stories/s15-per-zone-contracts.md` — workers per zone, not one sale split
- [x] `docs/stories/s16-people-store.md` — reusable people list + picker
- [x] `docs/stories/s17-remove-seed-and-sale-list.md` — no app-side seed; sale list front door
- [x] `docs/stories/s19-orientation-and-tablet.md` — orientation unlocked; numeral legibility measured, not assumed
- [x] `docs/stories/s6-sale-setup.md` — parties, price, split, zones each with
      a worker picked from the people list, piles — replaces the S17 stub
- [x] `docs/stories/s9-zero-tare-gate.md` — the pre-count wizard now gates the
      stage; a failed zero check flags and continues rather than blocking
- [x] `docs/stories/s11-short-basket.md` — real F-22 three-way weight input
      (drag / ± / typed), replacing the hard-coded 43 kg placeholder
- [x] `docs/stories/s13-close-lifecycle.md` — pile close → decision point →
      zone close → sale close, the zone/pile switcher, and typed-reason
      reopen for a pile, a zone, and the sale
- [x] `docs/stories/s18-settlement-per-worker.md` — the per-worker payout
      card, summing each worker's total across every zone that names them
- [x] `docs/stories/s21-testing-feedback-polish.md` — verbose confirmations
      for undo/close, settlement→list navigation, reopen simplified to one
      action, ถัง→ตะกร้า, `WeightInput` focus/slider polish
- [x] Auto-save on the setup screen (no story number — amended into
      `docs/stories/s6-sale-setup.md` directly, since it changes S6's own
      acceptance criteria rather than adding new ones)
- [x] `docs/stories/s10-thai-speech.md` — the spoken count only (FR-11.3,
      FR-11.4, FR-11.11); the read-back and พร้อมค่ะ/ต่อไปค่ะ move to S31,
      blocked on PRD open questions 5 and 6

Not started — no story file written yet:

- [ ] **S22** short-basket visibility — a more explicit, inline-visible
      breakdown of short baskets (on the stage and in the close report), from
      the same testing round as S21. Currently short baskets are only fully
      visible in the Log tab.
- [ ] **S23** late/catch-up basket entry — a way to log a basket count
      already counted before opening the app (arriving mid-count, or using
      the app without a live show), per the owner: quick basket-count entry
      per pile, appending that many `accept` events at once with a distinct
      `source` so they're auditable as entered-after-the-fact rather than
      live-held.
- [ ] **S31** the rest of FR-11 — level read-back (FR-11.1), พร้อมค่ะ
      (FR-11.2), ต่อไปค่ะ (FR-11.5). Blocked on PRD open questions 5 (voice
      persona) and 6 (which fields the read-back says). S10 built the spoken
      count only.

## Known blockers

~~S10 needs `expo-speech`~~ and ~~F-7 needs `expo-haptics`~~ — **both authorized
and installed 2026-08-10** at `~57.0.1`. **S10 (spoken count) built
2026-09-01** — the announced register exists for the count. F-7 (haptic
accept/reject feedback) and S31 (the rest of FR-11) are still unimplemented,
but neither is blocked.

## Definition of done for the epic

Every story at `Review` with its acceptance criteria met, screenshots attached,
and `npm run verify` green from a clean checkout. Stories cannot reach `Done`
without a push to CI and an independent review — see each story's own status.
