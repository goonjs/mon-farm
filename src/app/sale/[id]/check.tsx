/**
 * "ตรวจยอดกับคนรับซื้อยาง" (E05-S03). Our figures come from the sale log
 * through settle() — the same numbers the settlement shows — and the check
 * itself lives in the finance log (BuyerCheckPanel).
 */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { BuyerCheckPanel } from '../../../components/finance/BuyerCheckPanel';
import { Note, ScreenHeader } from '../../../components/finance/parts';
import { drillDown, saleFigures, shortByZone } from '../../../core/finance/buyer-check';
import { settle, SettlementUnavailable } from '../../../core/settle';
import { useT } from '../../../i18n';
import { useSale } from '../../../store/SaleProvider';
import { useTheme } from '../../../theme';

export default function CheckScreen() {
  const t = useTheme();
  const msg = useT();
  const { events, state } = useSale();
  const data = useMemo(() => {
    try {
      const s = settle(events, state);
      return { ours: saleFigures(s), shorts: shortByZone(s), drill: drillDown(events, state) };
    } catch (err) {
      // No price yet, or nothing weighed: there is nothing to check against. Anything else is a bug (review #4).
      if (err instanceof SettlementUnavailable) return null;
      throw err;
    }
  }, [events, state]);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader testID="check" title={msg('chk.title')} subtitle={state.parties?.farmName ?? undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        {data ? <BuyerCheckPanel saleId={state.id} ours={data.ours} shorts={data.shorts} drill={data.drill} /> : <Note testID="check-unavailable">{msg('settle.cannotSettle')}</Note>}
      </ScrollView>
    </View>
  );
}
