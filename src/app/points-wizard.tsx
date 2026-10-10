/**
 * The weighing-point set-up helper — see `PointsWizard` (E03-S03, D-73).
 */

import { useRouter, type Href } from 'expo-router';

import { FarmScreen } from '../components/farm-ui';
import { PointsWizard } from '../components/PointsWizard';
import { useT } from '../i18n';

export default function PointsWizardScreen() {
  const msg = useT();
  const router = useRouter();
  const back = '/properties' as Href;
  return (
    <FarmScreen title={msg('wizard.title')} subtitle={msg('properties.title')} back={back}>
      <PointsWizard onDone={() => (router.canGoBack() ? router.back() : router.replace(back))} />
    </FarmScreen>
  );
}
