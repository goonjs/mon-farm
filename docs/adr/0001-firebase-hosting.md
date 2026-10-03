# ADR 0001 — Host the web build on Firebase Hosting

- **Status:** Accepted (owner, 2026-10-03); **amended 2026-10-03** — two projects on Blaze; **amendment 2, 2026-10-03** — back to one project for MVP, Blaze kept (see below)
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

*Two-project part superseded by Amendment 2 below (PRD D-34); Blaze stays.*

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

## Amendment 2, 2026-10-03 — one project for MVP

Owner decision (PRD D-34): "This is MVP and for personal use first. So one
project until we go commercial, then we will separate." The owner has already
created a single Firebase project holding both dev and prod. This reverses
the two-project part of Amendment 1 (PRD D-1, D-22); the rest of Amendment 1
stands — **Blaze with a budget alert stays**, and Cloud Run previews stay
unused.

Separation inside the one project:

- **Hosting:** two sites, `dev` and `prod`; all PR preview channels live on
  the `dev` site (7-day expiry, D-21).
- **Firestore:** a named database `dev` for dev and previews (test/seed data
  only); prod uses `(default)` (real farm data).
- **Cloud Storage:** a separate bucket for dev media; prod uses the default
  bucket.
- **Build config:** dev/preview builds point at the `dev` database and the
  dev bucket. E01-S07 holds the test that checks the build config. Security
  rules still enforce farm-group membership on every database and bucket.

**Risk — accepted by the owner 2026-10-03 (ความเสี่ยงที่เจ้าของรับแล้ว):**
with one project, Auth is shared, so security rules cannot tell a prod build
from a preview build. The separate `dev` database and bucket prevent
*mistakes*; they are **not a security boundary**. A preview build altered to
point at `(default)` could read and write real farm data with the signed-in
user's rights, which weakens the PRD NFR-5 guarantee that a public preview can
never touch production data. Mitigations: previews are built only by this
repo's CI from branches in the owner's repo (needs write access), plus a build
test that dev/preview bundles reference only the `dev` database. Two projects
(the revisit below) remove this risk.

Accepted trade-off for MVP: **Firebase Auth and the Blaze budget alert are
shared** — the same Google account signs in to dev, previews and prod, and one
budget covers both environments.

Follow-up 1 becomes: create the two sites, the `dev` database and the dev
bucket in the existing project, and choose the two domains. **The `dev`
database and bucket are deferred (PRD D-48): the owner is not upgrading the
plan yet.** Follow-up 2 needs
one deploy credential.

**Revisit:** split into two projects (dev, prod) before commercial launch, or
before any non-owner user is given access — whichever comes first.

## What was built (2026-10-03)

Matches Amendment 2 (one project):

- Firebase project `mon-farmmate` (`farm-mate` was taken); no billing attached
  yet. Hosting sites `mon-farm-dev` and `mon-farm-prod` (`<site>.web.app`).
- `firebase.json` / `.firebaserc`: `dev` and `prod` targets, SPA rewrite to
  `index.html`, one-year immutable cache for `/_expo/static/**`, `no-cache`
  for `index.html`.
- `scripts/deploy.sh dev|prod|preview <name>` (tests in
  `scripts/deploy.test.ts`); non-zero on any failure, and in CI it requires a
  service credential from the environment.
- **Keyless CI credential (Workload Identity Federation):** pool `github`,
  provider `github-oidc` restricted to the GitHub repo `goonjs/mon-farm`,
  deploy-only service account `gh-deploy@mon-farmmate.iam.gserviceaccount.com`
  (roles: Firebase Hosting Admin, Service Usage Consumer). No key exists. This
  is the one deploy credential Amendment 2 calls for; its Hosting Admin role
  covers both sites.
- Workflows: `deploy-dev.yml` (push to `dev`), a `preview` job in `ci.yml`
  (PR channel `pr-<number>` on the dev site, 7-day expiry, reuses CI's build),
  and an auth step before the deploy in `deploy-prod.yml`.
- The dev site was deployed by hand and checked (SPA fallback, cache headers).
  The prod site has never been deployed.
- Hosting free quota, checked against the Firebase pricing page on 2026-10-03:
  10 GB storage and 360 MB/day data transfer.

**Still open (owner):** add the repo variables listed in `docs/process.md`;
create the `dev` database and dev bucket (deferred, PRD D-48 — needs the plan
upgrade); choose and connect the two domains;
run Deploy Prod once. Not yet built from E01-S07: preview-channel cleanup on
PR close and the PR comment with the preview link.
