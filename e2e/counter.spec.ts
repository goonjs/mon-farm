import { expect, test, type CDPSession, type Page } from '@playwright/test';

import { tokens } from '../design/tokens';
import { openPileScenario, seedSale, testSaleId } from './fixtures';

/**
 * Verifies the three things no other test tier can:
 *   1. the exported build boots at all
 *   2. the public numeral actually fills the stage — a measurement, and the
 *      constraint the whole cross-check rests on (F-9.7)
 *   3. real pointer press-and-hold through the react-native-web pointer path
 *
 * The hold is shortened via ?holdMs= on web only. Twelve real three-second
 * holds is 36s of wall clock per run and grows with every story.
 *
 * There is no app-side seed any more (S17). Every test seeds its own sale
 * directly into localStorage via `seedSale`, using the app's own event types
 * from `src/core/fixtures.ts` — so a change to the event shape breaks these
 * tests loudly instead of them silently testing something stale.
 */

/**
 * Shortened, but not arbitrarily. Below roughly 100ms the press window becomes
 * comparable to React's render-and-dispatch latency, and holds start missing
 * their own timer — a flaky test that looks like a product bug. 400ms is
 * comfortably clear of that.
 */
const FAST_HOLD = 400;
const SHOTS = 'docs/ux/screenshots';

/**
 * Seeds a fresh sale with `standardBaskets` already counted into its one
 * ready pile, and navigates to its counter screen.
 *
 * Do NOT clear storage in an addInitScript that reruns on reload — `seedSale`
 * is already idempotent for exactly that reason (see its own header).
 */
async function openCounter(page: Page, standardBaskets = 0, holdMs = FAST_HOLD) {
  const saleId = testSaleId('counter');
  await seedSale(page, saleId, openPileScenario(saleId, standardBaskets));
  await page.goto(`/sale/${saleId}/counter?holdMs=${holdMs}`);
  await expect(page.getByTestId('count')).toBeVisible();
  return { count: page.getByTestId('count'), saleId };
}

async function hold(page: Page, ms: number) {
  const stage = page.getByTestId('stage');
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/**
 * Makes SpeechSynthesis deterministic, injected before the bundle boots so
 * `src/speech/speaker.web.ts`'s availability check (evaluated once at module
 * load) sees it. Real Web Speech API behaviour in headless Chromium is not
 * deterministic enough for a CI assertion — no guaranteed voices, no
 * guaranteed `onend` — so `speak()` is replaced with one that always
 * resolves promptly (S10).
 *
 * `window.speechSynthesis` is a read-only accessor in real browsers —
 * `window.speechSynthesis = {...}` silently no-ops, which was caught only by
 * looking at an actual screenshot: `speaker.web.ts` still called the REAL
 * `speechSynthesis.speak()` with a fake utterance object, which threw inside
 * that native call and was swallowed by its own `catch { resolve(false) }`,
 * logging a convincingly-real-looking "not heard" for every basket. This
 * patches the existing native object's OWN `speak` method instead of
 * replacing the binding, which works regardless of that.
 */
async function stubSpeechSynthesis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!window.speechSynthesis) {
      class FakeUtterance {
        lang = '';
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      }
      // @ts-expect-error — test-only global, not the real DOM type.
      window.SpeechSynthesisUtterance = FakeUtterance;
      // @ts-expect-error — same.
      window.speechSynthesis = { speak: (u: FakeUtterance) => setTimeout(() => u.onend?.(), 0) };
      return;
    }
    window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      setTimeout(() => (utterance.onend as unknown as (() => void) | null)?.(), 0);
    };
  });
}

test('the exported build boots and shows the seeded count', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await expect(count).toHaveText('5');
  await expect(page.getByTestId('crumb')).toContainText('กอง 1');
});

