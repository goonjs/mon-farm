import { describe, expect, it } from 'vitest';

import { ACTIVE_PALETTE, PALETTES, colorFor, tokens } from '../design/tokens';

/**
 * E01-S17: colours are two layers — palette ramps → semantic roles — and the
 * role table is shared by every palette. Palette A (`farmmate`) must reproduce
 * the pre-story values exactly (the app must not change look), with one
 * deliberate exception: dark.ruleStrong #7D8B99 → #7A8998.
 */

/** The 30 names that existed before this story, with their pre-story values. */
const LEGACY = {
  light: {
    stage: '#FFFFFF', surface: '#F7FAFC', surfaceSunk: '#F1F3F5', surfaceRaised: '#FFFFFF',
    numeral: '#002858', ink: '#002858', inkSoft: '#52657A', inkFaint: '#7A8998', inkInverse: '#FFFFFF',
    rule: '#CBD4DC', ruleFaint: '#E4E9EE', ruleStrong: '#7A8998',
    action: '#002858', actionHover: '#002850', actionSunk: '#EAF5FC',
    accept: '#006F52', acceptSunk: '#E8F8F2', reject: '#BB1C1C', rejectSunk: '#FDECEC',
    warn: '#815908', warnSunk: '#FFF5D8',
    statusSynced: '#006F52', statusPending: '#815908', statusConflict: '#BB1C1C',
    brand: '#00AA7D', brandStrong: '#008F6C', brandYellow: '#FECB56', brandCream: '#FFF8E8',
    flashAccept: '#006F52', flashReject: '#BB1C1C',
  },
  dark: {
    stage: '#000000', surface: '#0B1520', surfaceSunk: '#060E17', surfaceRaised: '#13202E',
    numeral: '#F4F5F6', ink: '#F4F5F6', inkSoft: '#A3B1C0', inkFaint: '#6E7D8C', inkInverse: '#0A0B0C',
    rule: '#2E3B49', ruleFaint: '#1B2632',
    // The one value the story changes (was #7D8B99) — see the story's Dev notes.
    ruleStrong: '#7A8998',
    action: '#8FB4EC', actionHover: '#A9C6F1', actionSunk: '#0F2340',
    accept: '#48C090', acceptSunk: '#0B2A21', reject: '#F0796A', rejectSunk: '#331310',
    warn: '#FECB56', warnSunk: '#2E2409',
    statusSynced: '#48C090', statusPending: '#FECB56', statusConflict: '#F0796A',
    brand: '#48C090', brandStrong: '#48C090', brandYellow: '#FECB56', brandCream: '#221D10',
    flashAccept: '#48C090', flashReject: '#F0796A',
  },
} as const;

/** The 23 roles this story adds, palette A values, per the story's table. */
const ADDED = {
  light: {
    appBar: '#F7FAFC', appBarInk: '#002858', focusRing: '#002858',
    disabledFill: '#F1F3F5', disabledInk: '#52657A',
    moneyIn: '#006F52', moneyInSunk: '#E8F8F2', moneyOut: '#002858', moneyOutSunk: '#F1F3F5',
    category1: '#0F7985', category1Sunk: '#E7FBFE', category2: '#535DCD', category2Sunk: '#E9EAFC',
    category3: '#9940BF', category3Sunk: '#F6E9FB', category4: '#BE2F7B', category4Sunk: '#FCE8F3',
    category5: '#AA5718', category5Sunk: '#FEF1E7', category6: '#667314', category6Sunk: '#FBFEE7',
    brandLight: '#48C090', scrim: '#002858',
  },
  dark: {
    appBar: '#0B1520', appBarInk: '#F4F5F6', focusRing: '#8FB4EC',
    disabledFill: '#060E17', disabledInk: '#A3B1C0',
    moneyIn: '#48C090', moneyInSunk: '#0B2A21', moneyOut: '#F4F5F6', moneyOutSunk: '#060E17',
    category1: '#14A5B5', category1Sunk: '#143134', category2: '#7981D8', category2Sunk: '#141634',
    category3: '#B06CCE', category3Sunk: '#2A1434', category4: '#D65C9D', category4Sunk: '#341425',
    category5: '#DD7220', category5Sunk: '#342214', category6: '#93A51D', category6Sunk: '#2F3414',
    brandLight: '#008F6C', scrim: '#000000',
  },
} as const;

const sorted = (o: object) => Object.keys(o).sort();

describe('design tokens — palette → semantic roles (E01-S17)', () => {
  it('palette A is the active palette and feeds tokens.color', () => {
    expect(ACTIVE_PALETTE).toBe('farmmate');
    expect(tokens.color).toEqual(colorFor(PALETTES.farmmate));
  });

  it('palette A keeps every legacy name at its legacy value', () => {
    const c = colorFor(PALETTES.farmmate);
    for (const scheme of ['light', 'dark'] as const) {
      for (const [name, hex] of Object.entries(LEGACY[scheme])) {
        expect([scheme, name, c[scheme][name as keyof typeof c.light]]).toEqual([scheme, name, hex]);
      }
    }
  });

  it('palette A adds exactly the 23 new roles, at the agreed values', () => {
    const c = colorFor(PALETTES.farmmate);
    for (const scheme of ['light', 'dark'] as const) {
      const expected = { ...LEGACY[scheme], ...ADDED[scheme] };
      expect(Object.keys(expected)).toHaveLength(53);
      expect(c[scheme]).toEqual(expected);
    }
  });

  it('every palette yields the same 53 names in both schemes, all #RRGGBB', () => {
    const names = sorted({ ...LEGACY.light, ...ADDED.light });
    for (const [key, palette] of Object.entries(PALETTES)) {
      const c = colorFor(palette);
      for (const scheme of ['light', 'dark'] as const) {
        expect([key, scheme, sorted(c[scheme])]).toEqual([key, scheme, names]);
        for (const v of Object.values(c[scheme])) expect(v).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it('palette B carries the instrument headline values from the story', () => {
    const b = colorFor(PALETTES.instrument).light;
    expect(b).toMatchObject({
      ink: '#0A0B0C', surface: '#F2F3F4', action: '#17458C', actionSunk: '#E7EDF7',
      accept: '#06542C', reject: '#9E2015', warn: '#6F4000',
      brand: '#2E9E6B', brandStrong: '#1F7A50', brandCream: '#FBF4E6',
    });
  });
});
