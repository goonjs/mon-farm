/** "ใส่ที่ไหน" (FD-4): the zones of the farm, a QuantityField each, "ใส่แล้ว x / n"; not all placed is fine, over is not. */

import { useState } from 'react';
import { View } from 'react-native';

import type { Expense } from '../../../core/finance/ledger';
import { todayIso } from '../../../core/finance/money';
import type { ExpensePatch } from '../../../core/finance/types';
import { activeZones, zoneNameTaken, type MasterState } from '../../../core/master';
import { useT } from '../../../i18n';
import { peopleStore } from '../../../store/people';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Check, Plus, QuantityField, TextField } from '../../../ui';
import { ChoiceChip, ChoiceRow } from '../pieces';
import { ItemRow, SheetTitle, SummaryBar } from './parts';
import { itemSacks, zonesPatch, zoneProblems } from './tell';
import { SolidButton, SolidCTA } from '../order/solid-cta';

export function ZonesSheet({
  item,
  master,
  onZoneSaved,
  onSave,
  onClose,
}: {
  item: Expense;
  master: MasterState | null;
  onZoneSaved: () => void;
  onSave: (patch: ExpensePatch) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const total = itemSacks(item);
  const farms = master ? master.properties.filter((p) => !p.deleted) : [];
  const [pickedFarm, setPickedFarm] = useState<string | null>(item.propertyId);
  // One farm: it is the farm, nothing to pick.
  const farmId = pickedFarm ?? (farms.length === 1 ? farms[0].id : null);
  const zones = master && farmId ? activeZones(master, farmId) : [];
  const [sacks, setSacks] = useState<Record<string, number>>(() => Object.fromEntries((item.fertilizer?.zones ?? []).map((z) => [z.zoneId, z.sacks])));
  const [adding, setAdding] = useState<string | null>(null);
  const [addErr, setAddErr] = useState(false);
  const [failed, setFailed] = useState(false);

  // Zones the item already has but this farm's list no longer shows stay as they are.
  const inputs = [
    ...zones.map((z) => ({ zoneId: z.id, zoneName: z.name, sacks: sacks[z.id] ?? 0 })),
    ...(item.fertilizer?.zones ?? []).filter((z) => !zones.some((x) => x.id === z.zoneId) && !pickedFarmChanged(item, farmId)).map((z) => ({ zoneId: z.zoneId, zoneName: z.zoneName, sacks: sacks[z.zoneId] ?? z.sacks })),
  ];
  const placed = inputs.reduce((s, z) => s + z.sacks, 0);
  const over = zoneProblems(item, inputs).includes('zones-over');
  const left = Math.max(0, total - placed);

  const addZone = async () => {
    if (!adding || !farmId || !master) return;
    if (!adding.trim() || zoneNameTaken(master, farmId, adding)) {
      setAddErr(true);
      return;
    }
    try {
      await peopleStore.addZone(farmId, adding.trim(), todayIso());
      setAdding(null);
      setAddErr(false);
      onZoneSaved();
    } catch {
      setAddErr(true);
    }
  };

  const done = async () => {
    if (await onSave(zonesPatch(item, inputs, farmId))) onClose();
    else setFailed(true);
  };

  return (
    <BottomSheet open onClose={onClose} testID="ordd-zones-sheet" title={msg('ordd.zones.title')}>
      <View style={{ gap: t.space.md }}>
        <SheetTitle>{msg('ordd.zones.sub', { item: item.item, sacks: total })}</SheetTitle>
        {farms.length === 0 ? <AppText variant="bodySm">{msg('ordd.zones.noFarm')}</AppText> : null}
        {farms.length > 1 ? (
          <ChoiceRow>
            {farms.map((f) => <ChoiceChip key={f.id} testID={`ordd-farm-${f.id}`} label={f.name} on={farmId === f.id} onPress={() => setPickedFarm(f.id)} />)}
          </ChoiceRow>
        ) : null}
        {farmId ? (
          <>
            <SummaryBar testID="ordd-zones-sum" tone={over ? 'bad' : placed >= total ? 'ok' : 'warn'} left={msg('ordd.zones.sum', { placed, total })} right={over ? msg('ordd.zones.over', { total }) : left > 0 ? msg('ordd.zones.left', { n: left }) : undefined} />
            {zones.length === 0 ? <AppText variant="bodySm">{msg('ordd.zones.none')}</AppText> : null}
            {zones.map((z) => (
              <QuantityField key={z.id} testID={`ordd-zone-${z.id}`} label={z.name} unit={msg('ordd.zones.unit')} value={sacks[z.id] ?? 0} min={0} max={total} onChange={(n) => setSacks((s) => ({ ...s, [z.id]: n }))} />
            ))}
            {adding !== null ? (
              <View style={{ gap: t.space.sm }}>
                <TextField testID="ordd-zone-name" label={msg('ordd.zones.name')} value={adding} onChangeText={setAdding} error={addErr ? msg('ordd.zones.nameErr') : undefined} />
                <SolidButton testID="ordd-zone-save" variant="primary" disabled={!adding.trim()} onPress={() => void addZone()}>{msg('ordd.hdr.save')}</SolidButton>
              </View>
            ) : (
              <ItemRow testID="ordd-zone-add" dashed icon={<Plus color={t.color.action} />} title={msg('ordd.zones.add')} onPress={() => setAdding('')} />
            )}
          </>
        ) : null}
        {failed ? <AppText testID="ordd-zones-failed" style={{ color: t.color.reject }}>{msg('ordd.saveFailed')}</AppText> : null}
        <SolidCTA testID="ordd-zones-done" disabled={over} icon={(c) => <Check color={c} />} onPress={() => void done()}>{msg('ordd.zones.done')}</SolidCTA>
      </View>
    </BottomSheet>
  );
}

/** Another farm was picked than the one the item's zones belong to: those zones do not carry over. */
function pickedFarmChanged(item: Expense, farmId: string | null): boolean {
  return item.propertyId !== null && farmId !== item.propertyId;
}
