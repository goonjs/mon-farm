import { render } from '@testing-library/react-native';

import { Check, ChevronLeft, ChevronRight, MenuIcon, Minus, Plus, Scale, Undo } from './icons';

/** Every stroke/fill View an icon draws, as flat styles. */
function strokes(el: React.ReactElement) {
  const { toJSON } = render(el);
  const out: Record<string, unknown>[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { props?: { style?: unknown }; children?: unknown[] };
    if (node.props?.style) out.push(Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)));
    node.children?.forEach(walk);
  };
  walk(toJSON());
  return out;
}

describe('line icons — Views only, coloured by the caller (E01-S17 X8)', () => {
  it.each([
    ['ChevronLeft', <ChevronLeft key="a" color="sentinel" />],
    ['ChevronRight', <ChevronRight key="b" color="sentinel" />],
    ['MenuIcon', <MenuIcon key="c" color="sentinel" />],
    ['Plus', <Plus key="d" color="sentinel" />],
    ['Minus', <Minus key="e" color="sentinel" />],
    ['Check', <Check key="f" color="sentinel" />],
    ['Undo', <Undo key="g" color="sentinel" />],
    ['Scale', <Scale key="h" color="sentinel" />],
  ])('%s paints only in the colour it is given', (_name, icon) => {
    const s = strokes(icon);
    const colours = s.flatMap((x) =>
      ['backgroundColor', 'borderColor', 'borderTopColor', 'borderLeftColor', 'borderRightColor', 'borderBottomColor']
        .map((k) => x[k])
        .filter((v) => v !== undefined && v !== 'transparent'),
    );
    expect(colours.length).toBeGreaterThan(0);
    expect(new Set(colours)).toEqual(new Set(['sentinel']));
  });
});
