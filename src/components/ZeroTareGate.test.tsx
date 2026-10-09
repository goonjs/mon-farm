import { fireEvent, screen } from '@testing-library/react-native';

import { ZeroTareGate } from './ZeroTareGate';
import { wrap } from '../test/render';


const baseProps = {
  pileName: 'กอง 1',
  tareG: 2_000,
  stdNetG: 50_000,
  onZeroChecked: jest.fn(),
  onTareConfirmed: jest.fn(),
  onReady: jest.fn(),
};

describe('ZeroTareGate', () => {
  it('starts at the zero check when nothing has happened yet', () => {
    wrap(<ZeroTareGate {...baseProps} zeroChecked={false} tareConfirmed={false} />);
    expect(screen.getByTestId('zero-yes')).toBeTruthy();
    expect(screen.queryByTestId('tare-input')).toBeNull();
  });

  it('"yes, zero" reports ok:true with a zero reading', () => {
    const onZeroChecked = jest.fn();
    wrap(<ZeroTareGate {...baseProps} onZeroChecked={onZeroChecked} zeroChecked={false} tareConfirmed={false} />);
    fireEvent.press(screen.getByTestId('zero-yes'));
    expect(onZeroChecked).toHaveBeenCalledWith(true, 0);
  });

  it('"not zero" reveals a reading input, and flagging reports ok:false with the entered grams', () => {
    const onZeroChecked = jest.fn();
    wrap(<ZeroTareGate {...baseProps} onZeroChecked={onZeroChecked} zeroChecked={false} tareConfirmed={false} />);

    fireEvent.press(screen.getByTestId('zero-no'));
    fireEvent.changeText(screen.getByTestId('zero-reading'), '0.3');
    fireEvent.press(screen.getByTestId('zero-flag-confirm'));

    expect(onZeroChecked).toHaveBeenCalledWith(false, 300);
  });

  it('jumps straight to the tare step once zeroChecked is true', () => {
    wrap(<ZeroTareGate {...baseProps} zeroChecked={true} tareConfirmed={false} />);
    expect(screen.getByTestId('tare-input')).toBeTruthy();
    expect(screen.queryByTestId('zero-yes')).toBeNull();
  });

  it('confirming tare converts kg to grams', () => {
    const onTareConfirmed = jest.fn();
    wrap(<ZeroTareGate {...baseProps} onTareConfirmed={onTareConfirmed} zeroChecked={true} tareConfirmed={false} />);

    fireEvent.changeText(screen.getByTestId('tare-input'), '2.5');
    fireEvent.press(screen.getByTestId('tare-confirm'));

    expect(onTareConfirmed).toHaveBeenCalledWith(2_500);
  });

  it('reaches the read-back once both checks are done, showing the expected reading', () => {
    wrap(<ZeroTareGate {...baseProps} zeroChecked={true} tareConfirmed={true} />);
    expect(screen.getByTestId('ready-button')).toBeTruthy();
    expect(screen.getByTestId('read-back')).toHaveTextContent(/2.*50.*52/s);
  });

  it('the ready button commits ready', () => {
    const onReady = jest.fn();
    wrap(<ZeroTareGate {...baseProps} onReady={onReady} zeroChecked={true} tareConfirmed={true} />);
    fireEvent.press(screen.getByTestId('ready-button'));
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe('ZeroTareGate — E04-S03 (D-75)', () => {
  it('a non-zero empty scale offers two ways: wait for another scale, or accept the skew', () => {
    const onZeroChecked = jest.fn();
    const onWait = jest.fn();
    wrap(<ZeroTareGate {...baseProps} onZeroChecked={onZeroChecked} onWait={onWait} zeroChecked={false} tareConfirmed={false} />);
    fireEvent.press(screen.getByTestId('zero-no'));
    fireEvent.changeText(screen.getByTestId('zero-reading'), '2');
    expect(screen.getByTestId('zero-flag-confirm')).toHaveTextContent('รับเข็มเบี้ยวและใช้ต่อ');
    fireEvent.press(screen.getByTestId('zero-wait'));
    expect(onWait).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('zero-flag-confirm'));
    expect(onZeroChecked).toHaveBeenCalledWith(false, 2000);
  });

  it('the read-back adds the skew on its own term', () => {
    wrap(<ZeroTareGate {...baseProps} skewG={2000} zeroChecked tareConfirmed />);
    expect(screen.getByTestId('read-back')).toHaveTextContent(/เข็มเบี้ยว 2/);
    expect(screen.getByTestId('read-back')).toHaveTextContent(/= 54/);
  });
});
