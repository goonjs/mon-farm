/**
 * All expenses (E11-S01 · D-74 F4, F5, F7).
 *
 * Totals per stage for whatever is filtered — planned never adds into
 * actual, and an unknown planned amount is counted rather than summed as
 * zero. Filters: stage, category, month, "no payer recorded" (then pick
 * several and set the payer at once), "not repaid to payer" → narrow by
 * payer → pick several → record one repayment.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '../../components/chrome';
import { Card, Chip, ChipRow, Fact, MoneyLine, Note, PayerPicker, ScreenHeader, StageTag, stageFrame } from '../../components/finance/parts';
import { filterExpenses, stageTotals, type Expense, type ExpenseFilter, type Reimbursement } from '../../core/finance/ledger';
import { formatDate, formatMonth, formatSatang } from '../../core/finance/money';
import { FARM_FUNDS, type Payer, type Stage } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { useInFlight } from '../../finance/use-in-flight';

const STAGES: readonly Stage[] = ['actual', 'committed', 'planned'];

export default function ExpensesScreen() {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const [filter, setFilter] = useState<ExpenseFilter>({});
  const [open, setOpen] = useState<'category' | 'month' | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkPayer, setBulkPayer] = useState<Payer | null>(null);

  const state = fin.state;
  const rows = useMemo(() => (state ? filterExpenses(state, filter) : []), [state, filter]);
  const totals = stageTotals(rows);
  const months = useMemo(
    () => [...new Set((state?.expenses ?? []).filter((x) => !x.deleted).map((x) => x.date.slice(0, 7)))].sort().reverse(),
    [state],
  );
  const reimb = useMemo(() => new Map((state?.reimbursements ?? []).map((r) => [r.expenseId, r])), [state]);
  const catName = (id: string | null) => state?.categories.find((c) => c.id === id)?.name ?? msg('fin.filter.category');
  const unrepaidPayers = useMemo(() => {
    const m = new Map<string, Payer>();
    for (const r of state?.reimbursements ?? []) if (r.remainingSatang > 0) m.set(r.to.id, r.to);
    return [...m.values()];
  }, [state]);

  const set = (patch: Partial<ExpenseFilter>) => {
    setFilter((f) => {
      const next: Record<string, unknown> = { ...f, ...patch };
      for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === false) delete next[k];
      return next as ExpenseFilter;
    });
    setSelected(new Set());
  };
  const filterCount = Object.keys(filter).length;
  const selecting = !!filter.payerMissing || (!!filter.unrepaid && !!filter.payerId);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chosen = rows.filter((x) => selected.has(x.id));
  const chosenSatang = chosen.reduce((s, x) => s + (x.amountSatang ?? 0), 0);
  const chosenOwed = chosen.reduce((s, x) => s + Math.max(0, reimb.get(x.id)?.remainingSatang ?? 0), 0);

  const inFlight = useInFlight();
  const saving = inFlight.busy;
  const saveBulkPayer = async () => {
    try {
      for (const x of chosen) {
        await fin.write(x.id, x.headEventId, { t: 'expense_changed', patch: { payer: bulkPayer } });
      }
      setSelected(new Set());
      setBulkPayer(null);
    } catch (err) {
      console.error('Payer could not be stored.', err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        testID="expenses"
        title={msg('fin.list.title')}
        subtitle={filterCount ? msg('fin.list.filtering', { n: filterCount }) : undefined}
        onBack={() => router.replace('/')}
      />

      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.sm }}>
        <ChipRow>
          <Chip testID="open-owed" onPress={() => router.push('/finance/owed')}>{`${msg('fin.list.owed')} ›`}</Chip>
          <Chip testID="open-debts" onPress={() => router.push('/finance/debts')}>{`${msg('debt.open')} ›`}</Chip>
          {/* E11-S04..S08 */}
          <Chip testID="open-salary" onPress={() => router.push('/finance/salary')}>{`${msg('sal.open')} ›`}</Chip>
          <Chip testID="open-aid" onPress={() => router.push('/finance/aid')}>{`${msg('aid.open')} ›`}</Chip>
          <Chip testID="open-income" onPress={() => router.push('/finance/income')}>{`${msg('inc.open')} ›`}</Chip>
          <Chip testID="open-cashflow" onPress={() => router.push('/finance/cashflow')}>{`${msg('cf.open')} ›`}</Chip>
        </ChipRow>
        <ChipRow>
          <Chip testID="filter-stage" on={!!filter.stage} onPress={() => set({ stage: nextStage(filter.stage) })}>
            {filter.stage ? msg(`fin.stage.${filter.stage}`) : `${msg('fin.filter.stage')} ▾`}
          </Chip>
          <Chip testID="filter-category" on={!!filter.categoryId} onPress={() => setOpen(open === 'category' ? null : 'category')}>
            {filter.categoryId ? catName(filter.categoryId) : `${msg('fin.filter.category')} ▾`}
          </Chip>
          <Chip testID="filter-month" on={!!filter.month} onPress={() => setOpen(open === 'month' ? null : 'month')}>
            {filter.month ? formatMonth(filter.month) : `${msg('fin.filter.month')} ▾`}
          </Chip>
          <Chip testID="filter-payer-missing" on={!!filter.payerMissing} onPress={() => set({ payerMissing: !filter.payerMissing, unrepaid: undefined, payerId: undefined })}>
            {msg('fin.filter.payerMissing')}
          </Chip>
          <Chip testID="filter-unrepaid" on={!!filter.unrepaid} onPress={() => set({ unrepaid: !filter.unrepaid, payerId: undefined, payerMissing: undefined })}>
            {msg('fin.filter.unrepaid')}
          </Chip>
          {filterCount ? (
            <Chip testID="filter-clear" onPress={() => { setFilter({}); setSelected(new Set()); }}>{`${msg('fin.filter.clear')} ✕`}</Chip>
          ) : null}
        </ChipRow>

        {open === 'category' ? (
          <ChipRow>
            <Chip testID="cat-all" on={!filter.categoryId} onPress={() => { set({ categoryId: undefined }); setOpen(null); }}>{msg('fin.filter.all')}</Chip>
            {state?.categories.map((c) => (
              <Chip key={c.id} testID={`cat-${c.id}`} on={filter.categoryId === c.id} onPress={() => { set({ categoryId: c.id }); setOpen(null); }}>
                {c.name}
              </Chip>
            ))}
          </ChipRow>
        ) : null}
        {open === 'month' ? (
          <ChipRow>
            <Chip testID="month-all" on={!filter.month} onPress={() => { set({ month: undefined }); setOpen(null); }}>{msg('fin.filter.all')}</Chip>
            {months.map((m) => (
              <Chip key={m} testID={`month-${m}`} on={filter.month === m} onPress={() => { set({ month: m }); setOpen(null); }}>
                {formatMonth(m)}
              </Chip>
            ))}
          </ChipRow>
        ) : null}
        {filter.unrepaid ? (
          <ChipRow>
            {unrepaidPayers.map((p) => (
              <Chip key={p.id} testID={`filter-payer-${p.id}`} on={filter.payerId === p.id} onPress={() => set({ payerId: filter.payerId === p.id ? undefined : p.id })}>
                {msg('fin.filter.payer', { name: p.name })}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        <Card testID="totals">
          <MoneyLine testID="total-actual" strong label={msg('fin.total.actual')} satang={totals.actual} />
          <MoneyLine testID="total-committed" label={msg('fin.total.committed')} satang={totals.committed} />
          <View testID="total-planned" style={{ gap: 2 }}>
            <MoneyLine testID="total-planned-line" label={msg('fin.total.planned')} satang={totals.planned.knownSatang} />
            {totals.planned.unknownCount ? <Fact mark="half" tone="warn">{msg('fin.total.unknown', { n: totals.planned.unknownCount })}</Fact> : null}
          </View>
        </Card>

        {state === null ? (
          <Note>{msg('counter.loading')}</Note>
        ) : rows.length === 0 ? (
          <Note testID="expenses-empty">{msg('fin.list.empty')}</Note>
        ) : (
          <>
            {filterCount ? <Note testID="expenses-count">{msg('fin.list.count', { n: rows.length })}</Note> : null}
            {rows.map((x) => (
              <Row
                key={x.id}
                x={x}
                category={x.categoryId ? catName(x.categoryId) : msg('fin.filter.category')}
                reimb={reimb.get(x.id)}
                selectable={selecting}
                selected={selected.has(x.id)}
                onToggle={() => toggle(x.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {filter.payerMissing && chosen.length ? (
        <View testID="bulk-payer" style={{ padding: t.space.md, gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.rule }}>
          <Note>{msg('fin.bulk.payerTitle', { n: chosen.length })}</Note>
          <PayerPicker testID="bulk-payer" value={bulkPayer} onChange={setBulkPayer} extra={unrepaidPayers} />
          {bulkPayer && bulkPayer.id !== FARM_FUNDS ? (
            <Note tone="warn" testID="bulk-owed">{msg('fin.bulk.owedPreview', { name: bulkPayer.name, amount: formatSatang(chosenSatang) })}</Note>
          ) : null}
          <Button testID="bulk-payer-save" variant="primary" disabled={!bulkPayer || saving} onPress={() => void inFlight.run(saveBulkPayer)}>
            {msg('fin.bulk.payerSave')}
          </Button>
        </View>
      ) : null}

      {filter.unrepaid && filter.payerId && chosen.length ? (
        <View style={{ padding: t.space.md, borderTopWidth: t.border.hair, borderTopColor: t.color.rule }}>
          <Button
            testID="bulk-repay"
            variant="primary"
            onPress={() =>
              router.push({ pathname: '/finance/repay', params: { payerId: filter.payerId!, ids: chosen.map((x) => x.id).join(',') } })
            }
          >
            {msg('fin.bulk.repay', { n: chosen.length, amount: formatSatang(chosenOwed) })}
          </Button>
        </View>
      ) : null}

      {!selecting ? (
        <View style={{ padding: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.rule }}>
          <Button testID="expense-new" variant="primary" onPress={() => router.push({ pathname: '/finance/expense/[id]', params: { id: 'new' } })}>
            {msg('fin.list.add')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function nextStage(s: Stage | undefined): Stage | undefined {
  if (!s) return STAGES[0];
  const i = STAGES.indexOf(s);
  return i === STAGES.length - 1 ? undefined : STAGES[i + 1];
}

function Row({
  x,
  category,
  reimb,
  selectable,
  selected,
  onToggle,
}: {
  x: Expense;
  category: string;
  reimb: Reimbursement | undefined;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const status = reimb
    ? `${msg(`fin.status.${reimb.status}`)}${reimb.repayments.some((r) => r.saleId) ? ` · ${msg('fin.status.sale')}` : ''}`
    : null;

  return (
    <Pressable
      testID={`expense-${x.id}`}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected } : undefined}
      accessibilityLabel={selectable ? msg('fin.row.select', { name: category }) : undefined}
      onPress={() => (selectable ? onToggle() : router.push({ pathname: '/finance/expense/[id]', params: { id: x.id } }))}
      style={{
        ...stageFrame(x.stage, t),
        ...(x.stage === 'actual' ? { backgroundColor: t.color.surfaceRaised, borderColor: t.color.ruleFaint } : null),
        flexDirection: 'row',
        gap: t.space.sm,
        alignItems: 'center',
        ...(selected ? { borderColor: t.color.action, borderWidth: t.border.thick } : null),
      }}
    >
      {selectable ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: t.radius.sm / 2,
            borderWidth: t.border.thick,
            borderColor: t.color.action,
            backgroundColor: selected ? t.color.action : 'transparent',
          }}
        />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {x.item ? `${category} · ${x.item}` : category}
        </Text>
        <Fact mark="date">{formatDate(x.date)}</Fact>
        <Fact mark="person" tone={x.payer ? 'soft' : 'warn'}>{x.payer ? msg('fin.row.payer', { name: x.payer.name }) : msg('fin.row.noPayer')}</Fact>
        {status ? <Fact mark={reimb?.status === 'repaid' ? 'check' : 'half'} tone={reimb?.status === 'repaid' ? 'accept' : 'warn'}>{status}</Fact> : null}
        {x.conflicts.length ? (
          <Text testID={`expense-conflict-${x.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, fontWeight: t.font.weight.bold, color: t.color.reject }}>
            {msg('fin.row.conflict')}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: t.space.xxs }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {x.amountSatang === null ? msg('fin.row.unknown') : formatSatang(x.amountSatang)}
        </Text>
        <StageTag stage={x.stage} />
      </View>
    </Pressable>
  );
}
