/**
 * What the fertilizer flow offers to pick (E11-S10, approved simple design
 * 2026-10-23): products bought before, and reasons most used first.
 *
 * A "product" is type + formula + brand + sack size, read back from past
 * purchases — not a record of its own, so nothing new to sync. It is offered
 * only while its formula is a saved, shown option: "จำไว้ใช้ครั้งหน้า" saves
 * the formula, untick = this time only, and hiding the formula in ตั้งค่าปุ๋ย
 * takes the product off the list. A saved formula never bought yet is
 * offered after the bought ones, with nothing else filled.
 */

import type { Expense, FertOption } from './ledger';
import type { FertilizerType } from './types';

export interface FertProduct {
  readonly key: string;
  readonly type: FertilizerType;
  readonly formula: string;
  readonly brand: string;
  readonly sackKg: number | null;
  /** The bill per sack the last time it was bought; null when never bought. */
  readonly lastPerSackSatang: number | null;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

const newestFirst = (a: Expense, b: Expense) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? 1 : -1);

export function fertProducts(expenses: readonly Expense[], options: readonly FertOption[]): FertProduct[] {
  const saved = new Map(options.filter((o) => o.kind === 'formula' && !o.hidden).map((o) => [norm(o.name), o]));
  const out = new Map<string, FertProduct>();
  for (const x of [...expenses].filter((e) => !e.deleted && e.fertilizer).sort(newestFirst)) {
    const f = x.fertilizer!;
    if (!saved.has(norm(f.formula))) continue;
    const key = [f.type, norm(f.formula), norm(f.brand), f.sackKg ?? ''].join('|');
    if (out.has(key)) continue;
    const sacks = x.share?.totalSacks;
    out.set(key, {
      key,
      type: f.type,
      formula: f.formula.trim(),
      brand: f.brand.trim(),
      sackKg: f.sackKg,
      lastPerSackSatang: x.share && sacks ? Math.floor((2 * x.share.billSatang + sacks) / (2 * sacks)) : null,
    });
  }
  const bought = new Set([...out.values()].map((p) => norm(p.formula)));
  for (const [k, o] of saved) {
    if (bought.has(k)) continue;
    out.set(`option|${o.id}`, { key: `option|${o.id}`, type: 'chemical', formula: o.name, brand: '', sackKg: null, lastPerSackSatang: null });
  }
  return [...out.values()];
}

/** Shown reasons, the ones chosen on most live purchases first (ties by name). */
export function reasonsByUse(options: readonly FertOption[], expenses: readonly Expense[]): FertOption[] {
  const uses = new Map<string, number>();
  for (const x of expenses) {
    if (x.deleted || !x.fertilizer) continue;
    for (const r of new Set(x.fertilizer.reasons)) uses.set(r, (uses.get(r) ?? 0) + 1);
  }
  return options
    .filter((o) => o.kind === 'reason' && !o.hidden)
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'th'));
}
