# Story: Tech stack scaffold and CI

Status: **Review** — implemented 2026-08-10, awaiting owner sign-off and a push
to CI. Cannot reach `Done` without both (`docs/process.md` steps 7–9).

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- Related PRD section(s): NFR-1 (offline primary), NFR-4 (low-end Android), NFR-5 (platform)
- Related architecture section(s): `docs/architecture.md` §Tech stack, §Client architecture

`docs/process.md` requires that the story introducing the tech stack also stands
up CI in the same story — "a CI config that lints/tests a stack that doesn't
exist yet would be theater, not a gate." This is that story.

## Description

Scaffold the Expo application, wire three tiers of test tooling, and make
`npm run verify` a single command that runs everything CI runs. Record the
resolved dependency versions in `docs/architecture.md` and replace the
"Tech stack: TBD" line in `CLAUDE.md`.

## Acceptance criteria

- [x] Expo managed app scaffolded with expo-router and TypeScript strict.
- [x] Routes live under `src/app/`, so nothing collides with the repo's
      existing top-level directories.
- [x] Landscape orientation locked in `app.json` for native.
- [x] Vitest runs `src/core/**` with no React Native transform in the path.
- [x] jest-expo + Testing Library renders a component.
- [x] Playwright runs against the **exported** web build, not the dev server.
- [x] `.github/workflows/ci.yml` exists and runs: token drift → contrast →
      typecheck → lint → core tests → component tests → web export → e2e.
- [x] Every command in the workflow has been run locally and passed.
- [x] A placeholder test exists in each of the three tiers, so all three are
      proven wired rather than merely configured.
- [x] `docs/architecture.md` and `CLAUDE.md` record the resolved versions.

## Offline / sync behavior

N/A — no data or network involvement. Offline behaviour begins at S5.

One decision here does bear on it: `app.json` sets `web.output: "static"`, so
the exported web build is a set of static files with no server dependency. That
keeps the browser build honest about being an offline-capable client.

## Test plan

- [x] Online path: `npm run verify` from a clean `npm ci` checkout exits 0.
- [x] Offline path: N/A this story.
- [x] Reconnect / manual sync path: N/A this story.

## Verification

- [x] Sandbox run performed: `npm run build:web` produces `dist/`, served
      statically and loaded in a real browser.
- [x] Screenshots (UI stories only) — golden path: `docs/ux/screenshots/s1/`
- [ ] Screenshots — edge cases: N/A, no UI behaviour in this story.

## Dev notes

**Do not hard-code an SDK version.** The template was scaffolded and whatever it
resolved was pinned from the lockfile afterwards. Guessing a version and pinning
by hand is the common way an unattended Expo scaffold ends up in a broken
peer-dependency state.

**Vitest for `src/core/**`, jest-expo for components.** `core/` imports nothing
from react, react-native or expo, so it needs no Babel/Metro transform. Running
it under jest-expo would drag `transformIgnorePatterns` and ESM interop — the
most fragile part of the JS tooling — into the tightest feedback loop in the
project. Keeping them separate means logic gets sub-second feedback and tooling
flakiness is confined to the smaller suite.

**Playwright against `expo export`, not `expo start`.** A dev server never
exits, races HMR websockets, and turns a bundling failure into a blank white
screenshot. The export terminates, and a bundle failure surfaces as a non-zero
exit code *before* a browser opens. The export step doubles as CI's build gate.

**Template files kept, not deleted.** The scaffold ships example routes
(`src/app/explore.tsx`) and components this app does not use. The repo's
`CLAUDE.md` forbids deleting files without per-deletion confirmation, so they
are left in place and listed below for a morning cleanup pass. They are inert —
nothing the app renders imports them — but they do keep several template-only
dependencies in `package.json` (`@expo/ui`, `expo-glass-effect`, `expo-symbols`,
`expo-image`, `expo-web-browser`, `expo-device`) that a low-end Android target
(NFR-4) would rather not ship.

Cleanup candidates, pending confirmation:
`src/app/explore.tsx`, `src/components/animated-icon*`, `src/components/app-tabs*`,
`src/components/web-badge.tsx`, `src/components/hint-row.tsx`,
`src/components/external-link.tsx`, `src/components/ui/collapsible.tsx`,
`assets/images/react-logo*`, `assets/images/expo-*`, `assets/images/tutorial-web.png`.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.
- Findings:
- Resolution:

## QA notes

CI has not run: pushing to a remote is not authorized, so the workflow file is
validated by having run each of its commands locally. The first real CI run is a
morning task and may surface runner-specific issues, most likely the Playwright
browser download (`npx playwright install --with-deps`), which is a large
download and a common first-run failure.
