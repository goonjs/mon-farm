/**
 * Owner 2026-11-02 (E03-S10, same PR): the last thing on เครื่องนี้ is a small
 * way into the icon catalogue (/v2/dev/icons), set apart from the settings
 * above it — it only shows the icons, it changes nothing.
 */
import { screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SpeechProvider } from '../speech';
import { wrap } from '../test/render';
import { FarmMateArt } from '../ui';
import { V2Device } from '../v2/device-screen';

const links: string[] = [];
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    Link: ({ children, href }: { children: ReactNode; href: string }) => {
      links.push(href);
      return children;
    },
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => ({}),
    useRouter: () => router,
    router,
  };
});

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null, setItem: () => undefined },
});

it('ends with a view-only link to every icon in the app, under its own heading', () => {
  wrap(
    <SpeechProvider initial>
      <V2Device />
    </SpeechProvider>,
  );
  const row = screen.getByTestId('device-dev-icons');
  expect(screen.getByText('ดูอย่างเดียว')).toBeTruthy();
  expect(screen.getByText('ไอคอนทั้งหมดในแอป')).toBeTruthy();
  expect(screen.getByText('72 ไอคอน · เปิดดูเฉย ๆ ไม่เปลี่ยนการตั้งค่า')).toBeTruthy();
  // E03-S11: the sample on the link is drawn from the traced originals too.
  expect(screen.UNSAFE_getAllByType(FarmMateArt).map((a) => a.props.id)).toEqual(['nav.myFarm', 'sale.weigh', 'finance.income', 'people.tapper']);
  expect(row.props.accessibilityRole).toBe('button');
  expect(links).toContain('/v2/dev/icons');
});
