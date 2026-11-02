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

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { tokens, type ColorName, type ColorScheme } from '../../design/tokens';
import { TEXT_SCALE, scaleSizes, type TextSize } from '../core/text-scale';
import { deviceSettings } from '../store/device-settings';
import { readTextSize, writeTextSize } from './text-size-preference';

export type { TextSize };

/**
 * `Record<ColorName, string>`, not `typeof tokens.color.light`.
 *
 * The token file is `as const`, so the light palette's type is its literal hex
 * values — which makes the dark palette not assignable to it. What callers
 * actually need is "the same set of names, resolving to some colour".
 */
export type Palette = Record<ColorName, string>;

/** Font tokens with the sizes already multiplied by the device text size (E03-S08). */
export type FontTokens = Omit<typeof tokens.font, 'size'> & {
  readonly size: Readonly<Record<keyof typeof tokens.font.size, number>>;
};

export interface Theme {
  readonly scheme: ColorScheme;
  readonly color: Palette;
  readonly space: typeof tokens.space;
  readonly radius: typeof tokens.radius;
  readonly border: typeof tokens.border;
  readonly font: FontTokens;
  /**
   * The text size multiplier (0.875 / 1 / 1.125). Only for a size that is not
   * a font token; never for the public numeral, which is sized from the screen.
   */
  readonly textScale: number;
  readonly duration: typeof tokens.duration;
  readonly target: typeof tokens.target;
  readonly publicNumeral: typeof tokens.publicNumeral;
  readonly bezel: typeof tokens.bezel;
  readonly opacity: typeof tokens.opacity;
  readonly shadow: typeof tokens.shadow;
  readonly layout: typeof tokens.layout;
}

function themeFor(scheme: ColorScheme, textSize: TextSize): Theme {
  return {
    scheme,
    color: tokens.color[scheme],
    space: tokens.space,
    radius: tokens.radius,
    border: tokens.border,
    font: { ...tokens.font, size: scaleSizes(tokens.font.size, textSize) },
    textScale: TEXT_SCALE[textSize],
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
  /** This device's text size (E03-S08); setting it is remembered on the device. */
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
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
  // Native reads the stored size in the first render; web reads it after
  // mount, as the language and speech providers do (E01-S19 DS-4: the web
  // build static-renders, so the first client render must match the HTML).
  const [textSize, setTextSizeState] = useState<TextSize>(() =>
    deviceSettings.readDuringRender ? (readTextSize() ?? 'm') : 'm',
  );
  useEffect(() => {
    if (deviceSettings.readDuringRender) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const stored = readTextSize();
      if (stored !== null) setTextSizeState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size);
    writeTextSize(size);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: themeFor(scheme, textSize),
      scheme,
      setScheme,
      toggle: () => setScheme((s) => (s === 'light' ? 'dark' : 'light')),
      textSize,
      setTextSize,
    }),
    [scheme, textSize, setTextSize],
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
