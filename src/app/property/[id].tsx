/**
 * One farm (E03-S02): `/property/new` adds; `/property/<id>` is the
 * read-only detail (mockup v1.1.0 farm-14) and `?edit=1` its form (farm-13).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { FarmScreen } from '../../components/farm-ui';
import { PropertyDetail } from '../../components/PropertyDetail';
import { PropertyForm } from '../../components/PropertyForm';
import { useT } from '../../i18n';

export default function PropertyScreen() {
  const msg = useT();
  const router = useRouter();
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const propertyId = id && id !== 'new' ? id : null;
  const back = '/properties' as Href;
  const done = () => (router.canGoBack() ? router.back() : router.replace(back));
  if (propertyId && edit !== '1') {
    return (
      <PropertyDetail
        key={propertyId}
        propertyId={propertyId}
        onEdit={() => router.push({ pathname: '/property/[id]', params: { id: propertyId, edit: '1' } })}
        onDone={done}
      />
    );
  }
  return (
    <FarmScreen title={msg(propertyId ? 'propertyForm.editTitle' : 'propertyForm.addTitle')} subtitle={msg('properties.title')} back={back}>
      <PropertyForm key={propertyId ?? 'new'} propertyId={propertyId} onDone={done} />
    </FarmScreen>
  );
}
