import { fireEvent, screen } from '@testing-library/react-native';

import { ChoiceTile, ChoiceTiles, QuickLinks, TileGrid, ValueBox, type ChoiceTone } from './choice-tiles';
import { wrap } from '../test/render';
import { tokens, type ColorScheme } from '../../design/tokens';

const H = { includeHiddenElements: true } as const;
const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SIZE_KEYS = ['minHeight', 'borderWidth', 'borderRadius', 'paddingHorizontal', 'paddingVertical'] as const;
const size = (s: Record<string, unknown>) => Object.fromEntries(SIZE_KEYS.map((k) => [k, s[k]]));

describe('choice tiles (E01-S25 CT-1..CT-4)', () => {
  it('A: equal rounded tile, 2px edge both states, picked = navy fill + white text, same size', () => {
    wrap(
      <TileGrid columns={3}>
        <ChoiceTile testID="a-on" label="25 กก." selected onPress={() => {}} />
        <ChoiceTile testID="a-off" label="40 กก." selected={false} onPress={() => {}} />
      </TileGrid>,
    );
    const on = flat(screen.getByTestId('a-on').props.style);
    const off = flat(screen.getByTestId('a-off').props.style);
    expect(on.borderRadius).toBe(tokens.radius.md);
    expect(on.borderRadius).not.toBe(tokens.radius.pill);
    expect(on).toMatchObject({ backgroundColor: tokens.color.light.action, borderWidth: tokens.border.thick, minHeight: tokens.target.min });
    expect(size(on)).toEqual(size(off));
    expect(flat(screen.getByText('25 กก.').props.style).color).toBe(tokens.color.light.inkInverse);
    expect(screen.getByTestId('a-on').props.accessibilityRole).toBe('radio');
    expect(screen.getByTestId('a-on').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('single select: tapping another switches at once, tapping the picked one keeps it', () => {
    const onChange = jest.fn();
    wrap(
      <ChoiceTiles
        testID="kg"
        value="25"
        onChange={onChange}
        options={[
          { value: '25', label: '25 กก.' },
          { value: '40', label: '40 กก.' },
        ]}
      />,
    );
    fireEvent.press(screen.getByTestId('kg-40'));
    expect(onChange).toHaveBeenLastCalledWith('40');
    onChange.mockClear();
    fireEvent.press(screen.getByTestId('kg-25'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('I: content left, empty radio ring before picking (no tick), filled ring + tick after, sizes identical', () => {
    wrap(
      <>
        <ChoiceTile kind="mark" testID="i-on" label="สมชาย" selected onPress={() => {}} />
        <ChoiceTile kind="mark" testID="i-off" label="สมหญิง" selected={false} onPress={() => {}} />
      </>,
    );
    const on = flat(screen.getByTestId('i-on').props.style);
    const off = flat(screen.getByTestId('i-off').props.style);
    expect(on.justifyContent).toBe('flex-start');
    expect(size(on)).toEqual(size(off));
    const ringOn = flat(screen.getByTestId('i-on-mark', H).props.style);
    const ringOff = flat(screen.getByTestId('i-off-mark', H).props.style);
    for (const r of [ringOn, ringOff]) expect(r).toMatchObject({ width: 22, height: 22, borderWidth: tokens.border.thick, borderRadius: tokens.radius.pill });
    expect(ringOff).toMatchObject({ borderColor: tokens.color.light.ruleStrong });
    expect(ringOn).toMatchObject({ backgroundColor: tokens.color.light.action, borderColor: tokens.color.light.action });
    expect(screen.queryByTestId('i-off-tick', H)).toBeNull();
    expect(screen.getByTestId('i-on-tick', H)).toBeTruthy();
    expect(on).toMatchObject({ backgroundColor: tokens.color.light.actionSunk, borderColor: tokens.color.light.action });
  });

  const tones: ChoiceTone[] = ['action', 'accept', 'warn', 'reject'];
  const schemes: ColorScheme[] = ['light', 'dark'];
  it.each(schemes.flatMap((s) => tones.map((tone) => [s, tone] as const)))('I tone %s/%s: picked text and tick readable (≥ 4.5)', (scheme, tone) => {
    const c = tokens.color[scheme];
    wrap(<ChoiceTile kind="mark" tone={tone} testID="t" label="ไม่มี" selected onPress={() => {}} />, { scheme });
    const tile = flat(screen.getByTestId('t').props.style);
    expect(tile.backgroundColor).toBe(c[`${tone}Sunk` as const]);
    expect(tile.borderColor).toBe(c[tone]);
    const text = flat(screen.getByText('ไม่มี').props.style).color as string;
    expect(contrast(text, tile.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    const ring = flat(screen.getByTestId('t-mark', H).props.style);
    const tick = flat(screen.getByTestId('t-tick', H).props.style).borderColor as string;
    expect(contrast(tick, ring.backgroundColor)).toBeGreaterThanOrEqual(3);
  });

  it.each(schemes)('A and F picked text readable in %s', (scheme) => {
    wrap(
      <>
        <ChoiceTile testID="a" label="ก" selected onPress={() => {}} />
        <ChoiceTile kind="check" testID="f" label="ข" selected onPress={() => {}} />
      </>,
      { scheme },
    );
    const a = flat(screen.getByTestId('a').props.style);
    expect(contrast(flat(screen.getByText('ก').props.style).color, a.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    const f = flat(screen.getByTestId('f').props.style);
    expect(contrast(flat(screen.getByText('ข').props.style).color, f.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  it('F multi: tick box 22 on the left, checkbox role, toggles both ways, same size', () => {
    const onPress = jest.fn();
    wrap(
      <>
        <ChoiceTile kind="check" multi testID="f-on" label="บ้านบน" selected onPress={onPress} />
        <ChoiceTile kind="check" multi testID="f-off" label="สวนใหม่" selected={false} onPress={onPress} />
      </>,
    );
    const on = screen.getByTestId('f-on');
    expect(on.props.accessibilityRole).toBe('checkbox');
    expect(on.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('f-off').props.accessibilityState).toMatchObject({ checked: false });
    expect(size(flat(on.props.style))).toEqual(size(flat(screen.getByTestId('f-off').props.style)));
    const box = flat(screen.getByTestId('f-on-mark', H).props.style);
    expect(box).toMatchObject({ width: 22, height: 22, borderWidth: tokens.border.thick });
    expect(box.borderRadius).toBeLessThan(11);
    fireEvent.press(on);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('F single: radio role, tap the picked one keeps it', () => {
    const onPress = jest.fn();
    wrap(<ChoiceTile kind="check" testID="f" label="ทั้งหมด" selected onPress={onPress} />);
    expect(screen.getByTestId('f').props.accessibilityRole).toBe('radio');
    fireEvent.press(screen.getByTestId('f'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('F single, clearable (an optional pick such as the farm): tapping the picked one clears it', () => {
    const onPress = jest.fn();
    wrap(<ChoiceTile kind="check" clearable testID="f" label="สวนบน" selected onPress={onPress} />);
    expect(screen.getByTestId('f').props.accessibilityRole).toBe('radio');
    fireEvent.press(screen.getByTestId('f'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('F single with onRepeat (the category sheet): tapping the picked one calls onRepeat, not onPress', () => {
    const onPress = jest.fn();
    const onRepeat = jest.fn();
    wrap(<ChoiceTile kind="check" testID="f" label="ค่าแรง" selected onPress={onPress} onRepeat={onRepeat} />);
    fireEvent.press(screen.getByTestId('f'));
    expect(onRepeat).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('dashed add tile: grey dashed edge as in the mockup (p1a-after, p1d-after), navy text', () => {
    wrap(<ChoiceTile dashed kind="check" testID="add" label="+ เพิ่มหมวด" onPress={() => {}} />);
    const add = screen.getByTestId('add');
    expect(flat(add.props.style).borderColor).toBe(tokens.color.light.ruleStrong);
    expect(flat(add.props.style).borderColor).not.toBe(tokens.color.light.action);
  });

  it('dashed add tile is a button, not a choice', () => {
    const onPress = jest.fn();
    wrap(<ChoiceTile dashed testID="add" label="+ คนอื่น" onPress={onPress} />);
    const add = screen.getByTestId('add');
    expect(add.props.accessibilityRole).toBe('button');
    expect(flat(add.props.style)).toMatchObject({ borderStyle: 'dashed', borderRadius: tokens.radius.md });
    fireEvent.press(add);
    expect(onPress).toHaveBeenCalled();
  });

  it('a dashed add tile in an I grid sits left like the I tiles; in an A grid it is centred (mockup p1a, st-a)', () => {
    wrap(
      <>
        <ChoiceTile dashed kind="mark" testID="add-i" label="+ คนอื่น" onPress={() => {}} />
        <ChoiceTile dashed testID="add-a" label="+ ร้านใหม่" onPress={() => {}} />
      </>,
    );
    expect(flat(screen.getByTestId('add-i').props.style).justifyContent).toBe('flex-start');
    expect(flat(screen.getByTestId('add-a').props.style).justifyContent).toBe('center');
    expect(screen.queryByTestId('add-i-mark', H)).toBeNull();
  });

  it('grid: equal widths per row, a long label wraps instead of "…"', () => {
    wrap(
      <TileGrid columns={2} testID="g">
        <ChoiceTile testID="x" label="เงินยืม/เบิกล่วงหน้า ชื่อยาวมากจนต้องขึ้นบรรทัดใหม่" selected={false} onPress={() => {}} />
        <ChoiceTile testID="y" label="ค่าปุ๋ย" selected={false} onPress={() => {}} />
        <ChoiceTile testID="z" label="อื่น ๆ" selected={false} onPress={() => {}} />
      </TileGrid>,
    );
    for (const id of ['x', 'y', 'z']) expect(flat(screen.getByTestId(id).props.style).flex).toBe(1);
    expect(screen.getByText(/ชื่อยาวมาก/).props.numberOfLines).toBeUndefined();
    // The odd row is padded so its tile keeps the same width as the row above.
    expect(screen.getAllByTestId('g-spacer')).toHaveLength(1);
  });

  it('E ValueBox: small heading, bold value, ▾; set = tinted; press calls back', () => {
    const onPress = jest.fn();
    wrap(
      <>
        <ValueBox testID="v-set" label="หมวด" value="ค่าปุ๋ย" set onPress={onPress} />
        <ValueBox testID="v" label="สวน" value="ทุกสวน" onPress={onPress} />
      </>,
    );
    expect(flat(screen.getByTestId('v-set').props.style)).toMatchObject({ backgroundColor: tokens.color.light.actionSunk, borderColor: tokens.color.light.action, borderRadius: tokens.radius.md });
    expect(flat(screen.getByTestId('v').props.style)).toMatchObject({ backgroundColor: tokens.color.light.surfaceRaised, borderColor: tokens.color.light.ruleStrong });
    expect(screen.getByText('หมวด')).toBeTruthy();
    fireEvent.press(screen.getByTestId('v'));
    expect(onPress).toHaveBeenCalled();
  });

  it('quick links (CT-8): one wrapping line of underlined links; picked = ink, bold, ✓, no underline; beyond max = off', () => {
    const onPick = jest.fn();
    wrap(
      <QuickLinks
        testID="q"
        value="today"
        onPick={onPick}
        options={[
          { id: 'today', label: 'วันนี้' },
          { id: 'yesterday', label: 'เมื่อวาน' },
          { id: 'later', label: 'มะรืน', disabled: true },
        ]}
      />,
    );
    expect(flat(screen.getByTestId('q').props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    const on = screen.getByTestId('q-today');
    expect(on.props.accessibilityRole).toBe('radio');
    expect(on.props.accessibilityState).toMatchObject({ selected: true });
    expect(flat(on.props.style).minHeight).toBe(tokens.target.min);
    expect(flat(on.props.style).borderWidth ?? 0).toBe(0);
    expect(screen.getByTestId('q-today-tick', H)).toBeTruthy();
    expect(flat(screen.getByText('วันนี้').props.style)).toMatchObject({ color: tokens.color.light.ink, textDecorationLine: 'none' });
    expect(flat(screen.getByText('เมื่อวาน').props.style)).toMatchObject({ color: tokens.color.light.action, textDecorationLine: 'underline' });
    expect(screen.getByTestId('q-later').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('q-yesterday'));
    expect(onPick).toHaveBeenCalledWith('yesterday');
    onPick.mockClear();
    fireEvent.press(on);
    expect(onPick).not.toHaveBeenCalled();
  });
});
