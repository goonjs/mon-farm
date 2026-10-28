/** The "บันทึกแล้ว" view after the order is stored (E11-S11, mockup a8): a summary card and the two ways on. */

import { Text, View } from 'react-native';

import { formatDate, formatSatang } from '../../../core/finance/money';
import { useI18n, useT } from '../../../i18n';
import type { SyncStatus } from '../../../sync/status';
import { useTheme } from '../../../theme';
import { AppText, Button, cardStyle, Check, CTA, IconTile, PinnedActions, ScreenHeader } from '../../../ui';

export interface Saved {
  readonly orderId: string;
  readonly shop: string;
  readonly date: string;
  readonly stage: 'committed' | 'actual';
  readonly lineCount: number;
  readonly sacks: number;
  readonly netSatang: number;
}

export function SavedView({ saved, sync, onDetails, onLater }: { saved: Saved; sync: SyncStatus | null; onDetails: () => void; onLater: () => void }) {
  const t = useTheme();
  const msg = useT();
  const { era } = useI18n();
  const date = formatDate(saved.date, era);
  const stage = saved.stage === 'committed' ? `${msg('ordc.stage.committed')} ${msg('ordc.stage.committedHint')}` : msg('ordc.stage.actual');
  return (
    <View testID="ordc-saved" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('ordc.title')} sync={sync} />
      <View style={{ flex: 1, padding: t.layout.screenPaddingX, gap: t.space.lg, alignItems: 'center', justifyContent: 'center' }}>
        <IconTile tone="accept" size="regular" icon={(c) => <Check color={c} size={22} />} />
        <Text accessibilityRole="header" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, fontWeight: t.font.weight.bold, color: t.color.ink, textAlign: 'center' }}>
          {msg('ordc.savedTitle')}
        </Text>
        <View style={[cardStyle(t), { alignSelf: 'stretch', padding: t.space.lg, gap: t.space.xs }]}>
          <AppText testID="ordc-saved-head" style={{ fontWeight: t.font.weight.bold }}>
            {saved.shop ? msg('ordc.savedHead', { shop: saved.shop, date }) : msg('ordc.savedHeadNoShop', { date })}
          </AppText>
          <AppText testID="ordc-saved-sub" variant="bodySm">
            {saved.sacks > 0 ? msg('ordc.savedSub', { n: saved.lineCount, sacks: saved.sacks, stage }) : msg('ordc.savedSubNoSacks', { n: saved.lineCount, stage })}
          </AppText>
          <Text testID="ordc-saved-total" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
            {formatSatang(saved.netSatang)} <Text style={{ fontSize: t.font.size.bodyLg, color: t.color.inkSoft }}>{msg('ordc.baht')}</Text>
          </Text>
        </View>
        <AppText variant="bodySm" style={{ textAlign: 'center' }}>{msg('ordc.savedNote')}</AppText>
      </View>
      <View style={{ paddingBottom: t.space.sm }}>
        <PinnedActions>
          <View style={{ gap: t.space.sm }}>
            <CTA testID="ordc-saved-details" onPress={onDetails}>{msg('ordc.savedDetails')}</CTA>
            <Button testID="ordc-saved-later" onPress={onLater}>{msg('ordc.savedLater')}</Button>
          </View>
        </PinnedActions>
      </View>
    </View>
  );
}
