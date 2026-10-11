---
name: discord-project-management
description: Manage and maintain the standard Discord structure for projects, whether in a shared multi-project server or a project's own dedicated server. Use when setting up a new project, verifying an existing project's Discord Category and channels, adjusting channel names or settings, or updating agent instructions and channel routing. Ensures unambiguous channel names (project-prefixed in shared servers) and consistent use of talk, design-and-specs, playground, ai-updates, and ai-alerts.
---

# Discord Project Management

Use this skill whenever you need to set up, inspect, verify, adjust, or maintain Discord channels for a project.

The goal is to keep Discord simple for humans and predictable for AI agents.

> **Placeholder convention:** all project names and codes in this repo are mock names (`Acme Shop` / `as`, `Blue Comet` / `bc`). Real project names must never be written into this repository. Real projects keep their own real names in their own private agent instructions.

---

## 0. Server Mode (decide this first)

Every project lives in one of two modes. Determine the mode before anything else.

| Mode | Situation | Channel naming |
|---|---|---|
| **Shared server** | Multiple projects share one Discord server | **Prefix required**: `<project-code>-<purpose>` |
| **Dedicated server** | The project has its own Discord server | **Prefix optional** (default: omit): `<purpose>` |

### Why the prefix exists

Discord may automatically resolve `#channel-name` references when text is pasted. If several projects each have `#ai-alerts`, a message saying "Please respond in #ai-alerts" can resolve to the wrong project's channel. The prefix removes that ambiguity.

### Dedicated server rules

- In a dedicated server there is only one project, so there is nothing to confuse. Use the plain names: `#talk`, `#design-and-specs`, `#playground`, `#ai-updates`, `#ai-alerts`.
- A prefix is still allowed if the team wants one (for example, the server may later host a second project, or the team wants names that stay identifiable in screenshots and notifications). If used, apply it to all five channels, never some.
- Generated text must still use the **exact real channel names** of that server. Do not write a prefixed name in a server that has no prefix, or vice versa.
- If a dedicated server later becomes shared, switch to the prefixed names and update all agent instructions and references (see section 10).
- A dedicated server may not need a Category at all. Use one only if it helps organize the sidebar.

Record the mode and chosen naming in the project's agent instructions so agents never have to guess.

---

## 1. Standard Project Structure

Each project has the same five channels. In a shared server they sit under one dedicated Category per project.

Shared server (prefixed), example project Acme Shop (`as`):

```
Category: Acme Shop
#as-talk
#as-design-and-specs
#as-playground
#as-ai-updates
#as-ai-alerts
```

Another example, Blue Comet (`bc`):

```
Category: Blue Comet
#bc-talk
#bc-design-and-specs
#bc-playground
#bc-ai-updates
#bc-ai-alerts
```

Dedicated server (no prefix):

```
#talk
#design-and-specs
#playground
#ai-updates
#ai-alerts
```

In the rest of this document `<prefix>` means `<project-code>-` in a shared server (or when a dedicated server opts into a prefix), and nothing otherwise.

### Do not shorten the standard channel names

Use `#as-playground`, `#as-ai-updates`, `#as-ai-alerts`. Not `#as-play`, `#as-ai`, `#as-alert`. The full names are intentional because they make the purpose immediately understandable.

---

## 2. Project Code (shared servers, or dedicated with prefix)

A project code should be short, recognizable by the team, unique within the server, stable over the life of the project, and suitable for channel names.

Examples: Acme Shop → `as`, Blue Comet → `bc`.

When setting up a new project:

1. Check whether the project already has an established code. Reuse it if so.
2. Otherwise propose a short code.
3. Check for conflicts with existing projects.
4. Once established, treat the code as stable. Do not change it casually: it invalidates references in agent instructions, documentation, bookmarks, and integrations.

---

## 3. Channel Responsibilities

### `<prefix>talk`

General project conversation, primarily between humans: brainstorming, discussion, coordination, questions, informal communication, weighing approaches.

### `<prefix>design-and-specs`

Durable project knowledge and source-of-truth references: requirements, specifications, UX/design decisions, technical specs, architecture decisions, links to canonical documents, finalized rules.

A discussion may happen in `talk`, but if the outcome becomes an important durable decision it must be captured here or in its canonical document. Not a general conversation stream.

### `<prefix>playground`

Experimentation: AI prototypes, UI experiments, alternative implementations, preview builds, temporary demos, experimental features.

Everything here is experimental unless explicitly accepted. A playground result does not automatically become part of the product. Once accepted, the final decision/specification must be reflected in the appropriate source-of-truth location.

### `<prefix>ai-updates`

Meaningful AI → human updates that **do not require human action**: meaningful completed work or progress, implementation notes, discoveries, generated prototypes or previews, useful status, links to playground experiments.

- Lets humans see what AI is doing without being interrupted.
- Do not post every tiny implementation step.
- Do not use when the AI is blocked or needs human input.
- Normally do not mention/tag humans here.

Prefix for meaningful completed work: `✅ DONE`

```
✅ DONE
Implemented the discount grouping logic.
Preview:
#as-playground
Tests: 24/24 passing.
```

### `<prefix>ai-alerts`

Use **only** when a human needs to take action: a decision, clarification, review, testing, or approval is required; AI is blocked; AI needs information or access; AI needs a human to perform an action.

Keep it low-volume and actionable.

Human mentions:

- Mention the smallest relevant set of people: whoever can actually make the decision or take the action.
- Do not mention everyone. Do not use `@everyone` / `@here` for normal alerts.

Prefixes (use exactly one):

