import { fireEvent, screen } from '@testing-library/react-native';

import { BulkEntryForm } from './BulkEntryForm';
import { wrap } from '../test/render';

/**
 * The two things a person knows about a pile they did not watch being
 * counted: how many baskets, and what was left over. Plus why they are
 * entering it this way, which is the bar `pile_reopened` and `void` already
 * meet.
 */
const baseProps = {
  pileName: 'กอง 1',
  tareG: 2_000,
  stdNetG: 50_000,
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

const disabled = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState?.disabled;

describe('BulkEntryForm', () => {
  it('blocks confirm while the reason is empty or whitespace only', () => {
    wrap(<BulkEntryForm {...baseProps} />);
    fireEvent.changeText(screen.getByTestId('bulk-baskets'), '12');
    expect(disabled('bulk-confirm')).toBe(true);

    fireEvent.changeText(screen.getByTestId('bulk-reason'), '   ');
    expect(disabled('bulk-confirm')).toBe(true);

    fireEvent.changeText(screen.getByTestId('bulk-reason'), 'นับไว้ในกระดาษ');
    expect(disabled('bulk-confirm')).toBe(false);
  });

  it('blocks confirm when there is nothing to enter — no baskets and no leftover', () => {
    wrap(<BulkEntryForm {...baseProps} />);
    fireEvent.changeText(screen.getByTestId('bulk-reason'), 'ไม่ได้เปิดแอป');
    expect(disabled('bulk-confirm')).toBe(true);

    fireEvent.changeText(screen.getByTestId('bulk-baskets'), '0');
    fireEvent.changeText(screen.getByTestId('bulk-leftover'), '0');
    expect(disabled('bulk-confirm')).toBe(true);
  });

  it('reports baskets, leftover in grams, and the trimmed reason', () => {
    const onConfirm = jest.fn();
    wrap(<BulkEntryForm {...baseProps} onConfirm={onConfirm} />);
    fireEvent.changeText(screen.getByTestId('bulk-baskets'), '12');
    fireEvent.changeText(screen.getByTestId('bulk-leftover'), '8.4');
    fireEvent.changeText(screen.getByTestId('bulk-reason'), '  นับไว้ในกระดาษ  ');
    fireEvent.press(screen.getByTestId('bulk-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({
      baskets: 12,
      leftoverG: 8_400,
      reason: 'นับไว้ในกระดาษ',
    });
  });

  it('accepts baskets with no leftover', () => {
    const onConfirm = jest.fn();
    wrap(<BulkEntryForm {...baseProps} onConfirm={onConfirm} />);
    fireEvent.changeText(screen.getByTestId('bulk-baskets'), '3');
    fireEvent.changeText(screen.getByTestId('bulk-reason'), 'ไม่มีเศษ');
    fireEvent.press(screen.getByTestId('bulk-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({ baskets: 3, leftoverG: 0, reason: 'ไม่มีเศษ' });
  });

  it('accepts a leftover with no baskets — an all-leftover pile is valid', () => {
    const onConfirm = jest.fn();
    wrap(<BulkEntryForm {...baseProps} onConfirm={onConfirm} />);
    fireEvent.changeText(screen.getByTestId('bulk-leftover'), '20');
    fireEvent.changeText(screen.getByTestId('bulk-reason'), 'เหลือกองเดียว');
    fireEvent.press(screen.getByTestId('bulk-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({ baskets: 0, leftoverG: 20_000, reason: 'เหลือกองเดียว' });
  });

  it('cancel reports cancellation and never confirms', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    wrap(<BulkEntryForm {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.changeText(screen.getByTestId('bulk-baskets'), '12');
    fireEvent.changeText(screen.getByTestId('bulk-reason'), 'นับไว้ในกระดาษ');
    fireEvent.press(screen.getByTestId('bulk-cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('says what confirming will write, including that the pile closes', () => {
    wrap(<BulkEntryForm {...baseProps} />);
    fireEvent.changeText(screen.getByTestId('bulk-baskets'), '12');
    fireEvent.changeText(screen.getByTestId('bulk-leftover'), '8.4');

    const summary = screen.getByTestId('bulk-summary');
    expect(summary.props.children).toContain('12');
    expect(summary.props.children).toContain('8.4');
  });
});
