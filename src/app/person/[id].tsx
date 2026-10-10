/**
 * One person (E03-S01): `/person/new` adds; `/person/<id>` is the read-only
 * detail (mockup v1.1.0 farm-05) and `?edit=1` its form (farm-04).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { FarmScreen } from '../../components/farm-ui';
import { PersonDetail } from '../../components/PersonDetail';
import { PersonForm } from '../../components/PersonForm';
import { useT } from '../../i18n';

export default function PersonScreen() {
  const msg = useT();
  const router = useRouter();
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const personId = id && id !== 'new' ? id : null;
  const back = '/people' as Href;
  const done = () => (router.canGoBack() ? router.back() : router.replace(back));
  if (personId && edit !== '1') {
    return (
      <PersonDetail
        key={personId}
        personId={personId}
        onEdit={() => router.push({ pathname: '/person/[id]', params: { id: personId, edit: '1' } })}
        onDone={done}
      />
    );
  }
  return (
    <FarmScreen title={msg(personId ? 'personForm.editTitle' : 'personForm.addTitle')} subtitle={msg('peopleList.title')} back={back}>
      <PersonForm key={personId ?? 'new'} personId={personId} onDone={done} />
    </FarmScreen>
  );
}
