/**
 * A tapper's share over time on its own screen (E03-S06, mockup v1.1.0
 * farm-22), reached from the person's detail.
 */

import { useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { FarmScreen } from '../../components/farm-ui';
import { TapperShare } from '../../components/TapperShare';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';

export default function ShareScreen() {
  const msg = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  useEffect(() => {
    peopleStore.get(id).then((p) => setName(p?.name ?? ''));
  }, [id]);
  return (
    <FarmScreen title={msg('share.title')} subtitle={name} back={`/person/${id}` as Href}>
      <TapperShare tapperId={id} />
    </FarmScreen>
  );
}