test('the public numeral fills its share of the viewport (F-9.7)', async ({ page }) => {
  const viewport = page.viewportSize()!;
  const floor = tokens.publicNumeral.minHeightRatio;

  // Two digits.
  const { count: at2count } = await openCounter(page, 5);
  const at2 = (await at2count.boundingBox())!;
  expect(at2.height / viewport.height).toBeGreaterThanOrEqual(floor);

  // Three digits is the binding case — where a naive layout starts shrinking
  // the glyph to fit, silently giving back the millimetres the cross-check
  // depends on. Seeded directly at 186 rather than counted up to: the state
  // under test is the layout, not the interactions needed to reach it.
  const { count: at3count } = await openCounter(page, 186);
  await expect(at3count).toHaveText('186');
  const at3 = (await at3count.boundingBox())!;

  expect(at3.height / viewport.height).toBeGreaterThanOrEqual(floor);
  // And it must not have wrapped or spilled out of the viewport.
  expect(at3.width).toBeLessThanOrEqual(viewport.width);
});

test('a completed hold counts exactly one basket', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await expect(count).toHaveText('5');
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('6');
});

test('an early release counts nothing and says so', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await hold(page, Math.round(FAST_HOLD / 4));
  await expect(count).toHaveText('5');
  await expect(page.getByTestId('caption')).toContainText('ไม่นับ');
});

test('a hold cancelled by the pointer leaving does not become a phantom count', async ({ page }) => {
  // react-native-web does not reliably fire onPressOut when the pointer leaves
  // while held. If cancellation missed that path, the hold would complete on
  // its timer and count a basket nobody performed.
  const { count } = await openCounter(page, 5);
  const stage = page.getByTestId('stage');
  const box = (await stage.boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 40); // out of the stage
  await page.waitForTimeout(FAST_HOLD + 250);
  await page.mouse.up();

  await expect(count).toHaveText('5');
});

test('undo requires a confirmation naming the basket before it removes it', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('6');

  await page.getByTestId('undo').click();
  // Zero-confirmation undo was a real gap found from testing — it now names
  // the specific basket about to be voided before anything happens. The seq
  // is whatever the log assigned (setup events consume seqs too), not the
  // displayed count — so this checks the weight and kind, not a seq number.
  await expect(page.getByTestId('undo-confirm-detail')).toContainText('เข่งมาตรฐาน');
  await expect(page.getByTestId('undo-confirm-detail')).toContainText('50');
  await expect(count).toHaveText('6'); // nothing changed yet

  await page.getByTestId('undo-cancel').click();
  await expect(page.getByTestId('undo-confirm-detail')).toHaveCount(0);
  await expect(count).toHaveText('6'); // cancel undid nothing

  await page.getByTestId('undo').click();
  await page.getByTestId('undo-confirm').click();
  await expect(count).toHaveText('5');

  // The void and its target are both still in the log.
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('ยกเลิก');
});

test('the count stays visible when another tab is active (F-19)', async ({ page }) => {
  await openCounter(page, 5);
  await page.getByTestId('tab-pile').click();
  await expect(page.getByTestId('mini-count')).toContainText('5');
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('mini-count')).toContainText('5');
});

test('counts survive a reload (NFR-1)', async ({ page }) => {
  const { count } = await openCounter(page, 5);
  await hold(page, FAST_HOLD + 150);
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('7');

  await page.reload();
  await expect(page.getByTestId('count')).toHaveText('7');
});

/**
 * Real, CDP-level touch input (`Input.dispatchTouchEvent`) — not
 * `page.mouse.*`, which fires mouse events even on a "mobile" device
 * profile, and not JS `dispatchEvent(new TouchEvent(...))`, which does not
 * trigger the browser's own touch handling at all (proven while chasing the
 * bug below: a script-dispatched TouchEvent produced no `onPressIn`, no
 * hold, nothing). This is what it actually takes to exercise the code path
 * a real finger on a real phone drives.
 */
async function cdpTouch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: { x: number; y: number; id: number }[],
) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}

