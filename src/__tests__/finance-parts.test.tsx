import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { BigAmount, Fact, MoneyLine, ScreenHeader } from '../components/finance/parts';
import { wrap } from '../test/render';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
const { router: mockRouter } = jest.requireMock('expo-router') as { router: { back: jest.Mock; replace: jest.Mock } };

describe('ScreenHeader (v1.1.0 app bar)', () => {
  it('shows the title, the subtitle and a back arrow that goes back', () => {
    wrap(<ScreenHeader title="ค่าใช้จ่ายทั้งหมด" subtitle="สวนครอบครัว" testID="hdr" />);
    expect(screen.getByText('ค่าใช้จ่ายทั้งหมด')).toBeTruthy();
    expect(screen.getByText('สวนครอบครัว')).toBeTruthy();
    fireEvent.press(screen.getByTestId('hdr-back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('uses the given back action instead of history when one is passed', () => {
    const onBack = jest.fn();
    wrap(<ScreenHeader title="t" onBack={onBack} testID="hdr" />);
    fireEvent.press(screen.getByTestId('hdr-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('MoneyLine — money in/out carries a sign and a word, never colour alone', () => {
  it('money in: a plus sign and the word for in', () => {
    wrap(<MoneyLine label="แดง คืนหนี้ให้สวน" satang={200000} dir="in" testID="m" />);
    expect(screen.getByTestId('m-amount').props.children).toBe('+2,000.00');
    expect(screen.getByTestId('m-word').props.children).toBe('เข้า');
  });

  it('money out: a real minus sign and the word for out', () => {
    wrap(<MoneyLine label="หักหนี้" satang={150000} dir="out" testID="m" />);
    expect(screen.getByTestId('m-amount').props.children).toBe('−1,500.00');
    expect(screen.getByTestId('m-word').props.children).toBe('ออก');
  });

  it('a plain figure has no sign and no word', () => {
    wrap(<MoneyLine label="ยอดขาย" satang={7372000} testID="m" />);
    expect(screen.getByTestId('m-amount').props.children).toBe('73,720.00');
    expect(screen.queryByTestId('m-word')).toBeNull();
  });

  it('zero moves no money: no sign, no word', () => {
    wrap(<MoneyLine label="เงินออก" satang={0} dir="out" testID="m" />);
    expect(screen.getByTestId('m-amount').props.children).toBe('0.00');
    expect(screen.queryByTestId('m-word')).toBeNull();
  });

  it('an unknown amount reads ไม่ทราบ, never zero', () => {
    wrap(<MoneyLine label="ปุ๋ย" satang={null} testID="m" />);
    expect(screen.getByTestId('m-amount').props.children).toBe('ไม่ทราบ');
  });
});

describe('BigAmount and Fact', () => {
  it('shows the hero figure with its unit', () => {
    wrap(<BigAmount satang={120000} caption="สวนต้องคืนรวม" testID="big" />);
    expect(screen.getByTestId('big').props.children).toBe('1,200.00');
    expect(screen.getByText('บาท')).toBeTruthy();
    expect(screen.getByText('สวนต้องคืนรวม')).toBeTruthy();
  });

  it('an unknown total reads ไม่ทราบ, never 0.00 (SYNC-12)', () => {
    wrap(<BigAmount satang={0} unknown caption="ยอดขายรวม" testID="big" />);
    expect(screen.getByTestId('big').props.children).toBe('ไม่ทราบ');
    expect(screen.queryByText('บาท')).toBeNull();
  });

  it('one fact per line with its lead mark (D-70)', () => {
    wrap(<Fact mark="date">15 ก.ย. 2569</Fact>);
    expect(screen.getByText('15 ก.ย. 2569')).toBeTruthy();
    expect(screen.getByTestId('fact-mark-date')).toBeTruthy();
  });
});
