/**
 * MoneyText — an amount with its direction said three ways: a word ("รับ" /
 * "จ่าย" or the caller's own, e.g. "หักหนี้"), a sign (+ or the true minus
 * −), and the moneyIn / moneyOut role. Tabular sans figures so columns line
 * up — never monospace. Formatting the number is the caller's job (core
 * money logic); this only presents it.
 */

import { Text, type TextStyle } from 'react-native';

import { useT } from '../i18n';
import { useTheme } from '../theme';

const MINUS = '−';

export function MoneyText({
  amount,
  direction,
  word,
  size = 'bodyLg',
  testID,
}: {
  /** Already formatted, without a sign, e.g. "3,000.00". */
  amount: string;
  direction: 'in' | 'out';
  /** Overrides the default "รับ" / "จ่าย". */
  word?: string;
  size?: 'bodyLg' | 'lead' | 'title' | 'figure';
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  const said = word ?? msg(direction === 'in' ? 'v2.moneyIn' : 'v2.moneyOut');
  const sign = direction === 'in' ? '+' : MINUS;
  const baht = msg('v2.baht');
  const style: TextStyle = {
    fontFamily: t.font.family.sans,
    fontSize: t.font.size[size],
    fontWeight: t.font.weight.bold,
    fontVariant: ['tabular-nums'],
    color: direction === 'in' ? t.color.moneyIn : t.color.moneyOut,
  };
  return (
    <Text testID={testID} accessibilityLabel={`${said} ${amount} ${baht}`} style={style}>
      <Text style={{ fontWeight: t.font.weight.semibold }}>{said}</Text>
      {` ${sign}${amount} ${baht}`}
    </Text>
  );
}
