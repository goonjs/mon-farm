/**
 * Add (`/point/new?property=…`) or edit one weighing point — see `PointForm` (E03-S03).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { FarmScreen } from '../../components/farm-ui';
import { PointForm } from '../../components/PointForm';
import { useT } from '../../i18n';

export default function PointScreen() {
  const msg = useT();
  const router = useRouter();
  const { id, property } = useLocalSearchParams<{ id: string; property?: string }>();
  const pointId = id && id !== 'new' ? id : null;
  const back = '/properties' as Href;
  return (
    <FarmScreen title={msg(pointId ? 'pointForm.editTitle' : 'pointForm.addTitle')} subtitle={msg('properties.title')} back={back}>
      <PointForm
        key={pointId ?? 'new'}
        pointId={pointId}
        propertyId={property ?? null}
        onDone={() => (router.canGoBack() ? router.back() : router.replace(back))}
      />
    </FarmScreen>
  );
}
