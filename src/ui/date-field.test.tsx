import { fireEvent, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { TextInput } from 'react-native';

import { DateField } from './date-field';
import { pickDate } from '../test/pick-date';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

jest.mock('../core/finance/money', () => ({
  ...jest.requireActual('../core/finance/money'),
  todayIso: () => '2026-11-15',
}));

function Host({ start = '2026-11-15', ...rest }: { start?: string } & Partial<React.ComponentProps<typeof DateField>>) {
  const [v, setV] = useState(start);
  return <DateField testID="when" label="วันที่" value={v} onChange={setV} {...rest} />;
}

describe('DateField — a date is picked, never typed (E01-S22 DP-1)', () => {
  it('a picker row: the label, the date in the user era, a calendar mark and ›; no text input', () => {
    wrap(<Host required />);
    const row = screen.getByTestId('when');
    expect(row.props.accessibilityRole).toBe('button');
    expect(screen.getByText(/^วันที่/)).toBeTruthy();
    expect(screen.getByTestId('when-value')).toHaveTextContent('15 พ.ย. 2569');
    expect(within(row).getByTestId('when-chevron', { includeHiddenElements: true })).toBeTruthy();
    expect(within(row).getByTestId('when-calendar', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    expect(row).toHaveStyle({ minHeight: tokens.target.comfortable });
  });

  it('tapping opens the picker; picking a day and confirming changes the value', () => {
    wrap(<Host />);
    pickDate('when', '2026-09-28');
    expect(screen.getByTestId('when-value')).toHaveTextContent('28 ก.ย. 2569');
    expect(screen.queryByTestId('when-picker')).toBeNull();
  });

  it('an empty optional date says so, and the picker can clear it (DP-2)', () => {
    wrap(<Host start="" emptyText="ไม่ระบุวันเริ่ม" emptyLabel="ไม่ระบุวันเริ่ม" />);
    expect(screen.getByTestId('when-value')).toHaveTextContent('ไม่ระบุวันเริ่ม');
    pickDate('when', '2026-11-20');
    expect(screen.getByTestId('when-value')).toHaveTextContent('20 พ.ย. 2569');
    fireEvent.press(screen.getByTestId('when'));
    fireEvent.press(screen.getByTestId('when-picker-empty'));
    expect(screen.getByTestId('when-value')).toHaveTextContent('ไม่ระบุวันเริ่ม');
  });

  it('shows an error under the row', () => {
    wrap(<Host error="ใส่วันเริ่ม" />);
    expect(screen.getByTestId('when-error')).toHaveTextContent('ใส่วันเริ่ม');
  });

  it('passes min and max to the picker', () => {
    wrap(<Host min="2026-11-10" max="2026-11-15" />);
    fireEvent.press(screen.getByTestId('when'));
    expect(screen.getByTestId('when-picker-day-2026-11-09').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('when-picker-day-2026-11-16').props.accessibilityState.disabled).toBe(true);
  });
});
