/**
 * "โซนที่ใส่ · เหตุผล" — a full page (FZ-6, D-94 Z2, phone-form-ux rule 12): zones of every farm, several
 * at once; reasons as chips from the saved list, most used first, plus a new one (remembered by default,
 * as on the order before E11-S17). Per fertilizing, not per fertilizer (D-89 Q4). Nothing is written but
 * a new remembered reason; the main page saves.
 */

import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { TYPED_REASON } from '../../../core/finance/fertilizer';
import { reasonsByUse } from '../../../core/finance/fert-products';
import type { FinanceState } from '../../../core/finance/ledger';
import type { FertilizingZone, FinanceEvent, FinancePayload } from '../../../core/finance/types';
import type { EventId } from '../../../core/types';
import { useT } from '../../../i18n';
import type { useSyncStatus } from '../../../sync/use-sync-status';
import { useTheme } from '../../../theme';
import { AppText, CTA, PinnedActions, Plus, ScreenHeader, TextField } from '../../../ui';
import { setFertOption } from '../../money/fert-options';
import { ChoiceChip, ChoiceRow } from '../../money/pieces';
import { ItemRow, RememberTick } from '../../money/order-detail/parts';

export function WherePage({
  zones,
  initial,
  fin,
  sync,
  onDone,
  onBack,
}: {
  zones: readonly FertilizingZone[];
  initial: { readonly zones: readonly FertilizingZone[]; readonly reasons: readonly string[] };
  fin: { events: readonly FinanceEvent[]; state: FinanceState; write: (targetId: string, base: EventId | null, payload: FinancePayload) => Promise<FinanceEvent> };
  sync?: ReturnType<typeof useSyncStatus>;
  onDone: (w: { zones: readonly FertilizingZone[]; reasons: readonly string[] }) => void;
  onBack: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [picked, setPicked] = useState<readonly FertilizingZone[]>(initial.zones);
  const [reasons, setReasons] = useState<readonly string[]>(initial.reasons);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [remember, setRemember] = useState(true);
  const [failed, setFailed] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  // Zones on the record that are no longer listed stay pickable.
  const allZones = [...zones, ...initial.zones.filter((z) => !zones.some((x) => x.zoneId === z.zoneId))];
  const saved = reasonsByUse(fin.state.fertOptions, fin.state.expenses).map((o) => ({ id: o.id, name: o.name }));
  const rows = [
    ...saved,
    ...reasons.filter((r) => !saved.some((o) => o.id === r)).map((r) => ({ id: r, name: r.startsWith(TYPED_REASON) ? r.slice(TYPED_REASON.length) : (names[r] ?? fin.state.fertOptions.find((o) => o.id === r)?.name ?? r) })),
  ];
  const toggleZone = (z: FertilizingZone) => setPicked((ps) => (ps.some((p) => p.zoneId === z.zoneId) ? ps.filter((p) => p.zoneId !== z.zoneId) : [...ps, z]));
  const toggleReason = (id: string) => setReasons((rs) => (rs.includes(id) ? rs.filter((r) => r !== id) : [...rs, id]));

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      const id = remember ? await setFertOption(fin, { kind: 'reason', name: n, description: '', hidden: false }) : TYPED_REASON + n;
      setNames((m) => ({ ...m, [id]: n }));
      setReasons((rs) => (rs.includes(id) ? rs : [...rs, id]));
      setAdding(false);
      setName('');
    } catch (err) {
      console.error('Reason could not be stored.', err);
      setFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('fz.whereTitle')} back={{ label: msg('v2.back'), onPress: onBack, testID: 'fz-where-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.xl }}>
        <AppText variant="label">{msg('fz.zones')}</AppText>
        {allZones.length === 0 ? <AppText variant="bodySm">{msg('fz.zonesNone')}</AppText> : null}
        <ChoiceRow>
          {allZones.map((z) => (
            <ChoiceChip key={z.zoneId} testID={`fz-zone-${z.zoneId}`} label={z.zoneName} on={picked.some((p) => p.zoneId === z.zoneId)} onPress={() => toggleZone(z)} />
          ))}
        </ChoiceRow>
        <AppText variant="label">{msg('fz.reasons')}</AppText>
        <ChoiceRow>
          {rows.map((r) => (
            <ChoiceChip key={r.id} testID={`fz-reason-${r.id}`} label={r.name} on={reasons.includes(r.id)} onPress={() => toggleReason(r.id)} />
          ))}
        </ChoiceRow>
        {adding ? (
          <View style={{ gap: t.space.sm }}>
            <TextField testID="fz-reason-text" label={msg('fz.reasonName')} value={name} onChangeText={setName} />
            <RememberTick testID="fz-reason-remember" on={remember} onPress={() => setRemember((x) => !x)} hint={msg('fz.reasonRemember')} />
            <CTA testID="fz-reason-add" disabled={!name.trim()} onPress={() => void add()}>{msg('fz.reasonAdd')}</CTA>
          </View>
        ) : (
          <ItemRow testID="fz-reason-new" dashed icon={<Plus color={t.color.action} />} title={msg('fz.reasonNew')} onPress={() => setAdding(true)} />
        )}
        {failed ? <AppText testID="fz-where-failed" style={{ color: t.color.reject }}>{msg('fz.saveFailed')}</AppText> : null}
      </ScrollView>
      <PinnedActions>
        <CTA testID="fz-where-done" onPress={() => onDone({ zones: picked, reasons })}>{msg('fz.whereDone')}</CTA>
      </PinnedActions>
    </View>
  );
}
