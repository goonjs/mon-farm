/**
 * One traced FarmMate original ("ตัวสวย", design/icons/farmmate/<id>.svg),
 * drawn from the generated design/icons/farmmate-masters.ts (E03-S11, owner
 * 2026-11-03: the whole app uses these, not the simplified redraw in
 * registry.tsx). The colours are the originals' own; they do not follow the
 * theme (dark theme comes later, after every screen uses this set).
 *
 * Decorative like every icon in `ui/icons.tsx` — hidden from screen readers;
 * the control around it carries the accessible name.
 */

import { SvgXml } from 'react-native-svg';

import { FARMMATE_MASTERS } from '../../../design/icons/farmmate-masters';

export function FarmMateArt({ id, size = 32 }: { id: string; size?: number }) {
  const xml = FARMMATE_MASTERS[id];
  if (!xml) return null;
  return <SvgXml aria-hidden xml={xml} width={size} height={size} />;
}
