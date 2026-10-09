/**
 * Manager salary (E11-S04, FIN-5): a monthly rule — recipient, amount, payer
 * (default the owner), first month. Each month up to next month appears as a
 * committed expense; "จ่ายแล้ว" makes it actual. A new amount applies from a
 * chosen month and never rewrites a month already paid. A payer who is not
 * farm funds is owed it back, listed apart from other debts (FIN-5).
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, TopBar } from '../../components/chrome';
import { Input, Label, Note, PayerPicker, StageTag } from '../../components/finance/parts';
import { formatMonth, formatSatang, parseBahtToSatang, todayIso } from '../../core/finance/money';
import type { FinanceEvent, Payer, SalaryRule } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { useTheme } from '../../theme';

export default function SalaryScreen() {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const inFlight = useInFlight();
  const [adding, setAdding] = useState(false);

  const rules = useMemo(
    () => (fin.events ?? []).filter((e): e is FinanceEvent & { payload: { t: 'salary_set'; rule: SalaryRule } } => e.payload.t === 'salary_set'),
    [fin.events],
  );

  const mark = (ruleTarget: string, month: string, amountSatang: number, date: string, paid: boolean) =>
    inFlight.run(async () => {
      const target = `${ruleTarget}:${month}`;
      const marks = (fin.events ?? []).filter((e) => e.targetId === target);
      const head = marks.filter((e) => !marks.some((o) => o.baseEventId === e.id)).map((e) => e.id).sort().at(-1) ?? null;
      await fin.write(target, head, paid ? { t: 'salary_paid', month, amountSatang, date } : { t: 'salary_unpaid', month });
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={msg('sal.title')} right={<Button testID="salary-back" onPress={() => router.back()}>{msg('common.back')}</Button>} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        {adding ? (
          <RuleForm
            onCancel={() => setAdding(false)}
            onSave={(rule) =>
              inFlight.run(async () => {
                await fin.write(newId('salary-'), null, { t: 'salary_set', rule });
                setAdding(false);
              })
            }
          />
        ) : (
          <Button testID="salary-add" variant="primary" onPress={() => setAdding(true)}>{msg('sal.add')}</Button>
        )}
        {rules.length === 0 && !adding ? <Note testID="salary-empty">{msg('sal.empty')}</Note> : null}
        {rules.map((r) => {
          const months = (fin.state?.expenses ?? []).filter((x) => x.id.startsWith(`${r.targetId}:`));
          return (
            <View key={r.id} testID={`salary-${r.targetId}`} style={{ gap: t.space.xs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.rule }}>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                {`${r.payload.rule.recipient.name} · ${formatSatang(r.payload.rule.amountSatang)}`}
              </Text>
              <Note>{`${msg('sal.payer')}: ${r.payload.rule.payer.name}`}</Note>
              <Note>{msg('sal.owedNote')}</Note>
              {months.map((x) => {
                const month = x.id.slice(r.targetId.length + 1);
                return (
                  <View key={x.id} testID={`salary-month-${month}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                    <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>
                      {msg('sal.month', { month: formatMonth(month), amount: formatSatang(x.amountSatang ?? 0) })}
                    </Text>
                    <StageTag stage={x.stage} />
                    {x.stage === 'actual' ? (
                      <Button testID={`salary-undo-${month}`} onPress={() => void mark(r.targetId, month, 0, '', false)}>{msg('sal.undo')}</Button>
                    ) : (
                      <Button testID={`salary-pay-${month}`} variant="primary" onPress={() => void mark(r.targetId, month, x.amountSatang ?? 0, todayIso(), true)}>
                        {msg('sal.markPaid')}
                      </Button>
                    )}
                  </View>
                );
              })}
              <Raise onSave={(fromMonth, amountSatang) => inFlight.run(async () => { await fin.write(r.targetId, null, { t: 'salary_amount_set', fromMonth, amountSatang }); })} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RuleForm({ onSave, onCancel }: { onSave: (r: SalaryRule) => Promise<void>; onCancel: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [recipient, setRecipient] = useState<Payer | null>(null);
  const [payer, setPayer] = useState<Payer | null>(null);
  const [amount, setAmount] = useState('15000');
  const [start, setStart] = useState(todayIso().slice(0, 7));
  const [due, setDue] = useState('28');
  const satang = parseBahtToSatang(amount);
  const dueDay = Number(due);
  const ok = !!recipient && !!payer && !!satang && /^\d{4}-\d{2}$/.test(start) && Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 28;

  return (
    <View testID="salary-form" style={{ gap: t.space.sm, padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk }}>
      <Label>{msg('sal.recipient')}</Label>
      <PayerPicker testID="salary-recipient" value={recipient} onChange={setRecipient} />
      <Label>{msg('sal.payer')}</Label>
      <PayerPicker testID="salary-payer" value={payer} onChange={setPayer} />
      <Label>{msg('sal.amount')}</Label>
      <Input testID="salary-amount" numeric value={amount} onChangeText={setAmount} accessibilityLabel={msg('sal.amount')} />
      <Label>{msg('sal.start')}</Label>
      <Input testID="salary-start" value={start} onChangeText={setStart} accessibilityLabel={msg('sal.start')} />
      <Label>{msg('sal.due')}</Label>
      <Input testID="salary-due" numeric value={due} onChangeText={setDue} accessibilityLabel={msg('sal.due')} />
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button onPress={onCancel}>{msg('common.cancel')}</Button>
        <Button
          testID="salary-save"
          variant="primary"
          disabled={!ok}
          onPress={() => void onSave({ recipient: recipient!, payer: payer!, amountSatang: satang!, startMonth: start, dueDay })}
        >
          {msg('common.save')}
        </Button>
      </View>
    </View>
  );
}

function Raise({ onSave }: { onSave: (fromMonth: string, amountSatang: number) => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(todayIso().slice(0, 7));
  const [amount, setAmount] = useState('');
  const satang = parseBahtToSatang(amount);
  if (!open) return <Button testID="salary-raise" onPress={() => setOpen(true)}>{msg('sal.raise')}</Button>;
  return (
    <View style={{ gap: t.space.xs }}>
      <Note>{msg('sal.raiseNote')}</Note>
      <Input testID="salary-raise-from" value={from} onChangeText={setFrom} accessibilityLabel={msg('sal.raiseFrom')} placeholder={msg('sal.raiseFrom')} />
      <Input testID="salary-raise-amount" numeric value={amount} onChangeText={setAmount} accessibilityLabel={msg('sal.amount')} placeholder={msg('sal.amount')} />
      <Button
        testID="salary-raise-save"
        variant="primary"
        disabled={!satang || !/^\d{4}-\d{2}$/.test(from)}
        onPress={() => void onSave(from, satang!).then(() => setOpen(false))}
      >
        {msg('common.save')}
      </Button>
    </View>
  );
}
