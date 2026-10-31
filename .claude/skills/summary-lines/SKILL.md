---
name: summary-lines
description: How a mon-farm summary card or line shows money and people — short figures (at most 4 digits, k/m with the unit stressed), how many people per line, a symbol on the total, and which hint sentences never go on screen. Use when drawing or building any card, row or placeholder that summarises amounts per person (debt cards, sale summaries, settlement lines).
---

# Summary lines (owner rules, 2026-10-31)

Built from the sale close-out proposal (`docs/ux/sale-closeout-proposal.md`, mockup A1/A3/A10).

## 1. Short money

- A summary line shows at most **4 digits**: `฿ 3,250` · `฿ 12.54k` · `฿ 1.235m`. Whole baht with a comma under 10,000; from 10,000 the unit **k** or **m**.
- The unit is **stressed**: bold, action colour (and a light pill in mockups). Use `CompactMoney` (`src/ui/compact-money.tsx`); the text comes from `compactMoney` / `compactMoneyParts` (`src/core/compact-money.ts`). Never format by hand, never add k/m in a screen.
- It is rounded and display only. The exact amount is one tap away (a detail sheet) and **no sum is ever taken from this text**. Detail sheets, receipts and anything the buyer reads show the full amount.
- Thai-unit shortening for the counter cards (พัน / หมื่น / แสน, `compactBaht`, D-41) is a different thing and stays where it is.

## 2. How many per line

Count what the card has to show:

| The card shows | Layout |
|---|---|
| people **and** a total | people on one line; if more than 2 people, **2 per line**; then the total on **its own line**, led by a symbol (Σ) so it stands out |
| people only | **one person per line** |
| one person | that person's line |

Example (people + total): `แดง หนี้ 3 ก้อน · นัด หนี้ 2 ก้อน` / `Σ รวม ฿ 24.14k`.
Example (people only, after deduction): `แดง หัก ฿ 3,250 คงเหลืออีก ฿ 12.54k` / `นัด หัก ฿ 5,250 คงเหลืออีก ฿ 3,100`.

Keep the card to as few lines as that gives; do not wrap names and figures into a paragraph.

## 3. No "in case you forgot" sentences

Do not put reminder or reassurance sentences on screen — "บางทีเพิ่งนึกได้ตอนแบ่งเงิน", "เผื่อลืม…", "อย่าลืม…", "ยังไม่ได้บันทึกจนกด…". If the person must not skip a step, **gate it** (the button stays off until done) and say what to do in the button itself ("จัดการหนี้ก่อนจึงยืนยันได้"). A one-line fact the person needs to decide (a limit, a consequence) is fine; a hint about what they might forget is not.

## 4. Icons beside such cards

Use one FarmMate icon per card and keep it when the state changes (only the tile colour changes). Do not use a person icon on a card about money: a debt card uses `finance.otherCost` (a ฿ bill), a person row uses `people.tapper`. Small actions are round icon buttons (34 px circle in a 48 px target) with an accessible label; add a word only when it is one short word.

## Checks

- `src/core/compact-money.test.ts` holds the figures; add a case there before changing the rule.
- Mockups: `npm run check:mockup` as always.
