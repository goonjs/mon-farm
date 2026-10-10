/**
 * One weighing point (E03-S03): `/point/new?property=…` adds; `/point/<id>`
 * is the read-only detail (mockup v1.1.0 farm-20) and `?edit=1` renames it.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { FarmScreen } from '../../components/farm-ui';
import { PointDetail } from '../../components/PointDetail';
import { PointForm } from '../../components/PointForm';
import { useT } from '../../i18n';

export default function PointScreen() {
  const msg = useT();
  const router = useRouter();
  const { id, property, edit } = useLocalSearchParams<{ id: string; property?: string; edit?: string }>();
  const pointId = id && id !== 'new' ? id : null;
  const back = '/properties' as Href;
  const done = () => (router.canGoBack() ? router.back() : router.replace(back));
  if (pointId && edit !== '1') {
    return (
      <PointDetail
        key={pointId}
        pointId={pointId}
        onRename={() => router.push({ pathname: '/point/[id]', params: { id: pointId, edit: '1' } })}
        onDone={done}
      />
    );
  }
  return (
    <FarmScreen title={msg(pointId ? 'pointForm.editTitle' : 'pointForm.addTitle')} subtitle={msg('properties.title')} back={back}>
      <PointForm key={pointId ?? 'new'} pointId={pointId} propertyId={property ?? null} onDone={done} />
    </FarmScreen>
  );
}
