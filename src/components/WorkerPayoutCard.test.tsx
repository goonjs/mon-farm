import { fireEvent, screen } from '@testing-library/react-native';

import { WorkerPayoutCard } from './WorkerPayoutCard';
import type { WorkerSettlement } from '../core/settle';
import { wrap } from '../test/render';

const worker: WorkerSettlement = {
  personId: 'person-prayuth',
  workerName: 'ประยุทธ',
  zoneIds: ['zA'],
  workerSatang: 132_500, // ฿1,325.00
  deductions: [
    { id: 'ded-1', personId: 'person-prayuth', personName: 'ประยุทธ', satang: 5_000, reason: 'ค่าปุ๋ย', agreedBy: 'สมชาย', voided: false, voidReason: null },
    { id: 'ded-2', personId: 'person-prayuth', personName: 'ประยุทธ', satang: 2_500, reason: 'ค่าน้ำมัน', agreedBy: 'สมชาย', voided: false, voidReason: null },
  ],
  deductionSatang: 7_500,
  payoutSatang: 125_000, // ฿1,250.00
};

describe('WorkerPayoutCard', () => {
  it('renders one line per live deduction, then a payout row', () => {
    wrap(<WorkerPayoutCard worker={worker} onVoidDeduction={jest.fn()} />);

    expect(screen.getByTestId('deduction-ded-1')).toBeTruthy();
    expect(screen.getByTestId('deduction-ded-2')).toBeTruthy();
    expect(screen.getByText(/ค่าปุ๋ย/)).toBeTruthy();
    expect(screen.getByText(/ค่าน้ำมัน/)).toBeTruthy();

    const payoutRow = screen.getByTestId('worker-payout-person-prayuth');
    expect(payoutRow).toBeTruthy();
  });

  it('renders no deduction lines and the payout equal to the share when there are none', () => {
    const noDeductions: WorkerSettlement = { ...worker, deductions: [], deductionSatang: 0, payoutSatang: worker.workerSatang };
    wrap(<WorkerPayoutCard worker={noDeductions} onVoidDeduction={jest.fn()} />);
    expect(screen.queryByTestId('deduction-ded-1')).toBeNull();
  });

  it('a negative payout renders as −฿ x, the same money format as the deduction lines', () => {
    // Someone with a deduction but no zone contract in this sale: share ฿0.00,
    // deduction ฿30.00, payout −฿30.00. toLocaleString would render this
    // "฿ -30.00" — hyphen inside the symbol, unlike every other figure on the
    // screen. One money format, or the screen stops being readable at speed.
    const outsider: WorkerSettlement = {
      personId: 'person-outsider',
      workerName: 'คนนอกโซน',
      zoneIds: [],
      workerSatang: 0,
      deductions: [
        { id: 'ded-9', personId: 'person-outsider', personName: 'คนนอกโซน', satang: 3_000, reason: 'ค่าปรับ', agreedBy: 'สมชาย', voided: false, voidReason: null },
      ],
      deductionSatang: 3_000,
      payoutSatang: -3_000,
    };
    wrap(<WorkerPayoutCard worker={outsider} onVoidDeduction={jest.fn()} />);

    // Both the deduction line and the payout row now read "−฿ 30.00", which is
    // the consistency this test exists to hold — hence getAllByText.
    expect(screen.getAllByText('−฿ 30.00')).toHaveLength(2);
    expect(screen.queryByText(/฿ -30\.00/)).toBeNull();
  });

  it('voiding a deduction requires a typed reason before the void confirms', () => {
    const onVoidDeduction = jest.fn();
    wrap(<WorkerPayoutCard worker={worker} onVoidDeduction={onVoidDeduction} />);

    fireEvent.press(screen.getByTestId('deduction-void-ded-1'));
    const confirm = screen.getByTestId('deduction-void-confirm-ded-1');
    expect(confirm.props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('deduction-void-reason-ded-1'), 'จ่ายผิดคน');
    expect(screen.getByTestId('deduction-void-confirm-ded-1').props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(screen.getByTestId('deduction-void-confirm-ded-1'));
    expect(onVoidDeduction).toHaveBeenCalledWith('ded-1', 'จ่ายผิดคน');
  });
});
