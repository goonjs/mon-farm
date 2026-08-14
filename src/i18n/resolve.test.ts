import { describe, expect, it } from 'vitest';

import { isAnnounced, messages, untranslated } from './messages';
import { interpolate, resolve } from './resolve';

/**
 * The catalogue's own guarantees, tested where they are cheapest to test.
 *
 * `resolve` is deliberately a pure function taking a locale rather than a hook
 * reading context: it means the rules below — fallback, interpolation, the
 * refusal to render a key — are provable in the Vitest tier with no React tree
 * at all. The React binding on top of it (`src/i18n/index.tsx`) then has
 * nothing to prove except that it passes the right locale through.
 */

describe('resolve', () => {
  it('returns the Thai string for a known id', () => {
    expect(resolve('th', 'counter.undo')).toBe('ยกเลิกเข่งล่าสุด');
  });

  it('returns the English string when the locale is en', () => {
    expect(resolve('en', 'counter.undo')).toBe('undo last');
  });

  /**
   * The load-bearing one. English is the second locale and will lag: a story
   * that adds a Thai string and forgets the English must degrade to a readable
   * Thai label, never to a raw id. `counter.close_pile` on a button is worse
   * than the wrong language — it is not a word in either.
   */
  it('falls back to Thai when an id has no English translation', () => {
    const [id] = untranslated;
    expect(resolve('en', id)).toBe(messages.th[id]);
  });

  it('never returns the id itself, for any id in the catalogue, in any locale', () => {
    const ids = Object.keys(messages.th) as (keyof typeof messages.th)[];
    for (const locale of ['th', 'en'] as const) {
      for (const id of ids) {
        const out = resolve(locale, id);
        expect(out).not.toBe(id);
        expect(out.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('the catalogue itself', () => {
  /**
   * What stops the catalogue rotting silently. Without this, an id added to
   * `th` and forgotten in `en` is invisible until someone switches locale on
   * the one screen that uses it — which, for a second locale nobody on the
   * farm reads day to day, could be months.
   */
  it('has every Thai id either translated or explicitly marked untranslated', () => {
    const missing = (Object.keys(messages.th) as (keyof typeof messages.th)[]).filter(
      (id) => messages.en[id] === undefined && !untranslated.includes(id),
    );
    expect(missing).toEqual([]);
  });

  it('has no English id that does not exist in Thai', () => {
    const thIds = new Set(Object.keys(messages.th));
    expect(Object.keys(messages.en).filter((id) => !thIds.has(id))).toEqual([]);
  });

  it('marks nothing as untranslated that actually has a translation', () => {
    expect(untranslated.filter((id) => messages.en[id] !== undefined)).toEqual([]);
  });

  /**
   * NO WEB FONTS is a hard constraint (NFR-1, and the note at the top of
   * design/tokens.ts). It follows that the catalogue cannot rely on a glyph
   * the system stack may not carry — Thai and Latin only, plus the handful of
   * symbols the design system already uses.
   */
  it('carries no characters outside Thai, Latin and the symbols already in use', () => {
    // Thai block, printable ASCII, and the symbols the design system already
    // uses on screen — the ✓/✗ marks (F-16's non-colour encoding), the ⚖ on
    // the short-basket action, the ✕ that dismisses the switcher, the arrows
    // on undo/correction/next-pile and back-to-counting rows, and the typographic dashes and true
    // minus the derivations are set with. Anything outside this set is a
    // glyph the system stack may not carry, and a box on the counter screen
    // is a label nobody can read in any language.
    const allowed = /^[฀-๿ -~·—–−…×✓✗↺↩←→✕⚖\n]*$/u;
    const offenders = Object.entries({ ...messages.th, ...messages.en })
      .filter(([, s]) => !allowed.test(s))
      .map(([id]) => id);
    expect(offenders).toEqual([]);
  });
});

/**
 * The announced register (FR-11) is aimed at the people around the scale, not
 * at whoever is holding the phone — so it does not follow their locale. These
 * tests are what make that a property of the code rather than a note somebody
 * has to remember while adding a string.
 */
describe('the announced register', () => {
  const spoken = (Object.keys(messages.th) as (keyof typeof messages.th)[]).filter(isAnnounced);

  it('has something in it', () => {
    expect(spoken.length).toBeGreaterThan(0);
  });

  it('is Thai in every locale', () => {
    for (const id of spoken) {
      expect(resolve('en', id)).toBe(messages.th[id]);
    }
  });

  it('has no English column at all — translating it is the bug, not the fix', () => {
    for (const id of spoken) {
      expect(messages.en[id]).toBeUndefined();
    }
  });

  /**
   * Placeholders are stripped first: `{n}` is a slot for a number, not a word
   * anyone says. What must be free of Latin letters is the part that gets
   * pronounced.
   */
  it('says no Latin words — it is read aloud by a Thai voice', () => {
    for (const id of spoken) {
      expect(messages.th[id].replace(/\{\w+\}/g, '')).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe('interpolate', () => {
  it('substitutes a named placeholder', () => {
    expect(interpolate('นับได้ {n} เข่ง', { n: 7 })).toBe('นับได้ 7 เข่ง');
  });

  it('substitutes the same placeholder more than once', () => {
    expect(interpolate('{name} — {name}', { name: 'กอง 1' })).toBe('กอง 1 — กอง 1');
  });

  /**
   * A missing param must leave something legible rather than the raw
   * `{n}`, for the same reason a missing string must not render its id.
   */
  it('leaves no braces behind when a param is missing', () => {
    expect(interpolate('นับได้ {n} เข่ง', {})).not.toContain('{');
  });

  it('is a no-op for a string with no placeholders', () => {
    expect(interpolate('ปิดกอง', { n: 3 })).toBe('ปิดกอง');
  });
});
