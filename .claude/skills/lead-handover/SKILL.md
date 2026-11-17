---
name: lead-handover
description: How a mon-farm lead (dispatcher) session runs teams day to day, keeps the project moving, and hands over to the next lead without losing rules or state. Use when you are the lead, when you start as a new lead, when your context passes ~60%, or when the owner says hand over.
---

# Lead: running the project and handing over

Built from Lead 2 (session_01LA7pk7Fp5fefzpFtyFKiHp, 2026-11-14 → 11-18). Every lesson below links the PR or diff that fixed it.
AGENTS.md and docs/process.md stay binding; this skill covers what they do not.

## 1. The lead's job

- **Keep the project moving every day without being told** (owner, 2026-11-18: "lead ควรจะทำให้โปรเจกต์ move ทุกๆวันด้วยตัวเอง").
  - Pull the next story of the agreed **flow** and finish it.
  - A flow is a user scenario that can span several epics. Close work by flow, not by epic.
- **Flow meeting every 2 days at 16:00 Bangkok** (owner, same chat: "มาคุยกันทุกๆช่วงตอนสัก 4 โมงเย็นทุก2 วัน … ผมขอใช้คำว่าโฟลว์"). The steps below are the lead's proposal, which the owner accepted with "ข้อ2โอเค" and asked for a raised hand in the lead session too. The wording is the agent's.
  - Hold it when no flow order is agreed yet (lead practice).
  - At 15:00, put flow choices on the dashboard as ก/ข with (แนะนำ).
  - At 16:00, post `❓ NEED DECISION` to #farm-ai-alerts with the owner mention.
  - Retitle your own session with 🙋🏻‍♂️.
