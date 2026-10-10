/**
 * One worker's debt account (E06-S03, flow-farm v1.1.0 page 22).
 *
 * Balance owed to the farm; the per-sale instalment plan (one per worker,
 * editable, cancellable — D-59); the D-72 reconciliation, whose bottom line
 * is the same number as the balance on top; debts owed to other people in
 * their own box, never in the equation (D-69); history newest first,
 * filterable by kind, each line voidable/restorable and linked to its sale.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, TopBar } from '../../../components/chrome';
import { Chip, ChipRow, Input, Label, Note } from '../../../components/finance/parts';
import { projectDebts, type DebtAccount, type HistoryLine } from '../../../core/finance/debts';
import { formatDate, formatSatang, parseBahtToSatang, satangToInput } from '../../../core/finance/money';
import { useFinance } from '../../../finance/use-finance';
import { useSaleCounts } from '../../../finance/use-live-sales';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';

type Filter = 'all' | HistoryLine['type'];
const FILTERS: readonly Filter[] = ['all', 'loan', 'fertilizer', 'other', 'deduction', 'payment'];

export default function DebtAccountScreen() {
  const { workerId, name } = useLocalSearchParams<{ workerId: string; name: string }>();
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const counts = useSaleCounts();
  const account = useMemo(() => projectDebts(fin.events ?? [], counts).get(workerId), [fin.events, counts, workerId]);
  const worker = account?.worker ?? { id: workerId, name: name ?? '' };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={msg('debt.title', { name: worker.name })} right={<Button testID="debt-back" onPress={() => router.back()}>{msg('common.back')}</Button>} />
      {fin.events === null ? (
        <Text style={{ padding: t.space.md, fontFamily: t.font.family.mono, color: t.color.inkSoft }}>{msg('counter.loading')}</Text>
      ) : (
        <Account account={account} worker={worker} fin={fin} />
      )}
      <View style={{ flexDirection: 'row', gap: t.space.sm, padding: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.rule }}>
        <View style={{ flex: 1 }}>
          <Button testID="debt-add" onPress={() => router.push({ pathname: '/finance/debts/add', params: { workerId, name: worker.name } })}>
            {msg('debt.add')}
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="debt-pay" variant="primary" onPress={() => router.push({ pathname: '/finance/debts/pay', params: { workerId, name: worker.name } })}>
            {msg('debt.pay')}
          </Button>
        </View>
      </View>
    </View>
  );
}

function Account({ account, worker, fin }: { account: DebtAccount | undefined; worker: { id: string; name: string }; fin: ReturnType<typeof useFinance> }) {
  const t = useTheme();
  const msg = useT();
  const [filter, setFilter] = useState<Filter>('all');
  const [planDraft, setPlanDraft] = useState<string | null>(null);
  const planEvents = (fin.events ?? []).filter((e) => e.targetId === `plan-${worker.id}`);
  const balance = account?.balanceSatang ?? 0;
  const s = account?.summary;

  const savePlan = async (perSaleSatang: number | null) => {
    const heads = planEvents.filter((e) => !planEvents.some((o) => o.baseEventId === e.id)).map((e) => e.id).sort();
    await fin.write(`plan-${worker.id}`, heads.length ? heads[heads.length - 1] : null, { t: 'debt_plan_set', worker, perSaleSatang });
    setPlanDraft(null);
  };

  const voidLine = async (line: HistoryLine, deleted: boolean) => {
    const d = account?.debts.find((x) => x.id === line.id);
    if (d) return fin.write(d.id, d.headEventId, { t: 'debt_changed', patch: { deleted } });
    const p = account?.payments.find((x) => x.id === line.id);
    if (p) return fin.write(p.id, p.headEventId, { t: 'debt_payment_changed', patch: { deleted } });
  };

  const lines = (account?.history ?? []).filter((h) => filter === 'all' || h.type === filter);
  const row = (label: string, value: number, sign: '+' | '−', testID?: string) => (
    <View key={label} style={{ flexDirection: 'row' }}>
      <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>{`${sign} ${label}`}</Text>
      <Text testID={testID} style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.small, color: t.color.ink }}>{formatSatang(value)}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
      <View style={{ padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk, gap: t.space.xxs }}>
        <Note>{balance < 0 ? msg('debt.farmOwes', { name: worker.name }) : msg('debt.balance', { name: worker.name })}</Note>
        <Text testID="debt-balance" style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.ink }}>
          {formatSatang(Math.abs(balance))}
        </Text>
        {account?.overpaid ? <Note tone="reject" testID="debt-flag">{msg('debt.flag')}</Note> : null}
      </View>

      <View style={{ gap: t.space.xs }}>
        <Label>{msg('debt.plan')}</Label>
        {planDraft === null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <View style={{ flex: 1 }}>
              <Note testID="debt-plan">
                {account?.planPerSaleSatang != null ? msg('debt.planValue', { amount: formatSatang(account.planPerSaleSatang) }) : msg('debt.planNone')}
              </Note>
            </View>
            <Button testID="debt-plan-edit" onPress={() => setPlanDraft(account?.planPerSaleSatang != null ? satangToInput(account.planPerSaleSatang) : '')}>
              {msg('debt.planEdit')}
            </Button>
            {account?.planPerSaleSatang != null ? (
              <Button testID="debt-plan-cancel" variant="destructive" onPress={() => void savePlan(null)}>{msg('debt.planCancel')}</Button>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <View style={{ flex: 1 }}>
              <Input testID="debt-plan-amount" numeric value={planDraft} onChangeText={setPlanDraft} accessibilityLabel={msg('debt.plan')} />
            </View>
            <Button
              testID="debt-plan-save"
              variant="primary"
              disabled={!parseBahtToSatang(planDraft)}
              onPress={() => void savePlan(parseBahtToSatang(planDraft))}
            >
              {msg('common.save')}
            </Button>
          </View>
        )}
      </View>

      {s ? (
        <View testID="debt-summary" style={{ gap: t.space.xxs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.rule }}>
          <Label>{msg('debt.summary')}</Label>
          <Note>{msg('debt.sum.owedTitle')}</Note>
          {row(msg('debt.kind.loan'), s.owed.loan, '+')}
          {row(msg('debt.kind.fertilizer'), s.owed.fertilizer, '+')}
          {row(msg('debt.kind.other'), s.owed.other, '+')}
          <Note>{msg('debt.sum.deductTitle')}</Note>
          {row(msg('debt.method.cash-from-share'), s.deducted['cash-from-share'], '−')}
          {row(msg('debt.method.buyer-split'), s.deducted['buyer-split'], '−')}
          {row(msg('debt.method.transfer-with-owner'), s.deducted['transfer-with-owner'], '−')}
          {row(msg('debt.method.netting'), s.deducted.netting, '−')}
          <Note>{msg('debt.sum.outsideTitle')}</Note>
          {row(msg('debt.method.outside'), s.outside, '−')}
          <View style={{ flexDirection: 'row', borderTopWidth: t.border.hair, borderTopColor: t.color.ruleStrong, paddingTop: t.space.xxs }}>
            <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
              {msg('debt.sum.balance')}
            </Text>
            <Text testID="debt-summary-balance" style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
              {`${formatSatang(s.balanceSatang)} ${s.balanceSatang === balance ? `✓ ${msg('debt.sum.match')}` : '✗'}`}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: t.space.xxs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderStyle: 'dashed', borderColor: t.color.ruleStrong }}>
        <Label>{msg('debt.others')}</Label>
        {account?.others.length ? (
          account.others.map((o) => (
            <View key={o.lender.id} testID={`debt-other-${o.lender.id}`} style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>{o.lender.name}</Text>
              <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.small, color: t.color.ink }}>{formatSatang(o.balanceSatang)}</Text>
            </View>
          ))
        ) : (
          <Note>{msg('debt.othersNone')}</Note>
        )}
      </View>

      <View style={{ gap: t.space.xs }}>
        <Label>{msg('debt.history')}</Label>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f} testID={`debt-filter-${f}`} on={filter === f} onPress={() => setFilter(f)}>
              {f === 'all' ? msg('debt.history.all') : msg(`debt.kind.${f}`)}
            </Chip>
          ))}
        </ChipRow>
        {lines.map((h) => (
          <View key={h.id} testID={`debt-line-${h.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, padding: t.space.sm, borderRadius: t.radius.md, backgroundColor: t.color.surfaceSunk, opacity: h.deleted ? t.opacity.muted : 1 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink, textDecorationLine: h.deleted ? 'line-through' : 'none' }}>
                {msg(`debt.kind.${h.type}`)}
              </Text>
              <Note>
                {[
                  formatDate(h.date),
                  h.saleId ? `${msg('debt.history.sale')} ${h.saleId}` : null,
                  h.type === 'loan' && h.creditor.name ? msg('debt.history.lender', { name: h.creditor.name }) : null,
                  h.deleted ? msg('debt.history.voided') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Note>
            </View>
            <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.small, color: t.color.ink }}>
              {`${h.signedSatang >= 0 ? '+' : ''}${formatSatang(h.signedSatang)}`}
            </Text>
            <Button testID={`debt-void-${h.id}`} variant={h.deleted ? 'ghost' : 'destructive'} onPress={() => void voidLine(h, !h.deleted)}>
              {h.deleted ? msg('debt.history.restore') : msg('debt.history.void')}
            </Button>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
