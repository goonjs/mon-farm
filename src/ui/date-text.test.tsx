import { screen } from '@testing-library/react-native';

import { DateText } from './date-text';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('DateText — a slot for date logic to plug into later', () => {
  it('shows a pre-formatted string as-is', () => {
    wrap(<DateText testID="d" value="ส. 3 ต.ค. 2569" />);
    expect(screen.getByTestId('d')).toHaveTextContent('ส. 3 ต.ค. 2569');
    expect(flat(screen.getByTestId('d').props.style)).toMatchObject({
      fontFamily: tokens.font.family.sans,
      fontVariant: ['tabular-nums'],
    });
  });

  it('calls a formatter with the date and the current locale', () => {
    const at = new Date(Date.UTC(2026, 9, 3));
    const format = jest.fn((d: Date, locale: string) => `${locale}:${d.toISOString().slice(0, 10)}`);
    wrap(<DateText testID="d" value={at} format={format} />, { locale: 'en' });
    expect(format).toHaveBeenCalledWith(at, 'en');
    expect(screen.getByTestId('d')).toHaveTextContent('en:2026-10-03');
  });

  it('falls back to ISO date when given a Date and no formatter', () => {
    wrap(<DateText testID="d" value={new Date(Date.UTC(2026, 9, 3))} />);
    expect(screen.getByTestId('d')).toHaveTextContent('2026-10-03');
  });
});
