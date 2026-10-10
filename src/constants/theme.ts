/**
 * Expo-template colour names, kept so the template components that use
 * `Colors` / `ThemeColor` need no change. The values are semantic roles from
 * design/tokens.ts (E01-S17) — no raw colour lives in src/.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { tokens } from '../../design/tokens';

const template = (c: (typeof tokens.color)['light']) => ({
  text: c.ink,
  background: c.surface,
  backgroundElement: c.surfaceSunk,
  backgroundSelected: c.actionSunk,
  textSecondary: c.inkSoft,
  link: c.action,
});

export const Colors = {
  light: template(tokens.color.light),
  dark: template(tokens.color.dark),
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
