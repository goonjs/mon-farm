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

| Excluded | Why, and where it goes |
|---|---|
| **%DRC / grade deduction** pricing (FR-2.5) | Straight ฿/kg only. Grade assessment brings a second party's judgment into the money chain and needs its own agreement UI. |
| **Adjustments** — later deductions or additions (FR-7.3) | The settlement is a pure function of counts and one price. Adjustments make it a function of counts, price, and an editable list, which changes the audit story. |
| **Per-zone worker contracts** (FR-8.6) | One split for the whole sale. Different splits per zone is the realistic case eventually, but it needs the contract/roster model (FR-1) which this epic does not build. |
| **Backend and sync** (NFR-2) | Local-only. The event log is shaped so a sync layer can be added without reshaping data — every event carries a `synced_at` column — but nothing is sent anywhere. |
| **Multi-tenancy, RBAC** (NFR-6) | One farm, one device. |
| **Tablet layout** | Phone landscape only. |
| **Hardware volume-key counting (V5)** | Press-and-hold only. |

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

Not started — no story file written yet:

- [ ] **S6** sale setup (screen 1). The demo sale is seeded in code instead, so
      price, split and piles cannot yet be entered by a person.
- [ ] **S9** zero and tare gate (screen 2). Piles are seeded ready, so the
      pre-count check is bypassed entirely.
- [ ] **S10** Thai speech — blocked on `expo-speech`. **The announced register
      does not exist**, which means half the cross-check the product is built
      around is missing.
- [ ] **S11** short basket with the three-way weight input. A button logs a
      hard-coded 43 kg reading as a placeholder.
- [ ] **S13** close lifecycle (screens 5 and 6) — closing a pile, the decision
      point, closing a zone, reopen-and-announce. The core model supports all
      of it; no UI reaches it.

## Known blockers

- **S10** needs `expo-speech`, which is outside the dependency list authorized
  for this work. It is a first-party Expo module and speech is core to FR-11,
  but the rule is that anything outside the list is a written blocker rather
  than an install. Needs the owner's go-ahead.
- **F-7 feedback** ideally uses haptics (`expo-haptics`) so acceptance and
  rejection are distinguishable without sound or sight. Same situation.
  Implemented as colour + shape + text in the meantime, which satisfies the
  finding but is weaker one-handed.

## Definition of done for the epic

Every story at `Review` with its acceptance criteria met, screenshots attached,
and `npm run verify` green from a clean checkout. Stories cannot reach `Done`
without a push to CI and an independent review — see each story's own status.
