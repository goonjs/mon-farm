/** "แก้หัวใบ" (FD-2): date, payer, stage and shop of the whole order; saving rewrites every item (patchOrderFields). */

import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { OrderView } from '../../../core/finance/fert-order';
import { formatDate, todayIso } from '../../../core/finance/money';
import type { Payer, Stage } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, CalendarIcon, CTA, Check, DatePickerSheet, SegmentedControl, TextField } from '../../../ui';
import { PayerPicker } from '../pieces';

export interface HeaderEdit {
  readonly date: string;
  /** Only set when the user changed it; a planned order is never silently made actual. */
  readonly stage?: 'committed' | 'actual';
  readonly payer: Payer | null;
  readonly shop: string;
}

export function HeaderSheet({ order, onSave, onClose }: { order: OrderView; onSave: (next: HeaderEdit) => Promise<boolean>; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [date, setDate] = useState(order.date);
  const [stage, setStage] = useState<Stage>(order.stage);
  const [payer, setPayer] = useState<Payer | null>(order.payer);
  const [shop, setShop] = useState(order.shop);
  const [picking, setPicking] = useState(false);
  const [failed, setFailed] = useState(false);
  const stageOptions: { value: Stage; label: string }[] = [
    ...(order.stage === 'planned' ? [{ value: 'planned' as const, label: msg('ordd.stage.planned') }] : []),
    { value: 'committed', label: msg('ordd.stage.committed') },
    { value: 'actual', label: msg('ordd.stage.actual') },
  ];
  // Goods that have arrived cannot be dated in the future (story rule).
  const future = stage === 'actual' && date > todayIso();

  const save = async () => {
    if (future) return;
    if (await onSave({ date, ...(stage !== order.stage && stage !== 'planned' ? { stage } : {}), payer, shop: shop.trim() })) onClose();
    else setFailed(true);
  };

  return (
    <>
      <BottomSheet open={!picking} onClose={onClose} testID="ordd-header-sheet" title={msg('ordd.hdr.title')}>
        <View style={{ gap: t.space.md }}>
          <View style={{ gap: t.space.xs }}>
            <AppText variant="label">{msg('ordd.hdr.date')}</AppText>
            <Pressable testID="ordd-hdr-date" accessibilityRole="button" onPress={() => setPicking(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: t.target.comfortable, paddingHorizontal: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, backgroundColor: t.color.surfaceRaised }}>
              <CalendarIcon color={t.color.ink} />
              <AppText style={{ fontWeight: t.font.weight.bold }}>{formatDate(date)}</AppText>
            </Pressable>
            {future ? <AppText testID="ordd-hdr-future" style={{ color: t.color.reject }}>{msg('ordd.hdr.dateFuture')}</AppText> : null}
          </View>
          <View style={{ gap: t.space.xs }}>
            <AppText variant="label">{msg('ordd.hdr.stage')}</AppText>
            <SegmentedControl testID="ordd-hdr-stage" value={stage} onChange={setStage} options={stageOptions} />
          </View>
          <View style={{ gap: t.space.xs }}>
            <AppText variant="label">{msg('ordd.hdr.payer')}</AppText>
            <PayerPicker testID="ordd-hdr-payer" value={payer} onChange={setPayer} allowNone />
          </View>
          <TextField testID="ordd-hdr-shop" label={msg('ordd.hdr.shop')} value={shop} onChangeText={setShop} />
          {failed ? <AppText testID="ordd-hdr-failed" style={{ color: t.color.reject }}>{msg('ordd.saveFailed')}</AppText> : null}
          <CTA testID="ordd-hdr-save" disabled={future} icon={(c) => <Check color={c} />} onPress={() => void save()}>{msg('ordd.hdr.save')}</CTA>
        </View>
      </BottomSheet>
      <DatePickerSheet open={picking} onClose={() => setPicking(false)} value={date} onChange={setDate} max={stage === 'actual' ? todayIso() : undefined} testID="ordd-hdr-date-sheet" />
    </>
  );
}
