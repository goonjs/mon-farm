/**
 * Add a debt (E06-S03, flow-farm v1.1.0 page 23).
 *
 * Kind: loan/advance · fertilizer · other ("other" needs a note, has no
 * lender — F9). A loan records its lender: farm funds is deductible; anyone
 * else is shown in the account but repaid to them directly (D-69). A manual
 * fertilizer debt is the bill × a whole-number % (default 50 — F8); the
 * owner's share becomes a farm expense whose payer may be set now or later
 * (D-67, F7). Carried-forward balances still pick a kind (F6).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '../../../components/chrome';
import { Chip, ChipRow, Input, Label, Note, PayerPicker, ScreenHeader } from '../../../components/finance/parts';
import { checkDebt, fertilizerSplit } from '../../../core/finance/debts';
import { OWNER_SHARE_SUFFIX } from '../../../core/finance/ledger';
import { formatDate, formatSatang, parseBahtToSatang, todayIso } from '../../../core/finance/money';
import { FARM_FUNDS, type DebtKind, type Payer } from '../../../core/finance/types';
import { useFinance } from '../../../finance/use-finance';
import { useT } from '../../../i18n';
import { newId } from '../../../lib/id';
import { useTheme } from '../../../theme';
import { useInFlight } from '../../../finance/use-in-flight';

const KINDS: readonly DebtKind[] = ['loan', 'fertilizer', 'other'];

export default function AddDebtScreen() {
  const { workerId, name } = useLocalSearchParams<{ workerId: string; name: string }>();
  const worker: Payer = { id: workerId, name: name ?? '' };
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();

  const [kind, setKind] = useState<DebtKind>('loan');
  const [amount, setAmount] = useState('');
  const [pct, setPct] = useState('50');
  const [lender, setLender] = useState<Payer | null>({ id: FARM_FUNDS, name: msg('fin.payer.farm') });
  const [ownerPayer, setOwnerPayer] = useState<Payer | null>(null);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [carried, setCarried] = useState(false);
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useInFlight();
  const saving = inFlight.busy;

  const entered = parseBahtToSatang(amount) ?? 0;
  const pctNum = /^\d{1,3}$/.test(pct.trim()) ? Number(pct.trim()) : NaN;
  const pctOk = Number.isInteger(pctNum) && pctNum >= 0 && pctNum <= 100;
  const split = kind === 'fertilizer' && pctOk ? fertilizerSplit(entered, pctNum) : null;
  const debtSatang = kind === 'fertilizer' ? (split?.workerSatang ?? 0) : entered;
  const problems = checkDebt({ kind, amountSatang: debtSatang, date, note, fertilizerTotalSatang: kind === 'fertilizer' ? entered : undefined });
  const ok = problems.length === 0 && (kind !== 'fertilizer' || pctOk) && (kind !== 'loan' || !!lender);

  const save = async () => {
    setTried(true);
    if (!ok) return;
    const id = newId('debt-');
    try {
      const created = await fin.write(id, null, {
        t: 'debt_added',
        fields: {
          worker,
          kind,
          amountSatang: debtSatang,
          date,
          note: note.trim(),
          lender: kind === 'loan' ? lender : null,
          fertilizer: kind === 'fertilizer' ? { totalSatang: entered, workerPct: pctNum } : null,
          carriedForward: carried,
        },
      });
      if (kind === 'fertilizer' && ownerPayer) {
        // The owner-share expense is synthesised from the debt; its payer is an ordinary edit on it.
        await fin.write(id + OWNER_SHARE_SUFFIX, created.id + OWNER_SHARE_SUFFIX, { t: 'expense_changed', patch: { payer: ownerPayer } });
      }
      router.back();
    } catch (err) {
      console.error('Debt could not be stored.', err);
      setFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader testID="debt-add" title={msg('debt.form.title', { name: worker.name })} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.lg }}>
        <View style={{ gap: t.space.xs }}>
          <Label>{msg('debt.form.kind')}</Label>
          <ChipRow>
            {KINDS.map((k) => (
              <Chip key={k} testID={`debt-kind-${k}`} on={kind === k} onPress={() => setKind(k)}>
                {msg(`debt.kind.${k}`)}
              </Chip>
            ))}
          </ChipRow>
        </View>

        <View style={{ gap: t.space.xs }}>
          <Label hint={msg('fin.form.amountHint')}>{kind === 'fertilizer' ? msg('debt.form.fertTotal') : msg('debt.form.amount')}</Label>
          <Input testID="debt-amount" numeric value={amount} onChangeText={setAmount} placeholder="0.00" accessibilityLabel={msg('debt.form.amount')} />
          {tried && problems.includes('amount-required') ? <Note tone="reject">{msg('debt.form.err.amount-required')}</Note> : null}
        </View>

        {kind === 'fertilizer' ? (
          <View style={{ gap: t.space.xs }}>
            <Label>{msg('debt.form.pct')}</Label>
            <Input testID="debt-pct" numeric value={pct} onChangeText={setPct} accessibilityLabel={msg('debt.form.pct')} />
            {!pctOk ? <Note tone="reject" testID="debt-pct-bad">{msg('debt.form.pctBad')}</Note> : null}
            {split ? (
              <>
                <Note testID="debt-worker-share">{msg('debt.form.workerShare', { name: worker.name, amount: formatSatang(split.workerSatang) })}</Note>
                <Note testID="debt-owner-share">{msg('debt.form.ownerShare', { amount: formatSatang(split.ownerSatang) })}</Note>
              </>
            ) : null}
            <Label>{msg('debt.form.ownerPayer')}</Label>
            <PayerPicker testID="debt-owner-payer" value={ownerPayer} onChange={setOwnerPayer} allowNone />
          </View>
        ) : null}

        {kind === 'loan' ? (
          <View style={{ gap: t.space.xs }}>
            <Label>{msg('debt.form.lender')}</Label>
            <PayerPicker testID="debt-lender" value={lender} onChange={setLender} />
            {lender && lender.id !== FARM_FUNDS ? <Note tone="warn" testID="debt-lender-note">{msg('debt.form.lenderNote')}</Note> : null}
          </View>
        ) : null}

        <View style={{ gap: t.space.xs }}>
          <Label hint={formatDate(date)}>{msg('debt.form.date')}</Label>
          <Input testID="debt-date" value={date} onChangeText={setDate} accessibilityLabel={msg('debt.form.date')} />
          {tried && problems.includes('date-required') ? <Note tone="reject">{msg('debt.form.err.date-required')}</Note> : null}
        </View>

        <View style={{ gap: t.space.xs }}>
          <Label>{kind === 'other' ? msg('debt.form.noteRequired') : msg('debt.form.note')}</Label>
          <Input testID="debt-note" multiline value={note} onChangeText={setNote} placeholder={msg('fin.form.notePlaceholder')} />
          {tried && problems.includes('note-required') ? <Note tone="reject" testID="debt-note-required">{msg('debt.form.err.note-required')}</Note> : null}
        </View>

        <ChipRow>
          <Chip testID="debt-carried" on={carried} onPress={() => setCarried((c) => !c)}>
            {msg('debt.form.carried')}
          </Chip>
        </ChipRow>

        {failed ? <Note tone="reject">{msg('fin.form.saveFailed')}</Note> : null}
        <Button testID="debt-save" variant="primary" disabled={saving} onPress={() => void inFlight.run(save)}>
          {msg('fin.form.save')}
        </Button>
      </ScrollView>
    </View>
  );
}
