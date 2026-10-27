/** "ใส่เพื่ออะไร" (FD-3): multi-tick of saved reasons, most used first; type a new one and remember it. */

import { useState } from 'react';
import { View } from 'react-native';

import { TYPED_REASON } from '../../../core/finance/fertilizer';
import { reasonsByUse } from '../../../core/finance/fert-products';
import type { Expense } from '../../../core/finance/ledger';
import type { ExpensePatch } from '../../../core/finance/types';
import type { UseFinance } from '../../../finance/use-finance';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, CTA, Check, Plus, TextField } from '../../../ui';
import { setFertOption } from '../fert-options';
import { TickCard } from '../pieces';
import { reasonsPatch } from './tell';
import { ItemRow, RememberTick, SheetTitle } from './parts';

export function ReasonsSheet({
  item,
  state,
  fin,
  onSave,
  onClose,
}: {
  item: Expense;
  state: NonNullable<UseFinance['state']>;
  fin: Pick<UseFinance, 'events' | 'write' | 'state'>;
  onSave: (patch: ExpensePatch) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [chosen, setChosen] = useState<readonly string[]>(item.fertilizer?.reasons ?? []);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [remember, setRemember] = useState(true);
  const [failed, setFailed] = useState(false);

  const rows = [
    ...reasonsByUse(state.fertOptions, state.expenses).map((o) => ({ id: o.id, name: o.name, detail: o.description })),
    ...state.fertOptions.filter((o) => o.kind === 'reason' && o.hidden && chosen.includes(o.id)).map((o) => ({ id: o.id, name: o.name, detail: o.description })),
    ...chosen.filter((r) => r.startsWith(TYPED_REASON)).map((r) => ({ id: r, name: r.slice(TYPED_REASON.length), detail: msg('ordd.reasons.once') })),
  ];
  const toggle = (id: string) => setChosen((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]));

  const addTyped = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      const id = remember ? await setFertOption(fin, { kind: 'reason', name: n, description: desc.trim(), hidden: false }) : TYPED_REASON + n;
      setChosen((cs) => (cs.includes(id) ? cs : [...cs, id]));
      setAdding(false);
      setName('');
      setDesc('');
    } catch {
      setFailed(true);
    }
  };

  const done = async () => {
    const same = JSON.stringify(chosen) === JSON.stringify(item.fertilizer?.reasons ?? []);
    if (same || (await onSave(reasonsPatch(item, chosen)))) onClose();
    else setFailed(true);
  };

  return (
    <BottomSheet open onClose={onClose} testID="ordd-reasons-sheet" title={msg('ordd.reasons.title')}>
      <View style={{ gap: t.space.md }}>
        <SheetTitle>{msg('ordd.reasons.sub', { item: item.item })}</SheetTitle>
        {adding ? (
          <View style={{ gap: t.space.md }}>
            <AppText variant="heading">{msg('ordd.reasons.newTitle')}</AppText>
            <TextField testID="ordd-reason-name" label={msg('ordd.reasons.name')} required value={name} onChangeText={setName} />
            <TextField testID="ordd-reason-desc" label={msg('ordd.reasons.desc')} value={desc} onChangeText={setDesc} />
            <RememberTick testID="ordd-reason-remember" on={remember} onPress={() => setRemember((r) => !r)} hint={msg('ordd.reasons.rememberHint')} />
            <CTA testID="ordd-reason-add" disabled={!name.trim()} onPress={() => void addTyped()}>{msg('ordd.reasons.add')}</CTA>
          </View>
        ) : (
          <>
            {rows.map((o) => <TickCard key={o.id} testID={`ordd-reason-${o.id}`} title={o.name} detail={o.detail || undefined} on={chosen.includes(o.id)} onPress={() => toggle(o.id)} />)}
            <ItemRow testID="ordd-reason-new" dashed icon={<Plus color={t.color.action} />} title={msg('ordd.reasons.new')} onPress={() => setAdding(true)} />
            {failed ? <AppText testID="ordd-reasons-failed" style={{ color: t.color.reject }}>{msg('ordd.saveFailed')}</AppText> : null}
            <CTA testID="ordd-reasons-done" icon={(c) => <Check color={c} />} onPress={() => void done()}>
              {chosen.length ? msg('ordd.reasons.doneN', { n: chosen.length }) : msg('ordd.reasons.done')}
            </CTA>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
