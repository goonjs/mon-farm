import { parse, SvgAst, SvgXml } from 'react-native-svg';

import { FarmMateArt } from './FarmMateArt';
import { FARMMATE_MASTERS, type FarmMateArtId } from '../../../design/icons/farmmate-masters';
import { wrap } from '../../test/render';

describe('FarmMateArt — the traced FarmMate original ("ตัวสวย")', () => {
  it('draws the parsed original of the id at the given size, hidden from screen readers', () => {
    const { UNSAFE_getByType } = wrap(<FarmMateArt id="sale.weigh" size={40} />);
    const svg = UNSAFE_getByType(SvgAst);
    expect(svg.props.ast).toEqual(parse(FARMMATE_MASTERS['sale.weigh']));
    expect(svg.props.override).toEqual({ 'aria-hidden': true, width: 40, height: 40 });
  });

  // Review of PR 145: SvgXml passes its `xml` prop through to the <svg>, so the
  // web DOM carried every icon's source as an attribute (1.2 MB on /v2/dev/icons).
  it('does not go through SvgXml, so the source never reaches the DOM', () => {
    const { UNSAFE_queryAllByType } = wrap(<FarmMateArt id="sale.weigh" />);
    expect(UNSAFE_queryAllByType(SvgXml)).toHaveLength(0);
  });

  it('parses each original once, however many times it is drawn', () => {
    const a = wrap(<FarmMateArt id="people.tapper" />).UNSAFE_getByType(SvgAst).props.ast;
    const b = wrap(<FarmMateArt id="people.tapper" />).UNSAFE_getByType(SvgAst).props.ast;
    expect(a).toBe(b);
  });

  it('defaults to 32, the size it takes on a 48 tile', () => {
    const { UNSAFE_getByType } = wrap(<FarmMateArt id="people.tapper" />);
    expect(UNSAFE_getByType(SvgAst).props.override.width).toBe(32);
  });

  it('draws nothing for an id that has no original', () => {
    const { toJSON } = wrap(<FarmMateArt id={'nav.nope' as FarmMateArtId} />);
    expect(toJSON()).toBeNull();
  });

  it('every one of the 72 originals parses to an svg', () => {
    const ids = Object.keys(FARMMATE_MASTERS) as FarmMateArtId[];
    expect(ids).toHaveLength(72);
    for (const id of ids) expect(parse(FARMMATE_MASTERS[id])?.tag).toBe('svg');
  });
});
