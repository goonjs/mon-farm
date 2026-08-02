# mon-farm

## Product shape

A web app built to also run as a mobile app, **offline-first**: the app must be
fully usable standalone with no network, and sync local data to the backend
database when connectivity returns or when the user triggers a manual sync.
This constraint shapes architecture decisions (local storage, sync engine,
conflict resolution) and must be considered in every story that touches data.

Tech stack: TBD — will be recorded here and in `docs/architecture.md` once decided.

## Development process

This repo follows a lightweight, doc-driven development cycle. Full details:
`docs/process.md`. Summary:

1. **Planning**: `docs/prd.md` (what to build) and `docs/architecture.md`
   (how it's built — the "SDD") are written and agreed before implementation
   starts on a given epic.
2. **Breakdown**: PRD is sharded into epics (`docs/epics/`), epics into
   stories (`docs/stories/`), using the templates in `docs/templates/`.
3. **Implementation loop**: one story at a time — implement, self-check
   against `docs/checklists/definition-of-done.md`, and against
   `docs/checklists/offline-sync-checklist.md` if the story touches local
   data, sync, or connectivity state.
4. **Status**: each story file tracks its own status (Draft / Ready / In
   Progress / Review / Done) at the top of the file.

Do not start implementation on a story that doesn't yet exist as a file
under `docs/stories/` with an agreed Acceptance Criteria section — write the
story first.

Every story requires, before `Done`: TDD (tests written first), a real
sandbox run, screenshots for any UI change, an independent code review by a
separate agent/session, and CI green. See `docs/process.md` for the full
loop and `docs/checklists/` for the gates.

## Engineering principles (must)

YAGNI, KISS, SOLID, TDD. See `docs/process.md` for how each applies here.

## Git conventions

Commit subject ≤ 50 characters, imperative mood; explain *why* in the body.
One logical, medium-sized change per commit. Full detail in
`docs/process.md`.

## Conventions

- Docs are versioned in this repo under `docs/` and reviewed like code.
- No PRD/architecture content should be invented ahead of the user — those
  are authored collaboratively, not assumed.
- Docs are live documents: update them in the same session a decision is
  made or scope shifts, not as after-the-fact cleanup.
