---
name: phone-form-ux
description: Design and check mon-farm data-entry screens (forms, multi-step flows, sheets) so a farm worker can use them on a phone without scrolling or thinking. Use before drawing a mockup, before building or changing any form or flow screen, and before calling UI work done or putting it to the owner. Built from the E11-S10 fertilizer flow, where the first build passed every test and review but the owner found the pages too long on the real phone.
---

# Phone form UX: one screen, one question

The people using this app are on a farm, holding a phone in one hand, often in
the sun, often in a hurry. Every screen that asks for data is judged by one
test: **can they finish it without scrolling and without stopping to think?**

## What went wrong once (E11-S10, 2026-10-18 to 10-23)

The fertilizer purchase flow went through mockup approval, TDD, an independent
code review, a sandbox QA run and green unit tests. Then the owner opened it on
the real preview and said: the pages feel long, split them up. Measured on the
real build at 390×844:

| Screen | Height |
|---|---|
| Expense form | 1.6 screens |
| Fertilizer step "tappers" | 1.7 screens |
| Zones / pay / buy / summary | 1.2–1.4 screens |

These were the mistakes, and why each got through:

1. **The mockup was judged small, not at phone size.** Phones were drawn side
   by side on one long page and screenshot as a whole. At that scale "too
   long" is invisible, and the owner said "it's blurry" twice before anyone
   exported one PNG per phone. *Fix: one PNG per phone, at device size, 3×.*
2. **"Fits one screen" was asked of the mockup, never checked on the build.**
   The mockup was split into six steps, then the build put the same amount on
   each step again (fields, hints, insets, per-step edit buttons). No test and
   no reviewer measured height. *Fix: measure scroll height on the real build
   before calling it done.*
3. **Each step carried everything that could go there.** Optional fields
   (shop, who ordered, receipt, item, note, farm, stage, date) sat on the main
   path beside required ones. Most people would never touch them, but
   everyone had to scroll past them.
4. **The flow mirrored the data model, not the person's questions.** Steps
   were "buy / why / pay / zones / tappers / summary" with several fields each,
   instead of one plain question each.
5. **Chrome grew with the steps.** A six-chip step bar wrapped to two lines;
   the summary had five "edit step N" buttons plus another edit button.
6. **QA and review checked behaviour, not effort.** Both were thorough on
   money and data, and neither had "how long is this screen" on its list.

## Why the redesign worked

The approved redesign (docs/ux/mockups/flow-farm-v1.1.0.html §7b) fits every
phone in one screen because it:

- **asks one question per screen**, in the person's words: "ซื้อปุ๋ยอะไร",
  "กี่กระสอบ ราคาเท่าไหร่", "ใส่ทำไม", "ใครจ่ายเงินไปก่อน", "แบ่งให้ใคร";
- **pre-fills sensible defaults** (today's date, the payer from last time, the
  category %, the last tapper gets the sacks left), so most people only press
  ถัดไป;
- **puts optional things behind one "เพิ่มรายละเอียด" row**, a sheet that
  opens only on demand;
- **turns repeat typing into one tap**: a list of products bought before fills
  type, formula, brand and sack size at once; "ปุ๋ยใหม่" opens a sheet with a
  single "จำไว้ใช้ครั้งหน้า" tick, on by default;
- **moves rarely-used steps off the main path**: zones became a row on the
  summary, "บันทึกภายหลังได้";
- **makes the summary a short receipt**: tap a line to edit that step, no row
  of edit buttons;
- **keeps chrome thin**: a progress bar with "n จาก 6" instead of chips;
  ย้อนกลับ / ถัดไป pinned at the bottom;
- **avoids one word meaning two things**: in this flow the stages read
  "ซื้อแล้ว / สั่งไว้ / แค่วางแผน", so "จ่ายแล้ว" stays the tapper's button.

## Rules

Use these when you draw, build or review any screen that takes input.

1. **One screen in the normal case.** At 390×844 portrait, the golden path of
   every step fits without scrolling. A long list (settings, history) may
   scroll; a form may not.
2. **One question per step.** Title the step with the question. Two unrelated
   decisions means two steps, or one goes behind "เพิ่มรายละเอียด".
3. **Required first, optional hidden.** Only what is needed to save sits on
   the screen. Everything else goes behind one "เพิ่มรายละเอียด" row or sheet,
   with defaults already filled.
4. **Default everything you can,** and say where the default came from
   ("คนเดิมครั้งก่อน", "ค่าจากหมวด · แก้ได้").
5. **Pick instead of type.** Offer saved choices first (most used or most
   recent on top), with "+ ใหม่" to type, and save typed values for next time.
6. **Big targets, plain Thai.** No internal terms on screen. Never let one
   word mean two things in the same flow.
7. **Thin chrome.** One progress line, back and next pinned at the bottom, no
   per-step edit buttons. On the summary, tapping a line edits it.
8. **Summary = receipt.** Short lines that add up. Details sit one tap away in
   a sheet.
9. **Nothing is cut off (owner rule, 2026-10-27).** No control or text may
   stick out past the screen edge, no content may be truncated with "…", no
   row may scroll sideways. If it does not fit on one line, wrap it, drop it
   to the next line or rethink the layout (e.g. a unit chip row that runs off
   the edge becomes its own row). This was seen on an unchecked mockup
   (unit chips cut off on the right) and is not accepted in the project.

## How to check before you show anything

1. **Mockup:** export every phone as its own PNG at device size, 3×. Send the
   owner those, one per screen in order. Never send only the long page.
2. **Fit check on the mockup:** `npm run check:mockup -- <file.html> <outDir>`
   (scripts/check-mockup-fit.mjs). It fails on vertical overflow, anything
   sticking out sideways, "…" truncation and clipped boxes, and writes one PNG
   per phone. A FAIL blocks showing the mockup.
3. **Fit check on the build:** run the real web build at 390×844. For each
   screen of the flow, record `document.scrollingElement.scrollHeight /
   innerHeight` (or the ScrollView content height / viewport). The golden path
   must be ≤ 1.0. Record the numbers in the story's QA notes.
4. **Side by side:** before asking the owner, put the build screenshot next to
   the approved mockup phone. If the build is taller or busier, fix that first.
5. **Reviewers:** give the independent reviewer and QA this skill, so "how
   long is each screen, what could be hidden or defaulted" is on their list
   next to correctness.

## Where to look

- Approved example: `docs/ux/mockups/flow-farm-v1.1.0.html` §7b; per-screen
  images in `docs/ux/screenshots/v2/money/fertilizer/`.
- Story with the history: `docs/stories/e11-s10-share-expense.md`.
- Design system: `docs/ux/design-system.md`, tokens in `docs/ux/tokens.css`.
  The UI uses `src/ui` only (D-82).
