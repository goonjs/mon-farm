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
      <BrandMark size={96} />
      <AppText
        accessibilityRole="header"
        style={{
          fontSize: t.font.size.displayXl + 6,
          lineHeight: Math.round((t.font.size.displayXl + 6) * 1.2),
          fontWeight: t.font.weight.black,
          letterSpacing: -0.5,
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

/** Sun, a tall leaf, a small leaf and the hill, on the mockup's 64-unit grid. */
function BrandMark({ size }: { size: number }) {
  const t = useTheme();
  const u = size / 64;
  /** A leaf: two rounded corners, the other two are its tips. */
  const leaf = (w: number, h: number, tips: 'rising' | 'falling') => {
    const r = Math.max(w, h) * u;
    return {
      position: 'absolute' as const,
      width: w * u,
      height: h * u,
      ...(tips === 'rising'
        ? { borderTopLeftRadius: r, borderBottomRightRadius: r }
        : { borderTopRightRadius: r, borderBottomLeftRadius: r }),
    };
  };
  return (
    <View testID="splash-mark" aria-hidden style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 10 * u,
          top: 20 * u,
          width: 14 * u,
          height: 14 * u,
          borderRadius: 7 * u,
          backgroundColor: t.color.brandYellow,
        }}
      />
      <View style={{ ...leaf(21, 40, 'rising'), left: 32 * u, top: 6 * u, backgroundColor: t.color.brand, transform: [{ rotate: '6deg' }] }} />
      <View style={{ ...leaf(21, 12, 'falling'), left: 7 * u, top: 33 * u, backgroundColor: t.color.brandLight, transform: [{ rotate: '8deg' }] }} />
      <View
        style={{
          position: 'absolute',
          left: 4 * u,
          top: 47 * u,
          width: 56 * u,
          height: 9 * u,
          borderTopLeftRadius: 40 * u,
          borderTopRightRadius: 6 * u,
          borderBottomLeftRadius: 4 * u,
          backgroundColor: t.color.brandStrong,
          transform: [{ rotate: '-8deg' }],
        }}
      />
    </View>
  );
}
