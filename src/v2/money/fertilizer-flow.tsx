/**
 * ซื้อปุ๋ย — mockup 7b screens 21e–21p (E11-S10 C). One screen, six steps:
 * ซื้ออะไร → ทำไม → ใครจ่าย · เมื่อไร → โซน (optional) → คนกรีด → สรุป. The
 * expense form (category ปุ๋ย) and เพิ่มหนี้ (kind ปุ๋ย) both open it, so
 * one purchase is recorded one way (owner 2026-10-18).
 *
 * - The steps share one draft; going back never loses what was typed.
 * - Saving writes ONE expense: the net bill as `amountSatang`, the split
 *   by sacks as `share`, and what/why/where as `fertilizer`. Tapper debts
 *   and money owed back are projections of it (`shareDebts`, FIN-4) — never
 *   a `debt_added`, which would make a second owner-share expense.
 * - The tapper picked last is given the sacks the others left
 *   (`lastLineSacks`) until their sacks are typed; leftover sacks are the
 *   farm's cost and go to stock later (E10-S04).
 * - Editing (`id`) writes only the fields that changed, naming the head.
 * - Receipt photos are not attached in this slice (no media upload yet).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { checkFertilizer, reasonLabel, TYPED_REASON } from '../../core/finance/fertilizer';
import { checkExpense, defaultPayer, fertOptionId, type Expense, type FertOption } from '../../core/finance/ledger';
import { formatDate, formatSatang, isIsoDate, parseBahtToSatang, satangToInput, todayIso } from '../../core/finance/money';
import { checkShare, lastLineSacks, splitShare } from '../../core/finance/share';
import {
  FARM_FUNDS,
  type ExpenseFields,
  type ExpensePatch,
  type ExpenseShare,
  type FertilizerDetails,
  type FertilizerType,
  type FertOptionKind,
  type Payer,
  type ShareSettle,
  type Stage,
} from '../../core/finance/types';
import { activeZones, filterPeople } from '../../core/master';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { peopleStore } from '../../store/people';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Button, Card, Check, CTA, Minus, PinnedActions, Plus, ScreenHeader, SegmentedControl, TextField, type HeaderPrimaryAction } from '../../ui';
import { useMaster } from '../farm/pieces';
import { setFertOption } from './fert-options';
import { ChoiceChip, ChoiceRow, NotRecordedPill, PayerPicker, SectionLabel } from './pieces';

const FERTILIZER = 'cat-fertilizer';
const STEPS = ['buy', 'why', 'pay', 'zone', 'tapper', 'sum'] as const;
type Step = (typeof STEPS)[number];
const TYPES: readonly FertilizerType[] = ['chemical', 'manure', 'other'];
const STAGES: readonly Stage[] = ['actual', 'committed', 'planned'];
const WHOLE = /^\d+$/;

interface LineDraft {
  readonly worker: Payer;
  readonly sacks: string;
  readonly pct: string;
  readonly settle: ShareSettle;
  /** Picked last and not typed yet: given whatever the others left. */
  readonly auto: boolean;
}

interface ZoneDraft {
  readonly farmId: string;
  readonly name: string;
  readonly sacks: string;
  readonly reasons: readonly string[];
  readonly note: string;
}

