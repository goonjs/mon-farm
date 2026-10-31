/**
 * E05-S11 · ให้คนรับซื้อดู (A7, A12, A18). Stub from the contract commit; the owning worker fills it.
 */

import type { Href } from 'expo-router';

import { useT } from '../../../i18n';
import { FarmScreen } from '../../farm/pieces';

export function BuyerViewScreen() {
  const msg = useT();
  return <FarmScreen title={msg('cop.title')} fallback={'/v2/sales' as Href} />;
}
