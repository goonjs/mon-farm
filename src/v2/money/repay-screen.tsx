/**
 * บันทึกการคืน — v1.1.0 farm mockup screen 21 (E11-S03 · D-59, D-67),
 * rebuilt on src/ui (D-82).
 *
 * Who repays whom: farm funds → the person owed by default, both
 * changeable. One amount covers several debts of the same person, oldest
 * first, or split by hand. More than is owed is refused before saving.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { allocateOldestFirst, type Reimbursement } from '../../core/finance/ledger';
import { formatDate, formatSatang, parseBahtToSatang, satangToInput, todayIso } from '../../core/finance/money';
import { FARM_FUNDS, type Allocation, type Payer } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, CalendarIcon, Card, CardLabel, Check, FactRow, ReceiptIcon, ScreenHeader, TextField, type HeaderPrimaryAction } from '../../ui';
import { HalfDot } from './expenses-screen';
import { Day, PayerPicker, SectionLabel } from './pieces';

export function RepayScreen() {
  const { payerId, ids } = useLocalSearchParams<{ payerId: string; ids?: string }>();
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const fin = useFinance();

  const debts = useMemo(() => {
    const only = ids ? new Set(ids.split(',')) : null;
    return (fin.state?.reimbursements ?? []).filter((r) => r.to.id === payerId && r.remainingSatang > 0 && (!only || only.has(r.expenseId)));
  }, [fin.state, payerId, ids]);

  const header = (action?: HeaderPrimaryAction) => (
    <ScreenHeader title={msg('fin.repay.title')} back={{ label: msg('v2.back'), onPress: leave, testID: 'repay-back' }} sync={sync} action={action} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      {fin.state === null ? (
        <>
          {header()}
          <AppText variant="bodySm" style={{ padding: t.space.lg }}>{msg('counter.loading')}</AppText>
        </>
      ) : debts.length === 0 ? (
        <>
          {header()}
          <AppText testID="repay-nothing" style={{ padding: t.space.lg }}>{msg('fin.repay.nothing')}</AppText>
        </>
      ) : (
        <Form
          debts={debts}
          fin={fin}
          header={header}
          categoryOf={(id) => {
            const x = fin.state?.expenses.find((e) => e.id === id);
            return fin.state?.categories.find((c) => c.id === x?.categoryId)?.name ?? '';
          }}
        />
      )}
    </View>
  );
}

function Form({ debts, fin, categoryOf, header }: { debts: readonly Reimbursement[]; fin: ReturnType<typeof useFinance>; categoryOf: (expenseId: string) => string; header: (action?: HeaderPrimaryAction) => ReactNode }) {
  const t = useTheme();
  const msg = useT();
  const max = debts.reduce((s, d) => s + d.remainingSatang, 0);
  const payee = debts[0].to;

  const [from, setFrom] = useState<Payer | null>({ id: FARM_FUNDS, name: msg('fin.payer.farm') });
  const [to, setTo] = useState<Payer | null>(payee);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [amount, setAmount] = useState(satangToInput(max));
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [manual, setManual] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useInFlight();

  const auto = allocateOldestFirst(debts, parseBahtToSatang(amount) ?? 0);
  const manualAllocs: Allocation[] | null = manual ? debts.map((d) => ({ expenseId: d.expenseId, satang: parseBahtToSatang(manual[d.expenseId] ?? '') ?? -1 })) : null;
  const manualBad = manualAllocs?.some((a, i) => a.satang < 0 || a.satang > debts[i].remainingSatang) ?? false;
  const allocations = manualAllocs ? manualAllocs.filter((a) => a.satang > 0) : auto.ok ? auto.allocations : [];
  const total = allocations.reduce((s, a) => s + a.satang, 0);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const canSave = !!from && !!to && validDate && total > 0 && (manual ? !manualBad : auto.ok);

  const save = async () => {
    if (!canSave || !from || !to) return;
    setFailed(false);
    try {
      await fin.write(newId('rp-'), null, { t: 'repayment_recorded', fields: { from, to, amountSatang: total, date, note: note.trim(), allocations, saleId: null } });
      leave();
    } catch (err) {
      console.error('Repayment could not be stored.', err);
      setFailed(true);
    }
  };

  return (
    <>
      {header({ label: `${msg('fin.form.save')} · ${formatSatang(total)}`, savingLabel: `${msg('common.saving')} · ${formatSatang(total)}`, testID: 'repay-save', disabled: !canSave, saving: inFlight.busy, onPress: () => void inFlight.run(save) })}
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg, paddingBottom: t.space[16] * 2 }}>
        <View style={{ gap: t.space.sm }}>
          <SectionLabel>{msg('fin.repay.who')}</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <Party label={msg('fin.repay.from')} value={from} testID="repay-from" onPress={() => setPicking('from')} />
            <Text aria-hidden style={{ fontSize: t.font.size.headingLg, color: t.color.ink }}>→</Text>
            <Party label={msg('fin.repay.to')} value={to} testID="repay-to" onPress={() => setPicking('to')} />
          </View>
          <AppText variant="caption">{msg('v2m.tapToChange')}</AppText>
        </View>

        {!manual ? (
          <TextField
            testID="repay-amount"
            label={msg('fin.repay.amount').replace(' *', '')}
            required
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            helper={msg('v2m.baht')}
            error={!auto.ok && auto.reason === 'over' ? msg('fin.repay.over', { max: formatSatang(auto.maxSatang) }) : undefined}
          />
        ) : null}

        <TextField testID="repay-date" label={msg('fin.form.date')} required value={date} onChangeText={setDate} helper={msg('v2m.dateShown', { shown: formatDate(date) })} />

        <Card>
          <CardLabel>{manual ? msg('fin.repay.manual') : msg('fin.repay.oldestFirst')}</CardLabel>
          {debts.map((d, i) => {
            const take = allocations.find((a) => a.expenseId === d.expenseId)?.satang ?? 0;
            const left = d.remainingSatang - take;
            return (
              <View key={d.expenseId} testID={`repay-line-${d.expenseId}`} style={{ gap: 2, paddingTop: i ? t.space.sm : 0, borderTopWidth: i ? t.border.hair : 0, borderTopColor: t.color.ruleFaint }}>
                <View style={{ flexDirection: 'row' }}>
                  <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{categoryOf(d.expenseId)}</AppText>
                  <AppText style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>{formatSatang(take)}</AppText>
                </View>
                <FactRow icon={(c) => <CalendarIcon color={c} size={14} />}>
                  <Day iso={d.date} />
                </FactRow>
                <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>{msg('v2m.remaining', { amount: formatSatang(d.remainingSatang) })}</FactRow>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                  {take === d.remainingSatang ? <Check color={t.color.accept} /> : <HalfDot />}
                  <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: take === d.remainingSatang ? t.color.accept : t.color.warn }}>
                    {msg(take === 0 ? 'fin.status.owed' : take === d.remainingSatang ? 'fin.status.repaid' : 'fin.status.partial')}
                  </Text>
                </View>
                {take > 0 && left > 0 ? <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>{msg('v2m.left', { amount: formatSatang(left) })}</FactRow> : null}
                {manual ? (
                  <TextField
                    testID={`repay-manual-${d.expenseId}`}
                    label={`${categoryOf(d.expenseId)} ${formatDate(d.date)}`}
                    keyboardType="decimal-pad"
                    value={manual[d.expenseId] ?? ''}
                    onChangeText={(v) => setManual((m) => ({ ...(m ?? {}), [d.expenseId]: v }))}
                    error={(parseBahtToSatang(manual[d.expenseId] ?? '') ?? 0) > d.remainingSatang ? msg('fin.repay.overItem') : undefined}
                  />
                ) : null}
              </View>
            );
          })}
          <Pressable
            testID="repay-mode"
            accessibilityRole="button"
            onPress={() =>
              setManual((m) => (m ? null : Object.fromEntries(debts.map((d) => [d.expenseId, satangToInput(allocations.find((a) => a.expenseId === d.expenseId)?.satang ?? 0)]))))
            }
            style={{ minHeight: t.target.min, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.action, textDecorationLine: 'underline' }}>
              {manual ? msg('fin.repay.auto') : msg('fin.repay.manual')}
            </Text>
          </Pressable>
        </Card>

        <TextField testID="repay-note" label={msg('fin.form.note')} multiline value={note} onChangeText={setNote} placeholder={msg('fin.form.notePlaceholder')} />
        {failed ? <AppText style={{ color: t.color.reject }}>{msg('fin.form.saveFailed')}</AppText> : null}
      </ScrollView>

      <BottomSheet testID="repay-pick" open={picking !== null} onClose={() => setPicking(null)} title={msg(picking === 'to' ? 'fin.repay.to' : 'fin.repay.from')}>
        <PayerPicker
          testID={picking === 'to' ? 'repay-to-pick' : 'repay-from-pick'}
          value={picking === 'to' ? to : from}
          onChange={(p) => {
            if (picking === 'to') setTo(p);
            else setFrom(p);
            setPicking(null);
          }}
          extra={[payee]}
        />
      </BottomSheet>
    </>
  );
}

function Party({ label, value, testID, onPress }: { label: string; value: Payer | null; testID: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value?.name ?? ''}`}
      onPress={onPress}
      style={{ flex: 1, minHeight: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.md, borderRadius: t.radius.md, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, backgroundColor: t.color.surfaceRaised }}
    >
      <Text numberOfLines={1} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.semibold, color: t.color.ink }}>{value?.name ?? '—'}</Text>
    </Pressable>
  );
}

/** Back to where the user came from — replacing would stack a second copy of that screen. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/v2/owed');
}