type Params = { bill?: string; date?: string; id?: string; workerId?: string; name?: string };

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

  const initialPayer = useMemo<Payer | null>(
    () => (existing ? existing.payer : (defaultPayer(fin.events ?? [], fin.deviceId ?? '') ?? farmPayer)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the default is taken once, when the flow opens
    [],
  );

  const [step, setStep] = useState<Step>('buy');
  const [reached, setReached] = useState(existing ? STEPS.length - 1 : 0);
  const [tried, setTried] = useState<ReadonlySet<Step>>(new Set());
  // 1 — what
  const [type, setType] = useState<FertilizerType>(f?.type ?? 'chemical');
  const [formula, setFormula] = useState(f?.formula ?? '');
  const [brand, setBrand] = useState(f?.brand ?? '');
  const [sackKg, setSackKg] = useState(f?.sackKg != null ? String(f.sackKg) : '');
  const [productOpen, setProductOpen] = useState(false);
  const [sacks, setSacks] = useState(sh?.totalSacks != null ? String(sh.totalSacks) : '1');
  const [bill, setBill] = useState(sh ? satangToInput(sh.billSatang) : (params.bill ?? ''));
  const [discountOn, setDiscountOn] = useState(!!sh?.discountSatang);
  const [discount, setDiscount] = useState(sh?.discountSatang ? satangToInput(sh.discountSatang) : '');
  // 2 — why
  const [reasons, setReasons] = useState<readonly string[]>(f?.reasons ?? []);
  // 3 — who paid, when
  const [date, setDate] = useState(existing?.date ?? params.date ?? todayIso());
  const [stage, setStage] = useState<Stage>(existing?.stage ?? 'actual');
  const [payer, setPayer] = useState<Payer | null>(initialPayer);
  const [shop, setShop] = useState(f?.shop ?? '');
  const [orderedBy, setOrderedBy] = useState(f?.orderedBy ?? '');
  // 4 — zones
  const [farmId, setFarmId] = useState<string | null>(existing?.propertyId ?? null);
  const [zones, setZones] = useState<Record<string, ZoneDraft>>(() =>
    Object.fromEntries((f?.zones ?? []).map((z) => [z.zoneId, { farmId: existing?.propertyId ?? '', name: z.zoneName, sacks: String(z.sacks), reasons: z.reasons, note: z.note }])),
  );
  // 5 — tappers
  const [lines, setLines] = useState<readonly LineDraft[]>(() => {
    if (sh) return sh.lines.map((l) => ({ worker: l.worker, sacks: String(l.sacks ?? 0), pct: String(l.workerPct), settle: l.settle, auto: false }));
    if (params.workerId) return [{ worker: { id: params.workerId, name: params.name ?? '' }, sacks: '', pct: String(catPct), settle: 'debt', auto: true }];
    return [];
  });
  const [detail, setDetail] = useState<'zones' | 'reasons' | 'shop' | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveTried, setSaveTried] = useState(false);

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

  const zoneUses = Object.entries(zones)
    .filter(([, z]) => z.farmId === farmId && (z.sacks.trim() !== '' || z.reasons.length > 0 || z.note.trim() !== ''))
    .map(([zoneId, z]) => ({ zoneId, zoneName: z.name, sacks: z.sacks.trim() === '' ? 0 : WHOLE.test(z.sacks.trim()) ? Number(z.sacks.trim()) : NaN, reasons: z.reasons.filter((r) => reasons.includes(r)), note: z.note.trim() }));
  const zoneTotal = zoneUses.reduce((s, z) => s + (Number.isFinite(z.sacks) ? z.sacks : 0), 0);
  const details: FertilizerDetails = {
    type,
    formula: formula.trim(),
    brand: brand.trim(),
    sackKg: sackKg.trim() ? Number(sackKg.trim()) : null,
    reasons,
    zones: zoneUses,
    shop: shop.trim(),
    orderedBy: orderedBy.trim(),
  };
  const fertProblems = checkFertilizer(details, sacksOk ? totalSacks : 0);

  const problemsOf = (s: Step): string[] => {
    switch (s) {
      case 'buy':
        return [
          ...(fertProblems.includes('formula-required') ? ['formula'] : []),
          ...(fertProblems.includes('sack-kg-invalid') ? ['sackKg'] : []),
          ...(sacksOk ? [] : ['sacks']),
          ...(billSatang && billSatang > 0 ? [] : ['bill']),
          ...(shareProblems.includes('discount-over') ? ['discount'] : []),
        ];
      case 'pay':
        return [...(isIsoDate(date) ? [] : ['date']), ...checkExpense({ amountSatang: net, date, stage })];
      case 'zone':
        return fertProblems.filter((p) => p === 'zones-over' || p === 'zone-sacks-not-whole');
      case 'tapper':
        return shareProblems.filter((p) => p !== 'discount-over');
      default:
        return [];
    }
  };
  const shown = (s: Step) => tried.has(s) || saveTried;
  const idx = STEPS.indexOf(step);

  const goTo = (s: Step) => {
    setStep(s);
    setReached((r) => Math.max(r, STEPS.indexOf(s)));
  };
  const next = () => {
    setTried((x) => new Set(x).add(step));
    if (problemsOf(step).length) return;
    goTo(STEPS[idx + 1]);
  };
  const back = () => (idx === 0 ? leave() : setStep(STEPS[idx - 1]));

  // ── Writes ───────────────────────────────────────────────────────────────
  const save = async () => {
    setSaveTried(true);
    const bad = STEPS.find((s) => problemsOf(s).length);
    if (bad) return;
    setFailed(false);
    const fields: ExpenseFields = {
      amountSatang: net,
      date,
      stage,
      categoryId: FERTILIZER,
      propertyId: farmId,
      item: existing?.item ?? details.formula,
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
        if (Object.keys(patch).length) await fin.write(existing.id, existing.headEventId, { t: 'expense_changed', patch: patch as ExpensePatch });
      }
      leave();
    } catch (err) {
      console.error('Fertilizer purchase could not be stored.', err);
      setFailed(true);
    }
  };

  const remember = (kind: FertOptionKind, name: string, description = '') => setFertOption(fin, { kind, name, description, hidden: false });

  // ── Lines ────────────────────────────────────────────────────────────────
  const setLine = (i: number, p: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const pick = (worker: Payer) =>
    // The one picked last gets the rest; whoever had that before keeps the number they were shown.
    setLines((ls) => [...ls.map((l, i) => (l.auto ? { ...l, sacks: String(lineSacks(i)), auto: false } : l)), { worker, sacks: '', pct: String(catPct), settle: 'debt', auto: true }]);
  const bump = (i: number, by: number) => setLine(i, { sacks: String(Math.max(0, (lineSacks(i) || 0) + by)), auto: false });

  const tappers = master.state ? filterPeople(master.state.people, 'tapper').map((p) => ({ id: p.id, name: p.name })) : [];
  const farms = master.state ? master.state.properties.filter((p) => !p.deleted) : [];
  const farmZones = master.state && farmId ? activeZones(master.state, farmId) : [];
  const stepLabel = (s: Step) => msg(`fert.step.${s}`);
  const stepName = (s: Step) => msg(`fert.stepName.${s}`);
  const reasonName = (r: string) => reasonLabel(r, state.fertOptions);
  const err = (s: Step, key: string) => shown(s) && problemsOf(s).includes(key);

  const action: HeaderPrimaryAction | undefined =
    step === 'sum' ? { label: msg('fin.form.save'), testID: 'fert-save', saving: inFlight.busy, onPress: () => void inFlight.run(save) } : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        title={msg(existing ? 'fert.titleEdit' : 'fert.title')}
        subtitle={msg('fert.subtitle', { n: idx + 1, name: stepName(step) })}
        back={{ label: msg('v2.back'), onPress: back, testID: 'fert-back' }}
        sync={sync}
        action={action}
      />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg, paddingBottom: t.space[16] * 2 }}>
        <StepBar step={step} reached={reached} label={stepLabel} onPick={goTo} />

        {step === 'buy' ? (
          <>
            <View style={{ gap: t.space.sm }}>
              <SectionLabel required>{msg('fert.type')}</SectionLabel>
              <ChoiceRow>
                {TYPES.map((k) => <ChoiceChip key={k} testID={`fert-type-${k}`} label={msg(`fert.type.${k}`)} on={type === k} onPress={() => setType(k)} />)}
              </ChoiceRow>
            </View>

            <Pressable testID="fert-product" accessibilityRole="button" onPress={() => setProductOpen(true)}>
              <Card style={{ gap: t.space.xs, borderColor: err('buy', 'formula') ? t.color.reject : undefined }}>
                <SectionLabel required>{msg('fert.product')}</SectionLabel>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{details.formula ? [details.formula, details.brand].filter(Boolean).join(' · ') : msg('fert.productEmpty')}</AppText>
                <AppText variant="bodySm">
                  {details.sackKg && details.sackKg > 0 ? msg('fert.productSize', { kg: sackKg.trim(), total: sacksOk ? String(details.sackKg * totalSacks) : '-' }) : msg('fert.sizeUnknown')}
                </AppText>
                {err('buy', 'formula') ? <AppText testID="fert-formula-err" style={{ color: t.color.reject }}>{msg('fert.err.formula')}</AppText> : null}
              </Card>
            </Pressable>
            {productOpen ? (
              <ProductSheet
                onClose={() => setProductOpen(false)}
                options={state.fertOptions}
                value={{ formula, brand, sackKg }}
                onDone={async (v, keep) => {
                  setFormula(v.formula);
                  setBrand(v.brand);
                  setSackKg(v.sackKg);
                  setProductOpen(false);
                  for (const k of keep) await remember(k, v[k]);
                }}
              />
            ) : null}

            <View style={{ gap: t.space.sm }}>
              <SectionLabel required hint={msg('fert.sacksHint')}>{msg('fert.sacks')}</SectionLabel>
              <Stepper testID="fert-sacks" bumpID="fert-sacks" label={msg('fert.sacks')} value={sacks} onChange={setSacks} onBump={(by) => setSacks(String(Math.max(1, (sacksOk ? totalSacks : 0) + by)))} unit={msg('fert.sacksUnit')} error={err('buy', 'sacks') ? msg('fert.err.sacks') : undefined} />
            </View>

            <TextField testID="fert-bill" label={msg('fert.bill')} required keyboardType="decimal-pad" value={bill} onChangeText={setBill} placeholder="0.00" helper={msg('v2m.baht')} error={err('buy', 'bill') ? msg('fert.err.bill') : undefined} />

            <Card style={{ gap: t.space.sm }}>
              <ChoiceRow>
                <ChoiceChip
                  testID="fert-discount-switch"
                  label={msg(discountOn ? 'xshare.discountOn' : 'xshare.discountOff')}
                  on={discountOn}
                  onPress={() => {
                    if (discountOn) setDiscount('');
                    setDiscountOn(!discountOn);
                  }}
                />
              </ChoiceRow>
              {discountOn ? (
                <TextField testID="fert-discount" label={msg('xshare.discount')} keyboardType="decimal-pad" value={discount} onChangeText={setDiscount} placeholder="0.00" helper={msg('v2m.baht')} error={shareProblems.includes('discount-over') ? msg('xshare.err.discount') : undefined} />
              ) : null}
              <Line testID="fert-net" label={msg('fert.net', { perSack: formatSatang(perSack) })} value={formatSatang(net)} />
            </Card>
          </>
        ) : null}

        {step === 'why' ? (
          <Reasons
            options={state.fertOptions}
            chosen={reasons}
            onChange={setReasons}
            onRemember={(name, description) => remember('reason', name, description)}
            onSettings={() => router.push('/v2/fertilizer-settings')}
          />
        ) : null}

        {step === 'pay' ? (
          <>
            <TextField testID="fert-date" label={msg('fin.form.date')} required value={date} onChangeText={setDate} placeholder="2026-10-14" helper={msg('v2m.dateShown', { shown: formatDate(date) })} error={err('pay', 'date') ? msg('fin.form.err.date-required') : undefined} />
            <View style={{ gap: t.space.sm }}>
              <SectionLabel>{msg('fin.form.stage')}</SectionLabel>
              <SegmentedControl testID="fert-stage" value={stage} onChange={setStage} options={STAGES.map((s) => ({ value: s, label: msg(`fin.stage.${s}`) }))} />
              {stage !== 'actual' ? <AppText variant="caption" testID="fert-not-actual">{msg('fert.notActual')}</AppText> : null}
            </View>
            <View style={{ gap: t.space.sm }}>
              <SectionLabel hint={existing ? undefined : msg('fert.payerHint')}>{msg('fin.form.payer')}</SectionLabel>
              <PayerPicker testID="fert-payer" value={payer} onChange={setPayer} />
            </View>
            <Card style={{ gap: t.space.sm }}>
              <AppText variant="label">{msg('v2m.optional')}</AppText>
              <TextField testID="fert-shop" label={msg('fert.shop')} value={shop} onChangeText={setShop} />
              <TextField testID="fert-ordered" label={msg('fert.orderedBy')} value={orderedBy} onChangeText={setOrderedBy} />
              <View testID="fert-receipt" style={{ gap: t.space.xs }}>
                <AppText variant="label">{msg('fert.receipt')}</AppText>
                <NotRecordedPill />
                <AppText variant="caption">{msg('fert.receiptSoon')}</AppText>
              </View>
            </Card>
          </>
        ) : null}

        {step === 'zone' ? (
          <Zones
            farms={farms}
            farmId={farmId}
            onFarm={setFarmId}
            zones={farmZones}
            drafts={zones}
            onDraft={(id, z) => setZones((all) => ({ ...all, [id]: z }))}
            reasons={reasons}
            reasonName={reasonName}
            total={sacksOk ? totalSacks : 0}
            given={zoneTotal}
            error={problemsOf('zone').length ? msg(problemsOf('zone').includes('zones-over') ? 'fert.err.zonesOver' : 'fert.err.zoneSacks', { total: totalSacks }) : null}
            onZoneSaved={master.reload}
          />
        ) : null}

        {step === 'tapper' ? (
          <>
            <Card testID="fert-split-head" style={{ gap: t.space.xs }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fert.split', { given, total: sacksOk ? totalSacks : 0, left: Math.max(0, (sacksOk ? totalSacks : 0) - given) })}</AppText>
              <AppText variant="bodySm">{msg('fert.netPerSack', { net: formatSatang(net), perSack: formatSatang(perSack) })}</AppText>
              {split && split.leftoverSacks === 0 && lines.length ? <AppText variant="caption" style={{ color: t.color.accept }}>{msg('fert.full')}</AppText> : null}
            </Card>
            {lines.map((l, i) => {
              const s = split?.lines[i];
              return (
                <Card key={l.worker.id} testID={`fert-line-${l.worker.id}`} style={{ gap: t.space.sm }}>
                  <AppText style={{ fontWeight: t.font.weight.bold }}>{l.worker.name}</AppText>
                  <Stepper
                    testID={`fert-line-${l.worker.id}-sacks`}
                    bumpID={`fert-line-${l.worker.id}`}
                    label={msg('fert.sacks')}
                    value={l.auto ? String(lineSacks(i)) : l.sacks}
                    onChange={(v) => setLine(i, { sacks: v, auto: false })}
                    onBump={(by) => bump(i, by)}
                    unit={msg('fert.sacksUnit')}
                  />
                  {l.auto ? <AppText testID={`fert-line-${l.worker.id}-auto`} variant="caption">{msg('fert.autoFilled')}</AppText> : null}
                  <TextField testID={`fert-line-${l.worker.id}-pct`} label={msg('xshare.pct')} keyboardType="number-pad" value={l.pct} onChangeText={(v) => setLine(i, { pct: v })} error={!WHOLE.test(l.pct.trim()) || Number(l.pct) > 100 ? msg('xshare.err.pct') : undefined} />
                  {s ? <AppText testID={`fert-line-${l.worker.id}-cost`} variant="bodySm">{msg('fert.lineCost', { cost: formatSatang(s.costSatang), pct: l.pct, part: formatSatang(s.workerSatang) })}</AppText> : null}
                  <SegmentedControl testID={`fert-line-${l.worker.id}-settle`} value={l.settle} onChange={(v) => setLine(i, { settle: v })} options={[{ value: 'debt', label: msg('xshare.settle.debt') }, { value: 'paid', label: msg('xshare.settle.paid') }]} />
                  <AppText variant="caption">{msg(l.settle === 'debt' ? 'xshare.settle.debtHint' : 'xshare.settle.paidHint', { name: l.worker.name })}</AppText>
                  <ChoiceRow>
                    <ChoiceChip testID={`fert-line-${l.worker.id}-remove`} label={msg('fert.removeTapper')} onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
                  </ChoiceRow>
                </Card>
              );
            })}
            {tappers.length === 0 ? <AppText variant="bodySm">{msg('fert.noTappers')}</AppText> : null}
            {tappers.length ? <SectionLabel>{msg('fert.pickLabel')}</SectionLabel> : null}
            <ChoiceRow>
              {tappers.filter((p) => !lines.some((l) => l.worker.id === p.id)).map((p) => (
                <ChoiceChip key={p.id} dashed testID={`fert-pick-${p.id}`} label={msg('fert.pickTapper', { name: p.name })} onPress={() => pick(p)} />
              ))}
            </ChoiceRow>
            {split && split.leftoverSacks > 0 ? (
              <Card testID="fert-leftover" style={{ backgroundColor: t.color.warnSunk }}>
                <AppText>{msg('fert.leftover', { n: split.leftoverSacks, amount: formatSatang(split.leftoverSatang) })}</AppText>
              </Card>
            ) : null}
            {shown('tapper') && problemsOf('tapper').length ? (
              <AppText testID="fert-share-err" style={{ color: t.color.reject }}>{problemsOf('tapper').includes('sacks-over') ? msg('fert.err.sacksOver', { total: totalSacks }) : msg('xshare.err.pct')}</AppText>
            ) : null}
          </>
        ) : null}

        {step === 'sum' ? (
          <>
            <Card testID="fert-sum-head" style={{ gap: t.space.xs }}>
              <SumTitle onEdit={() => setStep('buy')} testID="fert-sum-edit-buy" label={msg('fert.edit')}>
                {msg('fert.headline', { type: msg(`fert.type.${type}`), formula: details.formula, sacks: sacksOk ? totalSacks : 0 })}
              </SumTitle>
              <AppText variant="title">{msg('fert.netBaht', { amount: formatSatang(net) })}</AppText>
              {discountSatang > 0 ? <AppText variant="bodySm">{msg('fert.billLine', { bill: formatSatang(billSatang ?? 0), discount: formatSatang(discountSatang) })}</AppText> : null}
              <AppText variant="bodySm">{msg('fert.payerLine', { name: payer?.name ?? msg('fin.form.payerLater') })}</AppText>
              <AppText variant="bodySm">{msg('fert.dateStage', { date: formatDate(date), stage: msg(`fin.stage.${stage}`) })}</AppText>
            </Card>

            {split ? (
              <Card testID="fert-sum-split" style={{ gap: t.space.sm }}>
                <SumTitle onEdit={() => setStep('tapper')} testID="fert-sum-edit-tapper" label={msg('fert.editStep', { n: 5 })}>
                  {msg('fert.splitTitle', { n: split.leftoverSacks })}
                </SumTitle>
                <Line label={msg('fert.ownerPart')} value={formatSatang(split.ownerTotalSatang)} />
                <Line label={msg('fert.tapperPart')} value={formatSatang(split.workerTotalSatang)} />
                {split.lines.map((s, i) => (
                  <View key={s.worker.id} testID={`fert-sum-line-${s.worker.id}`} style={{ gap: 2 }}>
                    <Line label={msg('fert.lineSummary', { name: s.worker.name, sacks: s.sacks ?? 0, pct: share.lines[i].workerPct })} value={formatSatang(s.workerSatang)} />
                    <AppText variant="caption">{s.settle === 'paid' ? msg('fert.paidDone') : msg('xshare.settle.debt')}</AppText>
                  </View>
                ))}
                {split.leftoverSacks > 0 ? <Line label={msg('fert.leftoverLine', { n: split.leftoverSacks })} value={formatSatang(split.leftoverSatang)} /> : null}
                <View testID="fert-sum-total" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm }}>
                  <AppText style={{ flex: 1 }}>{msg('fert.total')}</AppText>
                  <Amount satang={split.ownerTotalSatang + split.workerTotalSatang} />
                  {split.ownerTotalSatang + split.workerTotalSatang === net ? <AppText variant="caption" style={{ color: t.color.accept }}>{msg('fert.match')}</AppText> : null}
                </View>
              </Card>
            ) : null}

            <ChoiceRow>
              <ChoiceChip testID="fert-sum-zones" label={msg('fert.zonesN', { n: zoneUses.length })} onPress={() => setDetail('zones')} />
              <ChoiceChip testID="fert-sum-reasons" label={msg('fert.reasonsN', { n: reasons.length })} onPress={() => setDetail('reasons')} />
              <ChoiceChip testID="fert-sum-shop" label={msg('fert.shopRow')} onPress={() => setDetail('shop')} />
            </ChoiceRow>
            <ChoiceRow>
              {STEPS.slice(0, 5).map((s, i) => (
                <ChoiceChip key={s} testID={`fert-sum-step-${s}`} label={msg('fert.editStepNamed', { n: i + 1, name: stepLabel(s) })} onPress={() => setStep(s)} />
              ))}
            </ChoiceRow>
            {detail ? (
              <BottomSheet open onClose={() => setDetail(null)} testID="fert-detail-sheet" title={detail === 'zones' ? msg('fert.step.zone') : detail === 'reasons' ? msg('fert.step.why') : msg('fert.shopRow')}>
                <View style={{ gap: t.space.sm }}>
                  {detail === 'zones'
                    ? zoneUses.length
                      ? zoneUses.map((z) => (
                          <View key={z.zoneId} style={{ gap: 2 }}>
                            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fert.zoneLine', { name: z.zoneName, sacks: z.sacks })}</AppText>
                            {z.reasons.length ? <AppText variant="bodySm">{z.reasons.map(reasonName).join(', ')}</AppText> : null}
                            {z.note ? <AppText variant="caption">{z.note}</AppText> : null}
                          </View>
                        ))
                      : <AppText>{msg('fert.none')}</AppText>
                    : null}
                  {detail === 'reasons' ? (reasons.length ? reasons.map((r) => <AppText key={r}>{reasonName(r)}</AppText>) : <AppText>{msg('fert.none')}</AppText>) : null}
                  {detail === 'shop' ? (
                    <>
                      <Line label={msg('fert.shop')} value={details.shop || msg('fert.none')} />
                      <Line label={msg('fert.orderedBy')} value={details.orderedBy || msg('fert.none')} />
                      <Line label={msg('fert.receipt')} value={msg('fert.none')} />
                    </>
                  ) : null}
                </View>
              </BottomSheet>
            ) : null}
            {saveTried && STEPS.some((s) => problemsOf(s).length) ? (
              <AppText testID="fert-err" style={{ color: t.color.reject }}>{msg('fert.err.fix', { n: STEPS.findIndex((s) => problemsOf(s).length) + 1 })}</AppText>
            ) : null}
            {failed ? <AppText testID="fert-save-failed" style={{ color: t.color.reject }}>{msg('fin.form.saveFailed')}</AppText> : null}
          </>
        ) : null}
      </ScrollView>
      {step !== 'sum' ? (
        <PinnedActions>
          {step === 'zone' ? (
            <Button
              testID="fert-skip"
              onPress={() => {
                setZones((all) => Object.fromEntries(Object.entries(all).filter(([, z]) => z.farmId !== farmId)));
                goTo('tapper');
              }}
            >
              {msg('fert.skip')}
            </Button>
          ) : null}
          <CTA testID="fert-next" onPress={next}>{msg('fert.next', { name: stepLabel(STEPS[idx + 1]) })}</CTA>
        </PinnedActions>
      ) : null}
    </View>
  );
}

