/**
 * The two ways to say one short-basket weight (E04-S16): what the scale reads
 * (basket included) or the net rubber. `offsetKg` is everything on the scale
 * that is not new rubber — the basket, the scale's skew, and on a top-up the
 * rubber already in the basket. Pure; the screen only picks which side the
 * person types or drags.
 */

/** Float noise off: weights are kept to the gram. */
const round = (n: number) => Math.round(n * 1000) / 1000;

export const netFromReading = (readingKg: number, offsetKg: number): number => round(readingKg - offsetKg);

export const readingFromNet = (netKg: number, offsetKg: number): number => round(netKg + offsetKg);

/** A typed weight: digits and at most one point. Anything else (or nothing) is no weight. */
export function parseKg(text: string): number | null {
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** A computed weight as a field shows it: "47", "47.5", "-3". */
export const fieldKg = (kg: number): string => String(round(kg));
