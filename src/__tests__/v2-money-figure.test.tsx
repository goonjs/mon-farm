import { screen } from '@testing-library/react-native';

import { MoneyFigure } from '../v2/sale/money-figure';
import { wrap } from '../test/render';

describe('MoneyFigure (owner 2026-10-11: the ฿ sits by the label, never after a long amount)', () => {
  it('shows the amount with its unit word on one line, without ฿', () => {
    wrap(<MoneyFigure value="4.18 หมื่น" testID="fig-money" />);
    const t = screen.getByTestId('fig-money');
    expect(t).toHaveTextContent(/^4\.18 หมื่น$/);
    expect(t.props.numberOfLines).toBe(1);
  });

  it('a short amount is just the number', () => {
    wrap(<MoneyFigure value="850" testID="fig-money" />);
    expect(screen.getByTestId('fig-money')).toHaveTextContent(/^850$/);
  });
});
