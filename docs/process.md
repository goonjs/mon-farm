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

## Engineering principles (must)

- **YAGNI** — build what the current story needs, not what a future one
  might. No speculative abstractions or config for hypothetical cases.
- **KISS** — the simplest design that satisfies the acceptance criteria
  wins. Cleverness is a cost, not a feature.
- **SOLID** — applied pragmatically, not dogmatically: single-responsibility
  modules, depend on abstractions at real seams (not imagined ones), avoid
  God objects.
- **TDD** — tests are written before the implementation, per story:
  1. Write a failing test that encodes an acceptance criterion.
  2. Write the minimum code to pass it.
  3. Refactor with tests green.
  Repeat per acceptance criterion. A story with no failing-first test for
  its behavior isn't done, it's untested.

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

One story in flight at a time per feature line. Stories should be small
enough to implement and verify in one sitting — a "logical medium" unit of
work, not a multi-feature dump and not a one-line triviality split out for
its own sake.

1. **Draft → Ready**: fill in the story's Acceptance Criteria, Offline/Sync
   Behavior, and Test Plan.
2. **TDD**: write the failing test(s) for the first acceptance criterion,
   confirm it fails, then implement to green. Repeat per criterion. Status →
   `In Progress`.
3. **Sandbox + real verification** — not optional, and not "it should work":
   - Run the app in a sandbox environment and exercise the story's flow for
     real.
   - If the story touches UI, drive the actual UI (browser/emulator) and
     capture screenshots proving the feature works — golden path *and* the
     edge cases the story calls out. Attach/link the screenshots in the
     story's QA notes. A UI story isn't done on the strength of passing unit
     tests alone.
4. **Self-review** against:
   - `docs/checklists/definition-of-done.md` (always)
   - `docs/checklists/offline-sync-checklist.md` (if the story touches local
     storage, sync, network-state handling, or conflict resolution)
5. **Update docs live** — as decisions get made or scope shifts during
   implementation, update `docs/prd.md` / `docs/architecture.md` / the story
   file *in the same working session*, not as cleanup afterward. The docs
   should never lag behind what was actually decided or built.
6. **Commit** following the git conventions below — but **never ahead of an
   unanswered question**. If the change depends on something the owner has
   been asked and has not answered yet, it stays in the working tree until
   the answer arrives.

   A commit made on a guess is not neutral. Its message states reasoning
   that was wrong the moment it was written, and the record then has to be
   fixed by amending, rebasing or reverting — all of which either rewrite
   history or leave a misleading trail through it. Waiting costs a working
   tree that stays dirty for a while; guessing costs a rewrite plus a
   commit whose stated *why* was never true. The same applies to pushing,
   which is downstream of this: an open question blocks the commit, and the
   commit is what the push was waiting for.
7. **Push** — CI (see below) runs build, unit tests, and style/lint checks.
   Must be green.
8. **Independent code review**: a separate agent/session from the one that
   implemented the story reviews the diff — correctness, test coverage,
   YAGNI/KISS/SOLID adherence, and whether the offline/sync gate was
   actually satisfied (not just checked off). Use
   `docs/checklists/code-review-checklist.md`. Findings get addressed or
   explicitly deferred with reasoning in the story file — not silently
   dropped.
9. **Status → `Review` → `Done`** once CI is green, code review is resolved,
   screenshots/verification are attached where applicable, and docs are
   current.

### 4. Change management

If implementation reveals the PRD or architecture needs to change, update the
doc first (small diff, explain why), then continue the story. Don't let code
and docs drift — the docs are the source of truth for *why*, the code for
*what actually happens*. This is the same "update docs live" rule from step 5
above, called out again because it's the rule most likely to get skipped
under time pressure.

## Continuous Integration

Every push and pull request must run, at minimum:

- **Build** (the project compiles/starts)
- **Unit tests**
- **Style/lint check**

A red pipeline blocks merge. The actual workflow file
(`.github/workflows/ci.yml`) is created as the first story of the first epic,
once the tech stack is chosen — a CI config that lints/tests a stack that
doesn't exist yet would be theater, not a gate. Until then, this section is
the standing requirement: any story that introduces the tech stack must also
stand up CI in the same story.

## Git conventions

- **Commit subject line: 50 characters or fewer.** Imperative mood ("Add
  sync retry backoff", not "Added" or "Adds").
- **Body** (when the change needs explaining): why, not what — the diff
  already shows what. Wrap at ~72 characters.
- **One logical change per commit** — medium-sized: not a whole epic in one
  commit, not a commit per line. A commit should be the unit a reviewer could
  revert on its own without breaking the build.

## Status so far

- [x] Process defined (this doc)
- [~] PRD (`docs/prd.md`) — draft v0.1 written from the owner's product
      brief; 7 open questions outstanding before it counts as agreed
- [ ] Architecture / SDD (`docs/architecture.md`) — to be authored together,
      after PRD
- [ ] First epic/story breakdown
- [ ] Tech stack chosen + CI pipeline stood up
