/**
 * ตั้งค่าวันขาย — see `SaleSettingsForm` (E03-S07).
 */

import type { Href } from 'expo-router';

import { FarmScreen } from '../components/farm-ui';
import { SaleSettingsForm } from '../components/SaleSettingsForm';
import { useT } from '../i18n';

export default function SaleSettingsScreen() {
  const msg = useT();
  return (
    <FarmScreen title={msg('saleSettings.title')} subtitle={msg('saleSettings.subtitle')} back={'/farm-data' as Href}>
      <SaleSettingsForm />
    </FarmScreen>
  );
}
