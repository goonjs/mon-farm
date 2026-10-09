/**
 * Worker debt accounts (E06-S03): every worker with a balance, and anyone in
 * the people list to open an account for. One account per worker (D-59).
 */

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, TopBar } from '../../../components/chrome';
import { Chip, ChipRow, Note } from '../../../components/finance/parts';
import { projectDebts } from '../../../core/finance/debts';
import { formatSatang } from '../../../core/finance/money';
import { useFinance } from '../../../finance/use-finance';
import { useSaleCounts } from '../../../finance/use-live-sales';
import { useT } from '../../../i18n';
import { peopleStore, type Person } from '../../../store/people';
import { useTheme } from '../../../theme';

export default function DebtsScreen() {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const counts = useSaleCounts();
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    peopleStore.list().then(setPeople, () => setPeople([]));
  }, []);

  const accounts = useMemo(() => [...projectDebts(fin.events ?? [], counts).values()], [fin.events, counts]);
  const open = (id: string, name: string) => router.push({ pathname: '/finance/debts/[workerId]', params: { workerId: id, name } });

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={msg('debt.list.title')} right={<Button testID="debts-back" onPress={() => router.back()}>{msg('common.back')}</Button>} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        {accounts.length === 0 ? <Note testID="debts-empty">{msg('debt.list.empty')}</Note> : null}
        {accounts.map((a) => (
          <Button key={a.worker.id} testID={`debt-account-${a.worker.id}`} onPress={() => open(a.worker.id, a.worker.name)}>
            {`${a.worker.name} · ${formatSatang(a.balanceSatang)}${a.overpaid ? ' ⚠' : ''}`}
          </Button>
        ))}
        <View style={{ gap: t.space.xs }}>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {msg('debt.list.pick')}
          </Text>
          <ChipRow>
            {people.map((p) => (
              <Chip key={p.id} testID={`debt-person-${p.id}`} onPress={() => open(p.id, p.name)}>
                {p.name}
              </Chip>
            ))}
          </ChipRow>
        </View>
      </ScrollView>
    </View>
  );
}
