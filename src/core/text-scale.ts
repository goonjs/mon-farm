/**
 * Text size S / M / L (E03-S08, design-system §12.10 #5): every font size is
 * multiplied by the `textScale` token. The public counting numeral is not a
 * font-size token — it is sized from the viewport (`publicNumeral`) — so it
 * never scales with this setting, by construction.
 */

import { tokens } from '../../design/tokens';

export type TextSize = keyof typeof tokens.textScale;

export const TEXT_SCALE = tokens.textScale;

export function scaleSizes<K extends string>(sizes: Readonly<Record<K, number>>, size: TextSize): Record<K, number> {
  const k = TEXT_SCALE[size];
  return Object.fromEntries(Object.entries(sizes).map(([name, px]) => [name, Math.round((px as number) * k)])) as Record<K, number>;
}
