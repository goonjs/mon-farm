import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { V2Device } from './device-screen';
import { V2Home } from './home-screen';
import { Placeholder } from './placeholder-screen';
import { FARM_SECTIONS, SALE_STEPS, sectionHref } from './routes';
import { wrap } from '../test/render';

const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => mockRouter,
}));

describe('v2 route table (D-82) — one placeholder per v1.1.0 mockup section', () => {
  it('covers every farm-mockup section', () => {
    expect(FARM_SECTIONS.map((s) => s.slug)).toEqual(
      expect.arrayContaining(['farm', 'people', 'buyers', 'accounts', 'farms', 'points', 'shares', 'expenses', 'debts', 'sales', 'sync']),
    );
  });

  it('covers every sale-mockup step', () => {
    expect(SALE_STEPS.map((s) => s.slug)).toEqual([
      'start',
      'point',
      'zero-tare',
      'counter',
      'public',
      'partial',
      'backfill',
      'reconcile',
      'settlement',
      'rounding',
      'payment',
    ]);
  });

  it('slugs are unique and hrefs live under /v2', () => {
    const all = [...FARM_SECTIONS, ...SALE_STEPS];
    expect(new Set(all.map((s) => sectionHref(s))).size).toBe(all.length);
    expect(sectionHref(SALE_STEPS[0])).toBe('/v2/sale/start');
    expect(sectionHref(FARM_SECTIONS[0])).toMatch(/^\/v2\/[a-z-]+$/);
  });
});

describe('Placeholder screen', () => {
  it('is a ScreenHeader with back home plus a Thai "กำลังสร้าง" card', () => {
    wrap(<Placeholder titleId="v2.people" />);
    expect(screen.getByTestId('screen-title').props.children).toBe('คน');
    expect(screen.getByTestId('v2-back').props.accessibilityLabel).toBe('กลับ');
    expect(screen.getByText('กำลังสร้าง')).toBeTruthy();
  });

  it('back returns to where the user came from, or replaces with home on a cold open', () => {
    wrap(<Placeholder titleId="v2.people" />);
    fireEvent.press(screen.getByTestId('v2-back'));
    expect(mockRouter.back).toHaveBeenCalled();
    mockRouter.canGoBack.mockReturnValueOnce(false);
    fireEvent.press(screen.getByTestId('v2-back'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2');
  });
});

describe('V2Home — v1.1.0 card home with the ☰ drawer', () => {
  it('shows the card home and opens the menu from ☰', () => {
    wrap(<V2Home />);
    expect(screen.getByTestId('screen-title').props.children).toBe('หน้าแรก');
    expect(screen.getByText('เตรียมขาย')).toBeTruthy();
    expect(screen.getByTestId('home-sale-start')).toBeTruthy();
    expect(screen.queryByTestId('drawer')).toBeNull();
    fireEvent.press(screen.getByTestId('open-menu'));
    expect(screen.getByTestId('drawer')).toBeTruthy();
    expect(screen.getByText('ของกลุ่ม · ทุกเครื่องเห็นเหมือนกัน')).toBeTruthy();
    expect(screen.getByText('เฉพาะเครื่องนี้ · ไม่ส่งไปเครื่องอื่น')).toBeTruthy();
  });

  it('every farm section is reachable from the drawer or the home cards', () => {
    wrap(<V2Home />);
    fireEvent.press(screen.getByTestId('open-menu'));
    for (const s of FARM_SECTIONS) {
      expect(screen.queryAllByTestId(`nav-${s.slug}`).length).toBeGreaterThan(0);
    }
  });

  it('picking a menu item closes the drawer', () => {
    wrap(<V2Home />);
    fireEvent.press(screen.getByTestId('open-menu'));
    fireEvent.press(screen.getAllByTestId('nav-people')[0]);
    expect(screen.queryByTestId('drawer')).toBeNull();
  });
});

describe('V2Device — เครื่องนี้ holds the theme choice (device-only)', () => {
  it('switches light/dark through the shared theme, as a radio group', () => {
    wrap(<V2Device />);
    expect(screen.getByTestId('screen-title').props.children).toBe('เครื่องนี้');
    expect(screen.getByTestId('device-theme-light').props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getByTestId('device-theme-dark'));
    expect(screen.getByTestId('device-theme-dark').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('กำลังสร้าง')).toBeTruthy();
  });
});
