/**
 * ค่าใช้จ่ายทั้งหมด — v1.1.0 farm mockup screens 19, 19b, 19c (E11-S01,
 * E11-S02 · D-74 F4, F5, F7), rebuilt on src/ui (D-82).
 *
 * Totals by stage for whatever is filtered; planned never adds into actual
 * and an unknown planned amount reads "ไม่ทราบ", never 0. Filters: stage,
 * category, farm, month, "ยังไม่บันทึกผู้จ่าย" (pick several → set the payer
 * in a sheet) and "ยังไม่คืนผู้จ่าย" → narrow by payer → pick several →
 * record one repayment.
 */

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { groupOrders, orderProgress, type OrderView } from '../../core/finance/fert-order';
import { filterExpenses, stageTotals, type Expense, type ExpenseFilter, type Reimbursement } from '../../core/finance/ledger';
import { formatDate, formatMonth, formatSatang } from '../../core/finance/money';
import { FARM_FUNDS, type Payer, type Stage } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import {
  AppText,
  BottomSheet,
  Button,
  CalendarIcon,
  Card,
  Check,
  Chip,
  CTA,
  FactRow,
  FarmIcon,
  PersonIcon,
  PinnedActions,
  Plus,
  ReceiptIcon,
  ScreenHeader,
} from '../../ui';
import { V2_HOME } from '../routes';
import { orderHref } from './order-routes';
import { ChoiceChip, ChoiceRow, Day, NotRecordedPill, PayerPicker, stageCard, UnknownPill } from './pieces';

const STAGES: readonly Stage[] = ['actual', 'committed', 'planned'];

