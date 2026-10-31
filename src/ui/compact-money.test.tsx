import { screen } from '@testing-library/react-native';

import { CompactMoney } from './compact-money';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('CompactMoney — short figure, the unit stressed', () => {
  it('whole baht under 10,000: no unit, spoken as the exact amount', () => {
    wrap(<CompactMoney testID="m" satang={325_000} />);
    expect(screen.getByTestId('m')).toHaveTextContent('฿ 3,250');
    expect(screen.getByTestId('m').props.accessibilityLabel).toBe('3,250.00 บาท');
    expect(screen.queryByTestId('m-unit')).toBeNull();
  });

  it('k: the unit is its own bold, coloured run', () => {
    wrap(<CompactMoney testID="m" satang={1_254_000} />);
    expect(screen.getByTestId('m')).toHaveTextContent('฿ 12.54k');
    const unit = flat(screen.getByTestId('m-unit').props.style);
    expect(screen.getByTestId('m-unit')).toHaveTextContent('k');
    expect(unit.color).toBe(c.action);
    expect(unit.fontWeight).toBe(tokens.font.weight.black);
    expect(screen.getByTestId('m').props.accessibilityLabel).toBe('12,540.00 บาท');
  });

  it('m is stressed the same way, a negative keeps the true minus', () => {
    wrap(<CompactMoney testID="m" satang={-123_456_789_00} />);
    expect(screen.getByTestId('m')).toHaveTextContent('−฿ 123.5m');
    expect(screen.getByTestId('m-unit')).toHaveTextContent('m');
  });
});
