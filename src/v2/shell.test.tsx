import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

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

  it('has a placeholder for each home module not built yet (flow-v1 screen 3, v1.1.0 screen 25)', () => {
    expect(FARM_SECTIONS.map((s) => s.slug)).toEqual(
      expect.arrayContaining(['prepare', 'reports', 'weather', 'payables', 'stock']),
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
