import { fireEvent, screen } from '@testing-library/react-native';

import { RemoveControl } from './RemoveControl';
import { wrap } from '../test/render';

/**
 * S26. One control, two registers — the fork the story insists on: a pile or
 * zone that never held anything goes in one tap, and one that did is a void
 * with a typed reason (S12's pattern), never a delete.
 */
describe('RemoveControl', () => {
  const props = {
    testID: 'remove-pile-p1',
    label: 'เอากองออก',
    detail: 'กอง 1 จะไม่ถูกนับรวมอีก',
    onRemove: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('removes an empty target in one confirm, with no reason asked for', () => {
    wrap(<RemoveControl {...props} needsReason={false} />);

    fireEvent.press(screen.getByTestId('remove-pile-p1'));
    expect(screen.queryByTestId('remove-pile-p1-reason')).toBeNull();

    fireEvent.press(screen.getByTestId('remove-pile-p1-confirm'));
    expect(props.onRemove).toHaveBeenCalledWith('');
  });

  it('demands a typed reason when the target has history, and blocks an empty one', () => {
    wrap(<RemoveControl {...props} needsReason />);

    fireEvent.press(screen.getByTestId('remove-pile-p1'));
    const reason = screen.getByTestId('remove-pile-p1-reason');
    expect(reason).toBeTruthy();

    // Submitting nothing is not a removal — the reason is the record.
    expect(screen.getByTestId('remove-pile-p1-confirm').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('remove-pile-p1-confirm'));
    expect(props.onRemove).not.toHaveBeenCalled();

    fireEvent.changeText(reason, '  นับซ้ำกับกอง 2  ');
    fireEvent.press(screen.getByTestId('remove-pile-p1-confirm'));
    expect(props.onRemove).toHaveBeenCalledWith('นับซ้ำกับกอง 2');
  });

  it('reads as a void, not a delete, once there is history to void', () => {
    wrap(<RemoveControl {...props} needsReason />);
    fireEvent.press(screen.getByTestId('remove-pile-p1'));
    expect(screen.getByTestId('remove-pile-p1-confirm')).toHaveTextContent(/ยกเลิก/);
  });

  it('cancelling asks again next time rather than remembering the typed reason', () => {
    wrap(<RemoveControl {...props} needsReason />);
    fireEvent.press(screen.getByTestId('remove-pile-p1'));
    fireEvent.changeText(screen.getByTestId('remove-pile-p1-reason'), 'เปลี่ยนใจ');
    fireEvent.press(screen.getByTestId('remove-pile-p1-cancel'));

    fireEvent.press(screen.getByTestId('remove-pile-p1'));
    expect(screen.getByTestId('remove-pile-p1-reason').props.value).toBe('');
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  /**
   * The zone rule (S26): a zone with piles under it is not removable at all,
   * and the screen says why rather than showing a dead button.
   */
  it('is disabled with an inline explanation when it is blocked', () => {
    wrap(<RemoveControl {...props} needsReason={false} blockedReason="เอากองในโซนออกก่อน" />);

    expect(screen.getByTestId('remove-pile-p1').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('remove-pile-p1-blocked')).toHaveTextContent('เอากองในโซนออกก่อน');

    fireEvent.press(screen.getByTestId('remove-pile-p1'));
    expect(screen.queryByTestId('remove-pile-p1-confirm')).toBeNull();
  });

  it('shows no explanation line when it is not blocked', () => {
    wrap(<RemoveControl {...props} needsReason={false} />);
    expect(screen.queryByTestId('remove-pile-p1-blocked')).toBeNull();
  });

  /**
   * The trigger sits beside "แก้ไข" on every pile row. A full-width
   * destructive button there reads as the loudest thing on the screen for
   * the row's least common action — it should be icon-sized instead, with
   * the real label carried for anyone not reading the glyph.
   */
  it('collapses to a small icon, not a full-width labelled button', () => {
    wrap(<RemoveControl {...props} needsReason={false} />);
    const trigger = screen.getByTestId('remove-pile-p1');

    expect(trigger).not.toHaveTextContent(props.label);
    expect(trigger.props.accessibilityLabel).toBe(props.label);

    const style = Array.isArray(trigger.props.style) ? Object.assign({}, ...trigger.props.style) : trigger.props.style;
    expect(style.width).toBeLessThanOrEqual(40);
  });
});
