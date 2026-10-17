/**
 * One person's money lines, shared by the share summary (page 17) and the
 * payment page (19), signed like the tally (E05-S09): money the person
 * receives from the farm is "+", money they pay out or have deducted is "−".
 */

import { Text } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { useT } from '../../i18n';
import { Kv } from './pieces';

/** "+1,500.00" / "−1,500.00": the sign is always written. */
export const signed = (satang: number) => `${satang === 0 ? '' : satang > 0 ? '+' : '−'}${formatSatang(Math.abs(satang))}`;

/** A label with its direction mark (↘ person → farm, ↗ farm → person), nested so it keeps Kv's font. */
export const WayLabel = ({ mark, text }: { mark: string; text: string }) => (
  <Text>
    <Text style={{ fontWeight: '700' }}>{mark} </Text>
    {text}
  </Text>
);

export function MoneyLines({
  personId,
  name,
  shareSatang,
  paidSatang,
  backSatang,
  adjustSatang,
}: {
  personId: string;
  name: string;
  shareSatang: number;
  /** Debt taken from the person at this sale (route + netting), as a positive amount. */
  paidSatang: number;
  /** What the farm gives back by netting, positive. */
  backSatang: number;
  /** Rounding already chosen for the person; 0 hides the line. */
  adjustSatang: number;
}) {
  const msg = useT();
  return (
    <>
      <Kv tone="plus" testID={`pm-${personId}-share`} label={msg('v2s.share')} value={signed(shareSatang)} />
      {paidSatang ? <Kv tone="din" testID={`pay-route-${personId}`} label={<WayLabel mark="↘" text={msg('v2s.payRouteAll', { name })} />} value={signed(-paidSatang)} /> : null}
      {backSatang ? <Kv tone="dout" testID={`pay-back-${personId}`} label={<WayLabel mark="↗" text={msg('v2s.payBack', { name })} />} value={signed(backSatang)} /> : null}
      {adjustSatang ? <Kv testID={`pm-${personId}-round`} label={msg('v2s.rounding')} value={signed(adjustSatang)} /> : null}
    </>
  );
}