export function ExpensesScreen() {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const fin = useFinance();
  const inFlight = useInFlight();
  const [filter, setFilter] = useState<ExpenseFilter>({});
  const [open, setOpen] = useState<'stage' | 'category' | 'farm' | 'month' | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkPayer, setBulkPayer] = useState<Payer | null>(null);
  const [failed, setFailed] = useState(false);
  const farms = useFarms();

  const state = fin.state;
  const rows = useMemo(() => (state ? filterExpenses(state, filter) : []), [state, filter]);
  const totals = stageTotals(rows);
  const months = useMemo(
    () => [...new Set((state?.expenses ?? []).filter((x) => !x.deleted).map((x) => x.date.slice(0, 7)))].sort().reverse(),
    [state],
  );
  const reimb = useMemo(() => new Map((state?.reimbursements ?? []).map((r) => [r.expenseId, r])), [state]);
  // One row per shop order; while picking (payer, repayment) every item stays its own row so the selection is per item.
  const entries = useMemo(() => {
    if (selectingPayerOrRepay(filter)) return rows.map((x): ListEntry => ({ x }));
    const orders = new Map(groupOrders(rows.filter((x) => x.orderId)).map((o) => [o.orderId, o]));
    const seen = new Set<string>();
    const out: ListEntry[] = [];
    for (const x of rows) {
      const o = x.orderId ? orders.get(x.orderId) : undefined;
      if (!o) out.push({ x });
      else if (!seen.has(o.orderId)) {
        seen.add(o.orderId);
        out.push({ order: o });
      }
    }
    return out;
  }, [rows, filter]);
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
    setOpen(null);
  };
  const filterCount = Object.keys(filter).length;
  const selectingPayer = !!filter.payerMissing;
  const selectingRepay = !!filter.unrepaid && !!filter.payerId;
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

  const saveBulkPayer = () =>
    inFlight.run(async () => {
      setFailed(false);
      try {
        for (const x of chosen) await fin.write(x.id, x.headEventId, { t: 'expense_changed', patch: { payer: bulkPayer } });
        setSelected(new Set());
        setBulkPayer(null);
      } catch (err) {
        console.error('Payer could not be stored.', err);
        setFailed(true);
      }
    });

  const totalLabel = (k: Stage) => (k === 'actual' && filter.month ? `${msg('fin.total.actual')} ${formatMonth(filter.month)}` : msg(`fin.total.${k}`));

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        title={msg('fin.list.title')}
        subtitle={filterCount ? msg('fin.list.filtering', { n: filterCount }) : undefined}
        back={{ label: msg('v2.back'), href: V2_HOME, testID: 'expenses-back' }}
        sync={sync}
      />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space[16] * 2 }}>
        <ChoiceRow>
          <ChoiceChip testID="filter-stage" on={!!filter.stage || open === 'stage'} label={filter.stage ? msg(`fin.stage.${filter.stage}`) : `${msg('fin.filter.stage')} ▾`} onPress={() => setOpen(open === 'stage' ? null : 'stage')} />
          <ChoiceChip testID="filter-category" on={!!filter.categoryId || open === 'category'} label={filter.categoryId ? catName(filter.categoryId) : `${msg('fin.filter.category')} ▾`} onPress={() => setOpen(open === 'category' ? null : 'category')} />
          <ChoiceChip testID="filter-farm" on={!!filter.propertyId || open === 'farm'} label={filter.propertyId ? (farms.find((f) => f.id === filter.propertyId)?.name ?? '') : `${msg('v2m.farm')} ▾`} onPress={() => setOpen(open === 'farm' ? null : 'farm')} />
          <ChoiceChip testID="filter-month" on={!!filter.month || open === 'month'} label={filter.month ? formatMonth(filter.month) : `${msg('fin.filter.month')} ▾`} onPress={() => setOpen(open === 'month' ? null : 'month')} />
          <ChoiceChip testID="filter-payer-missing" on={!!filter.payerMissing} label={msg('fin.filter.payerMissing')} onPress={() => set({ payerMissing: !filter.payerMissing, unrepaid: undefined, payerId: undefined })} />
          <ChoiceChip testID="filter-unrepaid" on={!!filter.unrepaid} label={msg('fin.filter.unrepaid')} onPress={() => set({ unrepaid: !filter.unrepaid, payerId: undefined, payerMissing: undefined })} />
          {filterCount ? <ChoiceChip testID="filter-clear" label={`${msg('fin.filter.clear')} ✕`} onPress={() => { setFilter({}); setSelected(new Set()); }} /> : null}
        </ChoiceRow>

        {open === 'stage' ? (
          <ChoiceRow>
            <ChoiceChip testID="stage-all" label={msg('fin.filter.all')} on={!filter.stage} onPress={() => set({ stage: undefined })} />
            {STAGES.map((s) => <ChoiceChip key={s} testID={`stage-${s}`} label={msg(`fin.stage.${s}`)} on={filter.stage === s} onPress={() => set({ stage: s })} />)}
          </ChoiceRow>
        ) : null}
        {open === 'category' ? (
          <ChoiceRow>
            <ChoiceChip testID="cat-all" label={msg('fin.filter.all')} on={!filter.categoryId} onPress={() => set({ categoryId: undefined })} />
            {state?.categories.map((c) => <ChoiceChip key={c.id} testID={`cat-${c.id}`} label={c.name} on={filter.categoryId === c.id} onPress={() => set({ categoryId: c.id })} />)}
          </ChoiceRow>
        ) : null}
        {open === 'farm' ? (
          <ChoiceRow>
            <ChoiceChip testID="farm-all" label={msg('fin.filter.all')} on={!filter.propertyId} onPress={() => set({ propertyId: undefined })} />
            {farms.map((f) => <ChoiceChip key={f.id} testID={`farm-${f.id}`} label={f.name} on={filter.propertyId === f.id} onPress={() => set({ propertyId: f.id })} />)}
          </ChoiceRow>
        ) : null}
        {open === 'month' ? (
          <ChoiceRow>
            <ChoiceChip testID="month-all" label={msg('fin.filter.all')} on={!filter.month} onPress={() => set({ month: undefined })} />
            {months.map((m) => <ChoiceChip key={m} testID={`month-${m}`} label={formatMonth(m)} on={filter.month === m} onPress={() => set({ month: m })} />)}
          </ChoiceRow>
        ) : null}
        {filter.unrepaid ? (
          <ChoiceRow>
            {unrepaidPayers.map((p) => (
              <ChoiceChip key={p.id} testID={`filter-payer-${p.id}`} label={msg('fin.filter.payer', { name: p.name })} on={filter.payerId === p.id} onPress={() => set({ payerId: filter.payerId === p.id ? undefined : p.id })} />
            ))}
          </ChoiceRow>
        ) : null}

        <Card testID="totals">
          <TotalLine testID="total-actual" label={totalLabel('actual')} satang={totals.actual} />
          <TotalLine testID="total-committed" label={totalLabel('committed')} satang={totals.committed} />
          <View testID="total-planned" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <AppText style={{ flex: 1 }}>{totalLabel('planned')}</AppText>
            {totals.planned.unknownCount && !totals.planned.knownSatang ? (
              <UnknownPill />
            ) : (
              <>
                <Amount satang={totals.planned.knownSatang} />
                {totals.planned.unknownCount ? <AppText variant="caption">{`+ ${msg('fin.total.unknown', { n: totals.planned.unknownCount })}`}</AppText> : null}
              </>
            )}
          </View>
        </Card>

        {selectingPayer || selectingRepay ? <AppText variant="bodySm" testID="expenses-count">{msg('v2m.pickHint', { n: rows.length })}</AppText> : null}

        {state === null ? (
          <AppText variant="bodySm">{msg('counter.loading')}</AppText>
        ) : rows.length === 0 ? (
          <AppText variant="bodySm" testID="expenses-empty">{msg('fin.list.empty')}</AppText>
        ) : (
          entries.map((e) => 'order' in e ? (
            <OrderRow key={e.order.orderId} order={e.order} category={catName('cat-fertilizer')} />
          ) : (
            <Row
              key={e.x.id}
              x={e.x}
              category={e.x.categoryId ? catName(e.x.categoryId) : msg('fin.filter.category')}
              farm={farms.find((f) => f.id === e.x.propertyId)?.name ?? null}
              reimb={reimb.get(e.x.id)}
              selectable={selectingPayer || selectingRepay}
              selected={selected.has(e.x.id)}
              onToggle={() => toggle(e.x.id)}
            />
          ))
        )}
      </ScrollView>

      {selectingRepay && chosen.length ? (
        <View
          testID="repay-bar"
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, margin: t.layout.screenPaddingX, padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.action }}
        >
          <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.inkInverse }}>
            {msg('v2m.pickedSum', { n: chosen.length, amount: formatSatang(chosenOwed) })}
          </Text>
          <Button
            testID="bulk-repay"
            onPress={() => router.push({ pathname: '/v2/repay', params: { payerId: filter.payerId!, ids: chosen.map((x) => x.id).join(',') } })}
          >
            {msg('fin.repay.title')}
          </Button>
        </View>
      ) : !selectingPayer && !selectingRepay ? (
        <PinnedActions>
          <CTA testID="expense-new" icon={(c) => <Plus color={c} />} onPress={() => router.push({ pathname: '/v2/expense/[id]', params: { id: 'new' } })}>
            {msg('fin.list.add')}
          </CTA>
        </PinnedActions>
      ) : null}

      <BottomSheet testID="bulk-payer" open={selectingPayer && chosen.length > 0} onClose={() => setSelected(new Set())} title={msg('fin.bulk.payerTitle', { n: chosen.length })}>
        <View style={{ gap: t.space.md }}>
          <PayerPicker testID="bulk-payer" value={bulkPayer} onChange={setBulkPayer} extra={unrepaidPayers} />
          {bulkPayer && bulkPayer.id !== FARM_FUNDS ? (
            <Card style={{ backgroundColor: t.color.surfaceSunk }}>
              <FactRow icon={(c) => <PersonIcon color={c} size={14} />} testID="bulk-owed">
                {msg('fin.bulk.owedPreview', { name: bulkPayer.name, amount: formatSatang(chosenSatang) })}
              </FactRow>
            </Card>
          ) : null}
          {failed ? <AppText variant="bodySm" testID="bulk-failed">{msg('fin.form.saveFailed')}</AppText> : null}
          <CTA testID="bulk-payer-save" disabled={!bulkPayer || inFlight.busy} onPress={() => void saveBulkPayer()}>
            {msg('fin.bulk.payerSave')}
          </CTA>
        </View>
      </BottomSheet>
    </View>
  );
}

