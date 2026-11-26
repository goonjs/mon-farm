/**
 * "ใครจ่ายไปก่อน" as a full page (E01-S25, owner rv245-07 2026-11-23: "ของปุ่มโอเคตามนี้
 * แต่ถ้าหมายถึง แอ็คชั่นนี้สเต็ปนี้ขอให้ขึ้นเต็มจอ"). The tiles are the same style I
 * `PayerPicker`; only the frame changed from a bottom sheet to a page with its own back.
 * The form keeps its state; back and ตกลง both return to it with the pick kept.
 */

import { useEffect, type ReactNode } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';

import { useT } from '../../i18n';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, CTA, PinnedActions, ScreenHeader } from '../../ui';

export function PayerPage({ onBack, hint, picker, owed }: { onBack: () => void; hint?: string; picker: ReactNode; owed?: ReactNode }) {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();

  // Android back closes the page, as the sheet did, and never leaves the form.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <View testID="expense-payer-page" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('fin.form.payerQ')} back={{ label: msg('v2.back'), onPress: onBack, testID: 'expense-payer-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.xl }}>
        {hint ? <AppText variant="caption">{hint}</AppText> : null}
        {picker}
        {owed ?? null}
      </ScrollView>
      <PinnedActions>
        <CTA testID="expense-payer-done" onPress={onBack}>{msg('fert.done')}</CTA>
      </PinnedActions>
    </View>
  );
}
