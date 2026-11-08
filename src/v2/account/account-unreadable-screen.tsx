/**
 * The device's account could not be read at start-up, twice (owner q3 = ก,
 * 2026-11-08; decision page mockup). "Cannot read" is not "never signed in": a
 * person who signed in before must not be sent to the sign-in screen, which
 * offline at the farm is a dead end. The data is still on the device, so the
 * screen says so and offers one thing: read it again, without a reload. There
 * is deliberately no sign-in here — that could enter a wrong account or make a
 * second group.
 */

import { View } from 'react-native';

import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AlertIcon, AppText, CTA } from '../../ui';

export function AccountUnreadableScreen({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID="account-unreadable" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space.md, paddingHorizontal: t.space.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.warnSunk }}>
          <AlertIcon color={t.color.warn} size={32} />
        </View>
        <AppText accessibilityRole="alert" variant="heading" style={{ color: t.color.ink, textAlign: 'center' }}>
          {msg('acct.unreadable.title')}
        </AppText>
        <AppText variant="body" style={{ color: t.color.inkSoft, textAlign: 'center' }}>
          {msg('acct.unreadable.kept')}
        </AppText>
      </View>
      <View style={{ padding: t.layout.screenPaddingX, gap: t.space.sm }}>
        <CTA testID="account-unreadable-retry" disabled={busy} onPress={onRetry}>
          {msg('acct.unreadable.retry')}
        </CTA>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft, textAlign: 'center' }}>
          {msg('acct.unreadable.restart')}
        </AppText>
      </View>
    </View>
  );
}
