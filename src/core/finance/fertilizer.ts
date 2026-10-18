/**
 * The fertilizer purchase's own details (E11-S10 C, FERT-1): checks on what
 * the flow stores beside the share. No money here — the split is
 * `share.ts`; this is the "what, why and where" kept for tracking.
 *
 * A reason is a saved option's id (`fertOptionId('reason', name)`), or a
 * reason typed for this purchase only, stored as `text:<what was typed>`.
 */

import type { FertOption } from './ledger';
import type { FertilizerDetails } from './types';

export const TYPED_REASON = 'text:';

export type FertilizerProblem = 'formula-required' | 'sack-kg-invalid' | 'zone-sacks-not-whole' | 'zones-over' | 'zone-reason-unknown';

export function checkFertilizer(f: FertilizerDetails, totalSacks: number): FertilizerProblem[] {
  const out: FertilizerProblem[] = [];
  if (!f.formula.trim()) out.push('formula-required');
  if (f.sackKg !== null && !(f.sackKg > 0)) out.push('sack-kg-invalid');
  if (f.zones.some((z) => !Number.isSafeInteger(z.sacks) || z.sacks < 0)) out.push('zone-sacks-not-whole');
  else if (f.zones.reduce((s, z) => s + z.sacks, 0) > totalSacks) out.push('zones-over');
  const chosen = new Set(f.reasons);
  if (f.zones.some((z) => z.reasons.some((r) => !chosen.has(r)))) out.push('zone-reason-unknown');
  return out;
}

/** What a stored reason reads as: a saved one's current name (hidden ones too), else the text. */
export function reasonLabel(reason: string, options: readonly FertOption[]): string {
  if (reason.startsWith(TYPED_REASON)) return reason.slice(TYPED_REASON.length);
  return options.find((o) => o.id === reason)?.name ?? reason.replace(/^fopt-reason-/, '');
}
