/**
 * Add (`/person/new`) or edit one person — see `PersonForm` (E03-S01).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { FarmScreen } from '../../components/farm-ui';
import { PersonForm } from '../../components/PersonForm';
import { useT } from '../../i18n';

export default function PersonScreen() {
  const msg = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = id && id !== 'new' ? id : null;
  const back = '/people' as Href;
  return (
    <FarmScreen title={msg(personId ? 'personForm.editTitle' : 'personForm.addTitle')} subtitle={msg('peopleList.title')} back={back}>
      <PersonForm key={personId ?? 'new'} personId={personId} onDone={() => (router.canGoBack() ? router.back() : router.replace(back))} />
    </FarmScreen>
  );
}