/** 1/6 … 6/6: done steps say ✓ and their word, the current one its number (never colour alone). */
function StepBar({ step, reached, label, onPick }: { step: Step; reached: number; label: (s: Step) => string; onPick: (s: Step) => void }) {
  const t = useTheme();
  const msg = useT();
  const cur = STEPS.indexOf(step);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }}>
      {STEPS.map((s, i) => {
        const on = i === cur;
        const done = !on && (i < cur || i < reached);
        const open = i <= reached;
        return (
          <Pressable
            key={s}
            testID={`fert-step-${s}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: !open }}
            disabled={!open}
            onPress={() => onPick(s)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              minHeight: t.target.min,
              paddingHorizontal: t.space.sm,
              borderRadius: t.radius.pill,
              backgroundColor: on ? t.color.action : done ? t.color.acceptSunk : t.color.surfaceSunk,
            }}
          >
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: on ? t.color.inkInverse : done ? t.color.accept : t.color.inkSoft }}>
              {on ? msg('fert.stepActive', { n: i + 1, label: label(s) }) : done ? msg('fert.stepDone', { label: label(s) }) : label(s)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A whole-number field with − / + beside it. */
function Stepper({ testID, bumpID, label, value, onChange, onBump, unit, error }: { testID: string; bumpID: string; label: string; value: string; onChange: (v: string) => void; onBump: (by: number) => void; unit: string; error?: string }) {
  const t = useTheme();
  const msg = useT();
  const round = { width: t.target.min, height: t.target.min, borderRadius: t.radius.pill, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, backgroundColor: t.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm }}>
      <Pressable testID={`${bumpID}-less`} accessibilityRole="button" accessibilityLabel={msg('fert.less')} onPress={() => onBump(-1)} style={round}>
        <Minus color={t.color.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <TextField testID={testID} label={label} keyboardType="number-pad" value={value} onChangeText={onChange} aside={<AppText variant="bodySm">{unit}</AppText>} error={error} />
      </View>
      <Pressable testID={`${bumpID}-more`} accessibilityRole="button" accessibilityLabel={msg('fert.more')} onPress={() => onBump(1)} style={round}>
        <Plus color={t.color.ink} />
      </Pressable>
    </View>
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

function Amount({ satang }: { satang: number }) {
  const t = useTheme();
  return <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>{formatSatang(satang)}</Text>;
}

function SumTitle({ children, onEdit, label, testID }: { children: ReactNode; onEdit: () => void; label: string; testID: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
      <AppText variant="heading" style={{ flex: 1 }}>{children}</AppText>
      <ChoiceChip testID={testID} label={label} onPress={onEdit} />
    </View>
  );
}

/** A tick row: "บันทึกไว้ใช้ซ้ำ" — off means this time only. */
function RememberTick({ on, onPress, testID }: { on: boolean; onPress: () => void; testID: string }) {
  const t = useTheme();
  const msg = useT();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: on ? t.color.accept : t.color.ruleStrong, backgroundColor: on ? t.color.acceptSunk : t.color.surfaceRaised }}
    >
      <Box on={on} />
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fert.remember')}</AppText>
        <AppText variant="caption">{msg('fert.rememberHint')}</AppText>
      </View>
    </Pressable>
  );
}

function Box({ on }: { on: boolean }) {
  const t = useTheme();
  return (
    <View style={{ width: 28, height: 28, borderRadius: t.radius.sm, borderWidth: t.border.thick, borderColor: on ? t.color.action : t.color.ruleStrong, backgroundColor: on ? t.color.action : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Check color={t.color.inkInverse} /> : null}
    </View>
  );
}

type Product = { formula: string; brand: string; sackKg: string };
const PRODUCT_KINDS = ['formula', 'brand', 'sackKg'] as const;

/** สินค้า (21f): each field picks a saved option or takes a new value, optionally saved for reuse. */
function ProductSheet({ onClose, options, value, onDone }: { onClose: () => void; options: readonly FertOption[]; value: Product; onDone: (v: Product, keep: readonly (typeof PRODUCT_KINDS)[number][]) => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [v, setV] = useState<Product>(value);
  const [keep, setKeep] = useState<ReadonlySet<string>>(new Set());
  const toggle = (k: string, on?: boolean) => setKeep((s) => {
    const n = new Set(s);
    if (on ?? !n.has(k)) n.add(k);
    else n.delete(k);
    return n;
  });

  const field = (k: (typeof PRODUCT_KINDS)[number]) => {
    const typed = v[k].trim();
    const saved = options.filter((o) => o.kind === k && !o.hidden);
    const known = !typed || saved.some((o) => o.id === fertOptionId(k, typed));
    const matches = saved.filter((o) => !typed || o.name.toLowerCase().includes(typed.toLowerCase())).slice(0, 8);
    return (
      <View key={k} style={{ gap: t.space.sm }}>
        <TextField
          testID={`fert-${k}`}
          label={msg(k === 'formula' ? 'fert.formula' : k === 'brand' ? 'fert.brand' : 'fert.sackKg')}
          required={k === 'formula'}
          hint={k === 'formula' ? msg('fert.formulaHint') : msg('v2m.optional')}
          keyboardType={k === 'sackKg' ? 'decimal-pad' : 'default'}
          value={v[k]}
          onChangeText={(x) => setV((p) => ({ ...p, [k]: x }))}
        />
        <ChoiceRow>
          {matches.map((o) => (
            <ChoiceChip key={o.id} testID={`fert-opt-${k}-${o.name}`} label={k === 'sackKg' ? msg('fert.kg', { kg: o.name }) : o.name} on={o.id === fertOptionId(k, typed)} onPress={() => setV((p) => ({ ...p, [k]: o.name }))} />
          ))}
          {!known ? <ChoiceChip testID={`fert-add-${k}`} dashed label={msg('fert.addTyped', { name: typed })} on={keep.has(k)} onPress={() => toggle(k, true)} /> : null}
        </ChoiceRow>
        {!known ? <RememberTick testID={`fert-remember-${k}`} on={keep.has(k)} onPress={() => toggle(k)} /> : null}
      </View>
    );
  };

  const kg = v.sackKg.trim();
  const ok = v.formula.trim() !== '' && (!kg || Number(kg) > 0);
  return (
    <BottomSheet
      open
      onClose={onClose}
      testID="fert-product-sheet"
      title={msg('fert.productTitle')}
      action={{
        label: msg('fert.useProduct'),
        testID: 'fert-product-done',
        disabled: !ok,
        onPress: () => {
          const out = { formula: v.formula.trim(), brand: v.brand.trim(), sackKg: kg };
          void onDone(out, PRODUCT_KINDS.filter((k) => keep.has(k) && out[k] && !options.some((o) => o.id === fertOptionId(k, out[k]) && !o.hidden)));
        },
      }}
    >
      <View style={{ gap: t.space.lg }}>{PRODUCT_KINDS.map(field)}</View>
    </BottomSheet>
  );
}

/** ทำไม (21g): a searchable list, several may be chosen; a new reason is used once or saved for reuse. */
function Reasons({
  options,
  chosen,
  onChange,
  onRemember,
  onSettings,
}: {
  options: readonly FertOption[];
  chosen: readonly string[];
  onChange: (r: readonly string[]) => void;
  onRemember: (name: string, description: string) => Promise<unknown>;
  onSettings: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [search, setSearch] = useState('');
  const [desc, setDesc] = useState('');
  const [keep, setKeep] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const q = search.trim();
  const saved = options.filter((o) => o.kind === 'reason' && (!o.hidden || chosen.includes(o.id)));
  const typedOnes = chosen.filter((r) => r.startsWith(TYPED_REASON)).map((r) => ({ id: r, name: r.slice(TYPED_REASON.length), description: '', typed: true }));
  const rows = [...saved.map((o) => ({ ...o, typed: false })), ...typedOnes].filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase()) || o.description.toLowerCase().includes(q.toLowerCase()));
  const exists = !q || saved.some((o) => o.id === fertOptionId('reason', q)) || chosen.includes(TYPED_REASON + q);

  const toggle = (id: string) => onChange(chosen.includes(id) ? chosen.filter((r) => r !== id) : [...chosen, id]);
  const add = async () => {
    if (keep) {
      await onRemember(q, desc);
      const id = fertOptionId('reason', q);
      if (!chosen.includes(id)) onChange([...chosen, id]);
    } else {
      onChange([...chosen, TYPED_REASON + q]);
    }
    setDesc('');
    setKeep(false);
  };

  return (
    <View style={{ gap: t.space.md }}>
      <TextField testID="fert-reason-search" label={msg('fert.search')} value={search} onChangeText={setSearch} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <AppText variant="bodySm" style={{ flex: 1 }}>{msg('fert.chosen', { n: chosen.length })}</AppText>
        <ChoiceChip testID="fert-settings" label={msg('fert.manage')} onPress={onSettings} />
      </View>

      {!exists ? (
        <Card testID="fert-reason-new" style={{ gap: t.space.sm, backgroundColor: t.color.actionSunk }}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fert.newReason', { name: q })}</AppText>
          <TextField testID="fert-reason-desc" label={msg('fert.reasonDesc')} hint={msg('v2m.optional')} multiline value={desc} onChangeText={setDesc} />
          <RememberTick testID="fert-remember-reason" on={keep} onPress={() => setKeep((k) => !k)} />
          <Button testID="fert-reason-add" variant="primary" onPress={() => void add()}>{msg('fert.addReason')}</Button>
        </Card>
      ) : null}

      <Card style={{ gap: t.space.sm }}>
        {rows.length === 0 ? <AppText variant="bodySm">{msg('fert.noReasons')}</AppText> : null}
        {rows.map((o) => {
          const on = chosen.includes(o.id);
          const expanded = open === o.id;
          return (
            <View key={o.id} style={{ flexDirection: 'row', gap: t.space.md, alignItems: 'flex-start', borderBottomWidth: t.border.hair, borderBottomColor: t.color.ruleFaint, paddingBottom: t.space.sm }}>
              <Pressable testID={`fert-reason-${o.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(o.id)} style={{ flex: 1, flexDirection: 'row', gap: t.space.md, alignItems: 'flex-start', minHeight: t.target.min }}>
                <Box on={on} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.sm }}>
                    <AppText style={{ fontWeight: t.font.weight.bold }}>{o.name}</AppText>
                    {on ? <AppText variant="caption" style={{ color: t.color.accept }}>{msg('fert.picked')}</AppText> : null}
                  </View>
                  {o.typed ? <AppText variant="caption">{msg('fert.onceOnly')}</AppText> : o.description ? (
                    <AppText variant="bodySm" numberOfLines={expanded ? undefined : 1}>{o.description}</AppText>
                  ) : null}
                </View>
              </Pressable>
              {!o.typed && o.description.length > 30 ? (
                <ChoiceChip testID={`fert-reason-more-${o.id}`} label={msg(expanded ? 'fert.readLess' : 'fert.readMore')} onPress={() => setOpen(expanded ? null : o.id)} />
              ) : null}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

/** โซน (21j/21k): the chosen farm's zones as cards; sums never past the sacks bought. */
function Zones({
  farms,
  farmId,
  onFarm,
  zones,
  drafts,
  onDraft,
  reasons,
  reasonName,
  total,
  given,
  error,
  onZoneSaved,
}: {
  farms: readonly { id: string; name: string }[];
  farmId: string | null;
  onFarm: (id: string) => void;
  zones: readonly { id: string; name: string }[];
  drafts: Record<string, ZoneDraft>;
  onDraft: (id: string, z: ZoneDraft) => void;
  reasons: readonly string[];
  reasonName: (r: string) => string;
  total: number;
  given: number;
  error: string | null;
  onZoneSaved: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [sheet, setSheet] = useState<{ zoneId?: string; name: string; effective: string } | null>(null);
  const [sheetErr, setSheetErr] = useState(false);
  const draftOf = (z: { id: string; name: string }): ZoneDraft => drafts[z.id] ?? { farmId: farmId ?? '', name: z.name, sacks: '', reasons: [], note: '' };
  const set = (z: { id: string; name: string }, p: Partial<ZoneDraft>) => onDraft(z.id, { ...draftOf(z), name: z.name, farmId: farmId ?? '', ...p });

  const saveZone = async () => {
    if (!sheet || !farmId) return;
    try {
      if (sheet.zoneId) await peopleStore.renameZone(sheet.zoneId, sheet.name);
      else await peopleStore.addZone(farmId, sheet.name, sheet.effective);
      setSheet(null);
      setSheetErr(false);
      onZoneSaved();
    } catch {
      setSheetErr(true);
    }
  };

  return (
    <View style={{ gap: t.space.md }}>
      <SectionLabel>{msg('fert.farm')}</SectionLabel>
      {farms.length === 0 ? <AppText variant="bodySm">{msg('fert.noFarm')}</AppText> : null}
      <ChoiceRow>
        {farms.map((f) => <ChoiceChip key={f.id} testID={`fert-farm-${f.id}`} label={f.name} on={farmId === f.id} onPress={() => onFarm(f.id)} />)}
      </ChoiceRow>
      {farmId ? (
        <>
          <View testID="fert-zones-sum" style={{ flexDirection: 'row' }}>
            <AppText variant="bodySm" style={{ flex: 1 }}>{msg('fert.zonesSum')}</AppText>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fert.sacksOf', { n: given, total })}</AppText>
          </View>
          {zones.length === 0 ? <AppText>{msg('fert.noZones')}</AppText> : null}
          {zones.map((z) => {
            const d = draftOf(z);
            return (
              <Card key={z.id} testID={`fert-zone-${z.id}`} style={{ gap: t.space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                  <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{z.name}</AppText>
                  <ChoiceChip testID={`fert-zone-${z.id}-rename`} label={msg('fert.renameZone')} onPress={() => setSheet({ zoneId: z.id, name: z.name, effective: '' })} />
                </View>
                <TextField testID={`fert-zone-${z.id}-sacks`} label={msg('fert.zoneSacks')} keyboardType="number-pad" value={d.sacks} onChangeText={(v) => set(z, { sacks: v })} />
                {reasons.length ? (
                  <ChoiceRow>
                    {reasons.map((r) => (
                      <ChoiceChip key={r} testID={`fert-zone-${z.id}-reason-${r}`} label={reasonName(r)} on={d.reasons.includes(r)} onPress={() => set(z, { reasons: d.reasons.includes(r) ? d.reasons.filter((x) => x !== r) : [...d.reasons, r] })} />
                    ))}
                  </ChoiceRow>
                ) : null}
                <TextField testID={`fert-zone-${z.id}-note`} label={msg('fert.zoneNote')} hint={msg('v2m.optional')} value={d.note} onChangeText={(v) => set(z, { note: v })} />
              </Card>
            );
          })}
          <ChoiceRow>
            <ChoiceChip testID="fert-zone-add" dashed label={msg('fert.addZone')} onPress={() => setSheet({ name: '', effective: todayIso() })} />
          </ChoiceRow>
          {error ? <AppText testID="fert-zones-err" style={{ color: t.color.reject }}>{error}</AppText> : null}
        </>
      ) : null}
      {sheet ? (
        <BottomSheet
          open
          onClose={() => setSheet(null)}
          testID="fert-zone-sheet"
          title={msg(sheet.zoneId ? 'fert.zoneSheetRename' : 'fert.zoneSheet')}
          action={{ label: msg('common.save'), testID: 'fert-zone-save', disabled: !sheet.name.trim(), onPress: () => void saveZone() }}
        >
          <View style={{ gap: t.space.md }}>
            <TextField testID="fert-zone-name" label={msg('fert.zoneName')} value={sheet.name} onChangeText={(v) => setSheet((s) => (s ? { ...s, name: v } : s))} error={sheetErr ? msg('fert.err.zoneName') : undefined} />
            {!sheet.zoneId ? (
              <TextField testID="fert-zone-effective" label={msg('fert.zoneEffective')} value={sheet.effective} onChangeText={(v) => setSheet((s) => (s ? { ...s, effective: v } : s))} helper={msg('v2m.dateShown', { shown: formatDate(sheet.effective) })} />
            ) : null}
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

/** Back to where the user came from. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/v2/expenses');
}
