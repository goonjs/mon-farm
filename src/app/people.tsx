/**
 * People — farm master data (E03-S01, mockup v1.1.0 screen 4).
 *
 * Filters: ทุกคน · roles · คนรับซื้อยาง (D-74 F12). Deleted people are behind
 * a small "ที่ลบแล้ว (n)" link, each labelled "ลบแล้ว" with a small restore
 * link (D-74 F13). No per-row sync badge: rows only ever show "ขัดกัน", and
 * conflicts arrive with E01-S11 (D-65 Q20); pending sync is the global
 * indicator's job (E01-S10).
 */

import { Link, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Button } from '../components/chrome';
import { Card, Chip, ChipRow, FarmScreen, LinkButton, ListRow, StateBadge } from '../components/farm-ui';
import { filterPeople, type MasterState } from '../core/master';
import type { BuiltinRole } from '../core/types';
import { useT, type Translate } from '../i18n';
import { peopleStore, type Person } from '../store/people';
import { useTheme } from '../theme';

type Filter = 'all' | 'buyers' | BuiltinRole;
const FILTERS: readonly Filter[] = ['all', 'tapper', 'worker', 'manager', 'buyers', 'owner'];

function roleLabels(p: Person, msg: Translate): string {
  return [...p.roles.map((r) => msg(`role.${r}`)), ...p.otherRoles].join(' · ');
}

export default function PeopleScreen() {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showDeleted, setShowDeleted] = useState(false);

  const reload = useCallback(() => {
    peopleStore.state().then(setState);
  }, []);
  useEffect(reload, [reload]);
  useFocusEffect(reload);

  const restore = async (id: string) => {
    await peopleStore.restore(id);
    reload();
  };

  const deleted = state ? [...state.people.filter((p) => p.deleted), ...state.buyers.filter((b) => b.deleted)] : [];
  const label = (f: Filter) => (f === 'all' ? msg('peopleList.all') : f === 'buyers' ? msg('peopleList.buyers') : msg(`role.${f}`));

  return (
    <FarmScreen
      title={msg('peopleList.title')}
      subtitle={msg('farmData.title')}
      back={'/farm-data' as Href}
      footer={
        <Link href={'/person/new' as Href} asChild>
          <Button testID="add-person" variant="primary">{msg('peopleList.add')}</Button>
        </Link>
      }
    >
      {showDeleted ? (
        <>
          <LinkButton testID="hide-deleted" label={msg('peopleList.hideDeleted')} onPress={() => setShowDeleted(false)} />
          <Card>
            {deleted.map((r) => (
              <ListRow
                key={r.id}
                testID={`deleted-${r.id}`}
                title={r.name}
                badge={
                  <>
                    <StateBadge text={msg('peopleList.deletedBadge')} />
                    <LinkButton testID={`restore-${r.id}`} label={msg('peopleList.restore')} onPress={() => void restore(r.id)} />
                  </>
                }
              />
            ))}
          </Card>
        </>
      ) : (
        <>
          <ChipRow>
            {FILTERS.map((f) => (
              <Chip key={f} testID={`filter-${f}`} label={label(f)} on={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ChipRow>
          <Card>
            {state && filter === 'buyers'
              ? state.buyers
                  .filter((b) => !b.deleted)
                  .map((b) => (
                    <Link key={b.id} href={'/buyers' as Href} asChild>
                      <ListRow testID={`buyer-${b.id}`} title={b.name} lines={[msg('peopleList.buyers')]} />
                    </Link>
                  ))
              : state &&
                filterPeople(state.people, filter === 'buyers' ? 'all' : filter).map((p) => (
                  <Link key={p.id} href={`/person/${p.id}` as Href} asChild>
                    <ListRow testID={`person-${p.id}`} title={p.name} lines={[roleLabels(p, msg)]} />
                  </Link>
                ))}
            {state && isEmpty(state, filter) ? (
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
                {msg('peopleList.empty')}
              </Text>
            ) : null}
          </Card>
          {deleted.length > 0 ? (
            <LinkButton testID="show-deleted" label={msg('peopleList.deletedLink', { n: deleted.length })} onPress={() => setShowDeleted(true)} />
          ) : null}
        </>
      )}
    </FarmScreen>
  );
}

function isEmpty(state: MasterState, filter: Filter): boolean {
  if (filter === 'buyers') return !state.buyers.some((b) => !b.deleted);
  return filterPeople(state.people, filter).length === 0;
}
