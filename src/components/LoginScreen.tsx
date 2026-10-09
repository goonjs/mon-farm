/**
 * The login screen (E02-S01) — docs/ux/flows/e02-access-and-sync-states.md
 * §2.1/§2.2. The only screen there is before someone signs in (ACC-6): it
 * records nothing and leads nowhere else.
 *
 * States: idle · signing in (button disabled, says so) · offline · popup
 * blocked · failed (+ try again). Closing the Google window is not an error.
 */

import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { SignInError, type SignInFailure } from '../auth/errors';
import { useT, type MessageId } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './chrome';

const MESSAGE: Record<Exclude<SignInFailure, 'cancelled'>, MessageId> = {
  offline: 'login.offline',
  'popup-blocked': 'login.popupBlocked',
  failed: 'login.failed',
};

export function LoginScreen({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SignInFailure | null>(null);

  // Set synchronously: two presses in one frame both see `busy` false.
  const inFlight = useRef(false);

  const signIn = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await onSignIn();
    } catch (err) {
      setFailure(err instanceof SignInError ? err.reason : 'failed');
      inFlight.current = false;
      setBusy(false);
    }
  };

  const shown = failure && failure !== 'cancelled' ? failure : null;

  return (
    <View
      testID="login-screen"
      style={{
        flex: 1,
        backgroundColor: t.color.surface,
        justifyContent: 'center',
        padding: t.space.xl,
        gap: t.space.lg,
      }}
    >
      <View style={{ gap: t.space.sm }}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.displayLg,
            fontWeight: t.font.weight.bold,
            color: t.color.ink,
          }}
        >
          {msg('login.appName')}
        </Text>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.inkSoft }}>
          {msg('login.tagline')}
        </Text>
      </View>

      <Button testID="login-google" variant="primary" onPress={signIn} disabled={busy}>
        {busy ? msg('login.busy') : msg('login.google')}
      </Button>

      {shown ? (
        <View
          testID="login-message"
          accessibilityRole="alert"
          style={{
            gap: t.space.sm,
            backgroundColor: t.color.warnSunk,
            borderRadius: t.radius.md,
            borderWidth: t.border.hair,
            borderColor: t.color.warn,
            padding: t.space.md,
          }}
        >
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
            {msg(MESSAGE[shown])}
          </Text>
          {shown === 'failed' ? (
            <Button testID="login-retry" onPress={signIn} disabled={busy}>
              {msg('login.retry')}
            </Button>
          ) : null}
        </View>
      ) : null}

      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
        {msg('login.firstTimeNote')}
      </Text>
    </View>
  );
}
