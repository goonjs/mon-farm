/**
 * The FarmMate mark: the mockup's sun, two leaves and a hill, drawn with
 * Views (react-native-svg is not installed) in the brand roles only. Shared
 * by the splash and the sign-in screen (flow-v1 screens 1).
 */

import { View } from 'react-native';

import { useTheme } from '../theme';

/**
 * Sun, a tall leaf, a small leaf and the hill, on the mockup's 64-unit grid
 * (flow-v1 `.fm-logo`). Each shape is placed by its centre, then turned.
 */
export function BrandMark({ size, testID }: { size: number; testID: string }) {
  const t = useTheme();
  const u = size / 64;
  /** A shape `w`×`h` units centred on (`cx`, `cy`), turned by `deg`. */
  const at = (cx: number, cy: number, w: number, h: number, deg: number) => ({
    position: 'absolute' as const,
    left: (cx - w / 2) * u,
    top: (cy - h / 2) * u,
    width: w * u,
    height: h * u,
    transform: [{ rotate: `${deg}deg` }],
  });
  /**
   * A leaf: a square with two opposite corners fully round, so it is a lens
   * along the diagonal — rising (tips bottom-left and top-right) or falling.
   * `deg` then turns it onto the mockup's axis.
   */
  const leaf = (side: number, axis: 'rising' | 'falling') => {
    const r = side * u;
    return axis === 'rising' ? { borderTopLeftRadius: r, borderBottomRightRadius: r } : { borderTopRightRadius: r, borderBottomLeftRadius: r };
  };
  return (
    <View testID={testID} aria-hidden style={{ width: size, height: size }}>
      {/*
        Hill: a swoosh that tapers to a point at each end — the top border of
        an ellipse with no side borders, turned so the right end rises.
      */}
      <View
        style={{
          ...at(33, 52, 58, 24, -10),
          borderRadius: '50%',
          borderTopWidth: 7 * u,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderColor: t.color.brandStrong,
        }}
      />
      <View style={{ ...at(17, 27, 14, 14, 0), borderRadius: 7 * u, backgroundColor: t.color.brandYellow }} />
      {/* Big leaf: (31,46) to (54,7), 30° off upright. */}
      <View style={{ ...at(42.5, 26.5, 31, 31, -15), ...leaf(31, 'rising'), backgroundColor: t.color.brand }} />
      {/* Small leaf: (7,33) to (28,45), 30° below level. */}
      <View style={{ ...at(17.5, 39, 17, 17, -15), ...leaf(17, 'falling'), backgroundColor: t.color.brandLight }} />
    </View>
  );
}
