/**
 * /v2/buyers — คนรับซื้อยาง (E03-S01, farm mockup 8). "ใช้ล่าสุด" marks the
 * buyer a new sale starts with: the one the newest sale picked, nobody if
 * that buyer was deleted since (MD-6, D-65). The form is a sheet with the
 * name only; delete is "ลบ (กู้คืนได้)" like people.
 */

import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { defaultBuyer, type BuyerRecord } from '../../core/master';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Button, Check, Chip, CTA, IconTile, MenuItem, MoneyInIcon, TextField, TrashIcon } from '../../ui';
import { AddCTA, ConfirmSheet, DeletedLink, DeletedList, FarmScreen, HelpNote, RowCard, SaveFailed, useMaster, useWrite } from './pieces';

type Sheet = { kind: 'none' } | { kind: 'form'; buyer: BuyerRecord | null } | { kind: 'delete'; buyer: BuyerRecord };

export function BuyersScreen() {
  const t = useTheme();
  const msg = useT();
  const { state, reload } = useMaster();
  const latestId = useLatestBuyerId();
  const [sheet, setSheet] = useState<Sheet>({ kind: 'none' });
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const write = useWrite();

  const latest = state ? defaultBuyer(state, latestId) : null;
  const active = state?.buyers.filter((b) => !b.deleted) ?? [];
  const deleted = state?.buyers.filter((b) => b.deleted) ?? [];

  const open = (buyer: BuyerRecord | null) => {
    setName(buyer?.name ?? '');
    setTried(false);
    setSheet({ kind: 'form', buyer });
  };
  const close = () => setSheet({ kind: 'none' });
  const run = async (fn: () => Promise<unknown>) => {
    if (!(await write.run(fn))) return;
    close();
    reload();
  };
  const save = () => {
    setTried(true);
    if (!name.trim() || sheet.kind !== 'form') return;
    const { buyer } = sheet;
    void run(() => (buyer ? peopleStore.renameBuyer(buyer.id, name) : peopleStore.addBuyer(name)));
  };

  return (
    <FarmScreen
      title={msg('buyers.title')}
      subtitle={msg('farmData.title')}
      fallback={'/v2/farm' as Href}
      failed={write.failed && sheet.kind === 'none'}
      testID="buyers"
      footer={<AddCTA testID="add-buyer" label={msg('v2f.addBuyer')} onPress={() => open(null)} />}
      overlay={
        <>
          <BottomSheet open={sheet.kind === 'form'} onClose={close} title={msg(sheet.kind === 'form' && sheet.buyer ? 'v2f.editBuyer' : 'v2f.addBuyer')} testID="buyer-sheet">
            <TextField
              testID="buyer-name"
              label={msg('v2f.buyerName')}
              required
              placeholder={msg('buyers.namePlaceholder')}
              value={name}
              onChangeText={setName}
              error={tried && !name.trim() ? msg('personForm.needName') : undefined}
            />
            <SaveFailed show={write.failed} />
            <CTA testID="buyer-save" icon={(c) => <Check color={c} size={14} />} onPress={save}>
              {msg('common.save')}
            </CTA>
            {sheet.kind === 'form' && sheet.buyer ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <Button
                  testID="buyer-delete"
                  variant="destructive"
                  icon={(c) => <TrashIcon color={c} size={16} />}
                  onPress={() => sheet.buyer && setSheet({ kind: 'delete', buyer: sheet.buyer })}
                >
                  {msg('buyers.delete')}
                </Button>
              </View>
            ) : null}
          </BottomSheet>
          <ConfirmSheet
            open={sheet.kind === 'delete'}
            title={sheet.kind === 'delete' ? msg('personForm.deleteTitle', { name: sheet.buyer.name }) : ''}
            lines={msg('personForm.deleteBody').split(' · ')}
            confirmLabel={msg('personForm.deleteYes')}
            onConfirm={() => sheet.kind === 'delete' && void run(() => peopleStore.remove(sheet.buyer.id))}
            failed={write.failed}
            onClose={close}
          />
        </>
      }
    >
      {showDeleted ? (
        <>
          <AppText variant="label">{msg('v2f.deletedTitle')}</AppText>
          <DeletedList rows={deleted.map((b) => ({ id: b.id, name: b.name }))} onRestore={(id) => void run(() => peopleStore.restore(id))} />
          <Button testID="hide-deleted" onPress={() => setShowDeleted(false)}>
            {msg('v2.back')}
          </Button>
        </>
      ) : (
        <>
          {state && active.length === 0 ? <AppText variant="bodySm">{msg('buyers.empty')}</AppText> : null}
          {active.length > 0 ? (
            <RowCard testID="buyers-list">
              {active.map((b) => (
                <MenuItem
                  key={b.id}
                  testID={`buyer-${b.id}`}
                  label={b.name}
                  onPress={() => open(b)}
                  leading={<IconTile tone="cream" icon={(c) => <MoneyInIcon color={c} size={22} />} />}
                  trailing={latest?.id === b.id ? <Chip testID="buyer-latest" tone="accept" label={msg('buyers.latest')} /> : undefined}
                />
              ))}
            </RowCard>
          ) : null}
          <HelpNote title={msg('v2f.latestTitle')} lines={msg('v2f.latestBody').split(' · ')} />
          <View style={{ height: t.space.xs }} />
          <DeletedLink n={deleted.length} onPress={() => setShowDeleted(true)} />
        </>
      )}
    </FarmScreen>
  );
}

function useLatestBuyerId(): string | null {
  const [id, setId] = useState<string | null>(null);
  const load = useCallback(() => {
    let live = true;
    peopleStore.latestBuyerId().then(
      (x) => live && setId(x),
      () => live && setId(null),
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(load, [load]);
  useFocusEffect(load);
  return id;
}
