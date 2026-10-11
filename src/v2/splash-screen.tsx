/**
 * `/` — the splash (flow-v1 mockup screen 1, without the sign-in that comes
 * with E02): the FarmMate mark, the name and one line on what it is for, then
 * a replace to the v2 home so Back never lands here again. Deep links such as
 * `/v2/farm` are their own pages and never pass through this screen.
 *
 * The mark is the mockup's sun, two leaves and a hill, drawn with Views
 * (react-native-svg is not installed) in the brand roles only.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { V2_HOME } from './routes';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import { AppText } from '../ui';

/** Long enough to read the name, short enough not to be in the way. */
export const SPLASH_MS = 900;

/** flow-v1 `.fm-logo` (112px) and `.fm-word` (38px, -0.02em): larger than any type token. */
const MARK = 112;
const WORD = 38;

export function SplashScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace(V2_HOME), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View
      testID="splash"
      style={{
        flex: 1,
        backgroundColor: t.color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.space.md,
        paddingHorizontal: t.space.xl,
      }}
    >
      <BrandMark size={MARK} />
      <AppText
        accessibilityRole="header"
        style={{
          fontSize: WORD,
          lineHeight: Math.round(WORD * 1.1),
          fontWeight: t.font.weight.black,
          letterSpacing: WORD * -0.02,
          color: t.color.ink,
        }}
      >
        {msg('splash.name')}
      </AppText>
      <AppText variant="body" style={{ color: t.color.inkSoft }}>
        {msg('splash.tagline')}
      </AppText>
    </View>
  );
}

/**
 * Sun, a tall leaf, a small leaf and the hill, on the mockup's 64-unit grid
 * (flow-v1 `.fm-logo`). Each shape is placed by its centre, then turned.
 */
function BrandMark({ size }: { size: number }) {
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
    <View testID="splash-mark" aria-hidden style={{ width: size, height: size }}>
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
