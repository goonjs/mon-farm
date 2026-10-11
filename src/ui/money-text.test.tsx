import { screen } from '@testing-library/react-native';

import { MoneyText } from './money-text';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('MoneyText — sign and word, not colour alone', () => {
  it('money in: + sign, moneyIn ink, tabular sans figures, never mono', () => {
    wrap(<MoneyText testID="m" direction="in" amount="3,000.00" />);
    const s = flat(screen.getByTestId('m').props.style);
    expect(s).toMatchObject({ color: c.moneyIn, fontFamily: tokens.font.family.sans, fontVariant: ['tabular-nums'] });
    expect(s.fontFamily).not.toBe(tokens.font.family.mono);
    expect(screen.getByTestId('m')).toHaveTextContent('รับ +3,000.00 บาท');
    expect(screen.getByTestId('m').props.accessibilityLabel).toBe('รับ 3,000.00 บาท');
  });

  it('money out: − sign (minus, not hyphen) and moneyOut ink', () => {
    wrap(<MoneyText testID="m" direction="out" amount="1,200.00" />);
    expect(flat(screen.getByTestId('m').props.style).color).toBe(c.moneyOut);
    expect(screen.getByTestId('m')).toHaveTextContent('จ่าย −1,200.00 บาท');
    expect(screen.getByTestId('m').props.accessibilityLabel).toBe('จ่าย 1,200.00 บาท');
  });

  it('a custom word replaces the default', () => {
    wrap(<MoneyText testID="m" direction="out" amount="50.00" word="หักหนี้" />);
    expect(screen.getByTestId('m').props.accessibilityLabel).toBe('หักหนี้ 50.00 บาท');
    expect(screen.getByTestId('m')).toHaveTextContent('หักหนี้ −50.00 บาท');
  });

  it('speaks English when the locale is English', () => {
    wrap(<MoneyText testID="m" direction="in" amount="5.00" />, { locale: 'en' });
    expect(screen.getByTestId('m').props.accessibilityLabel).toBe('in 5.00 baht');
  });
});
