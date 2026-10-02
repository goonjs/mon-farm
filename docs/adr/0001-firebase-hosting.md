# ADR 0001 — Host the web build on Firebase Hosting

- **Status:** Accepted (owner, 2026-10-03)
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
| Billing | Free quota, no billing account | Billing account required; free allowance |
| Custom domain + TLS | Free | Free (domain mapping) |
| Two environments | Multiple sites in one project | Two services |
| PR previews with expiry | Built in (preview channels, expiry configurable) | Hand-built cleanup job |
| Same project as the data backend | Yes | Yes, but extra service to run |

Firebase Hosting free quota, verified against the Firebase pricing page on
2026-10-03: **10 GB storage and 360 MB/day data transfer**, custom domain and
SSL included, multiple sites per project, no payment method needed.

## Decision

Use **Firebase Hosting**, one project, two sites: `dev` and `prod`, each on its
own domain. PR previews use preview channels with a 7-day expiry. Deploys run
from GitHub Actions via `scripts/deploy.sh <env>`; Deploy Prod calls it with
`prod` and merges to `main` only if it succeeds.

## Consequences

- No Dockerfile or container registry to maintain; static export deploys as is.
- Hosting, auth and the data backend live in one Firebase project.
- The free transfer quota is ample for MVP testing. Selling to paying
  customers, or adding the data backend, likely means moving the project to
  Google Cloud with billing enabled. Revisit before selling.
- Server-side code, if ever needed, can go to Cloud Functions or Cloud Run
  later; this ADR does not preclude it.
- The native app is unaffected (store distribution is a separate decision).

## What was built (2026-10-03)

- Firebase project `mon-farmmate` (`farm-mate` was taken), no billing attached.
  Sites `mon-farm-dev` and `mon-farm-prod` (`<site>.web.app`).
- `firebase.json` / `.firebaserc`: `dev` and `prod` targets, SPA rewrite to
  `index.html`, one-year immutable cache for `/_expo/static/**`, `no-cache`
  for `index.html`.
- `scripts/deploy.sh dev|prod|preview <name>` (tested in
  `scripts/deploy.test.ts`); exits non-zero on any failure, and in CI requires
  a service credential from the environment.
- **Keyless CI credential (Workload Identity Federation):** pool `github`,
  provider `github-oidc` restricted to the GitHub repo `goonjs/mon-farm`,
  deploy-only service account `gh-deploy@mon-farmmate.iam.gserviceaccount.com`
  (roles: Firebase Hosting Admin, Service Usage Consumer). No key exists.
- Workflows: `deploy-dev.yml` (push to `dev`), a `preview` job in `ci.yml`
  (PR channel `pr-<number>` on the dev site, expires in 7 days, reuses CI's
  build), and an auth step before the deploy in `deploy-prod.yml`.
- Dev site deployed and checked by hand: SPA fallback, cache headers. Prod has
  never been deployed.

## Follow-ups (need the owner)

1. Add three **repository variables** (not secrets) in GitHub: see
   `docs/process.md` ("Branches and releases").
2. Choose the two custom domains and connect them in the Firebase console
   (Hosting, per site); DNS records are added at the registrar.
3. Run Deploy Prod once to confirm the first production release.
4. Before selling: decide on moving to Google Cloud with billing (see
   Consequences).
