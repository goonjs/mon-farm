/**
 * E05-S11 · สรุปจ่ายเงิน (A1–A5, A8, A10, A14–A16, A22–A26). Stub from the contract commit; the owning worker fills it.
 */

import type { Href } from 'expo-router';

import { useT } from '../../../i18n';
import { FarmScreen } from '../../farm/pieces';

export function CloseoutSummaryScreen() {
  const msg = useT();
  return <FarmScreen title={msg('co.title')} fallback={'/v2/sales' as Href} />;
}
