/**
 * ซื้อปุ๋ย — the simple design approved 2026-10-23 (E11-S10 C): one
 * question per screen, each fitting one phone, defaults filled so most
 * people only press ถัดไป.
 *
 *   1 ซื้อปุ๋ยอะไร → 2 กี่กระสอบ ราคาเท่าไหร่ → 3 ใส่ทำไม →
 *   4 ใครจ่ายเงินไปก่อน → 5 แบ่งให้ใคร → 6 ตรวจ แล้วกดบันทึก
 *
 * Optional things sit in sheets: ปุ๋ยใหม่, สาเหตุใหม่, เพิ่มรายละเอียด
 * (date, stage, shop, who ordered, receipt), a tapper's %, and zones (a row
 * on the summary, "บันทึกภายหลังได้").
 *
 * - The expense form (category ปุ๋ย) and เพิ่มหนี้ (kind ปุ๋ย) both open it,
 *   so one purchase is recorded one way (owner 2026-10-18).
 * - The steps share one draft; going back never loses what was typed.
 * - Saving writes ONE expense: the net bill as `amountSatang`, the split by
 *   sacks as `share`, and what/why/where as `fertilizer`. Tapper debts and
 *   money owed back are projections of it (`shareDebts`, FIN-4) — never a
 *   `debt_added`, which would make a second owner-share expense.
 * - The tapper picked last is given the sacks the others left
 *   (`lastLineSacks`) until their sacks are changed; leftover sacks are the
 *   farm's cost and go to stock later (E10-S04).
 * - Editing (`id`) opens on the summary; tapping a line goes to its step.
 *   Saving writes only the fields that changed, naming the head, with the
 *   share and the net amount always together.
 * - Receipt photos are not attached in this slice (no media upload yet).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { checkFertilizer, reasonLabel, TYPED_REASON } from '../../core/finance/fertilizer';
import { fertProducts, reasonsByUse } from '../../core/finance/fert-products';
import { checkExpense, defaultPayer, type Expense } from '../../core/finance/ledger';
import { formatDate, formatSatang, isIsoDate, parseBahtToSatang, satangToInput, todayIso } from '../../core/finance/money';
import { checkShare, lastLineSacks, splitShare } from '../../core/finance/share';
import { FARM_FUNDS, type ExpenseFields, type ExpensePatch, type ExpenseShare, type FertilizerDetails, type FertOptionKind, type Payer, type ShareSettle, type Stage } from '../../core/finance/types';
import { activeZones, filterPeople } from '../../core/master';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { peopleStore } from '../../store/people';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, Button, Card, Check, ChevronRight, CTA, PinnedActions, Plus, RadioCard, ScreenHeader, SearchIcon, SegmentedControl, TapperIcon, TextField } from '../../ui';
import { useMaster } from '../farm/pieces';
import { optionNamed, setFertOption } from './fert-options';
import { BigStepper, DetailsSheet, NewProductSheet, PctSheet, ReasonSheet, TapperSheet, ZonesSheet, type ProductDraft, type ZoneDraft } from './fertilizer-sheets';
import { ChoiceChip, ChoiceRow, PayerPicker, SwitchRow, TickCard } from './pieces';

const FERTILIZER = 'cat-fertilizer';
const STEPS = ['what', 'qty', 'why', 'pay', 'share', 'sum'] as const;
type Step = (typeof STEPS)[number];
const STAGES: readonly Stage[] = ['actual', 'committed', 'planned'];
const WHOLE = /^\d+$/;
const QUESTION: Record<Step, 'fert.q.what' | 'fert.q.qty' | 'fert.q.why' | 'fert.q.pay' | 'fert.q.share' | 'fert.q.sum'> = {
  what: 'fert.q.what',
  qty: 'fert.q.qty',
  why: 'fert.q.why',
  pay: 'fert.q.pay',
  share: 'fert.q.share',
  sum: 'fert.q.sum',
};

interface LineDraft {
  readonly worker: Payer;
  readonly sacks: string;
  readonly pct: string;
  readonly settle: ShareSettle;
  /** Picked last and not changed yet: given whatever the others left. */
  readonly auto: boolean;
}

/** From the expense form: bill, date, stage, payer (`payerId` 'none' = not recorded). From เพิ่มหนี้: workerId + name. Edit: id. */
type Params = { bill?: string; date?: string; stage?: string; payerId?: string; payerName?: string; id?: string; workerId?: string; name?: string };

type Sheet = 'new' | 'reason' | 'details' | 'tapper' | 'zones' | { pct: number } | null;

const EMPTY_PRODUCT: ProductDraft = { type: 'chemical', formula: '', brand: '', sackKg: '' };

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function FertilizerFlowScreen() {
  const params = useLocalSearchParams<Params>();
  const fin = useFinance();
  const msg = useT();
  const t = useTheme();
  const sync = useSyncStatus();
  const existing = params.id ? (fin.state?.expenses.find((x) => x.id === params.id) ?? null) : null;
  const ready = fin.state !== null && fin.deviceId !== null && (!params.id || existing !== null);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface }}>
        <ScreenHeader title={msg('fert.title')} back={{ label: msg('v2.back'), onPress: leave, testID: 'fert-back' }} sync={sync} />
        <AppText variant="bodySm" style={{ padding: t.space.lg }}>{msg('counter.loading')}</AppText>
      </View>
    );
  }
  return <Flow key={existing?.id ?? 'new'} params={params} existing={existing} fin={fin} />;
}

