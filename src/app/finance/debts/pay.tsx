/**
 * Record a payment outside a sale (E06-S03, flow-farm v1.1.0 page 24).
 *
 * Pick which debt: the one owed to the farm, or one owed to an outside
 * lender the worker repays directly (D-69). Paying more than is owed warns
 * first, then lets the owner fix the amount or save anyway — a negative
 * balance means the farm owes the worker (F10).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, TopBar } from '../../../components/chrome';
import { Chip, ChipRow, Input, Label, Note } from '../../../components/finance/parts';
import { projectDebts } from '../../../core/finance/debts';
import { formatDate, formatSatang, parseBahtToSatang, todayIso } from '../../../core/finance/money';
import { FARM_FUNDS, type Payer } from '../../../core/finance/types';
import { useFinance } from '../../../finance/use-finance';
import { useSaleCounts } from '../../../finance/use-live-sales';
import { useT } from '../../../i18n';
import { newId } from '../../../lib/id';
import { useTheme } from '../../../theme';
import { useInFlight } from '../../../finance/use-in-flight';

export default function DebtPaymentScreen() {
  const { workerId, name } = useLocalSearchParams<{ workerId: string; name: string }>();
  const worker: Payer = { id: workerId, name: name ?? '' };
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const counts = useSaleCounts();
  const account = useMemo(() => projectDebts(fin.events ?? [], counts).get(workerId), [fin.events, counts, workerId]);
  const farm: Payer = { id: FARM_FUNDS, name: msg('fin.payer.farm') };

  const options = [
    { creditor: farm, balance: account?.balanceSatang ?? 0 },
    ...(account?.others ?? []).map((o) => ({ creditor: o.lender, balance: o.balanceSatang })),
  ];
  const [creditorId, setCreditorId] = useState(FARM_FUNDS);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [confirmOver, setConfirmOver] = useState(false);
  const inFlight = useInFlight();
  const saving = inFlight.busy;
  const [failed, setFailed] = useState(false);

  const chosen = options.find((o) => o.creditor.id === creditorId) ?? options[0];
  const satang = parseBahtToSatang(amount) ?? 0;
  const after = chosen.balance - satang;
  const over = satang > 0 && after < 0;

  const save = async (anyway: boolean) => {
    if (satang <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (over && !anyway) {
      setConfirmOver(true);
      return;
    }
    try {
      await fin.write(newId('dpay-'), null, {
        t: 'debt_payment_recorded',
        fields: { worker, creditor: chosen.creditor, amountSatang: satang, date, note: note.trim(), method: 'outside', saleId: null },
      });
      router.back();
    } catch (err) {
      console.error('Payment could not be stored.', err);
      setFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={msg('debt.pay.title', { name: worker.name })} right={<Button testID="debt-pay-back" onPress={() => router.back()}>{msg('common.back')}</Button>} />
      {/* Until the log has loaded the balance is unknown, not zero (review #8). */}
      {fin.events === null ? null : (
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.lg }}>
        <View style={{ gap: t.space.xs }}>
          <Label>{msg('debt.pay.which')}</Label>
          <ChipRow>
            {options.map((o) => (
              <Chip key={o.creditor.id} testID={`debt-pay-to-${o.creditor.id}`} on={chosen.creditor.id === o.creditor.id} onPress={() => setCreditorId(o.creditor.id)}>
                {o.creditor.id === FARM_FUNDS
                  ? msg('debt.pay.farm', { amount: formatSatang(o.balance) })
                  : msg('debt.pay.other', { name: o.creditor.name, amount: formatSatang(o.balance) })}
              </Chip>
            ))}
          </ChipRow>
        </View>
        <View style={{ gap: t.space.xs }}>
          <Label hint={msg('fin.form.amountHint')}>{msg('debt.form.amount')}</Label>
          <Input testID="debt-pay-amount" numeric value={amount} onChangeText={(v) => { setAmount(v); setConfirmOver(false); }} accessibilityLabel={msg('debt.form.amount')} />
          {satang > 0 ? <Note testID="debt-pay-after">{msg('debt.pay.after', { amount: formatSatang(after) })}</Note> : null}
        </View>
        <View style={{ gap: t.space.xs }}>
          <Label hint={formatDate(date)}>{msg('debt.form.date')}</Label>
          <Input testID="debt-pay-date" value={date} onChangeText={setDate} accessibilityLabel={msg('debt.form.date')} />
        </View>
        <View style={{ gap: t.space.xs }}>
          <Label>{msg('debt.form.note')}</Label>
          <Input testID="debt-pay-note" multiline value={note} onChangeText={setNote} placeholder={msg('fin.form.notePlaceholder')} />
        </View>
        {confirmOver ? (
          <View testID="debt-pay-over" style={{ gap: t.space.sm, padding: t.space.sm, borderRadius: t.radius.md, backgroundColor: t.color.warnSunk }}>
            <Note tone="warn">{msg('debt.pay.over', { amount: formatSatang(chosen.balance) })}</Note>
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <Button testID="debt-pay-fix" onPress={() => setConfirmOver(false)}>{msg('debt.pay.fix')}</Button>
              <Button testID="debt-pay-anyway" variant="primary" disabled={saving} onPress={() => void inFlight.run(() => save(true))}>{msg('debt.pay.anyway')}</Button>
            </View>
          </View>
        ) : (
          <Button testID="debt-pay-save" variant="primary" disabled={satang <= 0 || saving} onPress={() => void inFlight.run(() => save(false))}>
            {msg('fin.form.save')}
          </Button>
        )}
        {failed ? <Note tone="reject">{msg('fin.form.saveFailed')}</Note> : null}
      </ScrollView>
      )}
    </View>
  );
}