- `❓ NEED DECISION`: a human must decide or clarify.
- `🔎 REVIEW`: a human must inspect, test, or approve something.
- `⚠️ BLOCKED`: AI cannot continue until a human or external dependency resolves the blocker.

---

## 4. Actionable Alert Format

Every `ai-alerts` message must make the required action obvious. When applicable include: what is needed, why, options, impact, and what the human should reply or do. Prefer questions answerable directly in Discord.

Decision:

```
❓ NEED DECISION @owner
Decision needed:
Should the best-value discount include shipping cost?
Options:
A. Yes
B. No
C. Configurable
Impact:
This affects how the discount engine selects the winning discount.
Reply:
A / B / C
```

Review:

```
🔎 REVIEW @owner
The discount UI prototype is ready in #as-playground.
Please test:
1. Multiple products
2. Overlapping discounts
3. Best-value selection
Reply with any issues found, or confirm it is ready to proceed.
```

Blocker:

```
⚠️ BLOCKED @owner
I cannot complete the deployment because the production API credential is missing.
Needed:
Provide/configure the production credential.
Once available, I can continue the deployment.
```

(Examples use the shared-server prefixed form. In a dedicated server without prefix, write `#playground`.)

---

## 5. The Simple Routing Rule

Ask: **Does a human need to take action for the AI to proceed or complete the task?**

- **No** → post to `<prefix>ai-updates`, using `✅ DONE` when appropriate.
- **Yes** → post to `<prefix>ai-alerts`, using `❓ NEED DECISION`, `🔎 REVIEW`, or `⚠️ BLOCKED`, and mention the relevant human.

This rule takes priority over less important considerations.

---

## 6. Channel References

When generating text that references a Discord channel, always use the **complete, exact channel name as it exists in that server**.

- Shared server: `#as-ai-alerts`, `#as-ai-updates`, `#as-playground`, `#as-design-and-specs`. Never `#ai-alerts`, `#ai-updates`, `#playground`, `#design-and-specs`.
- Dedicated server without prefix: `#ai-alerts`, etc.

Never rely on the Category to disambiguate a channel reference in generated text; copy/pasted messages lose that context and Discord may auto-convert the name into a mention.

---

## 7. Setting Up a New Project

1. **Identify** the project name, **server mode** (section 0), project code (if prefixed), and the intended Category.
2. **Check for conflicts:** code not used by another project, channel names unique, no conflicting Category.
3. **Create or verify** the Category (when used).
4. **Create or verify** the five channels using the correct naming for the mode.
5. **Verify:** all five exist, are under the correct Category, names are correct, no accidental generic duplicates were created (shared servers).
6. **Update agent instructions** so they contain the exact channel names, the server mode, and the project code. Remove old or ambiguous references.

Example agent-instruction block (shared server):

```
Project: Acme Shop
Discord mode: shared server
Project code: as
Channels:
#as-talk
#as-design-and-specs
#as-playground
#as-ai-updates
#as-ai-alerts
```

Example (dedicated server):

```
Project: Blue Comet
Discord mode: dedicated server (no prefix)
Channels:
#talk
#design-and-specs
#playground
#ai-updates
#ai-alerts
```

---

## 8. Verifying an Existing Project

Inspect:

- **Structure:** Category (if used), mode, project code, all five channels exist and are in the right place.
- **Naming:** names exactly follow the pattern for the mode; in a shared server no generic unprefixed project channels exist and all names are unique; no shortened names.
- **Purpose:** `talk` = discussion, `design-and-specs` = durable references, `playground` = experiments, `ai-updates` = non-actionable AI updates, `ai-alerts` = human-action requests.
- **AI communication:** correct prefixes, clear required action, relevant humans mentioned, no unnecessary `@everyone`/`@here`, no flood of trivial updates.
- **References:** agent instructions and generated messages use the exact channel names for the mode.

If something is wrong, explain the issue and recommend the smallest appropriate correction. Do not make disruptive changes automatically unless explicitly authorized.

---

## 9. Adjusting an Existing Project

- Preserve the five-channel model unless there is a clear reason not to.
- Prefer correcting existing channels over creating more.
- Keep project-specific additions minimal.
- If channel names change, update all agent instructions and references, and check for stale references to old names.
- Preserve the project code unless there is a strong reason to change it.
- Do not create channels because a new type of conversation appeared once.

## 10. Switching Mode (dedicated ⇄ shared)

If a project moves between a dedicated server and a shared one, treat it as a rename: add or remove the prefix on all five channels together, update every agent instruction, doc, bookmark, and integration, and search for stale references.

## 11. When an Additional Channel May Be Justified

Only for a persistent, clearly distinct workflow that cannot reasonably fit the five standard channels. First consider a thread, a document, a section in `design-and-specs`, or the existing channels. Avoid channel proliferation.

## 12. Existing Agent Communication Rules

This skill does not replace project-specific agent instructions or existing structured AI update formats. When modifying a project's rules:

1. Inspect the existing instructions first.
2. Preserve useful existing behavior.
3. Make the smallest changes needed to conform.
4. Do not redesign unrelated agent communication.
5. Use the exact channel names consistently.

If a project-specific rule conflicts with this skill, identify the conflict and resolve it per the project's established instructions and the user's explicit direction.

## 13. Core Principle

```
talk              → discuss
design-and-specs  → remember
playground        → experiment
ai-updates        → AI tells us
ai-alerts         → AI needs us
```

The prefix exists to prevent cross-project ambiguity in shared servers. Where there is no ambiguity (dedicated server), it is optional. Do not add complexity unless it solves a real recurring problem.

**Simple for humans. Predictable for AI. Unambiguous across projects.**
