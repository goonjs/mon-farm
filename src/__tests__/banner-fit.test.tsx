/**
 * E03-S08 TS-7: the icon column of a Banner never makes its icon stick out.
 * It was a fixed 16 px box: any icon wider than that (or the "?" at a large
 * text size) spilled past it (E05-S11 measured 2 px). The column now grows
 * to its icon and to the first line of the title.
 */
import { screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { View } from 'react-native';

import { Banner } from '../v2/sale/pieces';
import { wrap } from '../test/render';

jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => children, useRouter: () => ({}) }));

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
/** The banner's hidden icon column: the nearest aria-hidden ancestor. */
const columnOf = (el: ReactTestInstance) => {
  let p = el.parent;
  while (p && p.props['aria-hidden'] !== true) p = p.parent;
  return flat(p?.props.style);
};

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v) },
});
beforeEach(() => stored.clear());

const iconBanner = () => <Banner tone="bad" icon={() => <View testID="banner-icon" style={{ width: 18, height: 18 }} />} title="หักหนี้ซ้ำจาก 2 เครื่อง" lines={['ตรวจก่อน']} testID="b" />;

it('at L the icon column has no fixed width: an 18 px icon fits inside it', () => {
  stored.set('mon-farm:text-size', 'l');
  wrap(iconBanner());
  const column = columnOf(screen.getByTestId('banner-icon', { includeHiddenElements: true }));
  expect(column.width).toBeUndefined();
  expect(column.minWidth).toBeGreaterThanOrEqual(16);
});

it('at L the "?" of an info band sits in the same growing column', () => {
  stored.set('mon-farm:text-size', 'l');
  wrap(<Banner lines={['รายการขายทั้งหมด']} testID="b" />);
  expect(columnOf(screen.getByText('?', { includeHiddenElements: true })).width).toBeUndefined();
});

it('at M the column is the original 16 px box, pixel for pixel (owner 2026-11-02)', () => {
  wrap(iconBanner());
  expect(columnOf(screen.getByTestId('banner-icon', { includeHiddenElements: true }))).toEqual({ width: 16, alignItems: 'center', paddingTop: 2 });
});
