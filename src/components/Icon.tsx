import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';

/**
 * The app's one line-icon set (E01-S13, design-system §12.10 #11): Feather,
 * MIT, shipped as a font inside the app bundle — no network needed.
 *
 * `label` decides whether the icon means something on its own. With a label
 * it is announced in Thai; without one it is decoration beside text that
 * already says the same thing, and is hidden from screen readers.
 */
export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({
  name,
  label,
  size,
  color,
  testID,
}: {
  name: IconName;
  label?: string;
  size?: number;
  color?: string;
  testID?: string;
}) {
  const t = useTheme();
  // The label lives on a wrapper, not on the glyph: the icon font renders an
  // empty placeholder until it has loaded, and the meaning must not wait for it.
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : {
        accessible: false,
        importantForAccessibility: 'no-hide-descendants' as const,
        accessibilityElementsHidden: true,
        'aria-hidden': true,
      };
  return (
    <View testID={testID} {...a11y}>
      <Feather name={name} size={size ?? t.font.size.body * 1.25} color={color ?? t.color.ink} />
    </View>
  );
}
