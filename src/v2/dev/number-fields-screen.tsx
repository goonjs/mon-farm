/**
 * /v2/dev/number-fields — dev-only gallery of QuantityField and MoneyField
 * (E11-S11 UI-2), reached by direct URL like /v2/dev/icons. Lets the team see
 * and measure the real components at phone size before a flow uses them.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { V2_HOME } from '../routes';
import { useTheme } from '../../theme';
import { MoneyField, QuantityField, ScreenHeader } from '../../ui';
import { formatSatang } from '../../core/finance/money';

export function NumberFieldsScreen() {
  const t = useTheme();
  const router = useRouter();
  const [sacks, setSacks] = useState<number | null>(20);
  const [price, setPrice] = useState<number | null>(115000);
  const [big, setBig] = useState<number | null>(125000050);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title="ช่องตัวเลข (พรีวิว)" back={{ label: 'กลับ', onPress: () => (router.canGoBack() ? router.back() : router.replace(V2_HOME)), testID: 'dev-numbers-back' }} />
      <View style={{ padding: t.layout.screenPaddingX, gap: t.space.lg }}>
        <QuantityField testID="qty" label="กี่กระสอบ" unit="กระสอบ" value={sacks} onChange={setSacks} min={1} caption={(n) => `รวม ${((n ?? 0) * 50).toLocaleString('en-US')} กก.`} />
        <MoneyField testID="price" label="ราคาต่อกระสอบ" unit="บาท / กระสอบ" satang={price} onChange={setPrice} below={(s) => (s !== null && sacks ? `${sacks} × ${formatSatang(s)} = ${formatSatang(s * sacks)}` : undefined)} />
        <MoneyField testID="big" label="ยอดรวมทั้งใบ" unit="บาท" satang={big} onChange={setBig} />
      </View>
    </View>
  );
}
