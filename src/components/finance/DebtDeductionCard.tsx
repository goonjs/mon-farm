/**
 * "หักเงินคืนหนี้" on one worker's settlement card (E06-S04, D-60, D-71).
 *
 * Reads the worker's debt account from the finance log: only debt owed to
 * the farm is deductible (D-69). Proposes the instalment (or the whole
 * balance), capped at the share — widened by any netting the owner chooses
 * (D-67) — and records each deduction as a debt payment naming this sale and
 * how the money is collected (three routes, D-71). Netting is offered, never
 * applied by itself; when used it writes a repayment (E11-S03) and a debt
 * payment, kept apart. Deductions above the share after a sale edit are
 * flagged, not silently adjusted (D-61).
 *
 * Rounding after the deduction belongs to E05-S02; until it lands the cash
 * line is shown unrounded.
 */

import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { projectDebts } from '../../core/finance/debts';
import { deductionCap, needsChange, nettingPayloads, overDeducted, proposeDeduction, workerCash } from '../../core/finance/deduct';
import { formatSatang, parseBahtToSatang, satangToInput, todayIso } from '../../core/finance/money';
import { FARM_FUNDS, type DebtPaymentMethod, type FinanceEvent, type Payer } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useSaleCounts } from '../../finance/use-live-sales';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { useTheme } from '../../theme';
import { Button } from '../chrome';
import { Card, Chip, ChipRow, Fact, Input, MoneyLine, Note } from './parts';
import { useInFlight } from '../../finance/use-in-flight';

type Route = Exclude<DebtPaymentMethod, 'outside' | 'netting'>;
const ROUTES: readonly Route[] = ['cash-from-share', 'buyer-split', 'transfer-with-owner'];

