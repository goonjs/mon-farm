/**
 * E05-S11 · สรุปจ่ายเงิน, /v2/sale/<id>/settlement (mockup A0–A5, A8, A10,
 * A14–A16, A22–A26 · CO-1…CO-5, CO-7, CO-9, CO-15, CO-17, CO-18, CO-21,
 * CO-22, CO-26).
 *
 * One page: sale strip → debt card → owed card → one card per tapper → cash
 * card → tally bar, confirm pinned at the bottom. Everything shown is the
 * draft plan from `useCloseout()`; sheets change the in-memory draft only.
 * Nothing is written until "ยืนยันยอด" (CO-3), which then opens the payment.
 */

import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { sourcesSheet, type ConfirmGate } from '../../../core/finance/closeout';
import { buyerCheck, saleFigures } from '../../../core/finance/buyer-check';
import { useT, type Translate } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AlertIcon, Check, CTA } from '../../../ui';
import { FarmScreen } from '../../farm/pieces';
import { Banner, tapperTone, useLeaveIfClosed, useSaleView } from '../pieces';
import { CashCard, DebtCard, OwedCard, Progress, SaleStrip, TallyBar, WorkerCard } from './summary-cards';
import { DebtSheet } from './summary-debt-sheet';
import { DeductSheet } from './summary-deduct-sheet';
import { OwedSheet } from './summary-owed-sheet';
import { addId, MARK, shortBaht } from './summary-parts';
import { SaleSheet } from './summary-sale-sheet';
import { SourcesSheet } from './summary-sources-sheet';
import { useCloseout } from './use-closeout';

type Sheet = { kind: 'debt' } | { kind: 'owed' } | { kind: 'sources' } | { kind: 'sale' } | { kind: 'deduct'; id: string } | null;

/** The confirm button's words (CO-17 / CO-26 exact Thai; the rest short plain Thai). */
export function gateText(msg: Translate, gate: ConfirmGate): string {
  const up = (s: string) => `${MARK.up} ${s}`;
  switch (gate.kind) {
    case 'ready':
      return msg('co.gate.ready');
    case 'check-debt':
      return up(msg('co.gate.checkDebt', { names: gate.names.join(msg('co.and')) }));
    case 'check-owed':
      return up(msg('co.gate.checkOwed'));
    case 'check-both':
      return up(msg('co.gate.checkBoth'));
    case 'answer-debt':
      return up(msg('co.gate.answerDebt'));
    case 'answer-owed':
      return up(msg('co.gate.answerOwed'));
    case 'answer-both':
      return up(msg('co.gate.answerBoth'));
    case 'tally':
      return msg('co.gate.tally');
    case 'double':
      return up(msg('co.gate.double', { names: gate.names.join(msg('co.and')) }));
    case 'invalid':
      // N5: each problem in the deduct sheet's own words.
      if (gate.problem === 'net-range') return `${msg('co.net.overMax', { amount: shortBaht(gate.netCapSatang) })} · ${msg('co.gate.fix')}`;
      if (gate.problem === 'below-netting') return `${msg('co.deduct.belowNet', { amount: shortBaht(gate.nettingSatang) })} · ${msg('co.gate.fix')}`;
      return msg('co.gate.invalid');
  }
}

