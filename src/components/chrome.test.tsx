import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Button, CardLabel, Pill, Tabs, TopBar, cardStyle } from './chrome';
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
});