export function DebtDeductionCard({ saleId, worker, shareSatang }: { saleId: string; worker: Payer; shareSatang: number }) {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const counts = useSaleCounts();
  const farm: Payer = { id: FARM_FUNDS, name: msg('fin.payer.farm') };

  const account = useMemo(() => projectDebts(fin.events ?? [], counts).get(worker.id), [fin.events, counts, worker.id]);
  const owedBack = (fin.state?.reimbursements ?? []).filter((r) => r.to.id === worker.id && r.remainingSatang > 0);
  const owedBackSatang = owedBack.reduce((s, r) => s + r.remainingSatang, 0);

  const atThisSale = (account?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted);
  const deductedHere = atThisSale.filter((p) => p.method !== 'netting').reduce((s, p) => s + p.amountSatang, 0);
  const nettedHere = atThisSale.filter((p) => p.method === 'netting').reduce((s, p) => s + p.amountSatang, 0);
  const balance = account?.balanceSatang ?? 0;

  const [editing, setEditing] = useState(false);
  const [route, setRoute] = useState<Route>('cash-from-share');
  const [useNet, setUseNet] = useState(false);
  // null = "everything the farm owes" — derived, not frozen at first render, when the log may not have loaded yet.
  const [netText, setNetText] = useState<string | null>(null);
  // Default: what the farm owes, but never more than the worker owes (review #7).
  const netDefault = Math.min(owedBackSatang, Math.max(0, balance));
  const net = useNet ? (netText === null ? netDefault : (parseBahtToSatang(netText) ?? 0)) : 0;
  const inFlight = useInFlight();
  const saving = inFlight.busy;
  const [failed, setFailed] = useState(false);
  // Room left in this sale's share: netting already recorded here paid in what it took, so only
  // plain deductions use the share up. The new deduction's netting part widens the cap (D-67).
  const roomSatang = shareSatang - deductedHere;
  const cap = deductionCap({ balanceSatang: balance, shareSatang: roomSatang, nettingSatang: net });
  const [amountText, setAmountText] = useState<string | null>(null);
  const proposed = proposeDeduction({ balanceSatang: balance, planPerSaleSatang: account?.planPerSaleSatang ?? null, shareSatang: roomSatang, nettingSatang: net });
  const amount = amountText === null ? proposed : (parseBahtToSatang(amountText) ?? -1);
  const netOk = !useNet || (net > 0 && net <= owedBackSatang && net <= amount);
  const amountOk = amount > 0 && amount <= cap;

  const cash = workerCash({ shareSatang, deductionSatang: deductedHere + nettedHere, nettingSatang: nettedHere, adjustSatang: 0 });
  const flag = overDeducted(deductedHere + nettedHere, shareSatang, nettedHere);

  if (!account && owedBackSatang === 0) return null;

  const save = async () => {
    if (!amountOk || !netOk) return;
    setFailed(false);
    const date = todayIso();
    let repayment: FinanceEvent | null = null;
    try {
      if (useNet && net > 0) {
        const repaymentId = newId('rp-');
        const plan = nettingPayloads({ worker, farm, owed: owedBack, amountSatang: net, saleId, date, repaymentId });
        if (!plan.ok) throw new Error('netting above what the farm owes');
        repayment = await fin.write(repaymentId, null, plan.repayment);
        await fin.write(newId('dpay-'), null, plan.debtPayment);
        repayment = null;
      }
      const rest = amount - net;
      if (rest > 0) {
        await fin.write(newId('dpay-'), null, {
          t: 'debt_payment_recorded',
          fields: { worker, creditor: farm, amountSatang: rest, date, note: '', method: route, saleId },
        });
      }
      setEditing(false);
      setAmountText(null);
      setUseNet(false);
    } catch (err) {
      console.error('Deduction could not be stored.', err);
      // Half a netting is worse than none: undo the repayment if its debt side failed (review #4).
      if (repayment) {
        await fin.write(repayment.targetId, repayment.id, { t: 'repayment_changed', patch: { deleted: true } }).catch(() => undefined);
      }
      setFailed(true);
    }
  };

  const voidPayment = async (id: string) => {
    const p = account?.payments.find((x) => x.id === id);
    if (!p) return;
    try {
      await fin.write(p.id, p.headEventId, { t: 'debt_payment_changed', patch: { deleted: true } });
      // Netting voids its farm-side repayment with it, by the id it recorded (D-67).
      const r = p.repaymentId ? fin.state?.repayments.find((x) => x.id === p.repaymentId && !x.deleted) : undefined;
      if (r) await fin.write(r.id, r.headEventId, { t: 'repayment_changed', patch: { deleted: true } });
    } catch (err) {
      console.error('Void could not be stored.', err);
      setFailed(true);
    }
  };

  return (
    <View testID={`deduct-${worker.id}`} style={{ gap: t.space.xs, paddingTop: t.space.xs }}>
      {account || owedBackSatang > 0 ? (
        <Card tone="accent">
          {account ? (
            <Fact mark="money" testID={`deduct-owes-${worker.id}`}>
              {msg('deduct.owes', { amount: formatSatang(balance) })}
              {account.planPerSaleSatang != null ? ` · ${msg('deduct.plan', { amount: formatSatang(account.planPerSaleSatang) })}` : ''}
            </Fact>
          ) : null}
          {owedBackSatang > 0 ? <Fact mark="note">{msg('deduct.owedBack', { name: worker.name, amount: formatSatang(owedBackSatang) })}</Fact> : null}
        </Card>
      ) : null}

      {atThisSale.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
          <View style={{ flex: 1 }}>
            <MoneyLine
              testID={`deduct-line-${p.id}`}
              label={p.method === 'netting' ? msg('deduct.netLine') : msg('deduct.line', { method: msg(`debt.method.${p.method}`) })}
              satang={p.amountSatang}
              dir="out"
            />
          </View>
          <Button testID={`deduct-void-${p.id}`} variant="destructive" onPress={() => void inFlight.run(() => voidPayment(p.id))}>{msg('deduct.void')}</Button>
        </View>
      ))}
      {atThisSale.some((p) => p.method === 'cash-from-share' && needsChange(shareSatang, p.amountSatang)) ? (
        <Note tone="warn" testID={`deduct-change-${worker.id}`}>
          {msg('deduct.change', { amount: formatSatang(atThisSale.filter((p) => p.method === 'cash-from-share').reduce((s, p) => s + p.amountSatang, 0)) })}
        </Note>
      ) : null}
      {atThisSale.some((p) => p.method === 'transfer-with-owner') ? (
        <Note testID={`deduct-transfer-${worker.id}`}>
          {msg('deduct.transfer', { amount: formatSatang(atThisSale.filter((p) => p.method === 'transfer-with-owner').reduce((s, p) => s + p.amountSatang, 0)) })}
        </Note>
      ) : null}
      {atThisSale.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.xs }}>
          <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>{msg('deduct.cash')}</Text>
          <Text testID={`deduct-cash-${worker.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingXl, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {formatSatang(cash)}
          </Text>
        </View>
      ) : null}
      {flag ? <Note tone="reject" testID={`deduct-flag-${worker.id}`}>{msg('deduct.overFlag')}</Note> : null}

      {!editing ? (
        balance > 0 || owedBackSatang > 0 ? (
          <Button testID={`deduct-open-${worker.id}`} onPress={() => setEditing(true)}>{msg('deduct.button')}</Button>
        ) : null
      ) : (
        <View style={{ gap: t.space.xs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.thick, borderColor: t.color.action, backgroundColor: t.color.actionSunk }}>
          {owedBackSatang > 0 ? (
            <View style={{ gap: t.space.xs }}>
              <Note tone="warn">{msg('deduct.netOffer', { name: worker.name, amount: formatSatang(owedBackSatang) })}</Note>
              <ChipRow>
                <Chip testID={`deduct-net-${worker.id}`} on={useNet} onPress={() => setUseNet((v) => !v)}>{msg('deduct.netUse')}</Chip>
              </ChipRow>
              {useNet ? (
                <>
                  <Note>{msg('deduct.netAmount', { max: formatSatang(owedBackSatang) })}</Note>
                  <Input testID={`deduct-net-amount-${worker.id}`} numeric value={netText ?? satangToInput(netDefault)} onChangeText={setNetText} accessibilityLabel={msg('deduct.netUse')} />
                </>
              ) : null}
            </View>
          ) : null}
          <Note>{msg('deduct.amount', { cap: formatSatang(cap) })}</Note>
          <Input
            testID={`deduct-amount-${worker.id}`}
            numeric
            value={amountText ?? satangToInput(Math.max(0, proposed))}
            onChangeText={setAmountText}
            accessibilityLabel={msg('deduct.button')}
          />
          {amount > cap ? <Note tone="reject" testID={`deduct-over-${worker.id}`}>{msg('deduct.over', { cap: formatSatang(cap) })}</Note> : null}
          <Note>{msg('deduct.method')}</Note>
          <ChipRow>
            {ROUTES.map((r) => (
              <Chip key={r} testID={`deduct-route-${r}-${worker.id}`} on={route === r} onPress={() => setRoute(r)}>
                {msg(`debt.method.${r}`)}
              </Chip>
            ))}
          </ChipRow>
          {useNet && net > amount ? <Note tone="reject" testID={`deduct-net-over-${worker.id}`}>{msg('deduct.netOver')}</Note> : null}
          {failed ? <Note tone="reject" testID={`deduct-failed-${worker.id}`}>{msg('fin.form.saveFailed')}</Note> : null}
          {amountOk ? <Note>{msg('deduct.after', { amount: formatSatang(balance - amount) })}</Note> : null}
          <Button testID={`deduct-save-${worker.id}`} variant="primary" disabled={!amountOk || !netOk || saving} onPress={() => void inFlight.run(save)}>
            {msg('deduct.save')}
          </Button>
        </View>
      )}
    </View>
  );
}
