# Development Process

A lightweight, doc-driven cycle adapted from the BMAD method (agentic planning
+ context-engineered, story-by-story development), tailored for this repo and
its offline-first requirement.

## Why this shape

The app must run standalone offline and sync to a backend when connectivity
returns (automatically) or on demand (manually). That's an architectural
concern, not a feature — so architecture (SDD) is written and agreed
*before* implementation, and every story that touches data is checked against
an explicit offline/sync gate rather than trusting it to come up naturally in
code review.

## Phases

### 1. Planning

- **PRD** (`docs/prd.md`) — what we're building: goals, users, functional and
  non-functional requirements (including offline/sync expectations), scope
  boundaries, success criteria. Authored collaboratively with the user, not
  assumed.
- **Architecture / SDD** (`docs/architecture.md`) — how it's built: client
  architecture, local data layer, sync engine and conflict-resolution
  strategy, backend API contracts, security, deployment. Written once the PRD
  is stable enough to design against; revised as needed.

Both are living documents. A change significant enough to alter scope or
architecture gets reflected here before (or alongside) the code that
implements it.

### 2. Breakdown

- PRD is sharded into **epics** (`docs/epics/`) — coherent chunks of product
  scope.
- Each epic is sharded into **stories** (`docs/stories/`) — the unit of
  implementation. Use `docs/templates/story-template.md`. A story must carry
  enough context (linked PRD/architecture sections, acceptance criteria) that
  implementation doesn't require re-deriving intent from scratch.

### 3. Implementation loop (per story)

1. Story status: `Draft` → fill in Acceptance Criteria + Offline/Sync
   Behavior + Test Plan → `Ready`.
2. Implement against the story. Status → `In Progress`.
3. Self-review against:
   - `docs/checklists/definition-of-done.md` (always)
   - `docs/checklists/offline-sync-checklist.md` (if the story touches local
     storage, sync, network-state handling, or conflict resolution)
4. Status → `Review`, then `Done` once checks pass and the story's
   acceptance criteria are demonstrably met.

One story in flight at a time per feature line keeps context small and
reviewable; stories should be small enough to implement and verify in one
sitting.

### 4. Change management

If implementation reveals the PRD or architecture needs to change, update the
doc first (small diff, explain why), then continue the story. Don't let code
and docs drift — the docs are the source of truth for *why*, the code for
*what actually happens*.

## Status so far

- [x] Process defined (this doc)
- [ ] PRD (`docs/prd.md`) — to be authored together
- [ ] Architecture / SDD (`docs/architecture.md`) — to be authored together,
      after PRD
- [ ] First epic/story breakdown
