/**
 * CompactMoney — a short figure for a summary line ("฿ 3,250", "฿ 12.54k").
 * The k / m is its own bold, action-coloured run so a reader sees at once the
 * number is rounded and what scale it is. Screen readers hear the exact
 * amount. The sums never come from this text (core/compact-money.ts).
 */

import { Text, type TextStyle } from 'react-native';

import { compactMoneyParts } from '../core/compact-money';
import { formatSatang } from '../core/finance/money';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export function CompactMoney({
  satang,
  size = 'bodyLg',
  color,
  testID,
}: {
  satang: number;
  size?: 'bodyLg' | 'lead' | 'title' | 'figure';
  color?: string;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  const p = compactMoneyParts(satang);
  const base: TextStyle = {
    fontFamily: t.font.family.sans,
    fontSize: t.font.size[size],
    fontWeight: t.font.weight.bold,
    fontVariant: ['tabular-nums'],
    color: color ?? t.color.ink,
  };
  return (
    <Text testID={testID} accessibilityLabel={`${formatSatang(satang)} ${msg('v2.baht')}`} style={base}>
      {`${p.sign}฿ ${p.digits}`}
      {p.unit ? (
        <Text testID={testID ? `${testID}-unit` : undefined} style={{ fontWeight: t.font.weight.black, color: t.color.action }}>
          {p.unit}
        </Text>
      ) : null}
    </Text>
  );
}
