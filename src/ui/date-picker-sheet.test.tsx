import { fireEvent, screen } from '@testing-library/react-native';

import { StyleSheet } from 'react-native';

import { CHIP_MIN_WIDTH } from './chip-width';
import { DatePickerSheet, addDays, daysInMonth, monthGrid, shiftMonth, weekdayOf } from './date-picker-sheet';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

jest.mock('../core/finance/money', () => ({
  ...jest.requireActual('../core/finance/money'),
  todayIso: () => '2026-10-27',
}));

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const ID = 'dp';

function setup(over: Partial<React.ComponentProps<typeof DatePickerSheet>> = {}) {
  const onChange = jest.fn();
  const onClose = jest.fn();
  wrap(<DatePickerSheet open onClose={onClose} onChange={onChange} value="2026-10-27" title="ซื้อวันไหน" testID={ID} {...over} />);
  return { onChange, onClose };
}

describe('calendar helpers', () => {
  it('month lengths, leap years, Sunday offset', () => {
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(weekdayOf(2026, 10, 1)).toBe(4); // Thursday
    const grid = monthGrid(2026, 10);
    expect(grid[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(grid).toHaveLength(5);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });
  it('rolls the year and shifts days', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('DatePickerSheet', () => {
  it('renders nothing when closed', () => {
    wrap(<DatePickerSheet open={false} onClose={() => {}} onChange={() => {}} value="2026-10-27" testID={ID} />);
    expect(screen.queryByTestId(ID)).toBeNull();
  });

  it('shows title, month in พ.ศ., Sunday-first header, and the confirm label', () => {
    setup();
    expect(screen.getByText('ซื้อวันไหน')).toBeTruthy();
    expect(screen.getByTestId(`${ID}-month`).props.children.join('')).toBe('ตุลาคม 2569');
    for (const w of ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']) expect(screen.getAllByText(w, { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(screen.getByText('ตกลง · อ. 27 ต.ค. 2569')).toBeTruthy();
    expect(screen.getByTestId(`${ID}-day-2026-10-31`)).toBeTruthy();
    expect(screen.queryByTestId(`${ID}-day-2026-11-01`)).toBeNull();
  });

  it('targets: day cells and nav buttons are big enough', () => {
    setup();
    expect(flat(screen.getByTestId(`${ID}-day-2026-10-05`).props.style).height).toBeGreaterThanOrEqual(44);
    for (const k of ['prev', 'next']) {
      const s = flat(screen.getByTestId(`${ID}-${k}`).props.style);
      expect(s.width).toBeGreaterThanOrEqual(48);
      expect(s.height).toBeGreaterThanOrEqual(48);
    }
  });

  it('selected is filled, today is outlined', () => {
    setup({ value: '2026-10-20' });
    expect(flat(screen.getByTestId(`${ID}-day-2026-10-20`).props.style).backgroundColor).toBe(tokens.color.light.action);
    expect(flat(screen.getByTestId(`${ID}-day-2026-10-27`).props.style).borderWidth).toBeGreaterThan(0);
  });

  it('selecting a day changes only the draft; done commits and closes', () => {
    const { onChange, onClose } = setup();
    fireEvent.press(screen.getByTestId(`${ID}-day-2026-10-13`));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('ตกลง · อ. 13 ต.ค. 2569')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`${ID}-done`));
    expect(onChange).toHaveBeenCalledWith('2026-10-13');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('scrim cancels without changing', () => {
    const { onChange, onClose } = setup();
    fireEvent.press(screen.getByTestId(`${ID}-day-2026-10-13`));
    fireEvent.press(screen.getByTestId(`${ID}-scrim`));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('quick picks are word chips at least CHIP_MIN_WIDTH wide (owner q1 = ค)', () => {
    setup();
    for (const q of ['today', 'yesterday', 'twodays']) {
      expect(StyleSheet.flatten(screen.getByTestId(`${ID}-${q}`).props.style).minWidth).toBe(CHIP_MIN_WIDTH);
    }
  });

  it('quick picks are plain text links on one line, not pills (E01-S25 CT-8, owner 2026-11-21 and rv245-11 2026-11-23)', () => {
    setup();
    for (const q of ['today', 'yesterday', 'twodays']) {
      const s = StyleSheet.flatten(screen.getByTestId(`${ID}-${q}`).props.style);
      expect(s.borderRadius ?? 0).not.toBe(tokens.radius.pill);
      expect(s.borderWidth ?? 0).toBe(0);
      expect(s.minHeight).toBe(tokens.target.min);
    }
    // Owner rv245-11 (2026-11-23): no underline and no ✓ — a tap sets the day, nothing stays picked.
    for (const [q, label] of [['today', 'วันนี้'], ['yesterday', 'เมื่อวาน'], ['twodays', '2 วันก่อน']] as const) {
      expect(screen.queryByTestId(`${ID}-${q}-tick`, { includeHiddenElements: true })).toBeNull();
      expect(screen.getByTestId(`${ID}-${q}`).props.accessibilityState?.selected).toBeUndefined();
      expect(flat(screen.getByText(label).props.style)).toMatchObject({ textDecorationLine: 'none', color: tokens.color.light.action });
    }
  });

  it('quick picks set the draft and jump the calendar to that month', () => {
    const { onChange } = setup({ value: '2026-12-25' });
    expect(screen.getByTestId(`${ID}-month`).props.children.join('')).toBe('ธันวาคม 2569');
    fireEvent.press(screen.getByTestId(`${ID}-today`));
    expect(screen.getByTestId(`${ID}-month`).props.children.join('')).toBe('ตุลาคม 2569');
    fireEvent.press(screen.getByTestId(`${ID}-yesterday`));
    fireEvent.press(screen.getByTestId(`${ID}-done`));
    expect(onChange).toHaveBeenCalledWith('2026-10-26');
  });

  it('quick="ahead" offers วันนี้ / พรุ่งนี้ / มะรืน and no past picks; the calendar stays free (E15-S01 PREP-10)', () => {
    const { onChange } = setup({ quick: 'ahead' });
    expect(screen.getByTestId(`${ID}-today`)).toBeTruthy();
    expect(screen.getByTestId(`${ID}-tomorrow`)).toBeTruthy();
    expect(screen.getByTestId(`${ID}-dayafter`)).toBeTruthy();
    expect(screen.queryByTestId(`${ID}-yesterday`)).toBeNull();
    expect(screen.queryByTestId(`${ID}-twodays`)).toBeNull();
    fireEvent.press(screen.getByTestId(`${ID}-dayafter`));
    fireEvent.press(screen.getByTestId(`${ID}-done`));
    expect(onChange).toHaveBeenCalledWith('2026-10-29');
    // A past day on the calendar is still pickable.
    fireEvent.press(screen.getByTestId(`${ID}-prev`));
    fireEvent.press(screen.getByTestId(`${ID}-day-2026-09-10`));
    fireEvent.press(screen.getByTestId(`${ID}-done`));
    expect(onChange).toHaveBeenLastCalledWith('2026-09-10');
  });

  it('without quick the picks stay วันนี้ / เมื่อวาน / 2 วันก่อน (other screens unchanged)', () => {
    setup();
    expect(screen.getByTestId(`${ID}-yesterday`)).toBeTruthy();
    expect(screen.getByTestId(`${ID}-twodays`)).toBeTruthy();
    expect(screen.queryByTestId(`${ID}-tomorrow`)).toBeNull();
  });

  it('prev/next month, year rollover Dec→Jan, leap Feb 2028', () => {
    setup({ value: '2026-12-10' });
    fireEvent.press(screen.getByTestId(`${ID}-next`));
    expect(screen.getByTestId(`${ID}-month`).props.children.join('')).toBe('มกราคม 2570');
    fireEvent.press(screen.getByTestId(`${ID}-prev`));
    expect(screen.getByTestId(`${ID}-month`).props.children.join('')).toBe('ธันวาคม 2569');
  });

  it('Feb 2028 has 29 days', () => {
    setup({ value: '2028-02-10' });
    expect(screen.getByTestId(`${ID}-day-2028-02-29`)).toBeTruthy();
    expect(screen.queryByTestId(`${ID}-day-2028-02-30`)).toBeNull();
  });

  it('max disables later days (muted, no select) and quick picks beyond it', () => {
    const { onChange } = setup({ max: '2026-10-27', value: '2026-10-27' });
    const later = screen.getByTestId(`${ID}-day-2026-10-28`);
    expect(later.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(later);
    expect(screen.getByText('ตกลง · อ. 27 ต.ค. 2569')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`${ID}-done`));
    expect(onChange).toHaveBeenCalledWith('2026-10-27');
  });

  it('steps a year at a time, for old debts and far dates (E01-S22 DP-3)', () => {
    setup({ value: '2026-10-27' });
    fireEvent.press(screen.getByTestId(`${ID}-prevYear`));
    expect(screen.getByTestId(`${ID}-month`).props.children.join('')).toBe('ตุลาคม 2568');
    fireEvent.press(screen.getByTestId(`${ID}-nextYear`));
    fireEvent.press(screen.getByTestId(`${ID}-nextYear`));
    expect(screen.getByTestId(`${ID}-month`).props.children.join('')).toBe('ตุลาคม 2570');
    for (const id of ['prevYear', 'nextYear']) {
      const s = flat(screen.getByTestId(`${ID}-${id}`).props.style);
      expect(s.width).toBeGreaterThanOrEqual(tokens.target.min);
    }
  });

  it('min disables earlier days and quick picks before it (E01-S22, for rules that already exist)', () => {
    const { onChange } = setup({ min: '2026-10-26', value: '2026-10-27' });
    expect(screen.getByTestId(`${ID}-day-2026-10-25`).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId(`${ID}-twodays`).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId(`${ID}-yesterday`).props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId(`${ID}-day-2026-10-25`));
    fireEvent.press(screen.getByTestId(`${ID}-done`));
    expect(onChange).toHaveBeenCalledWith('2026-10-27');
  });

  it('with no date yet, the calendar starts inside min and max, so ตกลง cannot commit a day out of range (review of PR 194 N4)', () => {
    const early = setup({ value: '', min: '2026-11-03' });
    fireEvent.press(screen.getByTestId(`${ID}-done`));
    expect(early.onChange).toHaveBeenCalledWith('2026-11-03');
  });

  it('an optional date offers "no date", which commits an empty value and closes (E01-S22 DP-2)', () => {
    const { onChange, onClose } = setup({ emptyLabel: 'ไม่ระบุวันเริ่ม' });
    fireEvent.press(screen.getByTestId(`${ID}-empty`));
    expect(onChange).toHaveBeenCalledWith('');
    expect(onClose).toHaveBeenCalled();
  });

  it('no "no date" choice unless asked for', () => {
    setup();
    expect(screen.queryByTestId(`${ID}-empty`)).toBeNull();
  });

  it('max before yesterday disables that quick pick', () => {
    setup({ max: '2026-10-20' });
    expect(screen.getByTestId(`${ID}-today`).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId(`${ID}-yesterday`).props.accessibilityState.disabled).toBe(true);
  });
});