function Flow({ params, existing, fin }: { params: Params; existing: Expense | null; fin: ReturnType<typeof useFinance> }) {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const inFlight = useInFlight();
  const master = useMaster();
  const state = fin.state!;
  const farmPayer: Payer = { id: FARM_FUNDS, name: msg('fin.payer.farm') };
  const catPct = state.categories.find((c) => c.id === FERTILIZER)?.workerPct ?? 50;
  const f = existing?.fertilizer;
  const sh = existing?.share;

  // "เหมือนครั้งก่อน": the payer of this device's last expense (D-62); first time = farm funds.
  const last = useMemo(() => defaultPayer(fin.events ?? [], fin.deviceId ?? ''), [fin.deviceId]); // eslint-disable-line react-hooks/exhaustive-deps -- taken once
  const hadLast = last !== null;
  const lastPayer = last ?? farmPayer;
  const initialPayer = useMemo<Payer | null>(
    () =>
      existing
        ? existing.payer
        : params.payerId
          ? params.payerId === 'none' ? null : params.payerId === FARM_FUNDS ? farmPayer : { id: params.payerId, name: params.payerName ?? '' }
          : lastPayer,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the default is taken once, when the flow opens
    [],
  );

  const [step, setStep] = useState<Step>(existing ? 'sum' : 'what');
  const [reached, setReached] = useState(existing ? STEPS.length - 1 : 0);
  const [tried, setTried] = useState<ReadonlySet<Step>>(new Set());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [newInitial, setNewInitial] = useState<ProductDraft>(EMPTY_PRODUCT);
  // 1 — what
  const [product, setProduct] = useState<ProductDraft>({ type: f?.type ?? 'chemical', formula: f?.formula ?? '', brand: f?.brand ?? '', sackKg: f?.sackKg != null ? String(f.sackKg) : '' });
  // 2 — how many, what price
  const [sacks, setSacks] = useState(sh?.totalSacks != null ? String(sh.totalSacks) : '1');
  const [bill, setBill] = useState(sh ? satangToInput(sh.billSatang) : (params.bill ?? ''));
  const [discountOn, setDiscountOn] = useState(!!sh?.discountSatang);
  const [discount, setDiscount] = useState(sh?.discountSatang ? satangToInput(sh.discountSatang) : '');
  // 3 — why
  const [reasons, setReasons] = useState<readonly string[]>(f?.reasons ?? []);
  // 4 — who paid (+ details)
  const [payer, setPayer] = useState<Payer | null>(initialPayer);
  const [morePayers, setMorePayers] = useState(false);
  const [date, setDate] = useState(existing?.date ?? params.date ?? todayIso());
  const [stage, setStage] = useState<Stage>(existing?.stage ?? (STAGES.find((x) => x === params.stage) ?? 'actual'));
  const [shop, setShop] = useState(f?.shop ?? '');
  const [orderedBy, setOrderedBy] = useState(f?.orderedBy ?? '');
  // 5 — tappers
  const [lines, setLines] = useState<readonly LineDraft[]>(() => {
    if (sh) return sh.lines.map((l) => ({ worker: l.worker, sacks: String(l.sacks ?? 0), pct: String(l.workerPct), settle: l.settle, auto: false }));
    if (params.workerId) return [{ worker: { id: params.workerId, name: params.name ?? '' }, sacks: '', pct: String(catPct), settle: 'debt', auto: true }];
    return [];
  });
  // zones (summary row)
  const [farmId, setFarmId] = useState<string | null>(existing?.propertyId ?? null);
  const [zones, setZones] = useState<Record<string, ZoneDraft>>(() =>
    Object.fromEntries((f?.zones ?? []).map((z) => [z.zoneId, { farmId: existing?.propertyId ?? '', name: z.zoneName, sacks: String(z.sacks), reasons: z.reasons, note: z.note }])),
  );
  const [failed, setFailed] = useState(false);
  const [saveTried, setSaveTried] = useState(false);
  const [people, setPeople] = useState<readonly Payer[]>([]);
  useEffect(() => {
    peopleStore.list().then((ps) => setPeople(ps.map((p) => ({ id: p.id, name: p.name }))), () => setPeople([]));
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalSacks = WHOLE.test(sacks.trim()) ? Number(sacks.trim()) : NaN;
  const sacksOk = Number.isSafeInteger(totalSacks) && totalSacks >= 1;
  const billSatang = parseBahtToSatang(bill);
  const discountSatang = discountOn && discount.trim() ? (parseBahtToSatang(discount) ?? -1) : 0;
  const net = Math.max(0, (billSatang ?? 0) - Math.max(0, discountSatang));
  const perSack = sacksOk ? Math.floor((2 * net + totalSacks) / (2 * totalSacks)) : 0;

  const typedSacks = (l: LineDraft) => (WHOLE.test(l.sacks.trim()) ? Number(l.sacks.trim()) : NaN);
  const lineSacks = (i: number): number => {
    const l = lines[i];
    if (!l.auto) return typedSacks(l);
    const others = lines.filter((o, j) => j !== i && !o.auto).map((o) => typedSacks(o) || 0);
    return lastLineSacks(sacksOk ? totalSacks : 0, others);
  };
  const share: ExpenseShare = {
    billSatang: billSatang ?? 0,
    discountSatang,
    totalSacks: sacksOk ? totalSacks : 0,
    lines: lines.map((l, i) => ({ worker: l.worker, sacks: lineSacks(i), workerPct: WHOLE.test(l.pct.trim()) ? Number(l.pct.trim()) : NaN, settle: l.settle })),
  };
  const shareProblems = checkShare(share);
  const split = shareProblems.length ? null : splitShare(share);
  const given = share.lines.reduce((s, l) => s + (Number.isFinite(l.sacks) ? (l.sacks ?? 0) : 0), 0);

  const farms = master.state ? master.state.properties.filter((p) => !p.deleted) : [];
  // One farm: it is the farm, nothing to pick.
  const zoneFarm = farmId ?? (farms.length === 1 ? farms[0].id : null);
  const zoneUses = Object.entries(zones)
    .filter(([, z]) => z.farmId === zoneFarm && (z.sacks.trim() !== '' || z.reasons.length > 0 || z.note.trim() !== ''))
    .map(([zoneId, z]) => ({ zoneId, zoneName: z.name, sacks: z.sacks.trim() === '' ? 0 : WHOLE.test(z.sacks.trim()) ? Number(z.sacks.trim()) : NaN, reasons: z.reasons.filter((r) => reasons.includes(r)), note: z.note.trim() }));
  const zoneTotal = zoneUses.reduce((s, z) => s + (Number.isFinite(z.sacks) ? z.sacks : 0), 0);
  const details: FertilizerDetails = {
    type: product.type,
    formula: product.formula.trim(),
    brand: product.brand.trim(),
    sackKg: product.sackKg.trim() ? Number(product.sackKg.trim()) : null,
    reasons,
    zones: zoneUses,
    shop: shop.trim(),
    orderedBy: orderedBy.trim(),
  };
  const fertProblems = checkFertilizer(details, sacksOk ? totalSacks : 0);

  const problemsOf = (s: Step): string[] => {
    switch (s) {
      case 'what':
        return [...(fertProblems.includes('formula-required') ? ['formula'] : []), ...(fertProblems.includes('sack-kg-invalid') ? ['sackKg'] : [])];
      case 'qty':
        return [...(sacksOk ? [] : ['sacks']), ...(billSatang && billSatang > 0 ? [] : ['bill']), ...(shareProblems.includes('discount-over') ? ['discount'] : [])];
      case 'pay':
        return [...(isIsoDate(date) ? [] : ['date']), ...checkExpense({ amountSatang: net, date, stage })];
      case 'share':
        return shareProblems.filter((p) => p !== 'discount-over');
      case 'sum':
        return fertProblems.filter((p) => p === 'zones-over' || p === 'zone-sacks-not-whole');
      default:
        return [];
    }
  };
  const shown = (s: Step) => tried.has(s) || saveTried;
  const err = (s: Step, key: string) => shown(s) && problemsOf(s).includes(key);
  const idx = STEPS.indexOf(step);

  const goTo = (s: Step) => {
    setStep(s);
    setSearch(null);
    setReached((r) => Math.max(r, STEPS.indexOf(s)));
  };
  const next = () => {
    setTried((x) => new Set(x).add(step));
    if (problemsOf(step).length) return;
    goTo(STEPS[idx + 1]);
  };
  const prev = () => (idx === 0 ? leave() : goTo(STEPS[idx - 1]));

  // ── Writes ───────────────────────────────────────────────────────────────
  const save = async () => {
    setSaveTried(true);
    if (STEPS.some((s) => problemsOf(s).length)) return;
    setFailed(false);
    const fields: ExpenseFields = {
      amountSatang: net,
      date,
      stage,
      categoryId: FERTILIZER,
      propertyId: farmId ?? (zoneUses.length ? zoneFarm : null),
      item: details.formula,
      note: existing?.note ?? '',
      payer,
      share,
      fertilizer: details,
    };
    try {
      if (!existing) {
        await fin.write(newId('exp-'), null, { t: 'expense_created', fields });
      } else {
        const patch: Record<string, unknown> = {};
        for (const k of Object.keys(fields) as (keyof ExpenseFields)[]) {
          if (JSON.stringify(fields[k]) !== JSON.stringify(existing[k])) patch[k] = fields[k];
        }
        // The share and the net amount travel together, so a concurrent edit conflicts on both or neither.
        if ('share' in patch || 'amountSatang' in patch) {
          patch.share = fields.share;
          patch.amountSatang = fields.amountSatang;
        }
        if (Object.keys(patch).length) await fin.write(existing.id, existing.headEventId, { t: 'expense_changed', patch: patch as ExpensePatch });
      }
      leave();
    } catch (err) {
      console.error('Fertilizer purchase could not be stored.', err);
      setFailed(true);
    }
  };

  /** Saves a typed value for next time, unless a shown option already has that name. */
  const remember = async (kind: FertOptionKind, name: string, description = ''): Promise<string> => {
    const same = optionNamed(state.fertOptions, kind, name);
    if (same && !same.hidden && !description) return same.id;
    return setFertOption(fin, { kind, name, description, hidden: false });
  };

  // ── Lines ────────────────────────────────────────────────────────────────
  const setLine = (i: number, p: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const pick = (worker: Payer) =>
    // The one picked last gets the rest; whoever had that before keeps the number they were shown.
    setLines((ls) => [...ls.map((l, i) => (l.auto ? { ...l, sacks: String(lineSacks(i)), auto: false } : l)), { worker, sacks: '', pct: String(catPct), settle: 'debt', auto: true }]);
  const bump = (i: number, by: number) => setLine(i, { sacks: String(Math.max(0, (lineSacks(i) || 0) + by)), auto: false });

  const tappers = master.state ? filterPeople(master.state.people, 'tapper').map((p) => ({ id: p.id, name: p.name })) : [];
  const farmZones = master.state && zoneFarm ? activeZones(master.state, zoneFarm) : [];
  const reasonName = (r: string) => reasonLabel(r, state.fertOptions);
  const productName = (p: { formula: string; brand: string }) => (p.brand ? msg('fert.prodName', { formula: p.formula, brand: p.brand }) : p.formula);
  const stageWord = msg(`fert.stage.${stage}`);

  // ── Steps ────────────────────────────────────────────────────────────────
  const products = fertProducts(state.expenses, state.fertOptions);
  const openNew = (initial: ProductDraft) => {
    setNewInitial(initial);
    setSheet('new');
  };
  const sameProduct = (p: { type: string | null; formula: string; brand: string; sackKg: number | null }) =>
    p.type === product.type && norm(p.formula) === norm(product.formula) && norm(p.brand) === norm(product.brand) && String(p.sackKg ?? '') === product.sackKg.trim();
  const pickedListed = products.some(sameProduct);

  const what = (
    <View style={{ gap: t.space.sm }}>
      {product.formula && !pickedListed ? (
        <RadioCard testID="fert-picked" selected title={productName(product)} detail={productDetail(product.type, product.sackKg)} onPress={() => openNew(product)} />
      ) : null}
      {products
        .filter((p) => pickedListed || !product.formula || p.lastPerSackSatang !== null || norm(p.formula) !== norm(product.formula))
        .slice(0, 5)
        .map((p) => (
          <RadioCard
            key={p.key}
            testID={`fert-prod-${p.key}`}
            selected={sameProduct(p)}
            title={productName(p)}
            detail={p.type === null ? msg('fert.prodSavedOnly') : p.lastPerSackSatang !== null ? msg('fert.prodLast', { detail: productDetail(p.type, p.sackKg === null ? '' : String(p.sackKg)), price: formatSatang(p.lastPerSackSatang) }) : productDetail(p.type, p.sackKg === null ? '' : String(p.sackKg))}
            onPress={() =>
              // A saved formula never bought has no type or size yet: the sheet asks for them.
              p.type === null ? openNew({ ...EMPTY_PRODUCT, formula: p.formula }) : setProduct({ type: p.type, formula: p.formula, brand: p.brand, sackKg: p.sackKg === null ? '' : String(p.sackKg) })
            }
          />
        ))}
      <Row testID="fert-new" dashed icon={<Plus color={t.color.action} />} title={msg('fert.newProduct')} detail={msg('fert.newProductHint')} onPress={() => openNew(EMPTY_PRODUCT)} />
      {err('what', 'formula') ? <AppText testID="fert-err" style={{ color: t.color.reject }}>{msg('fert.err.pick')}</AppText> : null}
    </View>
  );

  function productDetail(type: ProductDraft['type'], kg: string) {
    return kg ? msg('fert.prodDetail', { type: msg(`fert.type.${type}`), kg }) : msg(`fert.type.${type}`);
  }

  const qty = (
    <View style={{ gap: t.space.md }}>
      <AppText testID="fert-product-line" variant="bodySm">{productName(details)}</AppText>
      <View style={{ alignItems: 'center' }}>
        <BigStepper
          testID="fert-sacks"
          bumpID="fert-sacks"
          value={sacks}
          onChange={setSacks}
          onBump={(by) => setSacks(String(Math.max(1, (sacksOk ? totalSacks : 0) + by)))}
          caption={details.sackKg && sacksOk ? msg('fert.sacksKg', { kg: String(details.sackKg * totalSacks) }) : msg('fert.sacksUnit')}
        />
        {err('qty', 'sacks') ? <AppText style={{ color: t.color.reject }}>{msg('fert.err.sacks')}</AppText> : null}
      </View>
      <TextField
        testID="fert-bill"
        label={msg('fert.bill')}
        hint={params.bill && !existing ? msg('fert.billPrefilled') : undefined}
        keyboardType="decimal-pad"
        value={bill}
        onChangeText={setBill}
        placeholder="0.00"
        aside={<AppText variant="bodySm">{msg('v2m.baht')}</AppText>}
        error={err('qty', 'bill') ? msg('fert.err.bill') : undefined}
      />
      <SwitchRow
        testID="fert-discount-switch"
        title={msg('fert.discountTitle')}
        hint={msg('fert.discountHint')}
        on={discountOn}
        onToggle={() => {
          if (discountOn) setDiscount('');
          setDiscountOn(!discountOn);
        }}
      />
      {discountOn ? (
        <TextField testID="fert-discount" label={msg('xshare.discount')} keyboardType="decimal-pad" value={discount} onChangeText={setDiscount} placeholder="0.00" aside={<AppText variant="bodySm">{msg('v2m.baht')}</AppText>} error={shareProblems.includes('discount-over') ? msg('xshare.err.discount') : undefined} />
      ) : null}
      <Card testID="fert-net" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.color.acceptSunk }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.accept }}>{msg('fert.netTitle')}</AppText>
          <AppText variant="caption">{msg('fert.perSack', { amount: formatSatang(perSack) })}</AppText>
        </View>
        <Big satang={net} />
      </Card>
    </View>
  );

  const q = (search ?? '').trim().toLowerCase();
  const reasonRows = [
    ...reasonsByUse(state.fertOptions, state.expenses).map((o) => ({ id: o.id, name: o.name, detail: o.description })),
    ...state.fertOptions.filter((o) => o.kind === 'reason' && o.hidden && reasons.includes(o.id)).map((o) => ({ id: o.id, name: o.name, detail: o.description })),
    ...reasons.filter((r) => r.startsWith(TYPED_REASON)).map((r) => ({ id: r, name: r.slice(TYPED_REASON.length), detail: msg('fert.onceOnly') })),
  ].filter((o) => !q || o.name.toLowerCase().includes(q) || o.detail.toLowerCase().includes(q));
  const toggleReason = (id: string) => setReasons((rs) => (rs.includes(id) ? rs.filter((r) => r !== id) : [...rs, id]));

  const why = (
    <View style={{ gap: t.space.sm }}>
      {search !== null ? <TextField testID="fert-reason-search" label={msg('fert.searchLabel')} value={search} onChangeText={setSearch} autoFocus /> : null}
      {reasonRows.map((o) => <TickCard key={o.id} testID={`fert-reason-${o.id}`} title={o.name} detail={o.detail || undefined} on={reasons.includes(o.id)} onPress={() => toggleReason(o.id)} />)}
      <Row testID="fert-reason-new" dashed icon={<Plus color={t.color.action} />} title={msg('fert.typeNewReason')} detail={msg('fert.typeNewReasonHint')} onPress={() => setSheet('reason')} />
      <ChoiceRow>
        <ChoiceChip testID="fert-settings" label={msg('fert.manage')} onPress={() => router.push('/v2/fertilizer-settings')} />
      </ChoiceRow>
    </View>
  );

  // Farm funds, whoever paid before (newest first), and the current choice; the rest behind "+ คนอื่น".
  const payers = useMemo(() => {
    const out: Payer[] = [farmPayer];
    const add = (p: Payer | null) => {
      if (p && !out.some((o) => o.id === p.id)) out.push(p);
    };
    add(initialPayer);
    for (const x of [...state.expenses].sort((a, b) => (a.date < b.date ? 1 : -1))) if (out.length < 4) add(x.payer);
    // Known people next, as direct choices (prop-07), up to four rows in all.
    for (const p of people) if (out.length < 4) add(p);
    return out;
  }, [state.expenses, people]); // eslint-disable-line react-hooks/exhaustive-deps -- farmPayer/initialPayer are fixed for the flow
  const shownPayers = payer && !payers.some((p) => p.id === payer.id) ? [...payers, payer] : payers;

  const pay = (
    <View style={{ gap: t.space.sm }}>
      {shownPayers.map((p) => (
        <RadioCard
          key={p.id}
          testID={`fert-payer-${p.id}`}
          selected={payer?.id === p.id}
          title={p.name}
          detail={p.id === FARM_FUNDS ? undefined : msg(stage === 'actual' ? 'fert.owedBack' : 'fert.owedBackLater', { amount: formatSatang(net) })}
          onPress={() => setPayer(p)}
        >
          {hadLast && p.id === lastPayer.id && !existing ? <AppText variant="caption">{msg('fert.sameAsLast')}</AppText> : null}
        </RadioCard>
      ))}
      {morePayers ? (
        <PayerPicker
          testID="fert-payer-more"
          value={payer}
          onChange={(p) => {
            setPayer(p);
            setMorePayers(false);
          }}
          extra={people}
          allowNone
        />
      ) : (
        <Row testID="fert-payer-other" dashed icon={<Plus color={t.color.action} />} title={msg('fert.otherPerson')} onPress={() => setMorePayers(true)} />
      )}
      <Row
        testID="fert-details"
        icon={<Plus color={t.color.inkSoft} />}
        title={msg('fert.details')}
        detail={shop.trim() ? msg('fert.detailsSummaryShop', { date: formatDate(date), stage: stageWord, shop: shop.trim() }) : msg('fert.detailsSummary', { date: formatDate(date), stage: stageWord })}
        onPress={() => setSheet('details')}
        chevron
      />
      {err('pay', 'date') ? <AppText testID="fert-err" style={{ color: t.color.reject }}>{msg('fin.form.err.date-required')}</AppText> : null}
    </View>
  );

  const left = Math.max(0, (sacksOk ? totalSacks : 0) - given);
  const over = shareProblems.includes('sacks-over');
  const shareStep = (
    <View style={{ gap: t.space.sm }}>
      <Card testID="fert-split-head" style={{ backgroundColor: over ? t.color.rejectSunk : !lines.length ? t.color.surfaceSunk : left > 0 ? t.color.warnSunk : t.color.acceptSunk, gap: 2 }}>
        <AppText style={{ fontWeight: t.font.weight.bold, color: over ? t.color.reject : left > 0 && lines.length ? t.color.warn : t.color.ink }}>
          {over ? msg('fert.err.sacksOver', { total: totalSacks }) : !lines.length ? msg('fert.splitNone') : left > 0 ? msg('fert.splitLeft', { n: left }) : msg('fert.splitFull', { n: given, total: totalSacks })}
        </AppText>
        <AppText variant="caption">
          {lines.length && left > 0 && split ? msg('fert.splitLeftCost', { amount: formatSatang(split.leftoverSatang) }) : msg('fert.netPerSack', { net: formatSatang(net), perSack: formatSatang(perSack) })}
        </AppText>
      </Card>
      {lines.map((l, i) => {
        const s = split?.lines[i];
        return (
          <Card key={l.worker.id} testID={`fert-line-${l.worker.id}`} style={{ gap: t.space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <TapperIcon color={t.color.ink} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm }}>
                  <AppText numberOfLines={1} style={{ fontWeight: t.font.weight.bold, flexShrink: 1 }}>{l.worker.name}</AppText>
                  <Pressable testID={`fert-line-${l.worker.id}-remove`} accessibilityRole="button" accessibilityLabel={msg('fert.removeNamed', { name: l.worker.name })} hitSlop={12} onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                    <AppText variant="caption" style={{ textDecorationLine: 'underline' }}>{msg('fert.removeTapper')}</AppText>
                  </Pressable>
                </View>
                {l.auto ? <AppText testID={`fert-line-${l.worker.id}-auto`} variant="caption" numberOfLines={1}>{msg('fert.autoFilled')}</AppText> : null}
              </View>
              <BigStepper testID={`fert-line-${l.worker.id}-sacks`} bumpID={`fert-line-${l.worker.id}`} size="small" value={l.auto ? String(lineSacks(i)) : l.sacks} caption={msg('fert.sacksUnit')} onChange={(v) => setLine(i, { sacks: v, auto: false })} onBump={(by) => bump(i, by)} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <AppText testID={`fert-line-${l.worker.id}-cost`} variant="bodySm" style={{ flex: 1 }}>{msg('fert.tapperCost', { cost: s ? formatSatang(s.costSatang) : '-' })}</AppText>
              <ChoiceChip testID={`fert-line-${l.worker.id}-pct`} label={msg('fert.pctValue', { pct: l.pct || '-' })} onPress={() => setSheet({ pct: i })} />
              <Text testID={`fert-line-${l.worker.id}-part`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>{s ? formatSatang(s.workerSatang) : '-'}</Text>
            </View>
            <SegmentedControl testID={`fert-line-${l.worker.id}-settle`} value={l.settle} onChange={(v) => setLine(i, { settle: v })} options={[{ value: 'debt', label: msg('xshare.settle.debt') }, { value: 'paid', label: msg('xshare.settle.paid') }]} />
            {stage !== 'actual' && l.settle === 'debt' ? <AppText testID={`fert-line-${l.worker.id}-hint`} variant="caption">{msg('fert.debtLater', { name: l.worker.name })}</AppText> : null}
          </Card>
        );
      })}
      {shown('share') && shareProblems.includes('pct-invalid') ? <AppText testID="fert-err" style={{ color: t.color.reject }}>{msg('xshare.err.pct')}</AppText> : null}
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button testID="fert-add-tapper" onPress={() => setSheet('tapper')}>{msg('fert.addTapper')}</Button>
        </View>
        {lines.length ? (
          <View style={{ flex: 1 }}>
            <Button testID="fert-no-share" onPress={() => setLines([])}>{msg('fert.noShare')}</Button>
          </View>
        ) : null}
      </View>
    </View>
  );

  const owner = split ? (lines.length ? split.ownerTotalSatang - split.leftoverSatang : net) : 0;
  const sum = (
    <View style={{ gap: t.space.md }}>
      <Card style={{ gap: t.space.xs }}>
        <Pressable testID="fert-sum-head" accessibilityRole="button" accessibilityHint={msg('fert.stepGo', { n: 1 })} onPress={() => goTo('what')}>
          <AppText variant="heading">{msg('fert.sumHead', { type: msg(`fert.type.${details.type}`), product: productName(details) })}</AppText>
        </Pressable>
        <Pressable testID="fert-sum-payer" accessibilityRole="button" accessibilityHint={msg('fert.stepGo', { n: 4 })} onPress={() => goTo('pay')}>
          <AppText variant="bodySm">{payer ? msg('fert.sumSub', { date: formatDate(date), stage: stageWord, payer: payer.name }) : msg('fert.sumSubNone', { date: formatDate(date), stage: stageWord })}</AppText>
        </Pressable>
        <Rule />
        <Pressable testID="fert-sum-bill" accessibilityRole="button" accessibilityHint={msg('fert.stepGo', { n: 2 })} onPress={() => goTo('qty')} style={{ gap: t.space.xs }}>
          <Line label={msg('fert.sumBill', { n: sacksOk ? totalSacks : 0 })} value={formatSatang(billSatang ?? 0)} />
          {discountSatang > 0 ? <Line label={msg('fert.discountLine')} value={msg('fert.minus', { amount: formatSatang(discountSatang) })} /> : null}
          <View testID="fert-sum-net" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{msg('fert.netTitle')}</AppText>
            <Big satang={net} />
          </View>
        </Pressable>
        <Rule />
        {split?.lines.map((s, i) => (
          <Pressable key={s.worker.id} testID={`fert-sum-line-${s.worker.id}`} accessibilityRole="button" accessibilityHint={msg('fert.stepGo', { n: 5 })} onPress={() => goTo('share')} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <AppText variant="bodySm">{msg('fert.sumLine', { name: s.worker.name, n: s.sacks ?? 0 })}</AppText>
            <Badge tone={s.settle === 'paid' ? 'ok' : 'debt'}>{s.settle === 'paid' ? msg('xshare.settle.paid') : stage === 'actual' ? msg('xshare.settle.debt') : msg('fert.debtLaterShort')}</Badge>
            <AppText variant="bodySm" style={{ flex: 1, textAlign: 'right', fontWeight: t.font.weight.bold }}>{formatSatang(share.lines[i] ? s.workerSatang : 0)}</AppText>
          </Pressable>
        ))}
        <Pressable onPress={() => goTo('share')} accessibilityRole="button" accessibilityHint={msg('fert.stepGo', { n: 5 })} style={{ gap: t.space.xs }}>
          <Line testID="fert-sum-owner" label={msg('fert.farmPart')} value={formatSatang(owner)} />
          {split && lines.length && split.leftoverSacks > 0 ? <Line testID="fert-sum-leftover" label={msg('fert.leftoverLine', { n: split.leftoverSacks })} value={formatSatang(split.leftoverSatang)} /> : null}
        </Pressable>
        {split && split.ownerTotalSatang + split.workerTotalSatang === net ? (
          <AppText testID="fert-sum-total" variant="bodySm" style={{ textAlign: 'right', color: t.color.accept, fontWeight: t.font.weight.bold }}>{msg('fert.totalMatch', { amount: formatSatang(net) })}</AppText>
        ) : null}
      </Card>
      <Card style={{ gap: t.space.sm }}>
        <Row testID="fert-sum-reasons" title={reasons.length ? msg('fert.sumReasons', { n: reasons.length }) : msg('fert.sumReasonsNone')} detail={reasons.map(reasonName).join(' · ') || undefined} onPress={() => goTo('why')} chevron flat />
        <Row
          testID="fert-sum-zones"
          title={msg('fert.sumZones')}
          detail={zoneUses.length ? zoneUses.map((z) => msg('fert.zoneShort', { name: z.zoneName, n: z.sacks })).join(' · ') : msg('fert.sumZonesNone')}
          onPress={() => setSheet('zones')}
          aside={zoneUses.length ? undefined : <ChoiceChip dashed label={msg('fert.put')} onPress={() => setSheet('zones')} />}
          chevron={zoneUses.length > 0}
          flat
        />
      </Card>
      <AppText variant="caption" style={{ textAlign: 'center' }}>{msg('fert.tapToEdit')}</AppText>
      {saveTried && STEPS.some((s) => problemsOf(s).length) ? (
        STEPS.findIndex((s) => problemsOf(s).length) === STEPS.length - 1 ? (
          // Only the zones are wrong: say so and open them.
          <Pressable testID="fert-err" accessibilityRole="button" onPress={() => setSheet('zones')}>
            <AppText style={{ color: t.color.reject, textDecorationLine: 'underline' }}>{msg('fert.err.fixZones')}</AppText>
          </Pressable>
        ) : (
          <AppText testID="fert-err" style={{ color: t.color.reject }}>{msg('fert.err.fix', { n: STEPS.findIndex((s) => problemsOf(s).length) + 1 })}</AppText>
        )
      ) : null}
      {failed ? <AppText testID="fert-save-failed" style={{ color: t.color.reject }}>{msg('fin.form.saveFailed')}</AppText> : null}
    </View>
  );

  const body: Record<Step, ReactNode> = { what, qty, why, pay, share: shareStep, sum };
  const hint: Partial<Record<Step, string>> = { what: msg('fert.h.what'), why: msg('fert.h.why'), pay: msg('fert.h.pay') };
  const pctLine = sheet && typeof sheet === 'object' ? lines[sheet.pct] : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        title={msg(existing ? 'fert.titleEdit' : 'fert.title')}
        back={{ label: msg('v2.back'), onPress: existing ? leave : prev, testID: 'fert-back' }}
        sync={sync}
        right={
          step === 'why' ? (
            <Pressable testID="fert-search-open" accessibilityRole="button" accessibilityLabel={msg('fert.searchOpen')} onPress={() => setSearch((s) => (s === null ? '' : null))} style={{ minWidth: t.target.min, minHeight: t.target.min, alignItems: 'center', justifyContent: 'center' }}>
              <SearchIcon color={t.color.appBarInk} size={20} />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.lg }}>
        <Progress idx={idx} reached={reached} onPick={(i) => goTo(STEPS[i])} />
        <View style={{ gap: 2 }}>
          <AppText testID="fert-question" variant="title">{msg(QUESTION[step])}</AppText>
          {hint[step] ? <AppText variant="bodySm">{hint[step]}</AppText> : null}
        </View>
        {body[step]}
      </ScrollView>
      <PinnedActions>
        {idx > 0 ? <Button testID="fert-prev" size="large" onPress={prev}>{msg('fert.prev')}</Button> : null}
        {step === 'sum' ? (
          <CTA testID="fert-save" icon={(c) => <Check color={c} />} disabled={inFlight.busy} onPress={() => void inFlight.run(save)}>{msg('fin.form.save')}</CTA>
        ) : (
          <CTA testID="fert-next" onPress={next}>{msg(step === 'share' ? 'fert.nextSum' : 'fert.nextPlain')}</CTA>
        )}
      </PinnedActions>

      {sheet === 'new' ? (
        <NewProductSheet
          options={state.fertOptions}
          initial={newInitial}
          onClose={() => setSheet(null)}
          onDone={async (v, keep) => {
            setProduct(v);
            setSheet(null);
            if (!keep) return;
            await remember('formula', v.formula);
            if (v.brand) await remember('brand', v.brand);
            if (v.sackKg) await remember('sackKg', v.sackKg);
          }}
        />
      ) : null}
      {sheet === 'reason' ? (
        <ReasonSheet
          initialName={search ?? ''}
          onClose={() => setSheet(null)}
          onAdd={async (name, description, keep) => {
            const id = keep ? await setFertOption(fin, { kind: 'reason', name, description, hidden: false }) : TYPED_REASON + name;
            setReasons((rs) => (rs.includes(id) ? rs : [...rs, id]));
            setSearch(null);
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === 'details' ? (
        <DetailsSheet
          date={date}
          stage={stage}
          shop={shop}
          orderedBy={orderedBy}
          shops={[...new Set(state.expenses.map((x) => x.fertilizer?.shop ?? '').filter(Boolean))]}
          people={people.map((p) => p.name)}
          onChange={(p) => {
            if (p.date !== undefined) setDate(p.date);
            if (p.stage) setStage(p.stage);
            if (p.shop !== undefined) setShop(p.shop);
            if (p.orderedBy !== undefined) setOrderedBy(p.orderedBy);
          }}
          onClose={() => setSheet(null)}
          dateError={isIsoDate(date) ? undefined : msg('fin.form.err.date-required')}
        />
      ) : null}
      {pctLine && typeof sheet === 'object' && sheet ? (
        <PctSheet
          name={pctLine.worker.name}
          pct={pctLine.pct}
          catPct={catPct}
          onClose={() => setSheet(null)}
          onDone={(v) => {
            setLine(sheet.pct, { pct: v });
            setSheet(null);
          }}
          onRemove={() => {
            setLines((ls) => ls.filter((_, j) => j !== sheet.pct));
            setSheet(null);
          }}
          onSettings={() => router.push('/v2/fertilizer-settings')}
        />
      ) : null}
      {sheet === 'tapper' ? (
        <TapperSheet
          tappers={tappers.filter((p) => !lines.some((l) => l.worker.id === p.id))}
          onClose={() => setSheet(null)}
          onPick={(p) => {
            pick(p);
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === 'zones' ? (
        <ZonesSheet
          farms={farms}
          farmId={zoneFarm}
          onFarm={setFarmId}
          zones={farmZones}
          drafts={zones}
          onDraft={(id, z) => setZones((all) => ({ ...all, [id]: z }))}
          reasons={reasons}
          reasonName={reasonName}
          total={sacksOk ? totalSacks : 0}
          given={zoneTotal}
          error={problemsOf('sum').length ? msg(problemsOf('sum').includes('zones-over') ? 'fert.err.zonesOver' : 'fert.err.zoneSacks', { total: totalSacks }) : null}
          onZoneSaved={master.reload}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

/** A thin bar of six, "n จาก 6"; a reached segment can be tapped to go back there. */
function Progress({ idx, reached, onPick }: { idx: number; reached: number; onPick: (i: number) => void }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: t.space.xs }}>
        {STEPS.map((s, i) => (
          <Pressable
            key={s}
            testID={`fert-step-${i + 1}`}
            accessibilityRole="button"
            accessibilityLabel={msg('fert.stepGo', { n: i + 1 })}
            accessibilityState={{ selected: i === idx, disabled: i > reached }}
            disabled={i > reached}
            onPress={() => onPick(i)}
            hitSlop={{ top: 21, bottom: 21 }}
            style={{ flex: 1, height: 6, borderRadius: t.radius.pill, backgroundColor: i === idx ? t.color.action : i < idx || i <= reached ? t.color.accept : t.color.surfaceSunk }}
          />
        ))}
      </View>
      <AppText testID="fert-progress" variant="bodySm">{msg('fert.of', { n: idx + 1 })}</AppText>
    </View>
  );
}

/** A tappable row: icon, title, one line; dashed for "+ new". `flat` drops the frame inside a card. */
function Row({ testID, title, detail, onPress, icon, dashed, chevron, aside, flat }: { testID: string; title: string; detail?: string; onPress: () => void; icon?: ReactNode; dashed?: boolean; chevron?: boolean; aside?: ReactNode; flat?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        minHeight: t.target.comfortable,
        paddingHorizontal: flat ? 0 : t.space.md,
        paddingVertical: t.space.sm,
        borderRadius: t.radius.lg,
        borderWidth: flat ? 0 : t.border.hair,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: t.color.ruleStrong,
        backgroundColor: flat ? 'transparent' : dashed ? t.color.surface : t.color.surfaceRaised,
      }}
    >
      {icon ?? null}
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{title}</AppText>
        {detail ? <AppText variant="caption" numberOfLines={1}>{detail}</AppText> : null}
      </View>
      {aside ?? null}
      {chevron ? <ChevronRight color={t.color.inkFaint} /> : null}
    </Pressable>
  );
}

function Line({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'baseline' }}>
      <AppText variant="bodySm" style={{ flex: 1 }}>{label}</AppText>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>{value}</Text>
    </View>
  );
}

function Big({ satang }: { satang: number }) {
  const t = useTheme();
  return <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayXl, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>{formatSatang(satang)}</Text>;
}

function Rule() {
  const t = useTheme();
  return <View style={{ borderTopWidth: t.border.hair, borderStyle: 'dashed', borderColor: t.color.ruleStrong, marginVertical: t.space.xs }} />;
}

/** A word on a tinted pill — ลงหนี้ / จ่ายแล้ว (the word carries it, not the tint). */
function Badge({ children, tone }: { children: string; tone: 'ok' | 'debt' }) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: t.space.sm, borderRadius: t.radius.pill, backgroundColor: tone === 'ok' ? t.color.acceptSunk : t.color.warnSunk }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: tone === 'ok' ? t.color.accept : t.color.warn }}>{children}</Text>
    </View>
  );
}

/** Back to where the user came from. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/v2/expenses');
}
