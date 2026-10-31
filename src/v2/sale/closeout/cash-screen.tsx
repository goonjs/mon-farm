/**
 * E05-S11 · จัดเงินสดกับคนรับซื้อยาง (A6, A11, A13, A17). Stub from the contract commit; the owning worker fills it.
 */

import type { Href } from 'expo-router';

import { useT } from '../../../i18n';
import { FarmScreen } from '../../farm/pieces';

export function CloseoutCashScreen() {
  const msg = useT();
  return <FarmScreen title={msg('cop.title')} fallback={'/v2/sales' as Href} />;
}