test('a second finger touching down and lifting mid-hold does not cancel it (field report)', async ({ page, context }) => {
  // A real field report: attempting to pinch-zoom on the counter screen
  // sometimes left the app "still counting" confusingly after release.
  // Root cause, found with real touch input (not mouse simulation): every
  // window-level pointerup/pointermove listener in HoldStage reacted to ANY
  // pointer, with no identity check — so a second, unrelated finger's
  // ordinary touchdown-and-lift (exactly what a failed pinch attempt looks
  // like) fired a genuine pointerup that cancelled the FIRST finger's
  // still-in-progress, never-released hold.
  const { count } = await openCounter(page, 5, 1200); // a real hold duration, not FAST_HOLD — this needs room for a second touch to land mid-hold
  const cdp = await context.newCDPSession(page);
  const box = (await page.getByTestId('stage').boundingBox())!;
  const ax = box.x + box.width / 2;
  const ay = box.y + box.height / 2;
  const bx = ax + 80;
  const by = ay - 60;

  await cdpTouch(cdp, 'touchStart', [{ x: ax, y: ay, id: 1 }]);
  await page.waitForTimeout(300);

  // A second finger touches down alongside the first (the start of a pinch
  // attempt) and lifts shortly after, while the first finger never moves.
  await cdpTouch(cdp, 'touchStart', [{ x: ax, y: ay, id: 1 }, { x: bx, y: by, id: 2 }]);
  await page.waitForTimeout(150);
  await cdpTouch(cdp, 'touchEnd', [{ x: bx, y: by, id: 2 }]);

  // The first finger's hold must still be running, not rejected.
  await page.waitForTimeout(200);
  await expect(page.getByTestId('caption')).not.toContainText('ปล่อยเร็วไป');

  // It completes on its own schedule, counting exactly once.
  await page.waitForTimeout(900);
  await expect(count).toHaveText('6');

  await cdpTouch(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  await expect(count).toHaveText('6'); // lifting the first finger afterward changes nothing
});

test('a completed hold speaks the new count and logs it (S10, FR-11.3)', async ({ page }) => {
  await stubSpeechSynthesis(page);
  const { count } = await openCounter(page, 5);
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('6');

  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('พูด');
  await expect(page.getByTestId('log')).toContainText('หก'); // six, spoken
  // Not just "an announcement happened" — it must have succeeded. A row
  // reading "พูด ... — ไม่ได้ยิน" would satisfy the two assertions above too.
  await expect(page.getByTestId('log')).not.toContainText('ไม่ได้ยิน');
});

test('speech still fires with the browser offline (NFR-1, FR-11.7)', async ({ page, context }) => {
  await stubSpeechSynthesis(page);
  const { count } = await openCounter(page, 5);
  await context.setOffline(true);

  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('6');

  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('พูด');
  await expect(page.getByTestId('log')).not.toContainText('ไม่ได้ยิน');
  await context.setOffline(false);
});

test('turning speech off stops announcements and logs the toggle (FR-11.11)', async ({ page }) => {
  await stubSpeechSynthesis(page);
  const { count } = await openCounter(page, 5);

  await page.getByTestId('speech-toggle').click();
  await hold(page, FAST_HOLD + 150);
  await expect(count).toHaveText('6'); // counting is unaffected

  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('log')).toContainText('เสียงนับ ปิด');
  await expect(page.getByTestId('log')).not.toContainText('พูด');
});

test('screenshots — counter, pile, log', async ({ page }, testInfo) => {
  const dir = `${SHOTS}/${testInfo.project.name}`;
  await openCounter(page, 5);
  await page.screenshot({ path: `${dir}/counter-count.png` });
  await page.getByTestId('tab-pile').click();
  await page.screenshot({ path: `${dir}/counter-pile.png` });
  await page.getByTestId('tab-log').click();
  await page.screenshot({ path: `${dir}/counter-log.png` });
});
