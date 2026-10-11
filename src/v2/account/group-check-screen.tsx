/**
 * Between sign-in and the first screen of a group (E02-S05, flow §1.1): the app
 * is asking the server which farm groups this user already has. Until it knows,
 * nothing else is offered, least of all "create group" — a returning member
 * would make a second farm and split their data.
 *
 * Two states: asking (the mark and a line), and could-not-ask (offline, timed
 * out, refused) with a retry. There is deliberately no way past it other than
 * the answer.
 */

import { View } from 'react-native';

import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, CTA } from '../../ui';
import { BrandMark } from '../brand-mark';

export function GroupCheckScreen({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID={failed ? 'group-check-failed' : 'group-check'} style={{ flex: 1, backgroundColor: t.color.surface }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space.md, paddingHorizontal: t.space.xl }}>
        <BrandMark size={112} testID="group-check-mark" />
        <AppText
          accessibilityRole={failed ? 'alert' : undefined}
          variant={failed ? 'label' : 'body'}
          style={{ color: t.color.ink, textAlign: 'center' }}
        >
          {failed ? msg('acct.check.failed') : msg('acct.check.busy')}
        </AppText>
        {failed ? (
          <AppText variant="bodySm" style={{ color: t.color.inkSoft, textAlign: 'center' }}>
            {msg('acct.check.why')}
          </AppText>
        ) : null}
      </View>
      {failed ? (
        <View style={{ padding: t.layout.screenPaddingX }}>
          <CTA testID="group-check-retry" onPress={onRetry}>
            {msg('acct.check.retry')}
          </CTA>
        </View>
      ) : null}
    </View>
  );
}
