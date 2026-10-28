# Definition of Done

Every story, before moving to `Done`:

- [ ] All acceptance criteria met
- [ ] Tests were written before the implementation (TDD) and pass
- [ ] Code follows existing conventions in the repo (no unrelated
      refactors bundled in); YAGNI/KISS/SOLID applied per
      `docs/process.md`
- [ ] No debug/dead code left behind
- [ ] Ran in a sandbox environment and exercised the story's flow for
      real (not just unit tests passing)
- [ ] For UI-touching stories: real UI exercised in browser/emulator,
      with screenshots attached as proof, golden path and edge cases
- [ ] For screens that take input: each step's golden path fits one
      390×844 screen on the real build, measured and noted in QA notes
      (`.claude/skills/phone-form-ux`)
- [ ] Nothing is cut off or off-screen (no sideways overflow, no "…" on
      content, no clipped boxes) on mockups and on the real build — owner
      rule; `npm run check:mockup` for mockups
- [ ] Story file updated: status, dev notes, any deviations from plan
      explained — updated live during implementation, not after the fact
- [ ] If this story revealed a gap in `docs/prd.md` or
      `docs/architecture.md`, that doc was updated in the same session
- [ ] `docs/checklists/offline-sync-checklist.md` completed if the story
      touches local data, sync, or network-state handling
- [ ] Commits follow the git conventions in `docs/process.md` (subject
      ≤ 50 chars, logical medium-sized commits)
- [ ] Pushed, CI green (build, unit tests, style/lint)
- [ ] Reviewed by a separate agent/session using
      `docs/checklists/code-review-checklist.md`, findings resolved or
      explicitly deferred
