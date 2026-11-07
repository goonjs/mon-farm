import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ScreenHeader } from './screen-header';
import { SaveBar } from './action-button';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

// expo-router ships ESM outside jest's transformIgnorePatterns (same stub as
// the screen tests); only <Link> is used here.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v) },
});
beforeEach(() => stored.clear());

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('ScreenHeader — one header for every screen (v1.1.0)', () => {
  it('shows title over subtitle on the app bar', () => {
    wrap(<ScreenHeader title="ข้อมูลฟาร์ม" subtitle="สวนครอบครัว" />);
    expect(flat(screen.getByTestId('screen-header').props.style).backgroundColor).toBe(c.appBar);
    expect(flat(screen.getByTestId('screen-title').props.style)).toMatchObject({
      color: c.appBarInk,
      fontSize: tokens.font.size.headingLg,
      fontWeight: tokens.font.weight.bold,
    });
    expect(screen.getByText('สวนครอบครัว')).toBeTruthy();
    expect(flat(screen.getByText('สวนครอบครัว').props.style).color).toBe(c.inkSoft);
  });

  it('back is a 48pt chevron named by its label, arrow stripped for screen readers', () => {
    const onPress = jest.fn();
    wrap(<ScreenHeader title="ตั้งค่า" back={{ label: '← รายการ', testID: 'settings-back', onPress }} />);
    const back = screen.getByTestId('settings-back');
    expect(back.props.accessibilityLabel).toBe('รายการ');
    expect(flat(back.props.style)).toMatchObject({ minWidth: tokens.target.min, minHeight: tokens.target.min });
    fireEvent.press(back);
    expect(onPress).toHaveBeenCalled();
  });

  it('menu button (☰) instead of back on the home screen', () => {
    const onPress = jest.fn();
    wrap(<ScreenHeader title="mon-farm" menu={{ onPress }} />);
    const menu = screen.getByTestId('open-menu');
    expect(menu.props.accessibilityLabel).toBe('เมนู');
    expect(menu.props.accessibilityRole).toBe('button');
    expect(flat(menu.props.style)).toMatchObject({ minWidth: tokens.target.min, minHeight: tokens.target.min });
    fireEvent.press(menu);
    expect(onPress).toHaveBeenCalled();
  });

  it('puts the sync pill and any extra actions on the right', () => {
    wrap(<ScreenHeader title="x" sync={{ state: 'pending', count: 2 }} right={<Text>extra</Text>} />);
    expect(screen.getByTestId('sync-pill')).toBeTruthy();
    expect(screen.getByText('extra')).toBeTruthy();
  });

  it('shows no pill while the status is still loading', () => {
    wrap(<ScreenHeader title="x" sync={null} />);
    expect(screen.queryByTestId('sync-pill')).toBeNull();
  });

  it('a Link back keeps its test id and name', () => {
    wrap(<ScreenHeader title="ที่ลบแล้ว" back={{ label: '← รายการ', testID: 'deleted-back', href: '/' }} />);
    expect(screen.getByTestId('deleted-back').props.accessibilityLabel).toBe('รายการ');
  });

  it('has no Save slot: a form\'s Save is the SaveBar at the foot (owner 2026-11-07, style I)', () => {
    wrap(<ScreenHeader title="x" sync={{ state: 'pending', count: 1 }} />);
    expect(screen.queryByText('บันทึก')).toBeNull();
  });
});

describe('SaveBar — the full-width pinned Save (owner 2026-11-07, style I)', () => {
  it('is full width, a 56 target, named, and fires onPress', () => {
    const onPress = jest.fn();
    wrap(<SaveBar action={{ label: 'บันทึก', onPress, testID: 'bar-save' }} />);
    const btn = screen.getByTestId('bar-save');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('บันทึก');
    expect(flat(btn.props.style)).toMatchObject({ alignSelf: 'stretch', minHeight: tokens.target.comfortable });
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled does not fire and says so', () => {
    const onPress = jest.fn();
    wrap(<SaveBar action={{ label: 'บันทึก', onPress, testID: 'bar-save', disabled: true }} />);
    const btn = screen.getByTestId('bar-save');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('saving shows the saving word (or savingLabel), is busy and does not fire', () => {
    const onPress = jest.fn();
    wrap(<SaveBar action={{ label: 'บันทึก · 300', savingLabel: 'กำลังบันทึก · 300', onPress, testID: 'bar-save', saving: true }} />);
    const btn = screen.getByTestId('bar-save');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(screen.getByText('กำลังบันทึก · 300')).toBeTruthy();
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ScreenHeader text', () => {
  it('a long title and subtitle wrap instead of being cut with "…" (AGENTS.md: no clipped content)', () => {
    wrap(<ScreenHeader title="บันทึกการคืน" subtitle="สวนครอบครัว" />);
    expect(screen.getByTestId('screen-title').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('สวนครอบครัว').props.numberOfLines).toBeUndefined();
  });

  it('E03-S08 TS-6: at L the title and subtitle get body leading (room for stacked Thai marks); M is unchanged', () => {
    const props = { title: 'สรุปจ่ายเงินและหักหนี้คนกรีดยางทั้งสวน', subtitle: 'การขาย 1 พ.ย. 2569', back: { label: '← กลับ', onPress: () => {} } };
    // M: exactly as before the story (owner 2026-11-02: no pixel change at the default).
    const m = wrap(<ScreenHeader {...props} />);
    expect(flat(screen.getByTestId('screen-title').props.style).lineHeight).toBe(tokens.font.size.headingLg * tokens.font.lineHeight.snug);
    expect(flat(screen.getByText(props.subtitle).props.style).lineHeight).toBeUndefined();
    m.unmount();

    stored.set('mon-farm:text-size', 'l');
    wrap(<ScreenHeader {...props} />);
    const title = screen.getByTestId('screen-title');
    const st = flat(title.props.style);
    expect(st.fontSize).toBe(23);
    expect(title.props.numberOfLines).toBeUndefined();
    expect(st.lineHeight).toBeGreaterThanOrEqual(st.fontSize * tokens.font.lineHeight.body);
    const sub = flat(screen.getByText(props.subtitle).props.style);
    expect(sub.lineHeight).toBeGreaterThanOrEqual(sub.fontSize * tokens.font.lineHeight.body);
  });
});
