/**
 * Monthly cashflow and reserve (E11-S08, FIN-9).
 *
 * Six months around today: money in and out per month, split by stage —
 * actual solid, committed outlined, planned dashed, each with its word
 * (§12.9 rule 9) — and net. A month with an unknown amount says
 * "ข้อมูลไม่ครบ" instead of filling one in (SYNC-12). Each month opens the
 * records behind its figures (ANA-3). Below: what is coming up, and the
 * reserve, which is the owner's own figure with its assumption and source —
 * the app never computes it.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, TopBar } from '../../components/chrome';
import { Input, Label, Note, StageTag, stageFrame } from '../../components/finance/parts';
import { nextMonth } from '../../core/finance/ledger';
import { formatDate, formatMonth, formatSatang, parseBahtToSatang, todayIso } from '../../core/finance/money';
import { cashflow, projectPlan, type CashflowRow } from '../../core/finance/plan';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useRubberIncome } from '../../finance/use-rubber-income';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

/** "+1,000.00" / "−1,000.00"; zero carries no sign. */
const signed = (n: number) => (n === 0 ? formatSatang(0) : `${n > 0 ? '+' : '−'}${formatSatang(Math.abs(n))}`);

function addMonths(month: string, n: number): string {
  let m = month;
  if (n >= 0) for (let i = 0; i < n; i++) m = nextMonth(m);
  else {
    for (let i = 0; i < -n; i++) {
      const [y, mm] = m.split('-').map(Number);
      m = mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
    }
  }
  return m;
}

export default function CashflowScreen() {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const inFlight = useInFlight();
  const rubber = useRubberIncome();
  const plan = useMemo(() => projectPlan(fin.events ?? []), [fin.events]);
  const now = todayIso().slice(0, 7);
  const rows = useMemo(
    () => (fin.state ? cashflow({ state: fin.state, plan, rubber, fromMonth: addMonths(now, -2), toMonth: addMonths(now, 3) }) : []),
    [fin.state, plan, rubber, now],
  );
  const [open, setOpen] = useState<string | null>(null);

  const ob = useMemo(() => {
    const live = (fin.state?.expenses ?? []).filter((x) => !x.deleted && x.date.slice(0, 7) >= now);
    return {
      committed: live.filter((x) => x.stage === 'committed').reduce((s, x) => s + (x.amountSatang ?? 0), 0),
      planned: live.filter((x) => x.stage === 'planned').reduce((s, x) => s + (x.amountSatang ?? 0), 0),
      plannedUnknown: live.filter((x) => x.stage === 'planned' && x.amountSatang === null).length,
      owed: (fin.state?.reimbursements ?? []).reduce((s, r) => s + Math.max(0, r.remainingSatang), 0),
    };
  }, [fin.state, now]);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={msg('cf.title')} right={<Button testID="cashflow-back" onPress={() => router.back()}>{msg('common.back')}</Button>} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        <Note>{msg('cf.pending')}</Note>
        {rows.map((r) => (
          <Month key={r.month} r={r} open={open === r.month} onToggle={() => setOpen(open === r.month ? null : r.month)} fin={fin} plan={plan} />
        ))}

        <View testID="cashflow-obligations" style={{ gap: t.space.xxs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.rule }}>
          <Label>{msg('cf.obligations')}</Label>
          <Line label={msg('cf.ob.committed')} value={signed(-ob.committed)} />
          <Line label={msg('cf.ob.planned')} value={`${signed(-ob.planned)}${ob.plannedUnknown ? ` + ${msg('fin.total.unknown', { n: ob.plannedUnknown })}` : ''}`} />
          <Line label={msg('cf.ob.owed')} value={signed(-ob.owed)} />
        </View>

        <Reserve
          value={plan.reserve}
          onSave={(amountSatang, assumption, source) =>
            inFlight.run(async () => {
              await fin.write('reserve', plan.reserve?.head ?? null, { t: 'reserve_set', amountSatang, assumption, source });
            })
          }
        />
      </ScrollView>
    </View>
  );
}

function Line({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.space.sm }}>
      <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>{label}</Text>
      <Text testID={testID} style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.small, color: t.color.ink }}>{value}</Text>
    </View>
  );
}

