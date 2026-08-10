/**
 * The hold indicator: a stroke travelling the stage perimeter.
 *
 * Built from four plain Views rather than SVG. react-native-svg is not a
 * dependency, and adding one for a rectangle would be a poor trade — four
 * absolutely-positioned bars work identically on iOS, Android and web with
 * nothing extra in the bundle for a low-end Android to parse (NFR-4).
 *
 * Progress is distributed along the real perimeter, so the stroke moves at a
 * constant speed rather than spending equal time on the short and long edges —
 * which is what makes it read as travel rather than as four separate bars.
 */

import { View } from 'react-native';

import { useTheme } from '../theme';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function Bezel({
  pct,
  width,
  height,
  rejected = false,
}: {
  /** 0 → 1. */
  pct: number;
  width: number;
  height: number;
  rejected?: boolean;
}) {
  const t = useTheme();
  const w = t.bezel.width;
  const colour = rejected ? t.color.reject : t.color.accept;

  // Travelled distance, in the same units as the box.
  const d = clamp(pct, 0, 1) * (2 * (width + height));

  const top = clamp(d, 0, width);
  const right = clamp(d - width, 0, height);
  const bottom = clamp(d - width - height, 0, width);
  const left = clamp(d - 2 * width - height, 0, height);

  const track = { position: 'absolute', backgroundColor: t.color.ruleFaint } as const;
  const fill = { position: 'absolute', backgroundColor: colour } as const;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {/* Idle track — frames the stage like an instrument bezel even at rest. */}
      <View style={[track, { left: 0, top: 0, right: 0, height: w }]} />
      <View style={[track, { right: 0, top: 0, bottom: 0, width: w }]} />
      <View style={[track, { left: 0, bottom: 0, right: 0, height: w }]} />
      <View style={[track, { left: 0, top: 0, bottom: 0, width: w }]} />

      {/* Fill, in travel order: top → right → bottom → left. */}
      <View style={[fill, { left: 0, top: 0, width: top, height: w }]} />
      <View style={[fill, { right: 0, top: 0, width: w, height: right }]} />
      <View style={[fill, { right: 0, bottom: 0, width: bottom, height: w }]} />
      <View style={[fill, { left: 0, bottom: 0, width: w, height: left }]} />
    </View>
  );
}
