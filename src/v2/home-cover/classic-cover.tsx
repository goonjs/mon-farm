/**
 * The home cover drawn before E03-S09 (e03-v2-splash-home): sun, cloud, hills
 * and two rows of trees out of plain Views. Kept as the fallback the new scene
 * falls back to if it throws (CS-7).
 */

import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '../../i18n';
import { useTheme } from '../../theme';

export function ClassicCover() {
  const t = useTheme();
  const msg = useT();
  const [w, setW] = useState(0);
  const H = 148;
  const s = Math.max(w / 316, 1);
  const dy = (H * s - H) / 2;
  /** A shape on the grid, `x`/`y` its top-left in mockup units. */
  const box = (x: number, y: number, bw: number, bh: number) => ({
    position: 'absolute' as const,
    left: x * s,
    top: y * s - dy,
    width: bw * s,
    height: bh * s,
  });
  const oval = (cx: number, cy: number, rx: number, ry: number, colour: string) => (
    <View key={`${cx},${cy}`} style={{ ...box(cx - rx, cy - ry, rx * 2, ry * 2), borderRadius: rx * s, backgroundColor: colour }} />
  );
  const tree = (cx: number, top: number, trunkW: number, trunkH: number, rx: number, ry: number, crown: string) => (
    <View key={cx}>
      <View style={{ ...box(cx - trunkW / 2, top, trunkW, trunkH), borderRadius: s * 2, backgroundColor: t.color.inkSoft }} />
      {oval(cx, top - 4, rx, ry, crown)}
    </View>
  );
  const ray = (deg: number) => (
    <View
      key={deg}
      style={{
        ...box(62 - 1.25, 40 - 3.5, 2.5, 7),
        borderRadius: s,
        backgroundColor: t.color.brandYellow,
        transform: [{ rotate: `${deg}deg` }, { translateY: -27.5 * s }],
      }}
    />
  );
  return (
    <View
      testID="home-cover-classic"
      role="img"
      accessibilityLabel={msg('home.cover')}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: H, borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.color.actionSunk }}
    >
      {w > 0 ? (
        <View aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map(ray)}
          {oval(62, 40, 14, 14, t.color.brandYellow)}
          {oval(200, 34, 22, 9, t.color.surfaceRaised)}
          {oval(216, 28, 14, 10, t.color.surfaceRaised)}
          {oval(186, 30, 11, 8, t.color.surfaceRaised)}
          <View style={{ ...box(-60, 88, 436, 140), borderTopLeftRadius: 220 * s, borderTopRightRadius: 220 * s, backgroundColor: t.color.brandLight }} />
          {[122, 162, 202, 242, 282].map((x, i) => tree(x, [66, 62, 64, 60, 62][i], 4, 44, 15, 13, t.color.brand))}
          <View style={{ ...box(-80, 110, 476, 140), borderTopLeftRadius: 240 * s, borderTopRightRadius: 240 * s, backgroundColor: t.color.brand }} />
          {[99, 153, 207, 261].map((x, i) => tree(x, [70, 74, 72, 70][i], 6, 70, 22, 18, t.color.brandStrong))}
        </View>
      ) : null}
    </View>
  );
}
