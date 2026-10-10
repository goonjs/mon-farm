import { screen } from '@testing-library/react-native';

import { AppText, Num, TYPE_VARIANTS } from './type';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;
const f = tokens.font;

describe('type scale and numerals (E01-S17 X8)', () => {
  it('every variant is sans with Thai-safe leading (never mono)', () => {
    for (const v of TYPE_VARIANTS) {
      wrap(<AppText variant={v}>{`ข้อความ ${v}`}</AppText>);
      const s = flat(screen.getByText(`ข้อความ ${v}`).props.style);
      expect([v, s.fontFamily]).toEqual([v, f.family.sans]);
      // Thai stacks marks above and below: at least snug leading on every step.
      expect(s.lineHeight / s.fontSize).toBeGreaterThanOrEqual(f.lineHeight.snug);
    }
  });

  it('maps the steps onto the FarmMate scale', () => {
    wrap(
      <>
        <AppText variant="title">ก</AppText>
        <AppText variant="body">ข</AppText>
        <AppText variant="label">ค</AppText>
      </>,
    );
    expect(flat(screen.getByText('ก').props.style)).toMatchObject({ fontSize: f.size.headingLg, fontWeight: f.weight.bold, color: c.ink });
    expect(flat(screen.getByText('ข').props.style)).toMatchObject({ fontSize: f.size.bodyLg, color: c.ink });
    expect(flat(screen.getByText('ค').props.style)).toMatchObject({ fontSize: f.size.bodySm, color: c.inkSoft });
  });

  it('Num: money and counts in tabular sans figures, never monospace', () => {
    wrap(
      <Num size="figure" tone="moneyIn" testID="n">
        +3,000.00
      </Num>,
    );
    const s = flat(screen.getByTestId('n').props.style);
    expect(s).toMatchObject({
      fontFamily: f.family.sans,
      fontVariant: ['tabular-nums'],
      fontSize: f.size.figure,
      color: c.moneyIn,
    });
    expect(s.fontFamily).not.toBe(f.family.mono);
  });
});