function Month({ r, open, onToggle, fin, plan }: { r: CashflowRow; open: boolean; onToggle: () => void; fin: ReturnType<typeof useFinance>; plan: ReturnType<typeof projectPlan> }) {
  const t = useTheme();
  const msg = useT();
  const sign = signed;
  return (
    <View testID={`cf-${r.month}`} style={{ gap: t.space.xs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.rule }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>{formatMonth(r.month)}</Text>
        {r.incomplete ? <Note tone="warn" testID={`cf-incomplete-${r.month}`}>{`⚠ ${msg('cf.incomplete')}`}</Note> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: t.space.xs }}>
        <Cell stage="actual" label={`${msg('cf.in')} · ${msg('fin.stage.actual')}`} value={signed(r.inActual)} testID={`cf-in-actual-${r.month}`} />
        <Cell stage="planned" label={`${msg('cf.in')} · ${msg('fin.stage.planned')}`} value={signed(r.inPlanned)} />
      </View>
      <View style={{ flexDirection: 'row', gap: t.space.xs }}>
        <Cell stage="actual" label={`${msg('cf.out')} · ${msg('fin.stage.actual')}`} value={signed(-r.outActual)} testID={`cf-out-actual-${r.month}`} />
        <Cell stage="committed" label={`${msg('cf.out')} · ${msg('fin.stage.committed')}`} value={signed(-r.outCommitted)} />
        <Cell stage="planned" label={`${msg('cf.out')} · ${msg('fin.stage.planned')}`} value={signed(-r.outPlanned)} />
      </View>
      <Line label={msg('cf.net')} value={sign(r.netActual)} testID={`cf-net-${r.month}`} />
      <Line label={msg('cf.netAll')} value={sign(r.netAll)} />
      {r.sources.length ? (
        <Button testID={`cf-sources-${r.month}`} onPress={onToggle}>{`${open ? '▴' : '▾'} ${msg('cf.sources', { n: r.sources.length })}`}</Button>
      ) : null}
      {open
        ? r.sources.map((id) => {
            const x = fin.state?.expenses.find((e) => e.id === id);
            const inc = plan.incomes.find((i) => i.id === id);
            return (
              <Button
                key={id}
                testID={`cf-source-${id}`}
                onPress={() =>
                  x
                    ? router.push({ pathname: '/finance/expense/[id]', params: { id } })
                    : id.startsWith('sale-')
                      ? router.push({ pathname: '/sale/[id]/settlement', params: { id } })
                      : router.push('/finance/income')
                }
              >
                {x
                  ? `${x.item || fin.state?.categories.find((c) => c.id === x.categoryId)?.name || msg('fin.filter.category')} · ${x.amountSatang === null ? msg('fin.row.unknown') : formatSatang(x.amountSatang)}`
                  : inc
                    ? `${msg('inc.received')} · ${formatDate(inc.date)} · ${signed(inc.amountSatang)}`
                    : id.startsWith('sale-')
                      ? `${msg('inc.rubber')}`
                      : id}
              </Button>
            );
          })
        : null}
    </View>
  );
}

function Cell({ stage, label, value, testID }: { stage: 'actual' | 'committed' | 'planned'; label: string; value: string; testID?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 2, ...stageFrame(stage, t), padding: t.space.xs }}>
      <StageTag stage={stage} />
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color: t.color.inkSoft }}>{label}</Text>
      <Text testID={testID} style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, fontWeight: t.font.weight.bold, color: t.color.ink }}>{value}</Text>
    </View>
  );
}

function Reserve({ value, onSave }: { value: ReturnType<typeof projectPlan>['reserve']; onSave: (amount: number, assumption: string, source: string) => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [assumption, setAssumption] = useState('');
  const [source, setSource] = useState('');
  const satang = parseBahtToSatang(amount);
  return (
    <View testID="cashflow-reserve" style={{ gap: t.space.xs, padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk }}>
      <Label>{msg('cf.reserve')}</Label>
      {value ? (
        <>
          <Text testID="reserve-amount" style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>{formatSatang(value.amountSatang)}</Text>
          <Note>{`${msg('cf.reserveAssumption')}: ${value.assumption}`}</Note>
          <Note>{`${msg('cf.reserveSource')}: ${value.source}`}</Note>
        </>
      ) : (
        <Note testID="reserve-none">{msg('cf.reserveNone')}</Note>
      )}
      {editing ? (
        <>
          <Input testID="reserve-input" numeric value={amount} onChangeText={setAmount} placeholder={msg('cf.reserveAmount')} accessibilityLabel={msg('cf.reserveAmount')} />
          <Input testID="reserve-assumption" value={assumption} onChangeText={setAssumption} placeholder={msg('cf.reserveAssumption')} accessibilityLabel={msg('cf.reserveAssumption')} />
          <Input testID="reserve-source" value={source} onChangeText={setSource} placeholder={msg('cf.reserveSource')} accessibilityLabel={msg('cf.reserveSource')} />
          <Button
            testID="reserve-save"
            variant="primary"
            disabled={satang === null || !assumption.trim()}
            onPress={() => void onSave(satang!, assumption.trim(), source.trim()).then(() => setEditing(false))}
          >
            {msg('common.save')}
          </Button>
        </>
      ) : (
        <Button testID="reserve-edit" onPress={() => setEditing(true)}>{msg('cf.reserveEdit')}</Button>
      )}
    </View>
  );
}
