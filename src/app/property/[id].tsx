/**
 * Add (`/property/new`) or edit one farm — see `PropertyForm` (E03-S02).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { FarmScreen } from '../../components/farm-ui';
import { PropertyForm } from '../../components/PropertyForm';
import { useT } from '../../i18n';

export default function PropertyScreen() {
  const msg = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = id && id !== 'new' ? id : null;
  const back = '/properties' as Href;
  return (
    <FarmScreen title={msg(propertyId ? 'propertyForm.editTitle' : 'propertyForm.addTitle')} subtitle={msg('properties.title')} back={back}>
      <PropertyForm key={propertyId ?? 'new'} propertyId={propertyId} onDone={() => (router.canGoBack() ? router.back() : router.replace(back))} />
    </FarmScreen>
  );
}
