import { fireEvent, screen } from '@testing-library/react-native';

import { ShortBasketPanel } from './ShortBasketPanel';
import { wrap } from '../test/render';


describe('ShortBasketPanel', () => {
  it('shows the live net preview: reading minus tare', () => {
    wrap(
      <ShortBasketPanel
        tareG={2_000}
        stdNetG={50_000}
        readingG={43_000}
        onChangeReading={jest.fn()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    // 43 − 2 = 41 kg
    expect(screen.getByTestId('short-preview')).toHaveTextContent(/41/);
  });

  it('confirm fires once, with nothing else appended on cancel', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    wrap(
      <ShortBasketPanel
        tareG={2_000}
        stdNetG={50_000}
        readingG={43_000}
        onChangeReading={jest.fn()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(screen.getByTestId('short-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancel fires without ever calling confirm', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    wrap(
      <ShortBasketPanel
        tareG={2_000}
        stdNetG={50_000}
        readingG={43_000}
        onChangeReading={jest.fn()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(screen.getByTestId('short-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables confirm when the reading is below tare (a negative net)', () => {
    wrap(
      <ShortBasketPanel
        tareG={2_000}
        stdNetG={50_000}
        readingG={1_000} // below tare
        onChangeReading={jest.fn()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByTestId('short-confirm').props.accessibilityState?.disabled).toBe(true);
  });
});
