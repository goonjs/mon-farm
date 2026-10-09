/**
 * Rubber buyers — farm master data (E03-S01, mockup v1.1.0 screen 8).
 *
 * "ใช้ล่าสุด" marks the buyer a new sale starts with: the one the newest sale
 * picked, and nobody if that buyer has been deleted (MD-6, D-65 Q6). Delete
 * is "ลบ (กู้คืนได้)" like people, restored from the small deleted link.
 */

import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Pill } from '../components/chrome';
import { Card, FarmScreen, LinkButton, ListRow, StateBadge, TextField } from '../components/farm-ui';
import { defaultBuyer, type MasterState } from '../core/master';
import { useT } from '../i18n';
import { peopleStore } from '../store/people';
import { useTheme } from '../theme';

export default function BuyersScreen() {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const reload = useCallback(() => {
    peopleStore.state().then(setState);
    peopleStore.latestBuyerId().then(setLatestId);
  }, []);
  useEffect(reload, [reload]);
  useFocusEffect(reload);

  const save = async () => {
    if (!name.trim()) return;
    if (editing) await peopleStore.renameBuyer(editing, name);
    else await peopleStore.addBuyer(name);
    setName('');
    setEditing(null);
    reload();
  };
  const act = async (fn: () => Promise<void>) => {
    await fn();
    reload();
  };

  const latest = state ? defaultBuyer(state, latestId) : null;
  const active = state?.buyers.filter((b) => !b.deleted) ?? [];
  const deleted = state?.buyers.filter((b) => b.deleted) ?? [];

  return (
    <FarmScreen title={msg('buyers.title')} subtitle={msg('farmData.title')} back={'/farm-data' as Href}>
      {showDeleted ? (
        <>
          <LinkButton testID="hide-deleted" label={msg('peopleList.hideDeleted')} onPress={() => setShowDeleted(false)} />
          <Card>
            {deleted.map((b) => (
              <ListRow
                key={b.id}
                testID={`deleted-${b.id}`}
                title={b.name}
                badge={
                  <>
                    <StateBadge text={msg('peopleList.deletedBadge')} />
                    <LinkButton testID={`restore-${b.id}`} label={msg('peopleList.restore')} onPress={() => void act(() => peopleStore.restore(b.id))} />
                  </>
                }
              />
            ))}
          </Card>
        </>
      ) : (
        <>
          <Card>
            {state && active.length === 0 ? (
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('buyers.empty')}</Text>
            ) : null}
            {active.map((b) => (
              <View key={b.id} testID={`buyer-${b.id}`} style={{ gap: t.space.xs }}>
                <ListRow
                  title={b.name}
                  badge={latest?.id === b.id ? <Pill tone="accept" testID="buyer-latest">{`✓ ${msg('buyers.latest')}`}</Pill> : undefined}
                />
                <View style={{ flexDirection: 'row', gap: t.space.sm }}>
                  <Button testID={`buyer-edit-${b.id}`} onPress={() => { setEditing(b.id); setName(b.name); }}>
                    {msg('buyers.edit')}
                  </Button>
                  <Button testID={`buyer-delete-${b.id}`} variant="destructive" onPress={() => void act(() => peopleStore.remove(b.id))}>
                    {msg('buyers.delete')}
                  </Button>
                </View>
              </View>
            ))}
          </Card>
          <Card>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('buyers.latestHelp')}</Text>
          </Card>
          <Card>
            <TextField testID="buyer-name" label={msg('buyers.name')} placeholder={msg('buyers.namePlaceholder')} value={name} onChangeText={setName} />
            <Button testID="buyer-save" variant="primary" onPress={() => void save()} disabled={!name.trim()}>
              {msg('common.save')}
            </Button>
          </Card>
          {deleted.length > 0 ? (
            <LinkButton testID="show-deleted" label={msg('peopleList.deletedLink', { n: deleted.length })} onPress={() => setShowDeleted(true)} />
          ) : null}
        </>
      )}
    </FarmScreen>
  );
}
