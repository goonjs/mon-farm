/**
 * The weighing-point set-up helper — see `PointsWizard` (E03-S03, D-73).
 */

import { useRouter, type Href } from 'expo-router';

import { PointsWizard } from '../components/PointsWizard';

export default function PointsWizardScreen() {
  const router = useRouter();
  const back = '/properties' as Href;
  return <PointsWizard onDone={() => (router.canGoBack() ? router.back() : router.replace(back))} />;
}
