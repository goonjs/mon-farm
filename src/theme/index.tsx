/**
 * Theme access for React Native / react-native-web.
 *
 * Reads the same `design/tokens.ts` that generates `docs/ux/tokens.css`, so the
 * app and the design prototypes cannot drift — CI fails the build if the
 * generated CSS is stale relative to the source.
 *
 * Light is the default and is not merely a preference: F-15 found that phone
 * displays are additive, so dark-ink-on-white at full brightness is the
 * brightest thing a phone can show in direct sun, which is the condition the
 * counter screen exists for.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { tokens, type ColorName, type ColorScheme } from '../../design/tokens';

/**
 * `Record<ColorName, string>`, not `typeof tokens.color.light`.
 *
 * The token file is `as const`, so the light palette's type is its literal hex
 * values — which makes the dark palette not assignable to it. What callers
 * actually need is "the same set of names, resolving to some colour".
 */
export type Palette = Record<ColorName, string>;

export interface Theme {
  readonly scheme: ColorScheme;
  readonly color: Palette;
  readonly space: typeof tokens.space;
  readonly radius: typeof tokens.radius;
  readonly border: typeof tokens.border;
  readonly font: typeof tokens.font;
  readonly duration: typeof tokens.duration;
  readonly target: typeof tokens.target;
  readonly publicNumeral: typeof tokens.publicNumeral;
  readonly bezel: typeof tokens.bezel;
  readonly opacity: typeof tokens.opacity;
  readonly shadow: typeof tokens.shadow;
  readonly layout: typeof tokens.layout;
}

function themeFor(scheme: ColorScheme): Theme {
  return {
    scheme,
    color: tokens.color[scheme],
    space: tokens.space,
    radius: tokens.radius,
    border: tokens.border,
    font: tokens.font,
    duration: tokens.duration,
    target: tokens.target,
    publicNumeral: tokens.publicNumeral,
    bezel: tokens.bezel,
    opacity: tokens.opacity,
    shadow: tokens.shadow,
    layout: tokens.layout,
  };
}

interface ThemeContextValue {
  theme: Theme;
  scheme: ColorScheme;
  setScheme: (s: ColorScheme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initial = 'light',
}: {
  children: ReactNode;
  initial?: ColorScheme;
}) {
  const [scheme, setScheme] = useState<ColorScheme>(initial);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: themeFor(scheme),
      scheme,
      setScheme,
      toggle: () => setScheme((s) => (s === 'light' ? 'dark' : 'light')),
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx.theme;
}

export function useThemeControls(): Omit<ThemeContextValue, 'theme'> {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeControls must be used inside <ThemeProvider>');
  const { theme: _theme, ...rest } = ctx;
  return rest;
}

export { tokens };
