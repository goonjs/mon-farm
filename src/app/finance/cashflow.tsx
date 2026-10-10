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

import { Button } from '../../components/chrome';
import { Input, Label, MoneyLine, Note, Rule, ScreenHeader } from '../../components/finance/parts';
import { isDerivedExpense, nextMonth, projectFinance } from '../../core/finance/ledger';
import { formatDate, formatMonth, formatSatang, parseBahtToSatang, todayIso } from '../../core/finance/money';
import { cashflow, projectPlan, type CashflowRow } from '../../core/finance/plan';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useSaleCounts } from '../../finance/use-live-sales';
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
  const counts = useSaleCounts();
  const plan = useMemo(() => projectPlan(fin.events ?? []), [fin.events]);
  const now = todayIso().slice(0, 7);
  const toMonth = addMonths(now, 3);
  // Salary months out to the table's last month, not just next month (review #4).
  const state = useMemo(() => (fin.events ? projectFinance(fin.events, counts, addMonths(toMonth, -1)) : null), [fin.events, counts, toMonth]);
  const rows = useMemo(
    () => (state ? cashflow({ state, plan, rubber: rubber.income, rubberUnknown: rubber.unknown, fromMonth: addMonths(now, -2), toMonth }) : []),
    [state, plan, rubber, now, toMonth],
  );
  const [open, setOpen] = useState<string | null>(null);

  const ob = useMemo(() => {
    const all = (fin.state?.expenses ?? []).filter((x) => !x.deleted);
    const live = all.filter((x) => x.date.slice(0, 7) >= now);
    return {
      // Every committed item, overdue ones included — an unpaid past salary is still owed (review #7).
      committed: all.filter((x) => x.stage === 'committed').reduce((s, x) => s + (x.amountSatang ?? 0), 0),
      planned: live.filter((x) => x.stage === 'planned').reduce((s, x) => s + (x.amountSatang ?? 0), 0),
      plannedUnknown: live.filter((x) => x.stage === 'planned' && x.amountSatang === null).length,
      owed: (fin.state?.reimbursements ?? []).reduce((s, r) => s + Math.max(0, r.remainingSatang), 0),
    };
  }, [fin.state, now]);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader testID="cashflow" title={msg('cf.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        <Note>{msg('cf.pending')}</Note>
        {rows.map((r) => (
          <Month key={r.month} r={r} open={open === r.month} onToggle={() => setOpen(open === r.month ? null : r.month)} state={state} plan={plan} />
        ))}

        <View testID="cashflow-obligations" style={{ gap: t.space.xxs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.ruleFaint, backgroundColor: t.color.surfaceRaised }}>
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
      <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>{value}</Text>
    </View>
  );
}

function Month({ r, open, onToggle, state, plan }: { r: CashflowRow; open: boolean; onToggle: () => void; state: ReturnType<typeof projectFinance> | null; plan: ReturnType<typeof projectPlan> }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID={`cf-${r.month}`} style={{ gap: t.space.xs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.ruleFaint, backgroundColor: t.color.surfaceRaised }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>{formatMonth(r.month)}</Text>
        {r.incomplete ? <Note tone="warn" testID={`cf-incomplete-${r.month}`}>{`⚠ ${msg('cf.incomplete')}`}</Note> : null}
      </View>
      <MoneyLine testID={`cf-in-actual-${r.month}`} label={`${msg('cf.in')} · ${msg('fin.stage.actual')}`} satang={r.inActual} dir="in" />
      <MoneyLine testID={`cf-in-planned-${r.month}`} label={`${msg('cf.in')} · ${msg('fin.stage.planned')}`} satang={r.inPlanned} dir="in" />
      <Rule />
      <MoneyLine testID={`cf-out-actual-${r.month}`} label={`${msg('cf.out')} · ${msg('fin.stage.actual')}`} satang={r.outActual} dir="out" />
      <MoneyLine testID={`cf-out-committed-${r.month}`} label={`${msg('cf.out')} · ${msg('fin.stage.committed')}`} satang={r.outCommitted} dir="out" />
      <MoneyLine testID={`cf-out-planned-${r.month}`} label={`${msg('cf.out')} · ${msg('fin.stage.planned')}`} satang={r.outPlanned} dir="out" />
      <Rule />
      <MoneyLine testID={`cf-net-${r.month}`} strong label={msg('cf.net')} satang={r.netActual} dir={r.netActual < 0 ? 'out' : r.netActual > 0 ? 'in' : undefined} />
      <MoneyLine testID={`cf-netall-${r.month}`} label={msg('cf.netAll')} satang={r.netAll} dir={r.netAll < 0 ? 'out' : r.netAll > 0 ? 'in' : undefined} />
      {r.sources.length ? (
        <Button testID={`cf-sources-${r.month}`} onPress={onToggle}>{`${open ? '▴' : '▾'} ${msg('cf.sources', { n: r.sources.length })}`}</Button>
      ) : null}
      {open
        ? r.sources.map((id) => {
            const x = state?.expenses.find((e) => e.id === id);
            const inc = plan.incomes.find((i) => i.id === id);
            return (
              <Button
                key={id}
                testID={`cf-source-${id}`}
                onPress={() =>
                  x && isDerivedExpense(id) && id.startsWith('salary-')
                    ? router.push('/finance/salary')
                    : x
                    ? router.push({ pathname: '/finance/expense/[id]', params: { id } })
                    : id.startsWith('sale-')
                      ? router.push({ pathname: '/sale/[id]/settlement', params: { id } })
                      : router.push('/finance/income')
                }
              >
                {x
                  ? `${x.item || state?.categories.find((c) => c.id === x.categoryId)?.name || msg('fin.filter.category')} · ${x.amountSatang === null ? msg('fin.row.unknown') : formatSatang(x.amountSatang)}`
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

function Reserve({ value, onSave }: { value: ReturnType<typeof projectPlan>['reserve']; onSave: (amount: number, assumption: string, source: string) => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [assumption, setAssumption] = useState('');
  const [source, setSource] = useState('');
  const satang = parseBahtToSatang(amount);
  return (
    <View testID="cashflow-reserve" style={{ gap: t.space.xs, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.ruleFaint, backgroundColor: t.color.surfaceRaised }}>
      <Label>{msg('cf.reserve')}</Label>
      {value ? (
        <>
          <Text testID="reserve-amount" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>{formatSatang(value.amountSatang)}</Text>
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
