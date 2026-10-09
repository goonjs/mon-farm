/**
 * Record a repayment (E11-S03).
 *
 * Who repays whom: from farm funds by default, to the person owed by default,
 * both changeable (D-59). One amount covers several debts of the same person,
 * oldest first (D-67), or split by hand. More than is owed is refused before
 * saving; two phones repaying past the total offline is flagged by the
 * projection instead (see `ledger.ts`).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, TopBar } from '../../components/chrome';
import { Chip, ChipRow, Input, Label, Note, PayerPicker } from '../../components/finance/parts';
import { allocateOldestFirst, type Reimbursement } from '../../core/finance/ledger';
import { formatDate, formatSatang, parseBahtToSatang, satangToInput, todayIso } from '../../core/finance/money';
import { FARM_FUNDS, type Allocation, type Payer } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { useTheme } from '../../theme';

export default function RepayScreen() {
  const { payerId, ids } = useLocalSearchParams<{ payerId: string; ids?: string }>();
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();

  const debts = useMemo(() => {
    const only = ids ? new Set(ids.split(',')) : null;
    return (fin.state?.reimbursements ?? []).filter(
      (r) => r.to.id === payerId && r.remainingSatang > 0 && (!only || only.has(r.expenseId)),
    );
  }, [fin.state, payerId, ids]);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={msg('fin.repay.title')}
        right={<Button testID="repay-back" onPress={leave}>{msg('common.back')}</Button>}
      />
      {fin.state === null ? (
        <Text style={{ padding: t.space.md, fontFamily: t.font.family.mono, color: t.color.inkSoft }}>{msg('counter.loading')}</Text>
      ) : debts.length === 0 ? (
        <View style={{ padding: t.space.md }}>
          <Note testID="repay-nothing">{msg('fin.repay.nothing')}</Note>
        </View>
      ) : (
        <Form debts={debts} fin={fin} categoryOf={(id) => {
          const x = fin.state?.expenses.find((e) => e.id === id);
          return fin.state?.categories.find((c) => c.id === x?.categoryId)?.name ?? '';
        }} />
      )}
    </View>
  );
}

function Form({ debts, fin, categoryOf }: { debts: readonly Reimbursement[]; fin: ReturnType<typeof useFinance>; categoryOf: (expenseId: string) => string }) {
  const t = useTheme();
  const msg = useT();
  const max = debts.reduce((s, d) => s + d.remainingSatang, 0);
  const payee = debts[0].to;

  const [from, setFrom] = useState<Payer | null>({ id: FARM_FUNDS, name: msg('fin.payer.farm') });
  const [to, setTo] = useState<Payer | null>(payee);
  const [amount, setAmount] = useState(satangToInput(max));
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [manual, setManual] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);

  const auto = allocateOldestFirst(debts, parseBahtToSatang(amount) ?? 0);
  const manualAllocs: Allocation[] | null = manual
    ? debts.map((d) => ({ expenseId: d.expenseId, satang: parseBahtToSatang(manual[d.expenseId] ?? '') ?? -1 }))
    : null;
  const manualBad = manualAllocs?.some((a, i) => a.satang < 0 || a.satang > debts[i].remainingSatang) ?? false;
  const allocations = manualAllocs ? manualAllocs.filter((a) => a.satang > 0) : auto.ok ? auto.allocations : [];
  const total = allocations.reduce((s, a) => s + a.satang, 0);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const canSave = !!from && !!to && validDate && total > 0 && (manual ? !manualBad : auto.ok);

  const save = async () => {
    if (!canSave || !from || !to) return;
    try {
      await fin.write(newId('rp-'), null, {
        t: 'repayment_recorded',
        fields: { from, to, amountSatang: total, date, note: note.trim(), allocations, saleId: null },
      });
      leave();
    } catch (err) {
      console.error('Repayment could not be stored.', err);
      setFailed(true);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.lg }}>
      <View style={{ gap: t.space.xs }}>
        <Label>{msg('fin.repay.who')}</Label>
        <Note>{msg('fin.repay.from')}</Note>
        <PayerPicker testID="repay-from" value={from} onChange={setFrom} extra={[payee]} />
        <Note>{msg('fin.repay.to')}</Note>
        <PayerPicker testID="repay-to" value={to} onChange={setTo} extra={[payee]} />
      </View>

      {!manual ? (
        <View style={{ gap: t.space.xs }}>
          <Label hint={msg('fin.form.amountHint')}>{msg('fin.repay.amount')}</Label>
          <Input testID="repay-amount" numeric value={amount} onChangeText={setAmount} accessibilityLabel={msg('fin.repay.amount')} />
          {!auto.ok && auto.reason === 'over' ? (
            <Note tone="reject" testID="repay-over">{msg('fin.repay.over', { max: formatSatang(auto.maxSatang) })}</Note>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: t.space.xs }}>
        <Label hint={formatDate(date)}>{msg('fin.form.date')}</Label>
        <Input testID="repay-date" value={date} onChangeText={setDate} accessibilityLabel={msg('fin.form.date')} />
      </View>

      <View style={{ gap: t.space.sm }}>
        <Label>{manual ? msg('fin.repay.manual') : msg('fin.repay.oldestFirst')}</Label>
        {debts.map((d) => {
          const take = allocations.find((a) => a.expenseId === d.expenseId)?.satang ?? 0;
          return (
            <View key={d.expenseId} testID={`repay-line-${d.expenseId}`} style={{ gap: t.space.xxs, padding: t.space.sm, borderRadius: t.radius.md, backgroundColor: t.color.surfaceSunk }}>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                {`${categoryOf(d.expenseId)} · ${formatDate(d.date)}`}
              </Text>
              {manual ? (
                <>
                  <Input
                    testID={`repay-manual-${d.expenseId}`}
                    numeric
                    value={manual[d.expenseId] ?? ''}
                    onChangeText={(v) => setManual((m) => ({ ...(m ?? {}), [d.expenseId]: v }))}
                    accessibilityLabel={`${categoryOf(d.expenseId)} ${formatDate(d.date)}`}
                  />
                  {(parseBahtToSatang(manual[d.expenseId] ?? '') ?? 0) > d.remainingSatang ? (
                    <Note tone="reject">{msg('fin.repay.overItem')}</Note>
                  ) : null}
                </>
              ) : null}
              <Note>
                {`${msg('fin.repay.line', { remaining: formatSatang(d.remainingSatang), take: formatSatang(take) })} · ${msg(
                  take === 0 ? 'fin.status.owed' : take === d.remainingSatang ? 'fin.status.repaid' : 'fin.status.partial',
                )}`}
              </Note>
            </View>
          );
        })}
        <ChipRow>
          <Chip
            testID="repay-mode"
            onPress={() =>
              setManual((m) =>
                m ? null : Object.fromEntries(debts.map((d) => [d.expenseId, satangToInput(allocations.find((a) => a.expenseId === d.expenseId)?.satang ?? 0)])),
              )
            }
          >
            {manual ? msg('fin.repay.auto') : msg('fin.repay.manual')}
          </Chip>
        </ChipRow>
      </View>

      <View style={{ gap: t.space.xs }}>
        <Label>{msg('fin.form.note')}</Label>
        <Input testID="repay-note" multiline value={note} onChangeText={setNote} placeholder={msg('fin.form.notePlaceholder')} />
      </View>

      {failed ? <Note tone="reject">{msg('fin.form.saveFailed')}</Note> : null}
      <Button testID="repay-save" variant="primary" disabled={!canSave} onPress={() => void save()}>
        {`${msg('fin.form.save')} · ${formatSatang(total)}`}
      </Button>
    </ScrollView>
  );
}

/** Back to where the user came from — replacing would stack a second copy of that screen. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/finance/owed');
}