- **Current flow:** "วันขายครบวงจร", i.e. prep → start → count → summary → clear money → home tile ✓. The lead proposed it as ข้อ1; the owner replied in chat on 2026-11-18: "ข้อ1โอเค".
- **What the lead may do alone** (owner on 2026-11-18, "ข้อ3โอเค", to the lead's proposal that the lead drafts on its own and code waits for the AC yes):
  - draft stories and mockups;
  - put AC questions on the dashboard;
  - dispatch teams;
  - get reviews;
  - merge non-critical PRs that meet the merge rule.
- **What waits for the owner:**
  - code, until the owner's AC yes;
  - critical merges;
  - deletes;
  - Deploy Prod;
  - dependencies, except where AGENTS.md lets the lead approve one (reputable maintainer, audit adds no new high or critical finding, evidence shown first).
- **Lead practice (agent wording, not owner rules):** the points below are habits from this round, not quoted owner rules.
- **Talking to the owner:**
  - short, plain Thai;
  - say what you checked and what you didn't;
  - end every message with a Discord status line;
  - **show the dashboard link in every reply to the owner**: https://claude.ai/artifact/3jHpPwSa3uWgMbW16oNdGa (owner rule, lead chat 2026-11-18 about 01:45 Bangkok: "เพิ่มกดอีกนิดนึงสำหรับ Lead อย่าลืม Handover ไปด้วยนะในทุกๆ Lead ผมต้องเห็น Link Artifact ด้วย"). Every lead keeps this rule and passes it on in each handover;
  - come back only for heavy decisions;
  - happy path first; rare cases go into a later story;
  - few PRs.

## 2. Session names (owner rule, 2026-11-18)

The owner's words, in the lead chat at about 00:35 Bangkok on 2026-11-18 (sent with the 00:32 dashboard answers, not one of them): "prefix ของเซสชันให้ขึ้นต้นด้วยมนฟาร์มวงเล็บนะใช้มนขีดฟาร์มในวงเล็บแล้วก็สำหรับงานที่ต้องการให้ผม take action ให้ prefix เพิ่ม emoticon raise hand ถ้าตอบแล้วไม่มีอะไรก็เอาลงด้วยอย่าลืม … ถ้าเซสชั่นลูกทำงานเสร็จแล้วไม่มีงานค้างแล้วไม่รอฮุกอะไรแล้วให้ prefix ด้วย emoticon 2 อันคือ raise hand และเครื่องหมายติ๊กถูก". In the same message the owner gave "ไม่เปิดเซสชันมากเกินไป" as an example of an earlier rule to recap.

- Every session you control starts with `(mon-farm)`.
- Add 🙋🏻‍♂️ in front while the owner must act. Remove it once answered.
- `🙋🏻‍♂️✅` means the session is done: no work, no hooks, no subscriptions left. The owner can delete it.
- Do not open more sessions than needed:
  - one independent reviewer, reused for many PRs;
  - a team only for a concrete stream of work.
- AGENTS.md says one developer team at a time.

## 3. Dashboard (https://claude.ai/artifact/3jHpPwSa3uWgMbW16oNdGa)

- **Questions:** ก/ข options with (แนะนำ).
  - Only `answers` docs or the owner's own chat words count as an answer.
  - Mark a question `answered` with a `done` line once acted on; the owner asked for stale items to be cleared.
- **Push cards** follow the AGENTS.md ledger rule:
  - `story`, `kind`, `evidence` (mockup/before/after or flow_before/after), `next_step`.
  - Upload pictures with Artifact publish `asset:true`.
- **Picture the right screen.** The owner was confused because a card showed the counter instead of the 3-way sheet. Fix: the evidence on #203's card was re-shot to show the sheet.
- **Cards for work done elsewhere:** set them to `superseded`, with the PR that replaced them.
  - Example: `feature-fill-sheet-redesign` was replaced by #202.
  - Otherwise they sit "open" for weeks.
- **Colours:** the page has light and dark tokens (`--ink`, `--surface2`, `--latex-soft`). Use them; never hard-code light colours. The owner uses dark mode.

## 4. Merging (AGENTS.md rule, in practice)

- Before merging:
  1. Record the owner's quote in `agreement` and the review in `reviewer`.
  2. Check that the head SHA equals the reviewed SHA and that `mergeable_state` is `clean`.
  3. Squash with `expectedHeadSha`.
- After merging: set the card to `merged`, then post `✅ DONE` to #farm-ai-updates.
- **Add the `e2e` label** on every UI PR with the GitHub MCP tool `issue_write` (method `update`, `labels` including `e2e`). In cloud sessions `gh` is for search only. Without it, PR extras skip Playwright and a red result hides.
  - #207 and #209 only ran e2e after the lead labelled them.
- **CI fonts differ from local fonts.** A layout that fits locally at 98% failed in CI.
  - Ask for headroom (≤ 90%) in fit tests. See #209's three rounds: https://github.com/goonjs/mon-farm/pull/209/files
- **Claims from the old lead:** a stale PR, or "the owner agreed (via lead)" with no quote, needs a fresh ก/ข from the owner before merge.
  - Examples: #154 → d88-confirm, #206 → merge-206.

## 5. Lessons (mistakes made, and the fix)

1. **An agent summary became an "owner rule".**
   - E11-S11's agent summary "no ± steppers" grew into "no − + anywhere" in E01-S20.
   - The lead then drafted E01-S24 on it. The owner never said it.
   - Fixes:
     - https://github.com/goonjs/mon-farm/pull/213/files (story wording)
     - https://github.com/goonjs/mon-farm/pull/215/files (skill wording)
     - #210 closed unmerged.
   - Rule: before you call anything an owner rule, find the owner's verbatim words and date. If you can't, write "project decision (agent wording)".
2. **A message went to the wrong session.** The lead sent the dashboard rule to "Project artifact dashboard", which belonged to another repo.
   - Rule: check a session's repo and title before you message it. The mon-farm dashboard has no session of its own; the lead edits it, and the local copy is in the lead's scratchpad.
3. **Two teams took the same story ID.** E04-S23 went to both team 1 and team 2.
   - Fix: team 1 renamed to E04-S24 in #211, later superseded by https://github.com/goonjs/mon-farm/pull/216.
   - Rule: the lead hands out story numbers. Check `docs/stories/` and cancelled IDs (E15-S05).
4. **New teams didn't know the rules.** Sonnet teams asked the owner directly in chat and drew mockups before reading the skills.
   - Rule: every new team's first message carries the 16-rule brief in §8 below.
5. **Messages crossed.** Teams acted before reading the lead's reply.
   - Examples: #208 opened before the NP-3 answer; the #212 brief arrived after the merge.
   - Rule: tell teams "if my message arrives after you acted, stop and say what you did". Re-read the PR state before acting on a brief.
6. **Pushing during review.** On #196 a push landed mid-merge and the merge returned 409.
   - Rule: no push to a PR under review unless the lead asks.
7. **A team session can't open PRs.** Its system prompt forbids it.
   - The lead opens the PR, e.g. https://github.com/goonjs/mon-farm/pull/214 and #218 (→ #220), then adds the label and queues the review.
8. **A mockup was not from the project file.** The owner rejected redrawn tiles.
   - Rule: start every mockup from `docs/ux/mockups/flow-farm-v1.1.0.html` (same CSS, icons, markup).
9. **Shared files between parallel teams.** Keep a claim list (which team owns which file), and sequence the PRs.
   - Example: E04-S24 waited for E04-S23's point-screen change.

## 6. When to hand over

- Context over ~60%: hand over at the next resting point (no PR mid-review, nothing half-merged).
- Context over ~80%: hand over now.
- Starting a new flow with context over ~40%: hand over first.
- The owner says so: hand over now.
- Before handing over, retitle your session with 🙋🏻‍♂️ and tell the owner in one line.

## 7. Handover checklist (old lead → new lead)

1. Write a handover note (scratchpad, then the new lead's first prompt). It contains:
   - open PRs, each with head SHA, review state and what it waits for;
   - open dashboard questions;
   - every live session with its id and role, and the file claims;
   - scheduled tasks (`list_triggers`): move the morning reminder and the flow meeting to the new lead (`update_trigger` with `persistent_session_id`, or recreate them);
   - the current flow and the next 2–3 stories;
   - the owner's recent decisions, as verbatim quotes with dates;
   - known limits and follow-ups.
   - the dashboard link (https://claude.ai/artifact/3jHpPwSa3uWgMbW16oNdGa) and the owner rule that every lead shows it in every reply (§1, owner 2026-11-18).
2. Create the new lead with `create_session`:
   - title `(mon-farm) Lead N`;
   - the note and this skill's path in its prompt.
3. Tell every live team and the reviewer the new lead's session id, and say that briefs go there now.
4. Retitle the old lead `🙋🏻‍♂️✅ (mon-farm) Lead N-1 · ส่งต่อแล้ว`, and tell the owner in Thai who the new lead is.
## 8. Brief for every new team (send in its first message)

Lead practice (agent wording). It restates AGENTS.md and the skills; where it is stricter, that is on purpose.

**Talking to the owner**
1. Reply in short, plain Thai. Say what you checked and what you did not.
2. No open-ended questions to the owner. Decisions go through the lead, as dashboard ก/ข questions.
3. Never write "the owner agreed" without the owner's exact words and date. Quote them in the story Status.
4. Follow the owner's UI rules:
   - nothing clipped and no "…" (`npm run check:mockup -- <file>` with `CHROMIUM_PATH=/opt/pw-browsers/chromium`);
   - no round outlined word buttons;
   - the app number pad for number fields;
   - summary-lines and phone-form-ux, which you read before any mockup.
   Steppers (− +) are **not** banned app-wide (see §5.1).

**Order of work**
5. No code before a story with AC the owner agreed. New work is drafted as story + mockup first.
6. Happy path first. Small PRs, one at a time.
7. Tests first, and red on the old code. Never weaken or delete a test.
8. Branch from the latest dev as `feature/`, `fix/`, `docs/` or `chore/`. Never commit or push to dev or main. Conventional Commits, subject of 50 characters or less.
9. Don't commit anything that depends on an unanswered owner question.
10. No new dependencies. No `npx` for packages outside the lockfile. No deleting tracked files without the owner's yes. Nothing outside the repo.

**After each push**
11. Write the dashboard `pushes` card, with evidence and `next_step`.
12. Send the lead the six-point brief.
13. Never merge, label, post to Discord, or run the Deploy or APK workflows. Don't push to a PR under review unless the lead asks.
14. Critical paths (AGENTS.md list): tell the lead before you go there.

**Coordination**
15. Ask the lead before you touch a file another team claims, or take a new story number.
16. Messages cross. If the lead's message arrives after you acted, stop and say what you already did.
