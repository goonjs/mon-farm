/**
 * E05-S11 · จ่ายเงิน · ปิดการขาย (A9, A19, A20). Stub from the contract commit; the owning worker fills it.
 */

import type { Href } from 'expo-router';

import { useT } from '../../../i18n';
import { FarmScreen } from '../../farm/pieces';

export function CloseoutPayScreen() {
  const msg = useT();
  return <FarmScreen title={msg('cop.title')} fallback={'/v2/sales' as Href} />;
}
