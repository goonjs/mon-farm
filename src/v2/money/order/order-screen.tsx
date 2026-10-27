/**
 * ใบซื้อ — quick capture of a shop order (E11-S11, mockups a1–a8): shop + date on top, the items as cards, who paid and
 * whether the goods have come, the total, บันทึก. Reasons, zones and tapper shares are told later, per item.
 *
 * - One draft holds everything (shop, date, items, payer, stage, discounts), so a sheet closed never loses typing.
 * - Saving writes one `expense_created` per item (ids from `buildOrderExpenses`, one after the other, so a retry that
 *   meets an already-written id is the same item and cannot double it), then shows the "saved" view.
 * - Params (`ORDER_NEW`): date, stage, payerId/payerName, amount (opens the first item with that total), repeatOf.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  buildOrderExpenses,
  checkOrder,
  groupOrders,
  orderTotals,
  type OrderDraft,
  type OrderLineDraft,
} from '../../../core/finance/fert-order';
import type { FertProduct } from '../../../core/finance/fert-products';
import { defaultPayer } from '../../../core/finance/ledger';
import { formatDate, formatSatang, parseBahtToSatang, todayIso } from '../../../core/finance/money';
import { FARM_FUNDS, type FertOptionKind, type Payer } from '../../../core/finance/types';
import { useFinance } from '../../../finance/use-finance';
import { useInFlight } from '../../../finance/use-in-flight';
import { useI18n, useT } from '../../../i18n';
import { newId } from '../../../lib/id';
import { peopleStore } from '../../../store/people';
import { useSyncStatus } from '../../../sync/use-sync-status';
import { useTheme } from '../../../theme';
import { AppText, BasketIcon, CalendarIcon, cardStyle, ChevronRight, CTA, DatePickerSheet, FieldError, Plus, ScreenHeader, WalletIcon } from '../../../ui';
import { FarmScreen, useMaster } from '../../farm/pieces';
import { optionNamed, setFertOption } from '../fert-options';
import { orderHref } from '../order-routes';
import { ItemIcon, ItemSheet, NewProductSheet, OtherItemSheet, PickProductSheet, TextLink, type NewProduct } from './item-sheets';
import {
  EMPTY_MONEY,
  fertSpec,
  lineOf,
  moneyOfLine,
  pastProducts,
  recentFertValues,
  repeatLines,
  specOfLine,
  withGross,
  type ItemMoney,
  type ProductSpec,
} from './order-model';
import { BillDiscountSheet, PayerSheet, ShopSheet } from './order-sheets';
import { SavedView, type Saved } from './saved-view';

type Params = { date?: string; stage?: string; payerId?: string; payerName?: string; amount?: string; repeatOf?: string };

type Sheet =
  | null
  | 'shop'
  | 'date'
  | 'payer'
  | 'bill'
  | { k: 'pick'; editId: string | null; carry: ItemMoney | null }
  | { k: 'new'; editId: string | null; carry: ItemMoney | null }
  | { k: 'item'; editId: string | null; spec: ProductSpec; money: ItemMoney }
  | { k: 'other'; editId: string | null; spec: ProductSpec | null; money: ItemMoney };

export function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/v2/expenses');
}

export function OrderScreen() {
  const params = useLocalSearchParams<Params>();
  const fin = useFinance();
  const msg = useT();
  const t = useTheme();
  const sync = useSyncStatus();
  if (fin.state === null || fin.deviceId === null) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface }}>
        <ScreenHeader title={msg('ordc.title')} back={{ label: msg('v2.back'), onPress: leave, testID: 'ordc-back' }} sync={sync} />
        <AppText variant="bodySm" style={{ padding: t.space.lg }}>
          {msg('ordc.loading')}
        </AppText>
      </View>
    );
  }
  return <Order params={params} fin={fin} />;
}

function Order({ params, fin }: { params: Params; fin: ReturnType<typeof useFinance> }) {
  const t = useTheme();
  const msg = useT();
  const { era } = useI18n();
  const sync = useSyncStatus();
  const master = useMaster();
  const { busy, run } = useInFlight();
  const state = fin.state!;

  const sackUnit = msg('ordc.sackUnit');
  const farmPayer: Payer = { id: FARM_FUNDS, name: msg('fin.payer.farm') };
  // "เหมือนครั้งก่อน": this device's last payer; the first time, farm funds (D-62). Taken once, when the screen opens.
  const last = useMemo(() => defaultPayer(fin.events ?? [], fin.deviceId ?? ''), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastPayer = last ?? farmPayer;

  const repeat = useMemo(() => (params.repeatOf ? (groupOrders(state.expenses.filter((e) => !e.deleted)).find((o) => o.orderId === params.repeatOf) ?? null) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [orderId] = useState(() => newId('ord-'));
  const [date, setDate] = useState(() => (repeat ? todayIso() : (params.date ?? todayIso())));
  const [stage, setStage] = useState<'committed' | 'actual'>(() => (repeat ? 'committed' : params.stage === 'actual' ? 'actual' : 'committed'));
  const [payer, setPayer] = useState<Payer | null>(() =>
    repeat ? repeat.payer : params.payerId ? (params.payerId === 'none' ? null : params.payerId === FARM_FUNDS ? farmPayer : { id: params.payerId, name: params.payerName ?? '' }) : lastPayer,
  );
  const [shop, setShop] = useState(repeat?.shop ?? '');
  const [orderedBy, setOrderedBy] = useState('');
  const [billDiscount, setBillDiscount] = useState(0);
  const [lines, setLines] = useState<readonly OrderLineDraft[]>(() => (repeat ? repeatLines(repeat, () => newId('li-'), sackUnit, msg('ordc.unit.piece')) : []));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [typedTotal, setTypedTotal] = useState<number | null>(() => {
    const n = params.amount && !repeat ? parseBahtToSatang(params.amount) : null;
    return n && n > 0 ? n : null;
  });
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [people, setPeople] = useState<readonly Payer[]>([]);
  useState(() => {
    peopleStore.list().then((ps) => setPeople(ps.map((p) => ({ id: p.id, name: p.name }))), () => setPeople([]));
    return null;
  });

  const farms = master.state ? master.state.properties.filter((p) => !p.deleted) : [];
  const draft: OrderDraft = {
    orderId,
    date,
    stage,
    payer,
    shop: shop.trim(),
    orderedBy: orderedBy.trim(),
    propertyId: farms.length === 1 ? farms[0].id : null,
    billDiscountSatang: billDiscount,
    lines,
  };
  const problems = checkOrder(draft);
  const clean = problems.order.length === 0 && Object.values(problems.lines).every((p) => p.length === 0);
  const totals = orderTotals(draft);
  const nets = lines.reduce((s, l) => s + l.grossSatang - l.itemDiscountSatang, 0);

  const products = useMemo(() => pastProducts(state.expenses, state.fertOptions), [state.expenses, state.fertOptions]);
  const recentShops = useMemo(() => recentFertValues(state.expenses, 'shop'), [state.expenses]);
  const recentPeople = useMemo(() => recentFertValues(state.expenses, 'orderedBy'), [state.expenses]);

  // Farm funds, whoever paid before (newest first), then known people — up to four rows, plus the current pick.
  const payerChoices = useMemo(() => {
    const out: Payer[] = [farmPayer];
    const add = (p: Payer | null) => {
      if (p && !out.some((o) => o.id === p.id)) out.push(p);
    };
    add(lastPayer);
    for (const x of [...state.expenses].sort((a, b) => (a.date < b.date ? 1 : -1))) if (out.length < 4) add(x.payer);
    for (const p of people) if (out.length < 4) add(p);
    return out;
  }, [state.expenses, people]); // eslint-disable-line react-hooks/exhaustive-deps -- farmPayer/lastPayer are fixed for the screen

  // ── Items ────────────────────────────────────────────────────────────────
  const putLine = (editId: string | null, spec: ProductSpec, m: ItemMoney) => {
    const line = lineOf(editId ?? newId('li-'), spec, m);
    setLines((ls) => (editId ? ls.map((l) => (l.id === editId ? line : l)) : [...ls, line]));
    setSheet(null);
  };
  const removeLine = (id: string) => {
    setLines((ls) => ls.filter((l) => l.id !== id));
    setSheet(null);
  };
  const openItem = (editId: string | null, spec: ProductSpec, money: ItemMoney) => setSheet({ k: 'item', editId, spec, money });
  /** The first item sheet opened after a typed total (from the expense form) carries it, as the typed total. */
  const takeTyped = (m: ItemMoney): ItemMoney => {
    if (typedTotal === null || m.gross !== null) return m;
    const out = { ...withGross(m, typedTotal), mode: 'total' as const };
    setTypedTotal(null);
    return out;
  };
  const pickProduct = (p: FertProduct, editId: string | null, carry: ItemMoney | null) => {
    const spec = fertSpec({ type: p.type ?? 'chemical', formula: p.formula, brand: p.brand, sackKg: p.sackKg }, sackUnit);
    if (p.type === null) {
      // A saved formula never bought has no type or size yet: the new-product sheet asks.
      setSheet({ k: 'new', editId, carry });
      return;
    }
    const base = carry ?? { ...EMPTY_MONEY, ...(p.lastPerSackSatang !== null ? { unitPrice: p.lastPerSackSatang } : {}) };
    openItem(editId, spec, takeTyped(base));
  };
  const editLine = (l: OrderLineDraft) => {
    const spec = specOfLine(l);
    const money = moneyOfLine(l);
    setSheet(l.fertilizer ? { k: 'item', editId: l.id, spec, money } : { k: 'other', editId: l.id, spec, money });
  };

  /** Saves a typed value for next time, unless a shown option already has that name. */
  const remember = async (kind: FertOptionKind, name: string) => {
    if (!name.trim()) return;
    const same = optionNamed(state.fertOptions, kind, name);
    if (same && !same.hidden) return;
    await setFertOption(fin, { kind, name, description: '', hidden: false });
  };
  const newProductDone = async (p: NewProduct, rememberIt: boolean, editId: string | null, carry: ItemMoney | null) => {
    if (rememberIt) {
      try {
        await remember('formula', p.formula);
        await remember('brand', p.brand);
        if (p.sackKg !== null) await remember('sackKg', String(p.sackKg));
      } catch (err) {
        console.error('Fertilizer choice could not be remembered.', err);
      }
    }
    openItem(editId, fertSpec(p, sackUnit), takeTyped(carry ?? EMPTY_MONEY));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const save = () =>
    run(async () => {
      if (!clean) return;
      setFailed(false);
      try {
        // A retry after a partial save meets ids already written: those items exist, do not create them twice.
        const have = new Set(fin.state?.expenses.map((x) => x.id));
        for (const { id, fields } of buildOrderExpenses(draft)) if (!have.has(id)) await fin.write(id, null, { t: 'expense_created', fields });
        setSaved({ orderId, shop: shop.trim(), date, stage, lineCount: totals.lineCount, sacks: totals.sacks, netSatang: totals.netSatang });
      } catch (err) {
        console.error('Order could not be stored.', err);
        setFailed(true);
      }
    });

  if (saved) {
    return (
      <SavedView
        saved={saved}
        sync={sync}
        onDetails={() => router.replace(orderHref(saved.orderId))}
        onLater={leave}
      />
    );
  }

  // ── View ─────────────────────────────────────────────────────────────────
  const dateText = (() => {
    const shown = formatDate(date, era);
    return date === todayIso() ? msg('ordc.today', { date: shown.replace(/ \d{4}$/, '') }) : shown;
  })();
  const payerTitle = payer ? (payer.id === FARM_FUNDS ? msg('ordc.payerFarm') : msg('ordc.payerName', { name: payer.name })) : msg('ordc.payerNone');
  const fieldCard = (testID: string, icon: React.ReactNode, label: string, value: string, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={[cardStyle(t), { flex: 1, minHeight: t.target.comfortable, padding: t.space.md, flexDirection: 'row', alignItems: 'center', gap: t.space.sm }]}
    >
      <View aria-hidden>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodySm">{label}</AppText>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{value}</AppText>
      </View>
    </Pressable>
  );
  const addRow = (testID: string, label: string, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{ minHeight: t.target.comfortable, flexDirection: 'row', gap: t.space.sm, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.lg, borderWidth: t.border.thick, borderStyle: 'dashed', borderColor: t.color.ruleStrong, padding: t.space.md }}
    >
      <Plus color={t.color.ink} />
      <AppText style={{ fontWeight: t.font.weight.bold }}>{label}</AppText>
    </Pressable>
  );
  const stageSeg = (value: 'committed' | 'actual', title: string, hint?: string) => {
    const on = stage === value;
    return (
      <Pressable
        key={value}
        testID={`ordc-stage-${value}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        aria-checked={on}
        onPress={() => setStage(value)}
        style={{ flex: 1, minHeight: t.target.comfortable, borderRadius: t.radius.pill, backgroundColor: on ? t.color.action : 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space.md, paddingVertical: t.space.xs }}
      >
        <Text style={{ textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: on ? t.color.inkInverse : t.color.inkSoft }}>{title}</Text>
        {hint ? <Text style={{ textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: on ? t.color.inkInverse : t.color.inkSoft }}>{hint}</Text> : null}
      </Pressable>
    );
  };

  const body = (
    <>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        {fieldCard('ordc-shop', <BasketIcon color={t.color.inkSoft} />, msg('ordc.shop'), shop.trim() || msg('ordc.shopNone'), () => setSheet('shop'))}
        {fieldCard('ordc-date', <CalendarIcon color={t.color.inkSoft} />, msg('ordc.date'), dateText, () => setSheet('date'))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: t.space.sm }}>
        <AppText variant="heading">{msg('ordc.items')}</AppText>
        <AppText testID="ordc-count" variant="bodySm">{lines.length ? msg('ordc.itemCount', { n: lines.length }) : msg('ordc.itemNone')}</AppText>
      </View>

      {lines.length === 0 ? (
        <View testID="ordc-empty" style={[cardStyle(t), { padding: t.space.xl, alignItems: 'center', gap: t.space.sm }]}>
          <AppText variant="heading" style={{ textAlign: 'center' }}>{msg('ordc.emptyTitle')}</AppText>
          <AppText variant="bodySm" style={{ textAlign: 'center' }}>{msg('ordc.emptyBody')}</AppText>
        </View>
      ) : (
        lines.map((l) => {
          const net = l.grossSatang - l.itemDiscountSatang;
          const per = l.qty > 0 ? Math.round(l.grossSatang / l.qty) : 0;
          const bad = (problems.lines[l.id] ?? []).length > 0;
          return (
            <Pressable
              key={l.id}
              testID={`ordc-row-${l.id}`}
              accessibilityRole="button"
              accessibilityLabel={msg('ordc.editItem', { name: l.item })}
              onPress={() => editLine(l)}
              style={[cardStyle(t), { flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable }, bad ? { borderColor: t.color.reject, borderWidth: t.border.thick } : null]}
            >
              <ItemIcon spec={specOfLine(l)} />
              <View style={{ flex: 1, minWidth: 0, gap: t.space.xxs }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{l.item}</AppText>
                <AppText variant="bodySm">{msg('ordc.itemLine', { qty: l.qty, unit: l.unit, price: formatSatang(per) })}</AppText>
                {l.itemDiscountSatang > 0 ? <AppText variant="bodySm" style={{ color: t.color.accept, fontWeight: t.font.weight.bold }}>{msg('ordc.itemDiscount', { amount: formatSatang(l.itemDiscountSatang) })}</AppText> : null}
                {bad ? <AppText variant="bodySm" style={{ color: t.color.reject }}>{msg('ordc.err.line')}</AppText> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: t.space.xs }}>
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>{formatSatang(net)}</Text>
                <ChevronRight color={t.color.inkFaint} />
              </View>
            </Pressable>
          );
        })
      )}

      {addRow('ordc-add', lines.length ? msg('ordc.addMore') : msg('ordc.addFert'), () => setSheet({ k: 'pick', editId: null, carry: null }))}

      {lines.length ? (
        <View style={[cardStyle(t), { padding: t.space.sm, gap: t.space.xs }]}>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.pill, padding: t.space.xs, gap: t.space.xs }}>
            {stageSeg('committed', msg('ordc.stage.committed'), msg('ordc.stage.committedHint'))}
            {stageSeg('actual', msg('ordc.stage.actual'))}
          </View>
          <Pressable
            testID="ordc-payer"
            accessibilityRole="button"
            onPress={() => setSheet('payer')}
            style={{ minHeight: t.target.comfortable, flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.sm }}
          >
            <WalletIcon color={t.color.ink} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText testID="ordc-payer-title" style={{ fontWeight: t.font.weight.bold }}>{payerTitle}</AppText>
              <AppText variant="bodySm">{msg('ordc.payerHint')}</AppText>
            </View>
            <ChevronRight color={t.color.inkFaint} />
          </Pressable>
        </View>
      ) : null}
      {problems.order.includes('bill-discount-over') ? <FieldError testID="ordc-err-bill">{msg('ordc.err.billOver')}</FieldError> : null}
      {failed ? <FieldError testID="ordc-err-save">{msg('ordc.saveFailed')}</FieldError> : null}
    </>
  );

  const footer = (
    <View style={{ gap: t.space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: t.space.sm }}>
        <AppText variant="bodySm">{msg('ordc.total')}</AppText>
        <Text testID="ordc-total" accessibilityLabel={`${msg('ordc.total')} ${formatSatang(totals.netSatang)} ${msg('ordc.baht')}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
          {formatSatang(totals.netSatang)} <Text style={{ fontSize: t.font.size.bodyLg, color: t.color.inkSoft }}>{msg('ordc.baht')}</Text>
        </Text>
      </View>
      {lines.length ? (
        billDiscount > 0 ? (
          <Pressable testID="ordc-bill-shown" accessibilityRole="button" onPress={() => setSheet('bill')} style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.sm, alignSelf: 'flex-start' }}>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.accept }}>{msg('ordc.billShown', { amount: formatSatang(billDiscount) })}</Text>
            <ChevronRight color={t.color.accept} />
          </Pressable>
        ) : (
          <TextLink testID="ordc-bill-link" onPress={() => setSheet('bill')}>{msg('ordc.billLink')}</TextLink>
        )
      ) : null}
      <CTA testID="ordc-save" disabled={!clean || busy} onPress={() => void save()}>
        {msg('common.save')}
      </CTA>
    </View>
  );

  const close = () => setSheet(null);
  const overlay = (
    <>
      {sheet === 'shop' ? (
        <ShopSheet
          shop={shop}
          orderedBy={orderedBy}
          recentShops={recentShops}
          recentPeople={recentPeople}
          onChange={(p) => {
            if (p.shop !== undefined) setShop(p.shop);
            if (p.orderedBy !== undefined) setOrderedBy(p.orderedBy);
          }}
          onClose={close}
        />
      ) : null}
      {sheet === 'date' ? <DatePickerSheet open onClose={close} value={date} onChange={setDate} title={msg('ordc.dateTitle')} max={todayIso()} testID="ordc-date-sheet" /> : null}
      {sheet === 'payer' ? (
        <PayerSheet
          payer={payer}
          choices={payerChoices}
          lastPayerId={lastPayer.id}
          netSatang={totals.netSatang}
          onPick={(p) => setPayer(p)}
          onClose={close}
        />
      ) : null}
      {sheet === 'bill' ? <BillDiscountSheet value={billDiscount} maxSatang={nets} onChange={setBillDiscount} onClose={close} /> : null}
      {sheet && typeof sheet === 'object' && sheet.k === 'pick' ? (
        <PickProductSheet
          products={products}
          onPick={(p) => pickProduct(p, sheet.editId, sheet.carry)}
          onNew={() => setSheet({ k: 'new', editId: sheet.editId, carry: sheet.carry })}
          onOther={() => setSheet({ k: 'other', editId: sheet.editId, spec: null, money: takeTyped(sheet.carry ?? EMPTY_MONEY) })}
          onClose={close}
        />
      ) : null}
      {sheet && typeof sheet === 'object' && sheet.k === 'new' ? (
        <NewProductSheet
          options={state.fertOptions}
          initial={{ type: 'chemical', formula: '', brand: '', sackKg: 50 }}
          onClose={close}
          onDone={(p, r) => void newProductDone(p, r, sheet.editId, sheet.carry)}
        />
      ) : null}
      {sheet && typeof sheet === 'object' && sheet.k === 'item' ? (
        <ItemSheet
          key={sheet.spec.item}
          spec={sheet.spec}
          initial={sheet.money}
          editing={sheet.editId !== null}
          onDone={(m) => putLine(sheet.editId, sheet.spec, m)}
          onRemove={() => sheet.editId && removeLine(sheet.editId)}
          onChangeProduct={(m) => setSheet({ k: 'pick', editId: sheet.editId, carry: m })}
          onClose={close}
        />
      ) : null}
      {sheet && typeof sheet === 'object' && sheet.k === 'other' ? (
        <OtherItemSheet
          initialSpec={sheet.spec}
          initial={sheet.money}
          editing={sheet.editId !== null}
          onDone={(spec, m) => putLine(sheet.editId, spec, m)}
          onRemove={() => sheet.editId && removeLine(sheet.editId)}
          onClose={close}
        />
      ) : null}
    </>
  );

  return (
    <FarmScreen testID="ordc-scroll" title={msg('ordc.title')} fallback="/v2/expenses" onBack={leave} footer={footer} overlay={overlay}>
      {body}
    </FarmScreen>
  );
}
