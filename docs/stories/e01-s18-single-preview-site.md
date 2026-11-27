# Story E01-S18: One shared preview site, deployed by PR number

Status: Review (built, PR #84 merged 2026-10-11; owner asked for it: "pick by PR number") · docs check 2026-11-27: every AC checked in the code and tests below; missing: an independent code review (PR #84 has no review on GitHub and this story has none)
เงื่อนไขไปขั้นถัดไป: a separate session reviews `.github/workflows/preview-site.yml`, `scripts/deploy.sh preview-site` and the `preview` target with `docs/checklists/code-review-checklist.md` and writes it below → Done · ใคร: ผู้รีวิวอิสระ (ลีดเป็นคนสั่ง) · รอ: ลีด

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

- [x] `.firebaserc` maps a `preview` hosting target to `mon-farm-preview`;
      `firebase.json` has a `preview` entry that serves `dist/` like `dev` and
      `prod` (same not-found fallback and cache headers). — `.firebaserc:10` `"preview": ["mon-farm-preview"]`, `firebase.json:112` target `preview` (public `dist`, same headers and `/+not-found.html` rewrite as `dev`/`prod`, checked 2026-11-27); `scripts/deploy.test.ts:203`
- [x] `scripts/deploy.sh preview-site` deploys `hosting:preview` with the generated
      dynamic-route config, and fails closed like the other modes (no `dist/`, no
      CI credential, firebase error). — `scripts/deploy.sh:70-71`; `scripts/deploy.test.ts:123-138` (deploys `hosting:preview`, fails with no `dist/`, fails in CI with no credential)
- [x] Workflow `Deploy Preview Site` runs only by `workflow_dispatch` with a
      required `pr` number. It refuses a PR that is closed or comes from a fork,
      checks out that PR's head commit, builds web with the real public config
      (project `mon-farmmate`), authenticates keylessly, deploys, and writes the PR
      number, commit and URL to the run summary. — `.github/workflows/preview-site.yml` (dispatch-only, `pr` required, refuses a closed or fork PR, checks out the PR head sha, public config for `mon-farmmate`, keyless auth, run summary); `scripts/preview-site-workflow.test.ts`
- [x] Runs queue (concurrency group, no cancel) so two picks never deploy at once. — `preview-site.yml` `concurrency: group: preview-site, cancel-in-progress: false`; `preview-site-workflow.test.ts:15`
- [x] Nothing here touches the shared `verify`/`e2e` bundle, `dev` or `prod`. — the workflow only builds its own checkout and runs `deploy.sh preview-site`; `ci.yml` and `deploy-dev.yml` do not call it

## Offline / sync behavior

N/A: CI and hosting only, no app data.

## Test plan (tests first)

- [x] `scripts/deploy.test.ts`: `preview-site` deploys `hosting:preview`; fails when
      `dist/` is missing; needs a credential in CI; the `preview` target maps to
      `mon-farm-preview` and serves like `dev`/`prod`.
- [x] `scripts/ci-workflow.test.ts` style check on the new workflow: dispatch-only,
      `pr` input required, concurrency set, no `pull_request` trigger. — done as `scripts/preview-site-workflow.test.ts`
- [x] Real run: after merge, dispatch with a green PR number and open
      `mon-farm-preview.web.app` (owner or lead; the sandbox cannot reach it). — `Deploy Preview Site` runs succeeded, latest 45784870612 (workflow_dispatch, 2026-11-26); the owner tried bundle PR #249 on mon-farm-preview.web.app on 2026-11-27 (lead's report)

## Owner must do

- Create the Hosting site `mon-farm-preview` in the Firebase project (if not yet
  there). The deploy service account already has Hosting Admin on the project.

## Verification

- [x] Docs check 2026-11-27 (worktree on dev `a18db4e` after `npm ci`): `npx vitest run` 1559/1559, including `scripts/deploy.test.ts` and `scripts/preview-site-workflow.test.ts`

## Dev notes

## Code review

## QA notes
