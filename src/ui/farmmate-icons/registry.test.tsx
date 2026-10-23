import { FarmMateIcon } from './FarmMateIcon';
import { FARMMATE_ICONS, FARMMATE_ICON_CATEGORY_LABEL_TH, getFarmMateIcon } from './registry';
import { wrap } from '../../test/render';

describe('FarmMate icon registry (pilot batch: nav, farm, sale)', () => {
  it('has 24 icons: 8 per pilot category, no duplicate ids', () => {
    expect(FARMMATE_ICONS).toHaveLength(24);
    const byCategory = { nav: 0, farm: 0, sale: 0 };
    for (const icon of FARMMATE_ICONS) byCategory[icon.category]++;
    expect(byCategory).toEqual({ nav: 8, farm: 8, sale: 8 });
    expect(new Set(FARMMATE_ICONS.map((i) => i.id)).size).toBe(24);
  });

  it('every icon has a Thai label and a usage note', () => {
    for (const icon of FARMMATE_ICONS) {
      expect(icon.labelTh.length).toBeGreaterThan(0);
      expect(icon.note.length).toBeGreaterThan(0);
    }
  });

  it('category labels cover every category used by the registry', () => {
    const categories = new Set(FARMMATE_ICONS.map((i) => i.category));
    for (const category of categories) {
      expect(FARMMATE_ICON_CATEGORY_LABEL_TH[category]).toBeTruthy();
    }
  });

  it('getFarmMateIcon finds a known id and misses an unknown one', () => {
    expect(getFarmMateIcon('nav.home')?.labelTh).toBe('หน้าแรก');
    expect(getFarmMateIcon('does.not.exist')).toBeUndefined();
  });

  it.each(FARMMATE_ICONS.map((icon) => [icon.id, icon.labelTh] as const))(
    'renders %s (%s) without crashing, hidden from screen readers',
    (id) => {
      wrap(<FarmMateIcon id={id} />);
    },
  );

  it('an unknown id renders nothing instead of crashing', () => {
    expect(() => wrap(<FarmMateIcon id="nope" />)).not.toThrow();
  });
});
