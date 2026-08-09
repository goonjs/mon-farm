/**
 * Settlement (FR-7, FR-8).
 *
 * MVP SCOPE: straight ฿/kg and ONE owner/worker split for the whole sale.
 * %DRC / grade deduction (FR-2.5), adjustments (FR-7.3) and per-zone contracts
 * (FR-8.6) are deliberately out of scope — see
 * `docs/epics/epic-1-run-and-settle-one-sale.md`. The `SettlementStep[]` shape
 * leaves room for all three later without changing any caller.
 *
 * FR-7.4 forbids a single opaque total, so this returns the DERIVATION, not
 * just the number. Each step is one arithmetic operation, rendered verbatim on
 * screen, so a disagreement can be localised to a step rather than to "the
 * app".
 */

import { saleTotals, zoneTotals } from './totals';
import type { SaleEvent, SaleState, Totals, ZoneId } from './types';

export interface SettlementStep {
  /** Machine-readable, for tests and for the announced register. */
  readonly key: string;
  readonly thai: string;
  readonly english: string;
  /** Already formatted for display. */
  readonly value: string;
}

export interface ZoneSettlement {
  readonly zoneId: ZoneId;
  readonly zoneName: string;
  readonly totals: Totals;
  readonly grossSatang: number;
  readonly ownerSatang: number;
  readonly workerSatang: number;
}

export interface Settlement {
  readonly totals: Totals;
  readonly satangPerKg: number;
  readonly ownerPct: number;
  readonly grossSatang: number;
  readonly ownerSatang: number;
  readonly workerSatang: number;
  readonly perZone: readonly ZoneSettlement[];
  readonly steps: readonly SettlementStep[];
}

export class SettlementUnavailable extends Error {}

/** grams × satang/kg → satang. Rounded once, here, and nowhere else. */
function valueOf(netG: number, satangPerKg: number): number {
  return Math.round((netG * satangPerKg) / 1000);
}

const kg = (g: number) =>
  (g / 1000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const baht = (satang: number) =>
  '฿ ' +
  (satang / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * ROUNDING RULE, stated because it is the classic bug in this shape of code:
 *
 * Each zone's gross is computed from that zone's own net weight and rounded
 * once; the sale gross is the SUM of those. The sale gross is never computed
 * independently and then apportioned back to zones.
 *
 * The reason is social, not numerical. The per-zone figures are printed on the
 * same screen as the total, in front of two people with a calculator. If they
 * do not add up exactly, the discrepancy is not read as a rounding artefact —
 * it is read as the app being wrong about money, and every other number on the
 * screen loses its credibility with it.
 *
 * The same rule applies one level down to the split.
 */
export function settle(events: readonly SaleEvent[], state: SaleState): Settlement {
  if (!state.price) {
    throw new SettlementUnavailable(
      'No agreed price. A sale cannot be settled against a price nobody recorded.',
    );
  }
  if (!state.split) {
    throw new SettlementUnavailable(
      'No split recorded. FR-8.5: the basis has no safe default — guessing whose ' +
        'share applies to what is exactly the assumption this app exists to remove.',
    );
  }

  const { satangPerKg } = state.price;
  const { ownerPct } = state.split;
  const totals = saleTotals(events);

  const perZone: ZoneSettlement[] = state.zones.map((zone) => {
    const zt = zoneTotals(events, state, zone.id);
    const grossSatang = valueOf(zt.netG, satangPerKg);
    const ownerSatang = Math.round((grossSatang * ownerPct) / 100);
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      totals: zt,
      grossSatang,
      // The worker takes the remainder, so owner + worker is exactly gross for
      // every zone, whatever the percentage does to the last satang.
      ownerSatang,
      workerSatang: grossSatang - ownerSatang,
    };
  });

  const grossSatang = perZone.reduce((sum, z) => sum + z.grossSatang, 0);
  const ownerSatang = perZone.reduce((sum, z) => sum + z.ownerSatang, 0);
  const workerSatang = perZone.reduce((sum, z) => sum + z.workerSatang, 0);

  const steps: SettlementStep[] = [
    {
      key: 'baskets',
      thai: `${totals.baskets} เข่ง — ${totals.standardBaskets} มาตรฐาน + ${totals.shortBaskets} ไม่เต็ม`,
      english: `${totals.baskets} baskets — ${totals.standardBaskets} standard + ${totals.shortBaskets} short`,
      value: String(totals.baskets),
    },
    {
      key: 'standard-weight',
      thai: `${totals.standardBaskets} เข่งมาตรฐาน`,
      english: `${totals.standardBaskets} standard baskets`,
      value: `${kg(totals.standardNetG)} กก.`,
    },
    {
      key: 'short-weight',
      thai: `${totals.shortBaskets} เข่งไม่เต็ม — ชั่งได้ลบถัง`,
      english: `${totals.shortBaskets} short baskets — reading minus tare`,
      value: `${kg(totals.shortNetG)} กก.`,
    },
    {
      key: 'net-weight',
      thai: 'น้ำหนักยางสุทธิ — หักถังแล้วทุกเข่ง',
      english: 'net rubber — tare deducted from every basket',
      value: `${kg(totals.netG)} กก.`,
    },
    {
      key: 'price',
      thai: `× ${baht(satangPerKg)} ต่อ กก. — ตกลงกันก่อนเริ่ม`,
      english: `× ${baht(satangPerKg)} per kg — agreed before the first basket`,
      value: baht(grossSatang),
    },
    {
      key: 'gross',
      thai: 'ยอดรวม',
      english: 'total',
      value: baht(grossSatang),
    },
    {
      key: 'owner',
      thai: `เจ้าของ ${ownerPct}%`,
      english: `owner ${ownerPct}%`,
      value: baht(ownerSatang),
    },
    {
      key: 'worker',
      thai: `คนงาน ${100 - ownerPct}%`,
      english: `worker ${100 - ownerPct}%`,
      value: baht(workerSatang),
    },
  ];

  return {
    totals,
    satangPerKg,
    ownerPct,
    grossSatang,
    ownerSatang,
    workerSatang,
    perZone,
    steps,
  };
}

export const formatKg = kg;
export const formatBaht = baht;
