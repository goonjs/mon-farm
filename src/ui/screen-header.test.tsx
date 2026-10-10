import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ScreenHeader } from './screen-header';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

// expo-router ships ESM outside jest's transformIgnorePatterns (same stub as
// the screen tests); only <Link> is used here.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

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

  describe('action slot (Save in the top-right corner)', () => {
    it('renders right of the sync pill, named, and fires onPress', () => {
      const onPress = jest.fn();
      wrap(<ScreenHeader title="x" sync={{ state: 'pending', count: 1 }} action={{ label: 'บันทึก', onPress, testID: 'hdr-save' }} />);
      const btn = screen.getByTestId('hdr-save');
      expect(btn.props.accessibilityRole).toBe('button');
      expect(btn.props.accessibilityLabel).toBe('บันทึก');
      expect(flat(btn.props.style).minHeight).toBeGreaterThanOrEqual(tokens.target.min);
      const row = screen.getByTestId('screen-header');
      const kids = [row.props.children].flat(Infinity).filter(Boolean);
      const pillIdx = kids.findIndex((k: any) => k?.props?.status !== undefined);
      const actionIdx = kids.findIndex((k: any) => k?.props?.action?.testID === 'hdr-save');
      expect(pillIdx).toBeGreaterThan(-1);
      expect(actionIdx).toBeGreaterThan(pillIdx);
      fireEvent.press(btn);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('disabled does not fire and says so', () => {
      const onPress = jest.fn();
      wrap(<ScreenHeader title="x" action={{ label: 'บันทึก', onPress, testID: 'hdr-save', disabled: true }} />);
      const btn = screen.getByTestId('hdr-save');
      expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
      fireEvent.press(btn);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('saving shows the saving word, is busy and does not fire', () => {
      const onPress = jest.fn();
      wrap(<ScreenHeader title="x" action={{ label: 'บันทึก', onPress, testID: 'hdr-save', saving: true }} />);
      const btn = screen.getByTestId('hdr-save');
      expect(btn.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
      expect(screen.getByText('กำลังบันทึก')).toBeTruthy();
      fireEvent.press(btn);
      expect(onPress).not.toHaveBeenCalled();
    });
  });
});
