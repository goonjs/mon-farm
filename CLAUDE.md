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

## Conventions

- Docs are versioned in this repo under `docs/` and reviewed like code.
- No PRD/architecture content should be invented ahead of the user — those
  are authored collaboratively, not assumed.
