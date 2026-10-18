/**
 * เพิ่มหนี้ and บันทึกจ่ายคืน — v1.1.0 farm mockup screens 23, 24 (E06-S03 ·
 * D-59, D-69, D-74 F6–F10), rebuilt on src/ui (D-82). Behaviour is the old
 * screens', ported:
 *
 * - A debt is one of three kinds; "อื่น ๆ" needs a note. A loan from
 *   someone other than farm funds is shown, never deducted.
 * - Fertilizer opens the one fertilizer purchase flow with this tapper
 *   picked (E11-S10 C, owner 2026-10-18): the purchase is one expense and
 *   the tapper's part is projected from its share. Debts recorded the old
 *   way (bill × %, with an owner-share expense) still read as before.
 * - Paying back outside a sale: to the farm or to the outside lender; paying
 *   more than is owed warns first, then records if confirmed.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { checkDebt, projectDebts } from '../../core/finance/debts';
import { formatDate, formatSatang, parseBahtToSatang, todayIso } from '../../core/finance/money';
import { FARM_FUNDS, type DebtKind, type Payer } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useSaleCounts } from '../../finance/use-live-sales';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, Button, Card, Check, RadioCard, ScreenHeader, SegmentedControl, TextField } from '../../ui';
import { PayerPicker, SectionLabel } from './pieces';

const KINDS: readonly DebtKind[] = ['loan', 'fertilizer', 'other'];
const FLOW = '/v2/fertilizer' as const;

const back = () => (router.canGoBack() ? router.back() : router.replace('/v2/debts'));

export function AddDebtScreen() {
  const { workerId, name } = useLocalSearchParams<{ workerId: string; name: string }>();
  const worker: Payer = { id: workerId, name: name ?? '' };
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const fin = useFinance();
  const inFlight = useInFlight();

  const [kind, setKind] = useState<Exclude<DebtKind, 'fertilizer'>>('loan');
  const [amount, setAmount] = useState('');
  const [lender, setLender] = useState<Payer | null>({ id: FARM_FUNDS, name: msg('fin.payer.farm') });
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [carried, setCarried] = useState(false);
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);

  const debtSatang = parseBahtToSatang(amount) ?? 0;
  const problems = checkDebt({ kind, amountSatang: debtSatang, date, note });
  const ok = problems.length === 0 && (kind !== 'loan' || !!lender);

  const pickKind = (k: DebtKind) => {
    // Fertilizer is a purchase: the same flow as the expense form, this tapper picked.
    if (k === 'fertilizer') router.push({ pathname: FLOW, params: { workerId, name: worker.name } });
    else setKind(k);
  };

  const save = async () => {
    setTried(true);
    if (!ok) return;
    setFailed(false);
    const id = newId('debt-');
    try {
      await fin.write(id, null, {
        t: 'debt_added',
        fields: {
          worker,
          kind,
          amountSatang: debtSatang,
          date,
          note: note.trim(),
          lender: kind === 'loan' ? lender : null,
          fertilizer: null,
          carriedForward: carried,
        },
      });
      back();
    } catch (err) {
      console.error('Debt could not be stored.', err);
      setFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('debt.add')} subtitle={worker.name} back={{ label: msg('v2.back'), onPress: back, testID: 'debt-add-back' }} sync={sync} action={{ label: msg('fin.form.save'), testID: 'debt-save', disabled: inFlight.busy, saving: inFlight.busy, onPress: () => void inFlight.run(save) }} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg, paddingBottom: t.space[16] * 2 }}>
        <View style={{ gap: t.space.sm }}>
          <SectionLabel required>{msg('debt.form.kind').replace(' *', '')}</SectionLabel>
          <SegmentedControl testID="debt-kind" value={kind} onChange={pickKind} options={KINDS.map((k) => ({ value: k, label: msg(`debt.kind.${k}`) }))} />
        </View>

        <TextField
          testID="debt-amount"
          label={msg('debt.form.amount').replace(' *', '')}
          required
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          helper={msg('v2m.baht')}
          error={tried && problems.includes('amount-required') ? msg('debt.form.err.amount-required') : undefined}
        />

        {kind === 'loan' ? (
          <View style={{ gap: t.space.sm }}>
            <SectionLabel>{msg('debt.form.lender')}</SectionLabel>
            <PayerPicker testID="debt-lender" value={lender} onChange={setLender} />
            {lender && lender.id !== FARM_FUNDS ? (
              <Card style={{ backgroundColor: t.color.surfaceSunk }}>
                <AppText variant="bodySm" testID="debt-lender-note">{msg('debt.form.lenderNote')}</AppText>
              </Card>
            ) : null}
          </View>
        ) : null}

        <TextField
          testID="debt-date"
          label={msg('debt.form.date').replace(' *', '')}
          required
          value={date}
          onChangeText={setDate}
          helper={msg('v2m.dateShown', { shown: formatDate(date) })}
          error={tried && problems.includes('date-required') ? msg('debt.form.err.date-required') : undefined}
        />
        <TextField
          testID="debt-note"
          label={msg('debt.form.note')}
          required={kind === 'other'}
          multiline
          value={note}
          onChangeText={setNote}
          placeholder={msg('fin.form.notePlaceholder')}
          error={tried && problems.includes('note-required') ? msg('debt.form.err.note-required') : undefined}
        />

        <Pressable
          testID="debt-carried"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: carried }}
          onPress={() => setCarried((c) => !c)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, backgroundColor: t.color.surfaceRaised }}
        >
          <View style={{ width: 28, height: 28, borderRadius: t.radius.sm, borderWidth: t.border.thick, borderColor: carried ? t.color.action : t.color.ruleStrong, backgroundColor: carried ? t.color.action : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {carried ? <Check color={t.color.inkInverse} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2m.carried')}</AppText>
            <AppText variant="caption">{msg('v2m.carriedHint')}</AppText>
          </View>
        </Pressable>
        {failed ? <AppText style={{ color: t.color.reject }}>{msg('fin.form.saveFailed')}</AppText> : null}
      </ScrollView>
    </View>
  );
}

export function PayDebtScreen() {
  const { workerId, name } = useLocalSearchParams<{ workerId: string; name: string }>();
  const worker: Payer = { id: workerId, name: name ?? '' };
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const fin = useFinance();
  const counts = useSaleCounts();
  const inFlight = useInFlight();
  const account = useMemo(() => projectDebts(fin.events ?? [], counts).get(workerId), [fin.events, counts, workerId]);
  const farm: Payer = { id: FARM_FUNDS, name: msg('fin.payer.farm') };
  const options = [{ creditor: farm, balance: account?.balanceSatang ?? 0 }, ...(account?.others ?? []).map((o) => ({ creditor: o.lender, balance: o.balanceSatang }))];

  const [creditorId, setCreditorId] = useState(FARM_FUNDS);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [confirmOver, setConfirmOver] = useState(false);
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
    setFailed(false);
    try {
      await fin.write(newId('dpay-'), null, {
        t: 'debt_payment_recorded',
        fields: { worker, creditor: chosen.creditor, amountSatang: satang, date, note: note.trim(), method: 'outside', saleId: null },
      });
      back();
    } catch (err) {
      console.error('Payment could not be stored.', err);
      setFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('debt.pay')} subtitle={worker.name} back={{ label: msg('v2.back'), onPress: back, testID: 'debt-pay-back' }} sync={sync} action={confirmOver ? undefined : { label: msg('fin.form.save'), testID: 'debt-pay-save', disabled: satang <= 0, saving: inFlight.busy, onPress: () => void inFlight.run(() => save(false)) }} />
      {fin.events === null ? null : (
        <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg, paddingBottom: t.space[16] * 2 }}>
          <View style={{ gap: t.space.sm }}>
            <SectionLabel>{msg('debt.pay.which')}</SectionLabel>
            {options.map((o) => (
              <RadioCard
                key={o.creditor.id}
                testID={`debt-pay-to-${o.creditor.id}`}
                selected={chosen.creditor.id === o.creditor.id}
                title={o.creditor.id === FARM_FUNDS ? msg('debt.sum.owedTitle') : msg('v2m.debtWith', { name: o.creditor.name })}
                detail={msg('v2m.remaining', { amount: formatSatang(o.balance) })}
                onPress={() => setCreditorId(o.creditor.id)}
              />
            ))}
          </View>
          <TextField
            testID="debt-pay-amount"
            label={msg('debt.form.amount').replace(' *', '')}
            required
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              setConfirmOver(false);
            }}
            helper={msg('v2m.baht')}
          />
          <TextField testID="debt-pay-date" label={msg('debt.form.date').replace(' *', '')} required value={date} onChangeText={setDate} helper={msg('v2m.dateShown', { shown: formatDate(date) })} />
          <TextField testID="debt-pay-note" label={msg('debt.form.note')} multiline value={note} onChangeText={setNote} placeholder={msg('fin.form.notePlaceholder')} />
          {satang > 0 ? (
            <Card>
              <Row
                label={chosen.creditor.id === FARM_FUNDS ? msg('v2m.afterFarm') : msg('v2m.afterOther', { name: chosen.creditor.name })}
                value={formatSatang(after)}
                testID="debt-pay-after"
              />
            </Card>
          ) : null}
          {confirmOver ? (
            <Card testID="debt-pay-over" style={{ backgroundColor: t.color.warnSunk }}>
              <AppText style={{ color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('debt.pay.over', { amount: formatSatang(chosen.balance) })}</AppText>
              <View style={{ flexDirection: 'row', gap: t.space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button testID="debt-pay-fix" variant="ghost" onPress={() => setConfirmOver(false)}>{msg('debt.pay.fix')}</Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID="debt-pay-anyway" disabled={inFlight.busy} onPress={() => void inFlight.run(() => save(true))}>{msg('debt.pay.anyway')}</Button>
                </View>
              </View>
            </Card>
          ) : null}
          {failed ? <AppText style={{ color: t.color.reject }}>{msg('fin.form.saveFailed')}</AppText> : null}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: t.space.sm }}>
      <AppText variant="bodySm" style={{ flex: 1 }}>{label}</AppText>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>{value}</Text>
    </View>
  );
}
