/**
 * The v2 route map (D-82): one entry per section of the v1.1.0 mockups
 * (docs/ux/mockups/flow-farm-v1.1.0.html). Every entry is a placeholder until
 * its screen is rebuilt; a real screen gets its own static route file, which
 * expo-router prefers over the dynamic one. The sale flow (flow-sale-v1.1.0)
 * is built: `SALE_START` and `saleHref` address it.
 */

import type { Href } from 'expo-router';

import type { MessageId } from '../i18n/messages';

export interface V2Section {
  readonly slug: string;
  readonly titleId: MessageId;
  readonly kind: 'farm' | 'sale';
}

const farm = (slug: string, titleId: MessageId): V2Section => ({ slug, titleId, kind: 'farm' });

/** Farm mockup sections, plus the sale list and sync screens, at /v2/<slug>. */
export const FARM_SECTIONS: readonly V2Section[] = [
  farm('farm', 'v2.farmData'),
  farm('people', 'v2.people'),
  farm('buyers', 'v2.buyers'),
  farm('accounts', 'v2.accounts'),
  farm('farms', 'v2.farms'),
  farm('points', 'v2.points'),
  farm('shares', 'v2.shares'),
  farm('sale-settings', 'saleSettings.title'),
  farm('expenses', 'v2.expenses'),
  farm('debts', 'v2.debts'),
  farm('device', 'v2.device'),
  farm('sales', 'v2.sales'),
  farm('sync', 'v2.sync'),
  // Home actions and modules with no screen yet (flow-v1 screen 3, v1.1.0 screen 25).
  farm('prepare', 'v2.prepare'),
  farm('reports', 'v2.reports'),
  farm('weather', 'v2.weather'),
  farm('payables', 'v2.payables'),
  farm('stock', 'v2.stock'),
];

/** เริ่มการขาย — the real start screen (sale mockup page 5). */
export const SALE_START = '/v2/sale/start' as Href;

/**
 * Where a sale opens from the home or the sale list: a closed one at its
 * payment, an open one at its counter (the point it was last weighing), or
 * the point picker when it has none yet.
 */
export function saleHref(id: string, at: { closed: boolean; point: string | null }): Href {
  if (at.closed) return `/v2/sale/${id}/payment` as Href;
  return (at.point ? `/v2/sale/${id}/counter?point=${at.point}` : `/v2/sale/${id}/point`) as Href;
}

/** Sections with their own route file; the rest render the placeholder. */
export const BUILT_SECTIONS: ReadonlySet<string> = new Set(['farm', 'people', 'buyers', 'farms', 'points', 'shares', 'sale-settings', 'expenses', 'debts', 'device', 'sales']);

export const V2_HOME = '/v2' as Href;

export function sectionHref(s: V2Section): Href {
  return (s.kind === 'sale' ? `/v2/sale/${s.slug}` : `/v2/${s.slug}`) as Href;
}

export function findSection(list: readonly V2Section[], slug: string | string[] | undefined): V2Section | undefined {
  return list.find((s) => s.slug === slug);
}

/** Lookup by slug for the drawer and home cards. */
export function farmSection(slug: string): V2Section {
  const s = findSection(FARM_SECTIONS, slug);
  if (!s) throw new Error(`unknown v2 section ${slug}`);
  return s;
}
