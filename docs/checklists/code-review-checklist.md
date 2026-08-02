# Code Review Checklist

For the **independent** reviewer (a separate agent/session from whoever
implemented the story) — not a self-check.

## Correctness

- [ ] Diff actually implements the story's acceptance criteria — read the
      story, not just the diff
- [ ] Tests were written to fail first (TDD), not retrofitted around
      working code
- [ ] Edge cases called out in the story are covered, not just the golden
      path
- [ ] Offline/sync behavior (if applicable) matches
      `docs/architecture.md` and was actually exercised, not just asserted

## Verification

- [ ] Sandbox run confirms the feature works as claimed
- [ ] For UI changes: screenshots provided are genuine (real run, not
      mocked) and show the described behavior

## Quality

- [ ] YAGNI: no speculative code for cases the story doesn't require
- [ ] KISS: simplest approach that satisfies the criteria — flag
      unnecessary complexity
- [ ] SOLID applied where it earns its keep, not layered on everywhere
- [ ] No unrelated refactors or scope creep bundled into the diff
- [ ] Commit(s) follow the git conventions in `docs/process.md` (subject
      ≤ 50 chars, logical medium-sized commits)

## Docs

- [ ] Story file, and PRD/architecture if affected, were updated to match
      what was actually built — not left stale

## Outcome

- [ ] Approved — or: findings listed below with each either fixed or
      explicitly deferred (with reasoning) in the story file
