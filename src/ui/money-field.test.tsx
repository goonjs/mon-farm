import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { MoneyField } from './money-field';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const press = (...keys: string[]) => keys.forEach((k) => fireEvent.press(screen.getByTestId(`m-pad-key-${k}`)));
const flatText = (n: unknown): string =>
  Array.isArray(n) ? n.map(flatText).join('') : n && typeof n === 'object' ? flatText((n as { props: { children?: unknown } }).props.children) : String(n ?? '');
const text = (id: string) => flatText(screen.getByTestId(id).props.children);
const done = () => fireEvent.press(screen.getByTestId('m-done'));

function Harness({ initial = 115000, ...rest }: { initial?: number | null } & Partial<React.ComponentProps<typeof MoneyField>>) {
  const [v, setV] = useState<number | null>(initial);
  return <MoneyField testID="m" label="ราคาต่อกระสอบ" unit="บาท / กระสอบ" satang={v} onChange={setV} {...rest} />;
}

describe('MoneyField', () => {
  it('closed: grouped whole part, faint ".00", small unit', () => {
    wrap(<Harness />);
    expect(text('m')).toContain('1,150.00');
    expect(screen.getByText('บาท / กระสอบ')).toBeTruthy();
    expect(screen.queryByTestId('m-sheet')).toBeNull();
  });

  it('closed card is slim (56-72) with the numeral below figure and unit on the same row', () => {
    wrap(<Harness />);
    const st = flat(screen.getByTestId('m').props.style);
    expect(st.minHeight).toBeGreaterThanOrEqual(56);
    expect(st.minHeight).toBeLessThanOrEqual(72);
    expect(st.paddingVertical).toBeLessThanOrEqual(8);
    expect(screen.getByText('ราคาต่อกระสอบ')).toBeTruthy();
  });

  it('sheet: first key replaces; words and below line follow the live amount; ตกลง commits', () => {
    wrap(<Harness below={(s) => (s == null ? undefined : `20 × ${s / 100} = ${(s * 20) / 100}`)} />);
    fireEvent.press(screen.getByTestId('m'));
    expect(screen.getByText('กำลังกรอก')).toBeTruthy();
    expect(text('m-display')).toBe('1,150.00');
    press('2', '5', '0', '000');
    expect(text('m-display')).toBe('250,000.00');
    expect(screen.getByTestId('m-words').props.children).toMatch(/สองแสนห้าหมื่นบาทถ้วน/);
    expect(screen.getByTestId('m-below').props.children).toBe('20 × 250000 = 5000000');
    press('.', '5');
    expect(text('m-display')).toBe('250,000.50');
    done();
    expect(screen.queryByTestId('m-sheet')).toBeNull();
    expect(text('m')).toContain('250,000.50');
  });

  it('the fraction is drawn at 55% and faint until typed', () => {
    wrap(<Harness />);
    fireEvent.press(screen.getByTestId('m'));
    const outer = screen.getByTestId('m-display');
    const frac = outer.props.children[1];
    expect(flat(frac.props.style).color).toBe(tokens.color.light.inkFaint);
    expect(flat(frac.props.style).fontSize).toBe(Math.round(flat(outer.props.style).fontSize * 0.55));
    press('.');
    expect(flat(screen.getByTestId('m-display').props.children[1].props.style).color).toBe(tokens.color.light.ink);
  });

  it('long amounts step the numeral down and never truncate', () => {
    wrap(<Harness initial={null} />);
    fireEvent.press(screen.getByTestId('m'));
    press('1', '2');
    const size = () => flat(screen.getByTestId('m-display').props.style).fontSize;
    expect(size()).toBe(tokens.font.size.figure);
    press('0', '0', '0', '0', '0', '0', '0');
    expect(size()).toBeLessThan(tokens.font.size.figure);
    expect(screen.getByTestId('m-display').props.numberOfLines).toBe(1);
  });

  it('empty hides words and disables ตกลง; closing cancels', () => {
    const onChange = jest.fn();
    wrap(<MoneyField testID="m" label="ราคา" unit="บาท" satang={null} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('m'));
    expect(screen.queryByTestId('m-words')).toBeNull();
    expect(screen.getByTestId('m-done').props.accessibilityState.disabled).toBe(true);
    press('5');
    fireEvent.press(screen.getByTestId('m-sheet-scrim'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('below min: message and disabled', () => {
    wrap(<Harness minSatang={10000} />);
    fireEvent.press(screen.getByTestId('m'));
    press('5');
    expect(screen.getByText('ต้องไม่น้อยกว่า 100.00')).toBeTruthy();
    expect(screen.getByTestId('m-done').props.accessibilityState.disabled).toBe(true);
  });

  it('past 8 whole digits: "ใหญ่เกินไป"', () => {
    wrap(<Harness initial={null} />);
    fireEvent.press(screen.getByTestId('m'));
    press('9', '9', '9', '9', '9', '9', '9', '9', '9');
    expect(screen.getByText('ใหญ่เกินไป')).toBeTruthy();
  });
});
