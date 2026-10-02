# ADR 0001 — Host the web build on Firebase Hosting

- **Status:** Accepted (owner, 2026-10-03); **amended 2026-10-03** — two projects on Blaze (see below)
- **Deciders:** owner; drafted by the lead agent
- **Related:** `docs/architecture.md` ("Deployment / environments"),
  `docs/process.md` ("Branches and releases")

## Context

The web build (`npm run build:web`) is a static `dist/`. We need two
environments with separate domains — `dev` (default branch, daily-use MVP)
and `prod` (`main`, what we sell) — plus per-PR previews that expire after
7 days. Owner constraints: cost control, lean GitHub Actions minutes, and a
Firebase backend for sync (Firestore vs Realtime Database still undecided).

## Options considered

| | Firebase Hosting | Cloud Run |
|---|---|---|
| Fit for static `dist/` | Direct | Needs a container image + registry storage |
| Billing | Free Spark plan, no billing account | Billing account required; free allowance |
| Custom domain + TLS | Free | Free (domain mapping) |
| Two environments | Multiple sites in one project | Two services |
| PR previews with expiry | Built in (preview channels, expiry configurable) | Hand-built cleanup job |
| Same project as the data backend | Yes | Yes, but extra service to run |

Free limits quoted from memory (about 10 GB storage, about 360 MB/day
transfer on Spark) — **verify against current Firebase pricing when wiring**.

## Decision

Use **Firebase Hosting**, one project, two sites: `dev` and `prod`, each on its
own domain. PR previews use preview channels with a 7-day expiry. Deploys run
from GitHub Actions via `scripts/deploy.sh <env>`; Deploy Prod calls it with
`prod` and merges to `main` only if it succeeds.

## Consequences

- No Dockerfile or container registry to maintain; static export deploys as is.
- Hosting, auth and the data backend live in one Firebase project.
- The Spark transfer cap is ample for MVP testing; scaling to paying customers
  likely means the pay-as-you-go Blaze plan. Revisit before selling.
- Server-side code, if ever needed, can go to Cloud Functions or Cloud Run
  later; this ADR does not preclude it.
- The native app is unaffected (store distribution is a separate decision).

## Follow-ups (need the owner)

1. Create the Firebase project and the two sites; choose the two domains.
2. Create a deploy credential and store it as a GitHub secret (the agent
   cannot and should not create it).
3. Wire `scripts/deploy.sh` and dev auto-deploy, then confirm with a real run.

## Amendment, 2026-10-03 — two projects, Blaze

Owner decision (PRD D-22), reconciling this ADR with PRD D-1:

- **Two Firebase projects**, not one: **`dev`** hosts the `dev` site and all PR
  preview channels, over test/seed data only; **`prod`** hosts the `prod` site
  over real farm data. A public preview can therefore never read or write
  production data (PRD NFR-5).
- **Blaze plan with a budget alert** on both: Cloud Storage for media, LINE
  login, scheduled reminders and any server code need billing (PRD D-1). The
  Spark transfer-cap consequence above no longer applies.
- Follow-up 1 becomes: create the two projects, one site each, and choose the
  two domains. Follow-up 2 needs one deploy credential per project.
- Cloud Run per-PR previews (the owner's general rule for other repos) are
  not used in this repo; there are no container images to retain.
