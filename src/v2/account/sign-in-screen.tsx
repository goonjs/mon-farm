/**
 * The sign-in screen (E02-S01, flow-v1 screen 1): the mark, the name, one
 * note that the first sign-in needs internet, and the Google button. It is the
 * only screen before someone signs in (ACC-6) — it records nothing and leads
 * nowhere else, and there is no skip path.
 *
 * States: idle · signing in (button says so, cannot be pressed twice) ·
 * offline · pop-up blocked · failed (button becomes "try again"). Closing the
 * Google window is not an error.
 */

import { useRef, useState } from 'react';
import { View } from 'react-native';

import { SignInError, type SignInFailure } from '../../auth/errors';
import { useT, type MessageId } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, Card, CTA, FieldError } from '../../ui';
import { BrandMark } from '../brand-mark';

const PROBLEM: Record<Exclude<SignInFailure, 'cancelled'>, MessageId> = {
  offline: 'acct.signIn.offline',
  'popup-blocked': 'acct.signIn.popupBlocked',
  failed: 'acct.signIn.failed',
};

export function SignInScreen({ onSignIn }: { onSignIn: () => Promise<void> }) {
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

  const problem = failure && failure !== 'cancelled' ? failure : null;
  const label = busy ? msg('acct.signIn.busy') : failure === 'failed' ? msg('acct.signIn.retry') : msg('acct.signIn.google');

  return (
    <View testID="signin" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space.md, paddingHorizontal: t.space.xl }}>
        <BrandMark size={112} testID="signin-mark" />
        <AppText accessibilityRole="header" variant="display" style={{ color: t.color.ink }}>
          {msg('splash.name')}
        </AppText>
        <AppText variant="body" style={{ color: t.color.inkSoft }}>
          {msg('splash.tagline')}
        </AppText>
      </View>
      <View style={{ padding: t.layout.screenPaddingX, gap: t.space.md }}>
        <Card style={{ padding: t.space.md, gap: t.space.xs }}>
          <AppText variant="label" style={{ color: t.color.ink }}>
            {msg('acct.signIn.noteTitle')}
          </AppText>
          <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>
            {msg('acct.signIn.note')}
          </AppText>
        </Card>
        {problem ? <FieldError testID="signin-problem">{msg(PROBLEM[problem])}</FieldError> : null}
        <CTA testID="signin-google" onPress={signIn} disabled={busy}>
          {label}
        </CTA>
      </View>
    </View>
  );
}
