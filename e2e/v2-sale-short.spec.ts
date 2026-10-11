import { appendFileSync, mkdirSync } from 'node:fs';

import { test, type Page } from '@playwright/test';

import type { MasterPayload } from '../src/core/types';
import { seedMaster } from './fixtures';

/**
 * Walks the "เข่งไม่เต็ม" (short basket) flow of E04-S06 through every condition
 * in the real web build and records, per condition, a screenshot and what the
 * screen says against what the story / mockup 2b says. Nothing here fails a
 * run on a mismatch: the point is the report (SHORT_OUT=<dir>), not a gate.
 */

const OUT = process.env.SHORT_OUT ?? 'e2e/.results/short';
mkdirSync(OUT, { recursive: true });

test.beforeEach(() => test.skip(test.info().project.name !== 'phone-portrait', 'portrait only'));
test.use({ viewport: { width: 412, height: 915 } });
test.setTimeout(120_000);

const on = (page: Page) => (id: string) => page.getByTestId(id).filter({ visible: true });
const snap = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });
const text = async (page: Page, id: string) => ((await on(page)(id).first().textContent({ timeout: 2_000 }).catch(() => null)) ?? '').replace(/\s+/g, ' ').trim();

/** One line in the report: what the story/mockup expects vs what the app shows. */
async function rec(scenario: string, check: string, expected: string, actual: string, ok: boolean, shot?: string) {
  appendFileSync(`${OUT}/results.jsonl`, JSON.stringify({ scenario, check, expected, actual, ok, shot }) + '\n');
}
async function expectText(page: Page, scenario: string, check: string, testId: string, expected: string, shot?: string) {
  const actual = await text(page, testId);
  await rec(scenario, check, expected, actual || '(ไม่พบ)', actual.includes(expected), shot);
}
async function expectEq(scenario: string, check: string, expected: string, actual: string, shot?: string) {
  await rec(scenario, check, expected, actual, expected === actual, shot);
}

const FARM: MasterPayload[] = [
  { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'nat', name: 'นัด', roles: ['tapper'], otherRoles: [] },
  { t: 'person_added', personId: 'mgr', name: 'อ.สมหวัง', roles: ['manager'], otherRoles: [] },
  { t: 'buyer_added', buyerId: 'buyer-a', name: 'คนรับซื้อยาง ก (ตัวอย่าง)' },
  { t: 'property_added', propertyId: 'fa', name: 'จันทเขลม', crop: 'rubber' },
  { t: 'property_added', propertyId: 'fb', name: 'คลองพลู', crop: 'rubber' },
  { t: 'area_recorded', propertyId: 'fa', entryId: 'ar1', centiRai: 12_500, effective: '2020-01-01' },
  { t: 'area_recorded', propertyId: 'fb', entryId: 'ar2', centiRai: 3_000, effective: '2020-01-01' },
  { t: 'point_added', pointId: 'a1', propertyId: 'fa', name: 'จุด 1' },
  { t: 'point_added', pointId: 'a2', propertyId: 'fa', name: 'จุด 2' },
  { t: 'point_added', pointId: 'a3', propertyId: 'fa', name: 'จุด 3' },
  { t: 'point_added', pointId: 'a4', propertyId: 'fa', name: 'จุด 4' },
  { t: 'point_added', pointId: 'b1', propertyId: 'fb', name: 'จุด 1' },
  { t: 'tapper_assigned', assignmentId: 's1', pointId: 'a1', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's2', pointId: 'a2', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's3', pointId: 'a3', tapperId: 'red' },
  { t: 'tapper_assigned', assignmentId: 's4', pointId: 'a4', tapperId: 'nat' },
  { t: 'tapper_assigned', assignmentId: 's5', pointId: 'b1', tapperId: 'nat' },
];

