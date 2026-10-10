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
   * A leaf: two opposite corners fully round, so the other two are its tips
   * and its axis is the box's diagonal — rising (tips bottom-left and
   * top-right) or falling (top-left and bottom-right).
   */
  const leaf = (w: number, h: number, axis: 'rising' | 'falling') => {
    const r = Math.max(w, h) * u;
    return axis === 'rising' ? { borderTopLeftRadius: r, borderBottomRightRadius: r } : { borderTopRightRadius: r, borderBottomLeftRadius: r };
  };
  return (
    <View testID="splash-mark" aria-hidden style={{ width: size, height: size }}>
      <View style={{ ...at(17, 27, 14, 14, 0), borderRadius: 7 * u, backgroundColor: t.color.brandYellow }} />
      <View style={{ ...at(42.5, 26.5, 20, 40, 4), ...leaf(20, 40, 'rising'), backgroundColor: t.color.brand }} />
      <View style={{ ...at(17.5, 39, 22, 10, 6), ...leaf(22, 10, 'falling'), backgroundColor: t.color.brandLight }} />
      <View
        style={{
          ...at(31, 51, 54, 7, -9),
          borderTopLeftRadius: 40 * u,
          borderTopRightRadius: 40 * u,
          borderBottomLeftRadius: 6 * u,
          borderBottomRightRadius: 2 * u,
          backgroundColor: t.color.brandStrong,
        }}
      />
    </View>
  );
}
