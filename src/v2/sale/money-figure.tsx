/**
 * The sale's money on a counter card: the amount and its unit word (หมื่น,
 * แสน) on one line. The ฿ sign sits beside the card's label ("ราคารวม ฿"),
 * not after the amount, where it used to drop onto a line of its own when the
 * amount was long (owner 2026-10-11).
 */

import { Text } from 'react-native';

import { useTheme } from '../../theme';

export function MoneyFigure({ value, testID }: { value: string; testID?: string }) {
  const t = useTheme();
  // "6.56 หมื่น": the unit word is set small, like "กก." beside the weight, so a long amount fits the card.
  const [amount, ...unit] = value.split(' ');
  return (
    <Text testID={testID} numberOfLines={1} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingXl, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
      {amount}
      {unit.length ? <Text style={{ fontSize: t.font.size.caption, fontWeight: t.font.weight.regular, color: t.color.inkSoft }}> {unit.join(' ')}</Text> : null}
    </Text>
  );
}
