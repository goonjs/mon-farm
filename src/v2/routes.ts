/**
 * The v2 route map (D-82): one entry per section of the v1.1.0 mockups
 * (docs/ux/mockups/flow-farm-v1.1.0.html, flow-sale-v1.1.0.html). Every entry
 * is a placeholder until its screen is rebuilt; a real screen later gets its
 * own static route file, which expo-router prefers over the dynamic one.
 */

import type { Href } from 'expo-router';

import type { MessageId } from '../i18n/messages';

export interface V2Section {
  readonly slug: string;
  readonly titleId: MessageId;
  readonly kind: 'farm' | 'sale';
}

const farm = (slug: string, titleId: MessageId): V2Section => ({ slug, titleId, kind: 'farm' });
const sale = (slug: string, titleId: MessageId): V2Section => ({ slug, titleId, kind: 'sale' });

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
];

/** Sale mockup steps, in flow order, at /v2/sale/<slug>. */
export const SALE_STEPS: readonly V2Section[] = [
  sale('start', 'v2.saleStart'),
  sale('point', 'v2.salePoint'),
  sale('zero-tare', 'v2.saleZeroTare'),
  sale('counter', 'v2.saleCounter'),
  sale('public', 'v2.salePublic'),
  sale('partial', 'v2.salePartial'),
  sale('backfill', 'v2.saleBackfill'),
  sale('reconcile', 'v2.saleReconcile'),
  sale('settlement', 'v2.saleSettlement'),
  sale('rounding', 'v2.saleRounding'),
  sale('payment', 'v2.salePayment'),
];

/** Sections with their own route file; the rest render the placeholder. */
export const BUILT_SECTIONS: ReadonlySet<string> = new Set(['farm', 'people', 'buyers', 'farms', 'points', 'shares', 'sale-settings', 'expenses', 'debts', 'device', 'sales', 'sale/start']);

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
