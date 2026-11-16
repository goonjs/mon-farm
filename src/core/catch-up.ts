/**
 * Catching up from the paper (E04-S19): someone arrives late and enters the
 * baskets already weighed, point by point in weighing order, then counts
 * live. Contract only; the build follows the tests.
 */

import type { MasterState } from './master';
import type { NumberingMode, SaleEvent } from './types';

export interface CatchUpPoint {
  readonly pointId: string;
  /** The last basket number at this point, short or not ("จบที่เข่ง"). */
  readonly endNo: number;
  /** Net grams of that last basket when it was short; null = full. */
  readonly lastShortG: number | null;
  /** Grams added here to the basket the previous point left short; 0 = not topped up; null = not answered. */
  readonly topUpG: number | null;
}

export type CatchUpDraft =
  | { readonly kind: 'accept'; readonly pointId: string; readonly basketNo: number; readonly netG: number; readonly tareG: number; readonly partOf?: number }
  | { readonly kind: 'short'; readonly pointId: string; readonly basketNo: number; readonly netG: number; readonly tareG: number }
  | { readonly kind: 'close'; readonly root: number };

export type CatchUpRow =
  | { readonly kind: 'full'; readonly pointId: string; readonly from: number; readonly to: number; readonly count: number; readonly netG: number }
  | {
      readonly kind: 'short';
      readonly pointId: string;
      readonly basketNo: number;
      readonly firstG: number;
      readonly topUps: readonly { readonly pointId: string; readonly g: number }[];
      readonly netG: number;
      readonly status: 'full' | 'closed' | 'open';
    };

export interface CatchUpPlan {
  readonly drafts: readonly CatchUpDraft[];
  readonly rows: readonly CatchUpRow[];
  readonly totalG: number;
  readonly baskets: number;
  readonly lastNo: number;
}

export interface CatchUpOptions {
  readonly mode: NumberingMode;
  readonly firstNo: number;
  readonly stdNetG: number;
  readonly tareG: number;
}

export function catchUpPlan(_points: readonly CatchUpPoint[], _o: CatchUpOptions): CatchUpPlan | null {
  throw new Error('not built yet');
}

export function writeCatchUp(_drafts: readonly CatchUpDraft[], _append: (body: Record<string, unknown>) => string): void {
  throw new Error('not built yet');
}

export function catchUpAllowed(_events: readonly SaleEvent[], _master: MasterState, _day: string, _pointId: string, _mode: NumberingMode): boolean {
  throw new Error('not built yet');
}
