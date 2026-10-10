import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Button, CardLabel, PinnedActions, Pill, Tabs, TopBar, cardStyle } from './chrome';
import { useTheme } from '../theme';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

/**
 * E01-S17 phase B: the shell matches the approved v1.1.0 mockups — pill
 * buttons at the 48pt field floor, cards with hairline + soft shadow, sans
 * Thai type in pills and labels (mono cannot set Thai well). Tokens only.
 */

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('chrome — v1.1.0 shell styling', () => {
  it('primary button: navy pill at the 48pt floor, white bold label', () => {
    wrap(<Button testID="b" variant="primary">บันทึก</Button>);
    const s = flat(screen.getByTestId('b').props.style);
    expect(s).toMatchObject({ backgroundColor: c.action, borderRadius: tokens.radius.pill, minHeight: tokens.target.min });
    const label = flat(screen.getByText('บันทึก').props.style);
    expect(label).toMatchObject({ color: c.inkInverse, fontWeight: tokens.font.weight.bold, fontFamily: tokens.font.family.sans });
  });

  it('secondary button: raised fill, navy outline and label', () => {
    wrap(<Button testID="b">ตั้งค่า</Button>);
    const s = flat(screen.getByTestId('b').props.style);
    expect(s).toMatchObject({
      backgroundColor: c.surfaceRaised,
      borderColor: c.action,
      borderWidth: tokens.border.thick,
      borderRadius: tokens.radius.pill,
    });
    expect(flat(screen.getByText('ตั้งค่า').props.style).color).toBe(c.action);
  });

  it('disabled button: disabled fill, readable label, dashed control border — not just faded', () => {
    wrap(<Button testID="b" variant="primary" disabled>บันทึก</Button>);
    const s = flat(screen.getByTestId('b').props.style);
    expect(s).toMatchObject({ backgroundColor: c.disabledFill, borderColor: c.ruleStrong, borderStyle: 'dashed' });
    expect(s.opacity ?? 1).toBe(1);
    expect(flat(screen.getByText('บันทึก').props.style).color).toBe(c.disabledInk);
  });

  it('card style: raised surface, faint hairline, large radius, card shadow', () => {
    let s: ReturnType<typeof cardStyle> | undefined;
    function Probe() {
      s = cardStyle(useTheme());
      return <View />;
    }
    wrap(<Probe />);
    const sh = tokens.shadow.card;
    expect(s).toMatchObject({
      backgroundColor: c.surfaceRaised,
      borderColor: c.ruleFaint,
      borderWidth: tokens.border.hair,
      borderRadius: tokens.radius.lg,
      boxShadow: `0px ${sh.y}px ${sh.blur}px ${sh.color}`,
    });
  });

  it('card label and pill set Thai in the sans stack', () => {
    wrap(
      <>
        <CardLabel>ที่มาของยอด</CardLabel>
        <Pill tone="warn" dot="half">รอส่ง 1</Pill>
      </>,
    );
    expect(flat(screen.getByText('ที่มาของยอด').props.style)).toMatchObject({
      fontFamily: tokens.font.family.sans,
      color: c.inkSoft,
    });
    expect(flat(screen.getByText('รอส่ง 1').props.style)).toMatchObject({
      fontFamily: tokens.font.family.sans,
      color: c.warn,
      fontWeight: tokens.font.weight.semibold,
    });
  });

  it('top bar title uses the heading step in the app-bar ink', () => {
    wrap(<TopBar crumb="นับเข่ง" />);
    expect(flat(screen.getByTestId('crumb').props.style)).toMatchObject({
      color: c.appBarInk,
      fontSize: tokens.font.size.headingSm,
      fontWeight: tokens.font.weight.bold,
    });
  });

  it('selected tab reads navy and bold in sans; others inkSoft', () => {
    wrap(<Tabs tabs={[{ key: 'a', label: 'นับ' }, { key: 'b', label: 'กอง' }]} active="a" onChange={() => {}} />);
    expect(flat(screen.getByText('นับ').props.style)).toMatchObject({ color: c.action, fontWeight: tokens.font.weight.bold });
    expect(flat(screen.getByText('กอง').props.style).color).toBe(c.inkSoft);
  });

  it('row button: a borderless, left-aligned list row with a decorative chevron', () => {
    wrap(<Button testID="r" variant="row">ไร่คุณพ่อ · เปิดอยู่</Button>);
    const s = flat(screen.getByTestId('r').props.style);
    expect(s).toMatchObject({ borderWidth: 0, alignItems: 'stretch', minHeight: tokens.target.min });
    expect(flat(screen.getByText('ไร่คุณพ่อ · เปิดอยู่').props.style)).toMatchObject({
      color: c.ink,
      textAlign: 'left',
      fontSize: tokens.font.size.bodyLg,
    });
    expect(flat(screen.getByText('›', { includeHiddenElements: true }).props.style).color).toBe(c.inkFaint);
  });

  it('large CTA: 56pt pill with a leading icon painted in the label colour', () => {
    wrap(
      <Button
        testID="cta"
        variant="primary"
        size="large"
        icon={(colour) => <View testID="cta-icon" style={{ backgroundColor: colour }} />}
      >
        เริ่มการขายใหม่
      </Button>,
    );
    expect(flat(screen.getByTestId('cta').props.style)).toMatchObject({
      minHeight: tokens.target.comfortable,
      borderRadius: tokens.radius.pill,
      flexDirection: 'row',
    });
    expect(flat(screen.getByTestId('cta-icon', { includeHiddenElements: true }).props.style).backgroundColor).toBe(
      c.inkInverse,
    );
  });

  it('pinned actions: a bottom bar on the screen ground, no rule, gutters per layout', () => {
    wrap(
      <PinnedActions testID="pinned">
        <Button>หนึ่ง</Button>
      </PinnedActions>,
    );
    expect(flat(screen.getByTestId('pinned').props.style)).toMatchObject({
      backgroundColor: c.surface,
      paddingHorizontal: tokens.layout.screenPaddingX,
    });
  });

  it('top bar crumb path: parts split by drawn chevrons, not a ▸ glyph', () => {
    wrap(<TopBar crumb={['ไร่คุณพ่อ', 'โซน A', 'กอง 1']} />);
    expect(screen.queryByText(/▸/)).toBeNull();
    expect(screen.getByTestId('crumb')).toHaveTextContent(/ไร่คุณพ่อ.*โซน A.*กอง 1/);
    expect(screen.getAllByTestId('crumb-sep', { includeHiddenElements: true })).toHaveLength(2);
  });
});
