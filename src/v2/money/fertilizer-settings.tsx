/**
 * ตั้งค่าปุ๋ย — mockup 7b screen 21h (E11-S10 C). The saved choices the
 * fertilizer flow offers: reasons (name + description) and formulas, brands
 * and sack sizes. Add, edit, hide and show; nothing is ever removed, so an
 * old purchase still reads its reason's name. Hidden is said in words, not
 * by greying alone (NFR-4).
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { FertOption } from '../../core/finance/ledger';
import type { FertOptionKind } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, Button, Card, ScreenHeader, SegmentedControl, TextField } from '../../ui';
import { setFertOption } from './fert-options';
import { ChoiceChip, ChoiceRow } from './pieces';

const KINDS: readonly FertOptionKind[] = ['reason', 'formula', 'brand', 'sackKg'];

const back = () => (router.canGoBack() ? router.back() : router.replace('/v2/expenses'));

export function FertilizerSettingsScreen() {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const fin = useFinance();
  const inFlight = useInFlight();
  const [kind, setKind] = useState<FertOptionKind>('reason');
  const [search, setSearch] = useState('');
  /** The row being edited, or `{}` for a new one. */
  const [editing, setEditing] = useState<{ option?: FertOption; name: string; description: string } | null>(null);

  const q = search.trim().toLowerCase();
  const rows = (fin.state?.fertOptions ?? []).filter((o) => o.kind === kind && (!q || o.name.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)));

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    const o = editing.option;
    await setFertOption(fin, { kind, name: editing.name, description: editing.description, hidden: o?.hidden ?? false, id: o?.id });
    setEditing(null);
  };

  const toggleHidden = (o: FertOption) => setFertOption(fin, { kind: o.kind, name: o.name, description: o.description, hidden: !o.hidden, id: o.id });

  const editor = (
    <Card testID="fert-set-editor" style={{ gap: t.space.sm, backgroundColor: t.color.actionSunk }}>
      <TextField testID="fert-set-name" label={msg('fert.set.name')} value={editing?.name ?? ''} onChangeText={(v) => setEditing((e) => (e ? { ...e, name: v } : e))} />
      {kind === 'reason' ? (
        <TextField testID="fert-set-desc" label={msg('fert.reasonDesc')} hint={msg('v2m.optional')} multiline value={editing?.description ?? ''} onChangeText={(v) => setEditing((e) => (e ? { ...e, description: v } : e))} />
      ) : null}
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button testID="fert-set-cancel" onPress={() => setEditing(null)}>{msg('common.cancel')}</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="fert-set-save" variant="primary" disabled={inFlight.busy || !editing?.name.trim()} onPress={() => void inFlight.run(save)}>{msg('common.save')}</Button>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('fert.set.title')} back={{ label: msg('v2.back'), onPress: back, testID: 'fert-set-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg, paddingBottom: t.space[16] * 2 }}>
        <SegmentedControl
          testID="fert-set-tab"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setEditing(null);
          }}
          options={KINDS.map((k) => ({ value: k, label: msg(`fert.set.tab.${k}`) }))}
        />
        <View style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <TextField testID="fert-set-search" label={msg('fert.set.search')} value={search} onChangeText={setSearch} />
          </View>
          <Button testID="fert-set-add" onPress={() => setEditing({ name: search.trim(), description: '' })}>{msg('fert.set.add')}</Button>
        </View>

        {editing && !editing.option ? editor : null}

        <Card style={{ gap: t.space.md }}>
          {rows.length === 0 ? <AppText variant="bodySm">{msg('fert.set.empty')}</AppText> : null}
          {rows.map((o) =>
            editing?.option?.id === o.id ? (
              <View key={o.id}>{editor}</View>
            ) : (
              <View key={o.id} testID={`fert-set-row-${o.id}`} style={{ gap: t.space.xs, borderBottomWidth: t.border.hair, borderBottomColor: t.color.ruleFaint, paddingBottom: t.space.sm }}>
                <AppText style={{ fontWeight: t.font.weight.bold, color: o.hidden ? t.color.inkSoft : t.color.ink }}>{kind === 'sackKg' ? msg('fert.kg', { kg: o.name }) : o.name}</AppText>
                {kind === 'reason' ? <AppText variant="bodySm">{o.description || msg('fert.set.noDesc')}</AppText> : null}
                {o.hidden ? <AppText variant="caption" testID={`fert-set-hidden-${o.id}`}>{msg('fert.set.hidden')}</AppText> : null}
                <ChoiceRow>
                  {!o.hidden ? <ChoiceChip testID={`fert-set-edit-${o.id}`} label={msg('fert.set.edit')} onPress={() => setEditing({ option: o, name: o.name, description: o.description })} /> : null}
                  <ChoiceChip testID={`fert-set-hide-${o.id}`} dashed={o.hidden} label={msg(o.hidden ? 'fert.set.show' : 'fert.set.hide')} onPress={() => void inFlight.run(async () => { await toggleHidden(o); })} />
                </ChoiceRow>
              </View>
            ),
          )}
        </Card>
        <AppText variant="caption">{msg('fert.set.footnote')}</AppText>
      </ScrollView>
    </View>
  );
}
