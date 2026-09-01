# Story: The spoken count (Thai speech, count only)

Status: **Review** — implemented 2026-09-01. Cannot reach `Done` without a
push to CI and an independent review, neither authorized yet.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Related PRD section(s): FR-11.3, FR-11.4, FR-11.7–FR-11.11, FR-11.12,
  FR-12.2, FR-12.8
- Depends on: S3 (event log — `announced` sys payload already exists and is
  already projected, unused until now), S24 (the announced register — `say.*`
  ids, `isAnnounced()`, the always-Thai rule)

## Description

`expo-speech` has been installed since 2026-08-10 (`docs/epics/epic-1-run-and-
settle-one-sale.md`'s "Known blockers") and nothing imports it. FR-11 is half
of what makes the count a public, trustworthy record — the count is supposed
to be *heard* by everyone at the scale, not just seen by whoever holds the
phone (FR-9, FR-11 preamble) — and until this story it does not exist.

**Scope, deliberately narrower than FR-11.** This story covers only the
spoken count on each accepted basket (FR-11.3, FR-11.4) and the on/off
preference (FR-11.11). It does **not** cover the level read-back (FR-11.1),
พร้อมค่ะ (FR-11.2), or ต่อไปค่ะ (FR-11.5) — those depend on PRD open questions
5 (voice persona) and 6 (which fields the read-back says), both still
unanswered, and `CLAUDE.md` forbids building ahead of an unanswered question.
They are **S31**, to be written once those questions are settled.

A short basket (`short` event, confirmed via `ShortBasketPanel`) is also a
completed basket and is announced the same way as an `accept` — FR-11's
"on each recorded basket" does not distinguish standard from off-standard.

## Acceptance criteria

- [x] A pure Thai numeral speller (`src/core/thai-number.ts`) renders any
      non-negative integer used in a real sale (0 through at least 999) as
      correct Thai number words, including the irregular compounds — ยี่สิบ
      (not สองสิบ), เอ็ด in the ones place of a multi-digit number (ยี่สิบเอ็ด,
      not ยี่สิบหนึ่ง), ร้อย, and the same irregularities carried into the
      hundreds (หนึ่งร้อยยี่สิบเอ็ด).
- [x] Completing a hold (`onCount`) speaks the new running count in Thai,
      through a `Speaker` port with web (`SpeechSynthesis`) and native
      (`expo-speech`) adapters, mirroring the existing `store.ts` /
      `store.web.ts` / `store.native.ts` split.
- [x] Confirming a short basket (`confirmShort`) speaks the new running count
      the same way an accept does.
- [x] Every announce attempt appends one `sys` `announced` event
      (`{ t: 'announced', thai, ok }`) whether or not the speech engine
      reported success — `ok` records that, and it never blocks or delays the
      basket's own `accept`/`short` event.
- [x] Speech never blocks or delays counting (FR-11.4, FR-11.10): the
      announce call is fire-and-forget from the counter's perspective, the
      same discipline `store.append()` already uses for persistence.
- [x] A degraded-state indicator (a pill on the counter, next to the existing
      `clockSuspect` pill) appears when speech is on but the last announce
      attempt reported `ok: false` or the platform has no Thai voice
      available — non-blocking, per FR-11.10.
- [x] A speech on/off toggle lives in `src/app/settings.tsx`, next to the
      language switch, backed by a per-device preference
      (`src/store/speech-preference.ts`, mirroring `src/i18n/preference.ts`).
      Default is on.
- [x] Toggling speech while a sale is open (i.e. after `startedTs` is set)
      appends a `sys` event (`{ t: 'speech_set', on: boolean }`) to that
      sale's log, so a sale with no `announced` events is distinguishable
      from one where the voice failed silently throughout. Toggling before
      any sale is started (the settings screen, with no sale in progress)
      does not — there is no sale log to append to.
- [x] `say.count` stays `'{n}'` on screen (FR-11.12) — only the spoken string
      uses the speller. On-screen numerals remain Arabic digits.
- [x] Turning speech off stops future announcements but does not change the
      counting logic or the hold rhythm (FR-11.11).

## Offline / sync behavior

Speech must work fully offline (NFR-1, FR-11.7) — both adapters use on-device
capability (`expo-speech` wraps each platform's native TTS; `SpeechSynthesis`
is a browser API), neither calls a network service. `announced` and
`speech_set` events are ordinary sale events: they persist through the
existing `store.append()` path and are included in whatever syncs later
(FR-12.8 — no sync exists yet per epic 1's boundary table, so this is
forward-shaped only, not implemented). No new offline/online branching:
speech either works on-device or is reported unavailable, in both cases
without a network round-trip.

- [x] Feature is fully usable with no network connection (verified: airplane
      mode / offline browser, in the sandbox run below)
- [x] Local writes (`announced`, `speech_set`) persist through the same
      `store.append()` path as every other event — no new persistence code
- [x] N/A — no sync trigger exists yet (epic 1 boundary: backend/sync is out
      of scope)
- [x] N/A — no sync to trigger manually yet
- [x] N/A — no remote conflict is possible with no backend
- [x] N/A — no partial sync path exists yet
- [x] Sync status — N/A, not built yet; the degraded-state pill communicates
      speech status instead, which is the analogous "is this working" signal
      for this story's scope
- [x] No data loss scenario: an `announced` event with `ok: false` is still
      logged, so the basket's own `accept`/`short` event and its count are
      unaffected by a speech failure — verified in the announcer's test with
      a fake speaker forced to fail

## Test plan

- [x] `src/core/thai-number.test.ts` — 0, 1–20 (the irregular teens are
      regular in Thai, but เอ็ด/ยี่ start at 21), 21, 100, 101, 121, 200, 999,
      and any count actually reachable in `docs/core/fixtures.ts`'s sample
      sales. Written first, failing, before the speller exists.
- [x] `src/speech/announcer.test.ts` — a fake `Speaker` that succeeds, and one
      that throws/rejects: asserts exactly one `announced` event per call,
      `ok` matches the outcome, and the announce call never throws back into
      the caller.
- [x] **Deviation**: no RNTL component test — `counter.tsx` has no existing
      `.test.tsx` precedent (it's a route/screen, exercised via `e2e/*.spec.ts`
      throughout the repo, same as setup/settlement). Kept that convention:
      `e2e/counter.spec.ts` gained a real-hold-through-a-real-browser case
      instead, stubbing `window.speechSynthesis` and asserting the Log tab
      shows the successful announcement.
- [x] `src/core/project.test.ts` — new case: a `speech_set` event flips a
      projected `speechOn`-style flag (or equivalent), and `announced` events
      remain no-ops on `SaleState` (already true; add a regression case).
- [x] `e2e/counter.spec.ts` — extend with a speech-on scenario stubbing
      `window.speechSynthesis` to assert the Log tab shows the announcement,
      and a speech-off scenario asserting no `announced` events appear.
- [x] Offline path: run the above e2e scenario with the browser context
      offline (Playwright `context.setOffline(true)`) to confirm speech still
      fires from on-device capability.

## Verification

- [x] Sandbox run performed: full `npm run verify` chain green from a clean
      checkout after `npm ci` (`node_modules` was absent at session start) —
      `tokens:check`, `contrast`, `tsc --noEmit`, `eslint .`, 86 Vitest cases
      across `src/core` + `src/i18n` + `src/store` + `src/speech`, 41 Jest/RNTL
      component cases, `expo export --platform web`, and the full Playwright
      suite (100 passed, 6 skipped by device scoping) across all four
      viewport projects. Playwright ran against a local, uncommitted
      `playwright.local.config.ts` that points `executablePath` at this
      sandbox's pre-installed Chromium — the checked-in
      `docs/architecture.md`/`playwright.config.ts` setup is untouched; the
      sandbox's `chromium_headless_shell` install is an older revision with a
      different directory layout than this project's Playwright version
      expects.
- [x] Screenshots (UI stories only) — golden path:
      `docs/stories/screenshots/s10/golden-log-with-speech.png` — a completed
      hold, Log tab, showing `พูด "ห้า"` with no failure suffix.
- [x] Screenshots (UI stories only) — edge cases:
      `docs/stories/screenshots/s10/edge-degraded-pill.png` (speech on, the
      speaker forced to fail — the warn pill appears and the count still
      advances, proving FR-11.10),
      `docs/stories/screenshots/s10/edge-settings-toggle.png` (the settings
      screen's three-choice layout with speech off, persisted), and
      `docs/stories/screenshots/s10/edge-speech-off-logged.png` (the counter
      after toggling off mid-sale — `#16 เสียงนับ ปิด` on the record, `#17` a
      basket with no announcement after it).

## Dev notes

**Design resolution not fully spelled out by the acceptance criteria**: there
are two different "is speech on" signals, deliberately.
`useSpeech()`/`src/speech/index.tsx` is the LIVE, reactive gate — read by
`counter.tsx` before every `announceCount()` call, exactly like theme and
locale (same provider shape, same reasoning: a device preference, read
everywhere, no event log). The projected `state.speechOn` /
`speech_set` event is NOT the runtime gate — it is audit trail only, there so
the Log tab can explain an otherwise-silent stretch of a sale. They are kept
in sync by construction: the only control that appends `speech_set` (the
counter's own quick-toggle pill) always calls `setSpeechOn` in the same
click. `settings.tsx`'s toggle only ever touches the device preference — it
structurally cannot log to a sale, since that screen has no sale in scope
(no `useSale()`), which is what actually satisfies "toggling before any sale
started does not log" rather than a runtime `startedTs` guard.

**A real bug, caught only by looking at an actual screenshot, not by the
green e2e run**: the first version of `stubSpeechSynthesis` (in
`e2e/counter.spec.ts`) did `window.speechSynthesis = { speak: ... }`.
`window.speechSynthesis` is a read-only accessor in real Chromium, so that
assignment silently no-ops; `speaker.web.ts` still called the REAL
`speechSynthesis.speak()` with a fake utterance object, which threw inside
that native call and was swallowed by `speaker.web.ts`'s own
`catch { resolve(false) }` — producing a *convincingly real-looking*
`พูด "ห้า" — ไม่ได้ยิน` log row on every single basket. The e2e assertion at
the time only checked that a `พูด` row existed, which this satisfied — the
test was green while speech silently failed on every count. Caught by
reading the screenshot taken for the story's own verification, not by any
automated check. Fixed two ways: the stub now patches the **existing**
`speechSynthesis` object's own `speak` method in place (mutating an owned
property always works, regardless of whether the top-level binding is
writable) instead of replacing the binding, and the golden-path e2e
assertion now explicitly checks `not.toContainText('ไม่ได้ยิน')` rather than
only checking that some announcement row exists. Left as a standing lesson:
an assertion that a thing *happened* is not the same as an assertion that it
*succeeded*.

**`src/speech/` folder shape**, settled during implementation rather than
exactly as first drafted: the on/off device preference lives at
`src/speech/preference.ts`, not `src/store/speech-preference.ts` as this
story originally said — mirroring `src/i18n/preference.ts` sitting beside
`src/i18n/index.tsx` inside its own feature folder, rather than the
`store.ts` naming this story borrowed the pattern from.

**`vitest.config.ts`** gained `src/speech/*.test.ts` to its `include` (not
`**`, so `speaker.web.ts`/`speaker.native.ts` stay excluded, same treatment
as `store.web.ts`/`store.native.ts`) — the port and the announcer are pure,
no RN import, so they belong in the fast Vitest tier.

**Not built, and deliberately out of scope**: the level read-back
(FR-11.1), พร้อมค่ะ (FR-11.2), ต่อไปค่ะ (FR-11.5). See S31 in
`docs/epics/epic-1-run-and-settle-one-sale.md`, blocked on PRD open
questions 5 and 6.

## Code review

- Reviewer (separate agent/session): not yet run — required before `Done`.
- Findings:
- Resolution:

## QA notes

The degraded-state pill and the fake-speaker screenshots were produced with
a forced `onerror` outcome, not a genuinely voiceless device — worth a real
low-end-Android pass (no Thai TTS installed) before this ships to the field,
since that is the actual failure mode FR-11.10 is written against and this
story could only simulate it.
