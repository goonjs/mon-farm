/**
 * `/` — the splash (flow-v1 mockup screen 1, once the account gate has let
 * the person in): the FarmMate mark, the name and one line on what it is for, then
 * a replace to the v2 home so Back never lands here again. Deep links such as
 * `/v2/farm` are their own pages and never pass through this screen.
 *
 * The mark itself lives in brand-mark.tsx; the sign-in screen draws it too.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { BrandMark } from './brand-mark';
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
  // The name follows the text size like every other text (E03-S08); the mark is a drawing and stays.
  const word = Math.round(WORD * t.textScale);
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
      <BrandMark size={MARK} testID="splash-mark" />
      <AppText
        accessibilityRole="header"
        style={{
          fontSize: word,
          lineHeight: Math.round(word * 1.1),
          fontWeight: t.font.weight.black,
          letterSpacing: word * -0.02,
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
