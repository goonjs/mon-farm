/**
 * ข้อมูลฟาร์ม — the entry to the farm group's master data (E03-S01 AC7,
 * mockup v1.1.0 screen 2). Rows appear as their stories land: people and
 * buyers now; farms, weighing points, accounts and sale settings later.
 */

import { Link, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Card, FarmScreen, ListRow } from '../components/farm-ui';
import { filterPeople, type MasterState } from '../core/master';
import { useT } from '../i18n';
import { peopleStore } from '../store/people';
import { useTheme } from '../theme';

export default function FarmDataScreen() {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const reload = useCallback(() => {
    peopleStore.state().then(setState);
  }, []);
  useEffect(reload, [reload]);
  useFocusEffect(reload);

  const people = state ? filterPeople(state.people, 'all').length : 0;
  const buyers = state ? state.buyers.filter((b) => !b.deleted).length : 0;

  return (
    <FarmScreen title={msg('farmData.title')} back={'/' as Href}>
      <Card>
        <Link href={'/people' as Href} asChild>
          <ListRow testID="farm-data-people" title={msg('farmData.people')} lines={[msg('farmData.peopleCount', { n: people })]} />
        </Link>
        <Link href={'/buyers' as Href} asChild>
          <ListRow testID="farm-data-buyers" title={msg('farmData.buyers')} lines={[msg('farmData.buyersCount', { n: buyers })]} />
        </Link>
      </Card>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
        {msg('farmData.offlineNote')}
      </Text>
    </FarmScreen>
  );
}