/** Farms (สวน) from the farm data, for the farm filter and the row's farm line. */
export function useFarms(): { id: string; name: string }[] {
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    peopleStore.state().then(
      (s) => setFarms(s.properties.filter((p) => !p.deleted).map((p) => ({ id: p.id, name: p.name }))),
      () => setFarms([]),
    );
  }, []);
  return farms;
}

function Amount({ satang, testID }: { satang: number; testID?: string }) {
  const t = useTheme();
  return (
    <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
      {formatSatang(satang)}
    </Text>
  );
}

function TotalLine({ label, satang, testID }: { label: string; satang: number; testID: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <Amount satang={satang} />
    </View>
  );
}

function Row({
  x,
  category,
  farm,
  reimb,
  selectable,
  selected,
  onToggle,
}: {
  x: Expense;
  category: string;
  farm: string | null;
  reimb: Reimbursement | undefined;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const repaid = reimb?.status === 'repaid';
  const atSale = reimb?.repayments.find((r) => r.saleId);
  return (
    <Pressable
      testID={`expense-${x.id}`}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected } : undefined}
      accessibilityLabel={selectable ? msg('fin.row.select', { name: category }) : undefined}
      onPress={() => {
        if (selectable) onToggle();
        else if (x.fertilizer || x.share?.totalSacks != null) router.push(orderHref(x.orderId ?? x.id));
        else router.push({ pathname: '/v2/expense/[id]', params: { id: x.id } });
      }}
      style={{ ...stageCard(x.stage, t), flexDirection: 'row', alignItems: 'center', gap: t.space.md, ...(selected ? { borderWidth: t.border.thick, borderColor: t.color.action } : null) }}
    >
      {selectable ? (
        <View style={{ width: 24, height: 24, borderRadius: t.radius.sm, borderWidth: t.border.thick, borderColor: t.color.action, backgroundColor: selected ? t.color.action : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {selected ? <Check color={t.color.inkInverse} /> : null}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="heading" style={{ fontSize: t.font.size.bodyLg }}>{x.item ? `${category} · ${x.item}` : category}</AppText>
        <FactRow icon={(c) => <CalendarIcon color={c} size={14} />}>
          <Day iso={x.date} />
        </FactRow>
        {farm ? <FactRow icon={(c) => <FarmIcon color={c} size={14} />}>{farm}</FactRow> : null}
        {x.payer ? (
          <FactRow icon={(c) => <PersonIcon color={c} size={14} />}>{x.payer.id === FARM_FUNDS ? msg('fin.row.payer', { name: x.payer.name }) : x.payer.name}</FactRow>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <FactRow icon={(c) => <PersonIcon color={c} size={14} />}>{msg('v2m.payer')}</FactRow>
            <NotRecordedPill />
          </View>
        )}
        {reimb ? (
          <View testID={`expense-status-${x.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            {repaid ? <Check color={t.color.accept} /> : <HalfDot />}
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: repaid ? t.color.accept : t.color.warn }}>{msg(`fin.status.${reimb.status}`)}</Text>
          </View>
        ) : null}
        {atSale ? <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>{msg('v2m.nettedAtSale', { date: formatDate(atSale.date) })}</FactRow> : null}
        {x.conflicts.length ? <Text testID={`expense-conflict-${x.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.reject }}>{msg('fin.row.conflict')}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {x.amountSatang === null ? <UnknownPill /> : <Amount satang={x.amountSatang} testID={`expense-amount-${x.id}`} />}
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg(`fin.stage.${x.stage}`)}</Text>
      </View>
    </Pressable>
  );
}

type ListEntry = { readonly x: Expense } | { readonly order: OrderView };
const selectingPayerOrRepay = (f: ExpenseFilter) => !!f.payerMissing || (!!f.unrepaid && !!f.payerId);

/** One shop order as one row (E11-S11 FO-12): what was bought, the shop and day, the net, how much is told. */
function OrderRow({ order, category }: { order: OrderView; category: string }) {
  const t = useTheme();
  const msg = useT();
  const { done, total } = orderProgress(order);
  const first = order.items[0];
  const title = order.items.length === 1 ? first.fertilizer?.formula || first.item || category : msg('ords.rowTitle', { n: order.items.length });
  const caption = order.shop ? msg('ords.rowCaption', { shop: order.shop, date: formatDate(order.date) }) : formatDate(order.date);
  return (
    <Pressable
      testID={`order-${order.orderId}`}
      accessibilityRole="button"
      onPress={() => router.push(orderHref(order.orderId))}
      style={{ ...stageCard(order.stage, t), flexDirection: 'row', alignItems: 'center', gap: t.space.md, minHeight: t.target.min }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: t.space.xs }}>
        <AppText variant="heading" style={{ fontSize: t.font.size.bodyLg }}>{title}</AppText>
        <FactRow icon={(c) => <CalendarIcon color={c} size={14} />}>{caption}</FactRow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }}>
          {order.stage === 'committed' ? <Chip testID={`order-ordered-${order.orderId}`} tone="neutral" label={msg('ords.ordered')} /> : null}
          {total > 0 && done < total ? <Chip testID={`order-progress-${order.orderId}`} tone="warn" label={msg('ords.progress', { done, total })} /> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Amount satang={order.netSatang} testID={`order-amount-${order.orderId}`} />
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg(`fin.stage.${order.stage}`)}</Text>
      </View>
    </Pressable>
  );
}

/** Half-filled dot — "ค้าง": pending, shape and word, not colour alone. */
export function HalfDot() {
  const t = useTheme();
  return (
    <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: t.border.hair, borderColor: t.color.warn, overflow: 'hidden', flexDirection: 'row' }}>
      <View style={{ flex: 1, backgroundColor: t.color.warn }} />
      <View style={{ flex: 1 }} />
    </View>
  );
}
