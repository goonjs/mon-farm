/**
 * The "กำลังสร้าง" placeholder every not-yet-rebuilt v2 screen shows: the
 * shared ScreenHeader (back to the v2 home, sync pill) over one card.
 */

import { ScrollView, View } from 'react-native';

import { V2_HOME } from './routes';
import { useT } from '../i18n';
import type { MessageId } from '../i18n/messages';
import { useSyncStatus } from '../sync/use-sync-status';
import { useTheme } from '../theme';
import { AppText, Card, CardLabel, ScreenHeader } from '../ui';

export function Placeholder({ titleId, children }: { titleId: MessageId; children?: React.ReactNode }) {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg(titleId)} back={{ label: msg('v2.back'), href: V2_HOME, testID: 'v2-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg }}>
        <Card testID="v2-building">
          <CardLabel>{msg('v2.building')}</CardLabel>
          <AppText variant="bodySm">{msg('v2.buildingHint')}</AppText>
        </Card>
        {children}
      </ScrollView>
    </View>
  );
}
