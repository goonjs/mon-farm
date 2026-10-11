import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { Placeholder } from './placeholder-screen';
import { FARM_SECTIONS, SALE_START, saleHref, sectionHref } from './routes';
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

  it('has a placeholder for each home module not built yet (flow-v1 screen 3, v1.1.0 screen 25)', () => {
    expect(FARM_SECTIONS.map((s) => s.slug)).toEqual(
      expect.arrayContaining(['prepare', 'reports', 'weather', 'payables', 'stock']),
    );
  });

  it('the sale flow is real screens: start, and each sale resumes where it stands', () => {
    expect(SALE_START).toBe('/v2/sale/start');
    expect(saleHref('s1', { closed: false, point: 'p1' })).toBe('/v2/sale/s1/counter?point=p1');
    expect(saleHref('s1', { closed: false, point: null })).toBe('/v2/sale/s1/point');
    expect(saleHref('s1', { closed: true, point: 'p1' })).toBe('/v2/sale/s1/payment');
  });

  it('slugs are unique and hrefs live under /v2', () => {
    expect(new Set(FARM_SECTIONS.map((s) => sectionHref(s))).size).toBe(FARM_SECTIONS.length);
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
