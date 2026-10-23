/**
 * Renders one icon from the FarmMate set by id. Decorative like every icon
 * in `ui/icons.tsx` — hidden from screen readers; the control around it
 * carries the accessible name.
 */

import { Svg } from 'react-native-svg';

import { FARMMATE_ICON_VIEWBOX, getFarmMateIcon } from './registry';
import { useTheme } from '../../theme';

export function FarmMateIcon({ id, size = 32 }: { id: string; size?: number }) {
  const theme = useTheme();
  const def = getFarmMateIcon(id);
  if (!def) return null;
  return (
    <Svg
      aria-hidden
      width={size}
      height={size}
      viewBox={`0 0 ${FARMMATE_ICON_VIEWBOX} ${FARMMATE_ICON_VIEWBOX}`}
    >
      {def.Render(theme)}
    </Svg>
  );
}