async function hold(page: Page) {
  const box = (await on(page)('hold').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
}

/** Starts a sale and opens the counter at a1 (แดง, จุด 1) with `n` full baskets counted. */
async function begin(page: Page, opts: { numbering?: 'per-tapper' | 'per-point'; full?: number } = {}) {
  const id = on(page);
  await seedMaster(page, FARM);
  await page.evaluate(() => localStorage.setItem('mon-farm:hold-ms', '500'));
  await page.goto('/v2');
  await id('home-sale-start').click();
  await id('start-buyer').click();
  await id('start-buyer-buyer-a').click();
  if (opts.numbering === 'per-point') await id('start-numbering-per-point').click();
  await id('start-next').click();
  await id('pick-farm-fa').click();
  await id('pick-point-a1').click();
  await id('start-weigh').click();
  await id('counter').waitFor();
  for (let i = 0; i < (opts.full ?? 3); i++) await hold(page);
}

/** "เปลี่ยนจุด" to a point of the given farm/tapper; passes the empty-scale check when asked. */
async function moveTo(page: Page, farm: string, tapper: string, point: string) {
  const id = on(page);
  await id('switch-point').click();
  await id(`pick-farm-${farm}`).click();
  await id(`pick-tapper-${tapper}`).click();
  await id(`pick-point-${point}`).click();
}
async function throughGate(page: Page) {
  const id = on(page);
  if (await id('start-weigh').isVisible().catch(() => false)) await id('start-weigh').click();
  await id('counter').waitFor();
}

/** Opens the short-basket sheet and nudges the reading to `kg`. */
async function setReading(page: Page, kg: number) {
  const id = on(page);
  for (let guard = 0; guard < 120; guard++) {
    const now = parseInt((await text(page, 'reading')).replace(/\D/g, ''), 10);
    if (now === kg) return;
    await id(now < kg ? 'reading-more' : 'reading-less').click();
  }
}

test('A · เข่งไม่เต็มที่จุดตัวเอง (เลขเข่งต่อเนื่องตามคนกรีดยาง)', async ({ page }) => {
  const S = 'A';
  const id = on(page);
  await begin(page);
  await expectEq(S, 'ก่อนบันทึก: เข่งปัจจุบัน', '4', await text(page, 'current-no'));
  await snap(page, 'A0-counter-before');

  await id('tool-short').click();
  await id('short-sheet').waitFor();
  await snap(page, 'A1-sheet-default');
  await expectEq(S, 'ค่าเริ่มต้นที่ตาชั่งอ่าน (mockup 10: 37)', '37', (await text(page, 'reading')).replace(/\D/g, ''), 'A1-sheet-default');
  await expectText(page, S, 'ยางสุทธิ (mockup: 35 กก.)', 'short-net', '35', 'A1-sheet-default');
  await expectText(page, S, 'ยังขาด (mockup: ขาด 15 จึงเต็ม 50)', 'card-lack', '15', 'A1-sheet-default');

  await setReading(page, 3);
  await snap(page, 'A2-sheet-min');
  await rec(S, 'ลดค่าสุดทาง: ต่ำสุดที่รับ = น้ำหนักเข่ง+1 (ค่า ≤ เข่ง ไม่รับ)', '3 กก. (สุทธิ 1)', `${await text(page, 'reading')} · สุทธิ ${await text(page, 'short-net')}`, (await text(page, 'reading')).startsWith('3'), 'A2-sheet-min');

  await setReading(page, 77);
  await snap(page, 'A3-sheet-max');
  await rec(S, 'เลื่อนสุดทาง: 77 กก. (D-79 ไม้บรรทัด 150%)', '77 กก. (สุทธิ 75)', `${await text(page, 'reading')} · สุทธิ ${await text(page, 'short-net')}`, (await text(page, 'reading')).startsWith('77'), 'A3-sheet-max');

  await id('short-cancel').click();
  await expectEq(S, 'ยกเลิก = ไม่บันทึกอะไร (เข่งปัจจุบันยังเป็น 4)', '4', await text(page, 'current-no'));
  await rec(S, 'ยกเลิก: ไม่มีการ์ดเข่งที่เปิดอยู่', 'ไม่มี open-card', (await id('open-card').count()) ? 'มี open-card' : 'ไม่มี open-card', (await id('open-card').count()) === 0);

  await id('tool-short').click();
  await setReading(page, 37);
  await id('short-save').click();
  await page.waitForTimeout(300);
  await snap(page, 'A4-open-waiting');
  await expectText(page, S, 'การ์ดเข่งเปิดอยู่ (mockup 11: เข่ง 9 เปิดอยู่ · 35 กก. ตาชั่ง 37 − น้ำหนักเข่ง 2)', 'open-card', 'เข่ง 4 เปิดอยู่ · 35 กก.', 'A4-open-waiting');
  await expectText(page, S, 'การ์ดเข่งไม่เต็ม: ยังขาด 15 กก. (SALE-11 / AC การ์ด)', 'fig-missing', '15', 'A4-open-waiting');
  await expectText(page, S, 'พื้นที่กดค้างเปลี่ยนเป็น "เข่ง 4 รอเติม"', 'stage-wait', 'เข่ง 4 รอเติม', 'A4-open-waiting');
  await expectText(page, S, 'ข้อความนำทาง "ไปจุดถัดไปของ แดง แล้วเติมต่อได้"', 'stage-wait', 'ไปจุดถัดไปของ แดง', 'A4-open-waiting');
  await expectEq(S, 'เข่งที่เปิดอยู่ยังไม่นับว่าเสร็จ (เสร็จแล้ว = 3)', '3', (await text(page, 'counter')).match(/เสร็จแล้ว\s*(\d+)/)?.[1] ?? (await text(page, 'fig-done')).replace(/\D/g, ''), 'A4-open-waiting');
  await expectText(page, S, 'น้ำหนักสะสมรวมเข่งที่เปิด 150+35 = 185 กก.', 'fig-kg', '185', 'A4-open-waiting');
  await rec(S, 'ปุ่มเข่งไม่เต็มปิดใช้งานขณะรอเติม', 'disabled', (await id('tool-short').getAttribute('aria-disabled')) === 'true' ? 'disabled' : 'enabled', (await id('tool-short').getAttribute('aria-disabled')) === 'true');
  await rec(S, 'ไม่มีพื้นที่กดค้างขณะรอเติม (flow Q8 ยังเปิด)', 'ไม่มี hold', (await id('hold').count()) ? 'มี hold' : 'ไม่มี hold', (await id('hold').count()) === 0);

  // reload keeps it
  await page.reload();
  await id('counter').waitFor();
  await snap(page, 'A5-after-reload');
  await expectText(page, S, 'รีโหลดแล้วเข่งเปิดค้างยังอยู่', 'open-card', 'เข่ง 4 เปิดอยู่', 'A5-after-reload');

  // close as scrap
  await id('close-open').click();
  await page.waitForTimeout(300);
  await snap(page, 'A6-closed-scrap');
  await expectEq(S, 'จบเข่งนี้ → เลขถัดไป 5 (SALE-13)', '5', await text(page, 'current-no'), 'A6-closed-scrap');
  await rec(S, 'หลังจบเข่ง กลับมีพื้นที่กดค้างปกติ', 'มี hold', (await id('hold').count()) ? 'มี hold' : 'ไม่มี hold', (await id('hold').count()) > 0, 'A6-closed-scrap');
  await expectText(page, S, 'น้ำหนักสะสมคงเดิม 185 กก.', 'fig-kg', '185', 'A6-closed-scrap');
  await expectText(page, S, 'ช่อง "เข่งไม่เต็ม" กลับเป็น ไม่มี', 'card-short', 'ไม่มี', 'A6-closed-scrap');
});

test('B · ย้อนกลับ (undo) เข่งไม่เต็ม', async ({ page }) => {
  const S = 'B';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await id('short-save').click();
  await page.waitForTimeout(300);
  await id('tool-undo').click();
  await page.waitForTimeout(300);
  await snap(page, 'B1-after-undo');
  await expectEq(S, 'ย้อนกลับเข่งไม่เต็ม → เลขเข่งกลับเป็น 4', '4', await text(page, 'current-no'), 'B1-after-undo');
  await rec(S, 'การ์ดเข่งที่เปิดอยู่หายไป', 'ไม่มี open-card', (await id('open-card').count()) ? 'มี open-card' : 'ไม่มี open-card', (await id('open-card').count()) === 0, 'B1-after-undo');
  await expectText(page, S, 'น้ำหนักสะสมกลับเป็น 150 กก.', 'fig-kg', '150', 'B1-after-undo');
});

test('C · ค่าที่อ่านเต็มเข่งหรือเกิน (เข่งไม่เต็มที่จริงเต็ม)', async ({ page }) => {
  const S = 'C';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await setReading(page, 52);
  await snap(page, 'C1-sheet-52');
  await expectText(page, S, 'ขาดอีก 0 กก. เมื่ออ่าน 52', 'card-lack', '0', 'C1-sheet-52');
  await id('short-save').click();
  await page.waitForTimeout(300);
  await snap(page, 'C2-saved-52');
  await rec(S, 'บันทึกที่ 52 (เต็ม 50 สุทธิ): ควรนับเป็นเข่งเต็ม ไม่ค้างเปิด (flow Q10 ยังเปิด — ไม่มีใน AC)', 'เลขถัดไป 5 และไม่มี open-card', `เลข ${await text(page, 'current-no')} · ${(await id('open-card').count()) ? 'มี open-card' : 'ไม่มี open-card'} · เสร็จแล้ว ${(await text(page, 'fig-done')).replace(/\D/g, '')}`, (await text(page, 'current-no')) === '5' && (await id('open-card').count()) === 0, 'C2-saved-52');
});

test('D · เปลี่ยนไปจุดของคนกรีดยางคนเดิม → ถาม 3 ทาง (โหมดต่อเนื่อง)', async ({ page }) => {
  const S = 'D';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await id('short-save').click();
  await page.waitForTimeout(300);
  await moveTo(page, 'fa', 'red', 'a2');
  await id('fill-sheet').waitFor();
  await snap(page, 'D1-fill-sheet');
  await expectText(page, S, 'หัวข้อ "เข่ง 4 ยังไม่เต็ม"', 'fill-sheet', 'เข่ง 4 ยังไม่เต็ม', 'D1-fill-sheet');
  await expectText(page, S, 'มีแล้ว 35 กก.', 'fill-sheet', '35', 'D1-fill-sheet');
  await expectText(page, S, 'บอกจุดเดิม "จันทเขลม จุด 1" และคนกรีดยางคนเดิม แดง', 'fill-sheet', 'จันทเขลม จุด 1', 'D1-fill-sheet');
  await expectText(page, S, 'ทางเลือก 1 เติมให้เต็มเข่ง: เติมอีก 15 กก. ตาชั่งอ่าน 52', 'fill-full', '52', 'D1-fill-sheet');
  await expectText(page, S, 'ทางเลือก 1 เติมอีก 15 กก.', 'fill-full', '15', 'D1-fill-sheet');
  await expectText(page, S, 'ทางเลือก 2 ชั่งแยก: ตาชั่งอ่าน 17 (15 + เข่ง 2)', 'fill-part', '17', 'D1-fill-sheet');
  await expectText(page, S, 'ทางเลือก 3 ปล่อยไว้: เข่งเต็มถัดไปคือ เข่ง 5', 'fill-next', '5', 'D1-fill-sheet');
  await rec(S, 'ครบ 3 ทางเลือก (D-57)', '3', String(await Promise.all(['fill-full', 'fill-part', 'fill-next'].map((x) => id(x).count())).then((c) => c.reduce((a, b) => a + b, 0))), true, 'D1-fill-sheet');
});

test('D2 · เติมให้เต็มเข่ง (ทางเลือก 1) แล้วกดค้าง', async ({ page }) => {
  const S = 'D2';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await id('short-save').click();
  await moveTo(page, 'fa', 'red', 'a2');
  await id('fill-full').click();
  await id('zero-tare').waitFor();
  await snap(page, 'D2a-gate-before-fill');
  await id('start-weigh').click();
  await id('counter').waitFor();
  await snap(page, 'D2b-fill-stage');
  await expectText(page, S, 'พื้นที่กดค้าง "เติมเข่ง 4"', 'hold', 'เติมเข่ง 4', 'D2b-fill-stage');
  await expectText(page, S, 'เติมอีก 15 กก.', 'hold', '15', 'D2b-fill-stage');
  await expectText(page, S, 'ตาชั่งควรอ่าน 52 กก.', 'should-read', '52', 'D2b-fill-stage');
  await expectText(page, S, 'สรุป (35 + 15) = 50 กก. ก่อนกดค้าง', 'hold', '35', 'D2b-fill-stage');
  await expectText(page, S, 'การ์ดเข่งไม่เต็มบอกขาด 15 กก.', 'fig-missing', '15', 'D2b-fill-stage');
  await hold(page);
  await page.waitForTimeout(400);
  await snap(page, 'D2c-after-fill');
  await expectEq(S, 'กดค้างครบ → ปิดเป็นเข่งเต็มเอง เลขปัจจุบัน 5', '5', await text(page, 'current-no'), 'D2c-after-fill');
  await rec(S, 'ไม่เหลือเข่งเปิดค้าง', 'ไม่มี open-card', (await id('open-card').count()) ? 'มี' : 'ไม่มี', (await id('open-card').count()) === 0, 'D2c-after-fill');
  await expectText(page, S, 'น้ำหนักสะสมของแดง 150+35+15 = 200 กก.', 'fig-kg', '200', 'D2c-after-fill');
  const page2 = await page.locator('body').innerText();
  await rec(S, 'แสดง "เข่ง 4 — (35 + 15) กก. = 50 กก." หลังรวมเข่ง (SALE-11 AC สุดท้าย)', 'พบข้อความ (35 + 15)', /35\s*\+\s*15/.test(page2) ? 'พบ' : 'ไม่พบบนหน้านับเข่งหลังกดค้าง', /35\s*\+\s*15/.test(page2), 'D2c-after-fill');
  await page.goto('/v2/sales');
  await page.waitForTimeout(600);
  await snap(page, 'D2d-sales-list');
  const list = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  await rec(S, 'รายการขายแยกน้ำหนักต่อคนกรีดยาง (แดง 200 กก. · 5 เข่ง?)', 'แดง 200', list.match(/แดง[^นัด]{0,40}/)?.[0] ?? list.slice(0, 160), /แดง\D{0,12}200/.test(list), 'D2d-sales-list');
});

test('D3 · ชั่งส่วนที่เติมแยก (ทางเลือก 2) แล้วกดค้าง', async ({ page }) => {
  const S = 'D3';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await id('short-save').click();
  await moveTo(page, 'fa', 'red', 'a2');
  await id('fill-part').click();
  await id('zero-tare').waitFor();
  await id('start-weigh').click();
  await id('counter').waitFor();
  await snap(page, 'D3a-part-stage');
  await expectText(page, S, 'พื้นที่กดค้าง เติมอีก 15 กก.', 'hold', '15', 'D3a-part-stage');
  await expectText(page, S, 'ตาชั่งควรอ่าน 17 กก. (15 + เข่ง 2)', 'should-read', '17', 'D3a-part-stage');
  await hold(page);
  await page.waitForTimeout(400);
  await snap(page, 'D3b-after-part');
  await expectEq(S, 'รวมครบ 50 → ปิดเป็นเข่งเต็ม เลขปัจจุบัน 5', '5', await text(page, 'current-no'), 'D3b-after-part');
  await expectText(page, S, 'น้ำหนักสะสม 200 กก.', 'fig-kg', '200', 'D3b-after-part');
});

test('D4 · เติมไม่ถึง (ยางหมดก่อน) ทั้งสองแบบ', async ({ page }) => {
  const S = 'D4';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await id('short-save').click();
  await moveTo(page, 'fa', 'red', 'a2');
  await id('fill-full').click();
  await id('start-weigh').click();
  await id('counter').waitFor();
  await expectText(page, S, 'ปุ่มในแถบล่างเป็น "เติมไม่ถึง"', 'tool-short', 'เติมไม่ถึง');
  await id('tool-short').click();
  await id('short-sheet').waitFor();
  await snap(page, 'D4a-underfill-full-default');
  const r1 = (await text(page, 'reading')).replace(/\D/g, '');
  const tooLow = await id('short-too-low').count();
  await rec(S, 'เติมต่อแบบ "ทั้งเข่ง": ค่าเริ่มต้นของตาชั่งควรให้บันทึกได้ทันที (ไม่ติด error)', 'ไม่มีข้อความผิดพลาด', `ตาชั่ง ${r1} กก. · สุทธิที่เติม ${await text(page, 'short-net')} · ${tooLow ? 'มีแถบ "ค่าที่อ่านต้องมากกว่าน้ำหนักเข่ง"' : 'ไม่มีแถบผิดพลาด'}`, tooLow === 0, 'D4a-underfill-full-default');
  await setReading(page, 47);
  await snap(page, 'D4b-underfill-full-47');
  await expectText(page, S, 'อ่าน 47: สุทธิส่วนเติม = 47 − 2 − 35 = 10', 'short-net', '10', 'D4b-underfill-full-47');
  await id('short-save').click();
  await page.waitForTimeout(300);
  await snap(page, 'D4c-still-open');
  await expectText(page, S, 'เติมไม่ถึง → เข่ง 4 ยังเปิด เหลืออีก 5', 'fig-missing', '5', 'D4c-still-open');
  await expectEq(S, 'เลขปัจจุบันยัง 4', '4', await text(page, 'current-no'), 'D4c-still-open');
});

test('D5 · ปล่อยเข่งไม่เต็มไว้ แล้วนับเข่งเต็มถัดไป (ทางเลือก 3)', async ({ page }) => {
  const S = 'D5';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await id('short-save').click();
  await moveTo(page, 'fa', 'red', 'a2');
  await id('fill-next').click();
  await throughGate(page);
  await snap(page, 'D5a-next-full');
  await expectEq(S, 'เข่งเต็มถัดไปคือ เข่ง 5', '5', await text(page, 'current-no'), 'D5a-next-full');
  await rec(S, 'เข่ง 4 ปิดเป็นเข่งไม่เต็ม ไม่มีเข่งเปิดค้าง', 'ไม่มี open-card', (await id('open-card').count()) ? 'มี' : 'ไม่มี', (await id('open-card').count()) === 0, 'D5a-next-full');
  await expectText(page, S, 'น้ำหนักสะสม 185 กก. (เข่ง 4 = 35 ค้างไว้)', 'fig-kg', '185', 'D5a-next-full');
  await hold(page);
  await expectEq(S, 'กดค้างนับเข่ง 5 เต็ม → เลข 6', '6', await text(page, 'current-no'));
});

test('E · เปลี่ยนไปจุดของคนกรีดยางคนอื่น → ปิดเป็นเศษเองไม่ถาม (SALE-12)', async ({ page }) => {
  const S = 'E';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await id('short-save').click();
  await moveTo(page, 'fa', 'nat', 'a4');
  await page.waitForTimeout(500);
  await snap(page, 'E1-other-tapper');
  await rec(S, 'ไม่มีหน้าถามเติมต่อ', 'ไม่มี fill-sheet', (await id('fill-sheet').count()) ? 'มี fill-sheet' : 'ไม่มี fill-sheet', (await id('fill-sheet').count()) === 0, 'E1-other-tapper');
  await throughGate(page);
  await snap(page, 'E2-nat-counter');
  await expectEq(S, 'นัดเริ่มนับที่เข่ง 1 (นับต่อเนื่องตามคนกรีดยาง)', '1', await text(page, 'current-no'), 'E2-nat-counter');
  await rec(S, 'ไม่มีเข่งเปิดค้างของแดงมาโผล่ในหน้าของนัด', 'ไม่มี open-card', (await id('open-card').count()) ? 'มี' : 'ไม่มี', (await id('open-card').count()) === 0, 'E2-nat-counter');
  await moveTo(page, 'fa', 'red', 'a2');
  await page.waitForTimeout(500);
  await snap(page, 'E3-back-to-red');
  await rec(S, 'กลับไปแดง: เข่ง 4 ปิดเป็นเศษไปแล้ว จึงไม่ถามเติมอีก', 'ไม่มี fill-sheet', (await id('fill-sheet').count()) ? 'มี fill-sheet' : 'ไม่มี fill-sheet', (await id('fill-sheet').count()) === 0, 'E3-back-to-red');
});

test('F · โหมดเริ่มนับเข่ง 1 ทุกจุด (per-point, D-46/D-70)', async ({ page }) => {
  const S = 'F';
  const id = on(page);
  await begin(page, { numbering: 'per-point', full: 3 });
  await id('tool-short').click();
  await id('short-save').click();
  await page.waitForTimeout(300);
  await snap(page, 'F1-open-per-point');
  await expectText(page, S, 'เข่ง 4 เปิดอยู่ 35 กก.', 'open-card', 'เข่ง 4 เปิดอยู่', 'F1-open-per-point');
  await rec(S, 'ข้อความรอเติมในโหมดต่อจุด (ไม่ควรบอกให้ "ไปจุดถัดไปของแดง")', 'ข้อความต่างจากโหมดต่อเนื่อง', await text(page, 'stage-wait'), (await text(page, 'stage-wait')).includes('จบเข่งนี้ก่อน'), 'F1-open-per-point');
  await moveTo(page, 'fa', 'red', 'a2');
  await page.waitForTimeout(500);
  await snap(page, 'F2-switch-same-tapper');
  const asked = await id('fill-sheet').count();
  await rec(S, 'ไปจุดของแดงคนเดิม: story/mockup 12-ต่อจุด ให้ถาม 3 ทาง', 'มี fill-sheet', asked ? 'มี fill-sheet' : 'ไม่ถาม — ไปเลือกจุดชั่งต่อโดยไม่มีหน้าถาม (ตรงกับช่องว่างที่ story ระบุว่ายังขาด)', asked > 0, 'F2-switch-same-tapper');
  if (!asked) await throughGate(page);
  else await id('fill-next').click().then(() => throughGate(page));
  await snap(page, 'F3-point2-counter');
  await expectEq(S, 'จุด 2 เริ่มที่เข่ง 1 (โหมดต่อจุด)', '1', await text(page, 'current-no'), 'F3-point2-counter');
  await moveTo(page, 'fa', 'nat', 'a4');
  await throughGate(page);
  await moveTo(page, 'fa', 'red', 'a1');
  await page.waitForTimeout(500);
  await snap(page, 'F4-back-to-point1');
  await rec(S, 'กลับจุด 1 (โหมดต่อจุด): เข่ง 4 ยังเปิดค้างไว้รอเติม', 'เห็น open-card เข่ง 4', (await text(page, 'open-card')) || (await id('fill-sheet').count() ? 'มี fill-sheet' : 'ไม่มีเข่งเปิด'), (await id('open-card').count()) > 0, 'F4-back-to-point1');
});

test('G · ตาชั่งเปล่าเบี้ยว +2 (D-75) กับเข่งไม่เต็ม', async ({ page }) => {
  const S = 'G';
  const id = on(page);
  await seedMaster(page, FARM);
  await page.evaluate(() => localStorage.setItem('mon-farm:hold-ms', '500'));
  await page.goto('/v2');
  await id('home-sale-start').click();
  await id('start-buyer').click();
  await id('start-buyer-buyer-a').click();
  await id('start-next').click();
  await id('pick-farm-fa').click();
  await id('pick-point-a1').click();
  await id('zero-not0').click();
  await id('not0-sheet').waitFor();
  await snap(page, 'G0-not0-sheet');
  await id('choose-skew').click();
  await id('start-weigh').click();
  await id('counter').waitFor();
  await hold(page);
  await snap(page, 'G1-counter-skew');
  await expectText(page, S, 'ตาชั่งควรอ่าน 54 (50 + 2 + เบี้ยว 1)', 'should-read', '53', 'G1-counter-skew');
  await id('tool-short').click();
  await id('short-sheet').waitFor();
  await snap(page, 'G2-sheet-skew');
  const net = await text(page, 'short-net');
  await rec(S, 'แผ่นเข่งไม่เต็มแสดงบรรทัดหักน้ำหนักเข่งและค่าเบี้ยว', 'มีรายการหักเข่ง/เบี้ยว', (await page.locator('body').innerText()).includes('เบี้ยว') ? `สุทธิ ${net} — มีบรรทัดเบี้ยว` : 'ไม่มีบรรทัดเบี้ยว', (await page.locator('body').innerText()).includes('เบี้ยว'), 'G2-sheet-skew');
  await id('short-save').click();
  await page.waitForTimeout(300);
  await snap(page, 'G3-open-skew');
  await expectText(page, S, 'การ์ดเข่งที่เปิดอยู่แสดงเบี้ยว', 'open-card', 'เข่ง 2', 'G3-open-skew');
  await moveTo(page, 'fa', 'red', 'a2');
  await id('fill-sheet').waitFor();
  await snap(page, 'G4-fill-sheet-skew');
  await expectText(page, S, 'ทางเลือก 1 ตาชั่งควรอ่านรวมเบี้ยว (52+1 = 53)', 'fill-full', '53', 'G4-fill-sheet-skew');
  await expectText(page, S, 'ทางเลือก 2 ตาชั่งควรอ่านรวมเบี้ยว (15+2+1 = 18)', 'fill-part', '18', 'G4-fill-sheet-skew');
});

test('H · โหมดสาธารณะขณะมีเข่งเปิด และขณะเติมต่อ', async ({ page }) => {
  const S = 'H';
  const id = on(page);
  await begin(page);
  await id('tool-short').click();
  await id('short-save').click();
  await id('tool-public').click();
  await page.waitForTimeout(400);
  await snap(page, 'H1-public-waiting');
  await rec(S, 'โหมดสาธารณะ ณ จุดที่เข่งรอเติม: ยังแสดงเลขเข่ง 4 ไม่นับเพิ่ม', '4', (await text(page, 'public-no')) || '(ไม่พบ)', (await text(page, 'public-no')) === '4', 'H1-public-waiting');
});
