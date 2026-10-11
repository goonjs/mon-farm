/**
 * Settlement (FR-7, FR-8).
 *
 * MVP SCOPE: straight ฿/kg pricing. %DRC / grade deduction (FR-2.5) and
 * adjustments (FR-7.3) are deliberately out of scope — see
 * `docs/epics/epic-1-run-and-settle-one-sale.md`. The `SettlementStep[]` shape
 * leaves room for both later without changing any caller.
 *
 * Workers ARE per zone (FR-8.6): each zone resolves its own owner/worker split
 * from a `zone_contract_set` event, falling back to the sale-level
 * `split_set` default when a zone has none of its own. The split is always
 * on gross (D-12).
 *
 * FR-7.4 forbids a single opaque total, so this returns the DERIVATION, not
 * just the number. Each step is one arithmetic operation, rendered verbatim on
 * screen, so a disagreement can be localised to a step rather than to "the
 * app".
 */

import { saleTotals, zoneTotals } from './totals';
import type { PersonId, SaleEvent, SaleState, Totals, ZoneId } from './types';

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
  /** null when the zone has no contract of its own and used the sale default. */
  readonly personId: PersonId | null;
  readonly workerName: string | null;
  /** The percentage actually applied, after fallback. */
  readonly ownerPct: number;
  /** True when this zone had no contract of its own. */
  readonly fromSaleDefault: boolean;
  readonly totals: Totals;
  readonly grossSatang: number;
  readonly ownerSatang: number;
  readonly workerSatang: number;
}

/** One worker's total across every zone with a contract naming them. */
export interface WorkerSettlement {
  readonly personId: PersonId;
  readonly workerName: string;
  readonly zoneIds: readonly ZoneId[];
  /** The share, per the zone contract(s) naming this worker. */
  readonly workerSatang: number;
}

export interface Settlement {
  readonly totals: Totals;
  readonly satangPerKg: number;
  readonly grossSatang: number;
  readonly ownerSatang: number;
  readonly workerSatang: number;
  readonly perZone: readonly ZoneSettlement[];
  /** Grouped by personId. Zones that fell back to the sale default are excluded — no worker was named to attribute them to. */
  readonly perWorker: readonly WorkerSettlement[];
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
 * The same rule applies one level down to each zone's own split: the worker
 * takes the remainder of that zone's gross, so owner + worker is exactly
 * gross for every zone regardless of what the percentage does to the last
 * satang.
 */
export function settle(events: readonly SaleEvent[], state: SaleState): Settlement {
  if (!state.price) {
    throw new SettlementUnavailable(
      'No agreed price. A sale cannot be settled against a price nobody recorded.',
    );
  }

  const { satangPerKg } = state.price;
  const totals = saleTotals(events);

  const perZone: ZoneSettlement[] = state.zones.map((zone) => {
    // FR-8.5: no safe default. A zone with neither its own contract nor a
    // sale-level fallback cannot be settled — refusing here is what keeps
    // that rule true per zone, not just per sale.
    const ownerPct = zone.contract?.ownerPct ?? state.split?.ownerPct;
    if (ownerPct === undefined) {
      throw new SettlementUnavailable(
        `${zone.name} has no split — no zone contract and no sale default. ` +
          `FR-8.5: guessing whose share applies to what is exactly the ` +
          `assumption this app exists to remove.`,
      );
    }

    const zt = zoneTotals(events, state, zone.id);
    const grossSatang = valueOf(zt.netG, satangPerKg);
    const ownerSatang = Math.round((grossSatang * ownerPct) / 100);

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      personId: zone.contract?.personId ?? null,
      workerName: zone.contract?.workerName ?? null,
      ownerPct,
      fromSaleDefault: !zone.contract,
      totals: zt,
      grossSatang,
      ownerSatang,
      workerSatang: grossSatang - ownerSatang,
    };
  });

  const grossSatang = perZone.reduce((sum, z) => sum + z.grossSatang, 0);
  const ownerSatang = perZone.reduce((sum, z) => sum + z.ownerSatang, 0);
  const workerSatang = perZone.reduce((sum, z) => sum + z.workerSatang, 0);

  // Grouped so a worker paid from two zones sees one number, without losing
  // the per-zone rows that make each contribution checkable by hand.
  const byWorker = new Map<PersonId, { workerName: string; zoneIds: ZoneId[]; workerSatang: number }>();
  for (const z of perZone) {
    if (!z.personId) continue; // no worker was named; nothing to group under
    const entry = byWorker.get(z.personId) ?? { workerName: z.workerName ?? '', zoneIds: [], workerSatang: 0 };
    entry.zoneIds.push(z.zoneId);
    entry.workerSatang += z.workerSatang;
    byWorker.set(z.personId, entry);
  }
  const perWorker: WorkerSettlement[] = [...byWorker.entries()].map(([personId, w]) => ({
    personId,
    workerName: w.workerName,
    zoneIds: w.zoneIds,
    workerSatang: w.workerSatang,
  }));

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
      thai: `${totals.shortBaskets} เข่งไม่เต็ม — ชั่งได้ลบตะกร้า`,
      english: `${totals.shortBaskets} short baskets — reading minus tare`,
      value: `${kg(totals.shortNetG)} กก.`,
    },
    {
      key: 'net-weight',
      thai: 'น้ำหนักยางสุทธิ — หักตะกร้าแล้วทุกเข่ง',
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
    // No single owner/worker step here — the split varies per zone now.
    // perZone and perWorker (below) carry that breakdown, each zone showing
    // its own percentage rather than one figure standing in for all of them.
  ];

  return {
    totals,
    satangPerKg,
    grossSatang,
    ownerSatang,
    workerSatang,
    perZone,
    perWorker,
    steps,
  };
}

export const formatKg = kg;
export const formatBaht = baht;
