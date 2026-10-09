/**
 * Special payments per worker (E11-S05, FIN-6): totals per worker over a
 * date range, each opening the payments behind it. These never touch a
 * sale's settlement or the 50% share — they are farm expenses with a worker.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, TopBar } from '../../components/chrome';
import { Input, Label, Note } from '../../components/finance/parts';
import { formatDate, formatSatang, todayIso } from '../../core/finance/money';
import { aidByWorker } from '../../core/finance/plan';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

export default function AidScreen() {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const [from, setFrom] = useState(`${todayIso().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(todayIso());
  const rows = useMemo(() => (fin.state ? aidByWorker(fin.state, from, to) : []), [fin.state, from, to]);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={msg('aid.title')} right={<Button testID="aid-back" onPress={() => router.back()}>{msg('common.back')}</Button>} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        <View style={{ flexDirection: 'row', gap: t.space.xs }}>
          <View style={{ flex: 1 }}>
            <Input testID="aid-from" value={from} onChangeText={setFrom} accessibilityLabel="from" />
          </View>
          <View style={{ flex: 1 }}>
            <Input testID="aid-to" value={to} onChangeText={setTo} accessibilityLabel="to" />
          </View>
        </View>
        <Label>{msg('aid.range', { from: formatDate(from), to: formatDate(to) })}</Label>
        <Note>{msg('aid.note')}</Note>
        {rows.length === 0 ? <Note testID="aid-empty">{msg('aid.empty')}</Note> : null}
        {rows.map((r) => (
          <View key={r.worker.id} style={{ gap: t.space.xxs }}>
            <Note testID={`aid-${r.worker.id}`}>{msg('aid.row', { name: r.worker.name, amount: formatSatang(r.totalSatang), n: r.ids.length })}</Note>
            {r.ids.map((id) => (
              <Button key={id} testID={`aid-item-${id}`} onPress={() => router.push({ pathname: '/finance/expense/[id]', params: { id } })}>
                {(() => {
                  const x = fin.state?.expenses.find((e) => e.id === id);
                  return x ? `${formatDate(x.date)} · ${x.aidKind ? msg(`aid.kind.${x.aidKind}`) : ''} · ${formatSatang(x.amountSatang ?? 0)}` : id;
                })()}
              </Button>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
