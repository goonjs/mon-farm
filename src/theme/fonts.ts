/**
 * E01-S13 — Noto Sans Thai, embedded (SIL OFL 1.1; licence in
 * assets/fonts/OFL.txt). Loaded from the app bundle, never from the network,
 * so it works in airplane mode at the farm.
 *
 * One family per weight, because on Android a `fontFamily` names one font
 * file: `fontWeight: '700'` on the regular face would be synthesised (faux
 * bold), not the real cut. So styles ask for a weight via `face()` and get
 * that weight's own family. Only the weights `tokens.font.weight` uses are
 * embedded — each one is a few hundred KB.
 */

// Per-weight entry points, not the package index: the index `require`s all
// nine weights, which would bundle the four this app never uses.
import { NotoSansThai_400Regular } from '@expo-google-fonts/noto-sans-thai/400Regular';
import { NotoSansThai_500Medium } from '@expo-google-fonts/noto-sans-thai/500Medium';
import { NotoSansThai_600SemiBold } from '@expo-google-fonts/noto-sans-thai/600SemiBold';
import { NotoSansThai_700Bold } from '@expo-google-fonts/noto-sans-thai/700Bold';
import { NotoSansThai_800ExtraBold } from '@expo-google-fonts/noto-sans-thai/800ExtraBold';

import type { tokens } from '../../design/tokens';

export type FontWeight = (typeof tokens.font.weight)[keyof typeof tokens.font.weight];

export const FONT_FACES: Record<FontWeight, string> = {
  '400': 'NotoSansThai_400Regular',
  '500': 'NotoSansThai_500Medium',
  '600': 'NotoSansThai_600SemiBold',
  '700': 'NotoSansThai_700Bold',
  '800': 'NotoSansThai_800ExtraBold',
};

export const fontAssets = {
  NotoSansThai_400Regular,
  NotoSansThai_500Medium,
  NotoSansThai_600SemiBold,
  NotoSansThai_700Bold,
  NotoSansThai_800ExtraBold,
};

/** The text style for a weight: its own family, and deliberately no `fontWeight`. */
export function face(weight: FontWeight): { fontFamily: string } {
  return { fontFamily: FONT_FACES[weight] };
}
