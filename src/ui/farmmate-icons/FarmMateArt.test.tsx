import { SvgXml } from 'react-native-svg';

import { FarmMateArt, personArt } from './FarmMateArt';
import { FARMMATE_MASTERS } from '../../../design/icons/farmmate-masters';
import { wrap } from '../../test/render';

describe('FarmMateArt — the traced FarmMate original ("ตัวสวย")', () => {
  it('draws the original of the id at the given size', () => {
    const { UNSAFE_getByType } = wrap(<FarmMateArt id="sale.weigh" size={40} />);
    const svg = UNSAFE_getByType(SvgXml);
    expect(svg.props.xml).toBe(FARMMATE_MASTERS['sale.weigh']);
    expect(svg.props.width).toBe(40);
    expect(svg.props.height).toBe(40);
  });

  it('defaults to 32, the size it takes on a 48 tile', () => {
    const { UNSAFE_getByType } = wrap(<FarmMateArt id="people.tapper" />);
    expect(UNSAFE_getByType(SvgXml).props.width).toBe(32);
  });

  it('is hidden from screen readers: the control around it carries the name', () => {
    const { UNSAFE_getByType } = wrap(<FarmMateArt id="nav.home" size={24} />);
    expect(UNSAFE_getByType(SvgXml).props['aria-hidden']).toBe(true);
  });

  it('draws nothing for an id that has no original', () => {
    const { toJSON } = wrap(<FarmMateArt id="nav.nope" />);
    expect(toJSON()).toBeNull();
  });
});

describe('personArt — a person tile drawn by role (owner 2026-11-03)', () => {
  it.each([
    [['tapper'], 'people.tapper'],
    [['manager'], 'people.manager'],
    [['tapper', 'manager'], 'people.tapper'],
    [['owner'], 'nav.profile'],
    [['buyer'], 'nav.profile'],
    [[], 'nav.profile'],
    [undefined, 'nav.profile'],
  ] as const)('%j → %s', (roles, id) => {
    expect(personArt(roles)).toBe(id);
  });
});