export function CloseoutSummaryScreen() {
  const msg = useT();
  const t = useTheme();
  const router = useRouter();
  const co = useCloseout();
  const view = useSaleView();
  const [sheet, setSheet] = useState<Sheet>(null);
  // A write screen: a closed sale goes to its payment, read-only (review #2).
  useLeaveIfClosed(view);
  const base = `/v2/sale/${co.saleId}`;
  const shell = (children?: React.ReactNode, footer?: React.ReactNode, overlay?: React.ReactNode) => (
    <FarmScreen title={msg('co.title')} subtitle={view.saleTitle} fallback={`${base}/check` as Href} testID="co-summary" footer={footer} overlay={overlay}>
      {children}
    </FarmScreen>
  );
  if (!co.ready || !co.plan || !co.gate || !co.settlement || !co.debtors || !co.owed || !co.pieces || !co.inputs || !co.owedOf) return shell();

  const { plan, gate, draft, settlement: s } = co;
  const workerOf = (id: string) => plan.workers.find((w) => w.id === id);
  const inputOf = (id: string) => co.inputs!.find((i) => i.id === id);
  const pieces = (id: string) => co.pieces!.get(id) ?? [];
  const master = co.money.master;
  const checkedWithBuyer = (() => {
    if (!co.fin.events) return false;
    const c = buyerCheck(co.fin.events, co.saleId, saleFigures(s));
    return c.status === 'total' || c.status === 'weight';
  })();

  const debtPeople = co.debtors.flatMap((d) => {
    const w = workerOf(d.id);
    return w ? [{ w, pieces: pieces(d.id).length, checked: draft.debtChecked.includes(d.id) }] : [];
  });
  const debtBalance = co.debtors.reduce((a, d) => a + (inputOf(d.id)?.balanceSatang ?? 0), 0);
  const owedPeople = co.owed.map((o) => ({ ...o, nettedSatang: workerOf(o.id)?.nettingSatang ?? 0 }));
  const handled = !gate.kind.startsWith('check') && !gate.kind.startsWith('answer');

  const addDebt = () => {
    const only = co.money.tappers.length === 1 ? co.money.tappers[0] : null;
    if (only) router.push({ pathname: '/v2/debt-add', params: { workerId: only.id, name: only.name } } as unknown as Href);
    else router.push('/v2/debts' as Href);
  };
  const addOwed = () => router.push('/v2/expense/new' as Href);
  const confirm = async () => {
    if (gate.kind !== 'ready' || co.closed) return;
    if (await co.confirm()) router.push(`${base}/payment` as Href);
  };

  const overlay = (() => {
    if (!sheet) return null;
    const close = () => setSheet(null);
    switch (sheet.kind) {
      case 'debt':
        return (
          <DebtSheet
            people={co.debtors.flatMap((d) => {
              const w = workerOf(d.id);
              return w ? [{ w, pieces: pieces(d.id), edited: draft.workers[d.id]?.totalSatang != null }] : [];
            })}
            onPiece={(id) => setSheet({ kind: 'deduct', id })}
            onAdd={addDebt}
            onOk={() => {
              co.update((d) => ({ ...d, debtChecked: co.debtors!.reduce((list, x) => addId(list, x.id), d.debtChecked) }));
              close();
            }}
            onClose={close}
          />
        );
      case 'deduct': {
        const w = workerOf(sheet.id);
        if (!w) return null;
        return <DeductSheet co={co} w={w} pieces={pieces(w.id)} canNet={(inputOf(w.id)?.owedBackSatang ?? 0) > 0} onClose={close} />;
      }
      case 'owed':
        return (
          <OwedSheet
            co={co}
            people={co.owed!.map((o) => {
              const open = co.owedOf!(o.id).filter((r) => r.remainingSatang > 0).sort((a, b) => a.date.localeCompare(b.date));
              return { id: o.id, name: o.name, satang: o.satang, date: open[0]?.date ?? null, w: workerOf(o.id) };
            })}
            onAdd={addOwed}
            onClose={close}
          />
        );
      case 'sources':
        return <SourcesSheet src={sourcesSheet(plan, s.grossSatang, s.ownerSatang)} plan={plan} saleTotalSatang={s.grossSatang} onClose={close} />;
      case 'sale':
        return <SaleSheet s={s} tappers={co.money.tappers} checked={checkedWithBuyer} onClose={close} />;
    }
  })();

  return shell(
    // One column with the mockup's tighter rhythm (CO-1: 2 tappers in one screen), inside the screen's own padding.
    <View style={{ gap: t.space.xs + t.space.xxs, marginTop: -t.space.xs, marginBottom: -t.space.md }}>
      <Progress />
      <SaleStrip grossSatang={s.grossSatang} checked={checkedWithBuyer} onOpen={() => setSheet({ kind: 'sale' })} />
      <DebtCard
        people={debtPeople}
        balanceSatang={debtBalance}
        answered={draft.debtAnswered}
        onOpen={() => setSheet({ kind: 'debt' })}
        onNone={() => co.update((d) => ({ ...d, debtAnswered: true }))}
        onAdd={addDebt}
      />
      <OwedCard
        people={owedPeople}
        checked={new Set(draft.owedChecked)}
        answered={draft.owedAnswered}
        onOpen={() => setSheet({ kind: 'owed' })}
        onNone={() => co.update((d) => ({ ...d, owedAnswered: true }))}
        onAdd={addOwed}
      />
      {plan.workers.map((w) => (
        <WorkerCard key={w.id} w={w} roundingNone={plan.rounding === 'none'} tone={master ? tapperTone(master, w.id) : 'cream'} onDeduct={() => setSheet({ kind: 'deduct', id: w.id })} />
      ))}
      <CashCard plan={plan} faded={!handled} onOpen={() => router.push(`${base}/cash` as Href)} />
      <TallyBar tally={plan.tally} onSources={() => setSheet({ kind: 'sources' })} />
      {co.failed ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('co.confirmFailed')} lines={[msg('co.confirmFailedLine')]} testID="co-confirm-error" /> : null}
    </View>,
    <CTA testID="co-confirm" disabled={gate.kind !== 'ready' || co.busy || co.closed} icon={gate.kind === 'ready' ? (c) => <Check color={c} /> : undefined} onPress={confirm}>
      {gateText(msg, gate)}
    </CTA>,
    overlay,
  );
}
