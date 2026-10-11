# Story E01-S18: One shared preview site, deployed by PR number

Status: Ready (owner asked for it, 2026-10-11: "pick by PR number")

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- Related: E01-S07 (Hosting, per-PR preview channels), E02-S01 (Google login),
  `docs/runbooks/firebase-setup.md` §4–5
- Why: Firebase Auth does not accept wildcard domains, so the per-PR channel URLs
  on `mon-farm-dev` can never be authorized for Google login. The owner added
  `mon-farm-preview.web.app` as an authorized domain and wants every agent's work
  to be tried on that one site.

## Description

A manually started workflow takes a PR number, builds that PR with the real public
Firebase web config, and deploys it to the live channel of the Hosting site
`mon-farm-preview`. The latest run wins; the site shows one PR at a time. Ordinary
PR CI and per-PR channels on `mon-farm-dev` are unchanged.

## Acceptance criteria

- [ ] `.firebaserc` maps a `preview` hosting target to `mon-farm-preview`;
      `firebase.json` has a `preview` entry that serves `dist/` like `dev` and
      `prod` (same not-found fallback and cache headers).
- [ ] `scripts/deploy.sh preview-site` deploys `hosting:preview` with the generated
      dynamic-route config, and fails closed like the other modes (no `dist/`, no
      CI credential, firebase error).
- [ ] Workflow `Deploy Preview Site` runs only by `workflow_dispatch` with a
      required `pr` number. It refuses a PR that is closed or comes from a fork,
      checks out that PR's head commit, builds web with the real public config
      (project `mon-farmmate`), authenticates keylessly, deploys, and writes the PR
      number, commit and URL to the run summary.
- [ ] Runs queue (concurrency group, no cancel) so two picks never deploy at once.
- [ ] Nothing here touches the shared `verify`/`e2e` bundle, `dev` or `prod`.

## Offline / sync behavior

N/A: CI and hosting only, no app data.

## Test plan (tests first)

- [ ] `scripts/deploy.test.ts`: `preview-site` deploys `hosting:preview`; fails when
      `dist/` is missing; needs a credential in CI; the `preview` target maps to
      `mon-farm-preview` and serves like `dev`/`prod`.
- [ ] `scripts/ci-workflow.test.ts` style check on the new workflow: dispatch-only,
      `pr` input required, concurrency set, no `pull_request` trigger.
- [ ] Real run: after merge, dispatch with a green PR number and open
      `mon-farm-preview.web.app` (owner or lead; the sandbox cannot reach it).

## Owner must do

- Create the Hosting site `mon-farm-preview` in the Firebase project (if not yet
  there). The deploy service account already has Hosting Admin on the project.

## Verification

## Dev notes

## Code review

## QA notes
