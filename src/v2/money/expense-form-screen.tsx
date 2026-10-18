/**
 * บันทึกค่าใช้จ่าย — v1.1.0 farm mockup screen 18 (E11-S01, E11-S02,
 * E11-S05 aid, E11-S06 trip), rebuilt on src/ui (D-82). Behaviour is the
 * old screen's, unchanged:
 *
 * - Only amount + date are required (D-62); the stage starts at เกิดจริง; a
 *   planned expense may say ไม่ทราบ instead of an amount (SYNC-12).
 * - The payer starts as this device's last payer; anyone other than farm
 *   funds is owed the money back once it is actual (previewed here).
 * - An edit writes only the fields that changed, naming the head it saw, so
 *   a concurrent edit merges or surfaces as a conflict to pick (D-30).
 * - Derived expenses (a fertilizer debt's owner share, a salary month) keep
 *   their amount and date from the source; a fertilizer purchase (sacks,
 *   details) is shown only, and edited in its own flow.
 * - A share and its net amount are always written together (E11-S10).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { checkExpense, defaultPayer, headOf, isDerivedExpense, type Expense } from '../../core/finance/ledger';
import { formatDate, formatSatang, parseBahtToSatang, satangToInput, todayIso } from '../../core/finance/money';
import { checkTrip } from '../../core/finance/plan';
import { checkShare } from '../../core/finance/share';
import { FARM_FUNDS, type AidKind, type ExpenseFields, type ExpensePatch, type ExpenseShare, type Payer, type Stage, type Trip, type TripCostKind } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, Button, Card, FactRow, PersonIcon, ReceiptIcon, ScreenHeader, SegmentedControl, TextField, type HeaderPrimaryAction } from '../../ui';
import { useFarms } from './expenses-screen';
import { ChoiceChip, ChoiceRow, NotRecordedPill, PayerPicker, SectionLabel } from './pieces';
import { CategoryShareSheet, draftOf, shareOf, ShareSheet, type ShareDraft } from './share-sheet';

const FERTILIZER = 'cat-fertilizer';
const FLOW = '/v2/fertilizer' as const;

const STAGES: readonly Stage[] = ['actual', 'committed', 'planned'];
const AID_KINDS: readonly AidKind[] = ['accident', 'general', 'food', 'other'];
const TRIP_KINDS: readonly TripCostKind[] = ['fuel', 'toll', 'lodging', 'food', 'other'];
const LIST = '/v2/expenses' as const;

export function ExpenseFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fin = useFinance();
  const msg = useT();
  const t = useTheme();
  const sync = useSyncStatus();

  const existing = id && id !== 'new' ? fin.state?.expenses.find((x) => x.id === id) ?? null : null;
  const ready = fin.state !== null && (id === 'new' || existing !== null) && fin.deviceId !== null;

  const header = (action?: HeaderPrimaryAction) => (
    <ScreenHeader
      title={msg(existing ? 'fin.form.titleEdit' : 'fin.form.titleNew')}
      back={{ label: msg('v2.back'), onPress: leave, testID: 'expense-back' }}
      sync={sync}
      action={action}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      {ready ? <Form key={existing?.headEventId ?? 'new'} existing={existing} fin={fin} header={header} /> : (
        <>
          {header()}
          <AppText variant="bodySm" style={{ padding: t.space.lg }}>{msg('counter.loading')}</AppText>
        </>
      )}
    </View>
  );
}

function Form({ existing, fin, header }: { existing: Expense | null; fin: ReturnType<typeof useFinance>; header: (action?: HeaderPrimaryAction) => ReactNode }) {
  const t = useTheme();
  const msg = useT();
  const state = fin.state!;
  const farmsList = useFarms();

  const initialPayer = useMemo<Payer | null>(
    () => (existing ? existing.payer : defaultPayer(fin.events ?? [], fin.deviceId ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the default is taken once, when the form opens
    [],
  );

  // A shared expense stores the net bill; the form edits the bill (E11-S10).
  const shownAmount = existing?.share ? existing.share.billSatang : existing?.amountSatang;
  const [amount, setAmount] = useState(shownAmount != null ? satangToInput(shownAmount) : '');
  const [unknownWanted, setUnknown] = useState(existing ? existing.amountSatang === null : false);
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [stage, setStage] = useState<Stage>(existing?.stage ?? 'actual');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [propertyId, setPropertyId] = useState<string | null>(existing?.propertyId ?? null);
  const [payer, setPayer] = useState<Payer | null>(initialPayer);
  const [item, setItem] = useState(existing?.item ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [worker, setWorker] = useState<Payer | null>(existing?.worker ?? null);
  const [aidKind, setAidKind] = useState<AidKind>(existing?.aidKind ?? 'general');
  const [tripFrom, setTripFrom] = useState(existing?.trip?.from ?? '');
  const [tripTo, setTripTo] = useState(existing?.trip?.to ?? '');
  const [purposes, setPurposes] = useState((existing?.trip?.purposes ?? []).join(', '));
  const [farms, setFarms] = useState((existing?.trip?.farms ?? []).map((f) => f.name).join(', '));
  const [lines, setLines] = useState<Record<TripCostKind, string>>(() => {
    const out = { fuel: '', toll: '', lodging: '', food: '', other: '' } as Record<TripCostKind, string>;
    for (const l of existing?.trip?.lines ?? []) out[l.kind] = satangToInput(l.satang);
    return out;
  });
  const [split, setSplit] = useState<Record<string, string> | null>(() =>
    existing?.trip?.split ? Object.fromEntries(existing.trip.split.map((x) => [x.farmId, satangToInput(x.satang)])) : null,
  );
  const [shareDraft, setShareDraft] = useState<ShareDraft>(() => draftOf(existing?.share, state.categories.find((c) => c.id === existing?.categoryId)?.workerPct ?? null));
  const [shareOpen, setShareOpen] = useState(false);
  const [catShareOpen, setCatShareOpen] = useState(false);
  const [addingCat, setAddingCat] = useState<'add' | 'rename' | null>(null);
  const [catName, setCatName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const inFlight = useInFlight();
  const derived = !!existing && isDerivedExpense(existing.id);
  // A fertilizer purchase is edited in its flow only: this form cannot carry sacks or details,
  // and saving here would drop the share (and void its debts).
  const fertLocked = !!existing && (!!existing.fertilizer || existing.share?.totalSacks != null);

  const unknown = stage === 'planned' && unknownWanted;
  const isAid = categoryId === 'cat-worker-aid';
  const isTrip = categoryId === 'cat-travel';
  const tripLines = TRIP_KINDS.map((k) => ({ kind: k, satang: parseBahtToSatang(lines[k]) ?? 0 })).filter((l) => l.satang > 0);
  const tripFarms = farms.split(',').map((f) => f.trim()).filter(Boolean).map((name) => ({ id: `farm:${name}`, name }));
  const fromLines = isTrip && tripLines.length > 0;
  const amountSatang = fromLines ? tripLines.reduce((a, l) => a + l.satang, 0) : unknown ? null : parseBahtToSatang(amount);
  const trip: Trip | undefined = isTrip
    ? {
        from: tripFrom.trim(),
        to: tripTo.trim(),
        purposes: purposes.split(',').map((x) => x.trim()).filter(Boolean),
        farms: tripFarms,
        lines: tripLines,
        split: split ? tripFarms.map((f) => ({ farmId: f.id, satang: parseBahtToSatang(split[f.id] ?? '') ?? 0 })) : null,
      }
    : undefined;
  const tripProblems = trip && amountSatang !== null ? checkTrip(trip, amountSatang).filter((p) => p !== 'lines-total' || fromLines) : [];
  const category = state.categories.find((c) => c.id === categoryId) ?? null;
  // A share already stored stays editable even if the category stopped sharing since.
  const sharable = !!category && (category.workerPct !== null || !!existing?.share) && category.id !== FERTILIZER && !isTrip && !isAid;
  const share = sharable && amountSatang !== null ? shareOf(shareDraft, amountSatang) : null;
  const shareProblems = share ? checkShare(share) : [];
  // No tapper but a discount typed (or kept from a removed share): the amount is still the net.
  const draftDiscount = sharable && !share && shareDraft.discount.trim() ? parseBahtToSatang(shareDraft.discount) : null;
  const unsharedNet = draftDiscount !== null && amountSatang !== null && draftDiscount <= amountSatang ? amountSatang - draftDiscount : null;
  // A discount that cannot apply is refused, not silently dropped.
  const badDiscount = sharable && !share && shareDraft.discount.trim() !== '' && amountSatang !== null && unsharedNet === null;
  const amountTyped = !unknown && amount.trim() !== '';
  const problems = checkExpense({ amountSatang, date, stage }).map((p) => (p === 'amount-required' && amountTyped ? 'amount-invalid' : p));

  const knownPayers = useMemo(() => {
    const seen = new Map<string, Payer>();
    for (const x of state.expenses) if (x.payer && x.payer.id !== FARM_FUNDS) seen.set(x.payer.id, x.payer);
    return [...seen.values()];
  }, [state.expenses]);

  const save = async () => {
    setShowErrors(true);
    if (fertLocked || problems.length || tripProblems.length || shareProblems.length || badDiscount) return;
    setFailed(false);
    const fields: ExpenseFields = {
      amountSatang: share ? share.billSatang - share.discountSatang : (unsharedNet ?? amountSatang),
      date,
      stage,
      categoryId,
      propertyId,
      item: item.trim(),
      note: note.trim(),
      payer,
      // Leaving aid/travel clears what belonged to it — null, since a stored key cannot be removed.
      ...(isAid && worker ? { worker, aidKind } : existing?.worker ? { worker: null, aidKind: null } : {}),
      ...(trip ? { trip } : existing?.trip ? { trip: null } : {}),
      ...(share ? { share } : existing?.share ? { share: null } : {}),
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
        if (('share' in patch || 'amountSatang' in patch) && (fields.share || existing.share)) {
          patch.share = fields.share ?? null;
          patch.amountSatang = fields.amountSatang;
        }
        if (Object.keys(patch).length) await fin.write(existing.id, existing.headEventId, { t: 'expense_changed', patch: patch as ExpensePatch });
      }
      leave();
    } catch (err) {
      console.error('Expense could not be stored.', err);
      setFailed(true);
    }
  };

  const setDeleted = async (deleted: boolean) => {
    if (!existing) return;
    await fin.write(existing.id, existing.headEventId, { t: 'expense_changed', patch: { deleted } });
    if (deleted) leave();
  };

  const pickConflict = async (field: string, value: unknown) => {
    if (!existing) return;
    const others = existing.heads.filter((h) => h !== existing.headEventId);
    // Picking a share picks its net amount too (E11-S10 review).
    const v = value as ExpenseShare | null;
    const patch = (field === 'share' ? { share: v, amountSatang: v ? v.billSatang - v.discountSatang : existing.amountSatang } : { [field]: value }) as ExpensePatch;
    await fin.write(existing.id, existing.headEventId, { t: 'expense_changed', patch, alsoBasedOn: others });
  };

  const pickCategory = (id: string) => {
    // The fertilizer category is its own flow (E11-S10 C): what was typed goes with it.
    // Replaced, not pushed: after saving there the user is not sent back to this half-filled form.
    if (id === FERTILIZER && !existing) {
      router.replace({ pathname: FLOW, params: { bill: amount, date, stage, payerId: payer?.id ?? 'none', payerName: payer?.name ?? '' } });
      return;
    }
    if (id !== categoryId) setShareDraft((d) => ({ ...d, pct: String(state.categories.find((c) => c.id === id)?.workerPct ?? d.pct) }));
    setCategoryId(categoryId === id ? null : id);
  };

  const saveCategoryShare = async (pct: number | null) => {
    if (!categoryId) return;
    const prior = (fin.events ?? []).filter((e) => e.targetId === categoryId && e.payload.t === 'category_share_set');
    await fin.write(categoryId, prior.length ? headOf(prior) : null, { t: 'category_share_set', workerPct: pct });
    if (pct !== null) setShareDraft((d) => ({ ...d, pct: String(pct) }));
    setCatShareOpen(false);
  };

  const saveCategory = async () => {
    const name = catName.trim();
    if (!name) return;
    if (addingCat === 'rename' && categoryId) {
      await fin.write(categoryId, null, { t: 'category_renamed', name });
    } else {
      const cid = newId('cat-');
      await fin.write(cid, null, { t: 'category_added', name });
      setCategoryId(cid);
    }
    setAddingCat(null);
    setCatName('');
  };

  const owed = payer && payer.id !== FARM_FUNDS;
  const fieldLabel = (f: string) => (f === 'amountSatang' ? msg('fin.field.amountSatang') : f === 'stage' ? msg('fin.field.stage') : f === 'share' ? msg('fin.field.share') : msg('fin.field.payer'));
  const shareLabel = (v: ExpenseShare | null) =>
    v
      ? msg('xshare.summary', { bill: formatSatang(v.billSatang), discount: formatSatang(v.discountSatang), lines: v.lines.map((l) => msg('xshare.summaryLine', { name: l.worker.name, pct: l.workerPct })).join(', ') })
      : msg('xshare.none');
  const valueLabel = (f: string, v: unknown) =>
    f === 'amountSatang'
      ? v === null ? msg('fin.row.unknown') : formatSatang(v as number)
      : f === 'stage' ? msg(`fin.stage.${v as Stage}`) : f === 'share' ? shareLabel(v as ExpenseShare | null) : ((v as Payer | null)?.name ?? msg('fin.form.payerLater'));
  // A share conflict carries its amount: one card, resolved together.
  const conflicts = (existing?.conflicts ?? []).filter((c) => !(c.field === 'amountSatang' && existing?.conflicts.some((o) => o.field === 'share')));
  const err = (key: 'amount-required' | 'amount-invalid' | 'date-required') => (showErrors && (problems as string[]).includes(key) ? msg(`fin.form.err.${key}`) : undefined);

  return (
    <>
      {header(fertLocked ? undefined : { label: msg('fin.form.save'), testID: 'expense-save', saving: inFlight.busy, onPress: () => void inFlight.run(save) })}
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg, paddingBottom: t.space[16] * 2 }}>
        {existing?.deleted ? (
          <Card style={{ backgroundColor: t.color.warnSunk }}>
            <AppText testID="expense-deleted">{msg('fin.form.deleted')}</AppText>
            <Button testID="expense-restore" onPress={() => void setDeleted(false)}>{msg('fin.form.restore')}</Button>
          </Card>
        ) : null}

        {conflicts.map((c) => (
          <Card key={c.field} testID={`conflict-${c.field}`} style={{ backgroundColor: t.color.rejectSunk }}>
            <AppText>{msg('fin.form.conflict', { field: fieldLabel(c.field) })}</AppText>
            <ChoiceRow>
              {c.values.map((v, i) => (
                <ChoiceChip key={i} testID={`conflict-${c.field}-${i}`} label={msg('fin.form.pick', { value: valueLabel(c.field, v) })} onPress={() => void pickConflict(c.field, v)} />
              ))}
            </ChoiceRow>
          </Card>
        ))}

        {fertLocked && existing ? (
          <Card testID="fert-locked" style={{ backgroundColor: t.color.surfaceSunk }}>
            <AppText>{existing.fertilizer?.formula || existing.item}</AppText>
            <AppText variant="bodySm">{`${existing.amountSatang === null ? msg('fin.row.unknown') : formatSatang(existing.amountSatang)} · ${formatDate(existing.date)} · ${msg(`fin.stage.${existing.stage}`)}`}</AppText>
            {!existing.deleted ? <Button testID="expense-open-fert" variant="primary" onPress={() => router.push({ pathname: FLOW, params: { id: existing.id } })}>{msg('fert.openFlow')}</Button> : null}
          </Card>
        ) : derived ? (
          <Card testID="owner-share-locked" style={{ backgroundColor: t.color.surfaceSunk }}>
            <AppText>{msg('fin.form.ownerShareLocked')}</AppText>
            <AppText variant="bodySm">{`${amountSatang === null ? msg('fin.row.unknown') : formatSatang(amountSatang)} · ${formatDate(date)}`}</AppText>
          </Card>
        ) : (
          <>
            <View style={{ gap: t.space.sm }}>
              {unknown ? (
                <View style={{ gap: t.space.xs }}>
                  <SectionLabel required>{msg('fin.form.amount')}</SectionLabel>
                  <AppText testID="amount-unknown">{msg('fin.row.unknown')}</AppText>
                </View>
              ) : (
                <TextField
                  testID="expense-amount"
                  label={msg('fin.form.amount')}
                  required
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  helper={msg('v2m.baht')}
                  error={err('amount-required') ?? err('amount-invalid')}
                />
              )}
              {stage === 'planned' ? (
                <ChoiceRow>
                  <ChoiceChip testID="expense-unknown" dashed label={msg('fin.form.amountUnknown')} on={unknown} onPress={() => setUnknown((u) => !u)} />
                </ChoiceRow>
              ) : null}
            </View>

            <TextField
              testID="expense-date"
              label={msg('fin.form.date')}
              required
              value={date}
              onChangeText={setDate}
              placeholder="2026-09-28"
              helper={msg('v2m.dateShown', { shown: formatDate(date) })}
              error={err('date-required')}
            />

            <View style={{ gap: t.space.sm }}>
              <SectionLabel>{msg('fin.form.stage')}</SectionLabel>
              <SegmentedControl testID="expense-stage" value={stage} onChange={setStage} options={STAGES.map((s) => ({ value: s, label: msg(`fin.stage.${s}`) }))} />
              {stage === 'planned' ? <AppText variant="caption">{msg('v2m.plannedHint')}</AppText> : null}
            </View>
          </>
        )}

        {fertLocked ? null : (
        <>
        <View style={{ gap: t.space.sm }}>
          <SectionLabel hint={msg('v2m.categoryHint')}>{msg('fin.form.category')}</SectionLabel>
          <ChoiceRow>
            {state.categories.map((c) => (
              <ChoiceChip key={c.id} testID={`expense-cat-${c.id}`} label={c.name} on={categoryId === c.id} onPress={() => pickCategory(c.id)} />
            ))}
            <ChoiceChip testID="expense-cat-add" label={msg('fin.form.addCategory')} onPress={() => { setAddingCat('add'); setCatName(''); }} />
            {categoryId ? (
              <ChoiceChip testID="expense-cat-rename" label={msg('fin.form.renameCategory')} onPress={() => { setAddingCat('rename'); setCatName(state.categories.find((c) => c.id === categoryId)?.name ?? ''); }} />
            ) : null}
          </ChoiceRow>
          {categoryId && categoryId !== FERTILIZER ? (
            <ChoiceRow>
              <ChoiceChip testID="expense-cat-share" label={msg('xshare.catSettings')} onPress={() => setCatShareOpen(true)} />
            </ChoiceRow>
          ) : null}
          {catShareOpen && category ? (
            <CategoryShareSheet open onClose={() => setCatShareOpen(false)} name={category.name} pct={category.workerPct} onSave={saveCategoryShare} />
          ) : null}
          {addingCat ? (
            <View style={{ gap: t.space.sm }}>
              <TextField testID="expense-cat-name" label={msg('fin.form.categoryPlaceholder')} value={catName} onChangeText={setCatName} />
              <Button testID="expense-cat-save" onPress={() => void saveCategory()}>{msg('common.save')}</Button>
            </View>
          ) : null}
        </View>

        {sharable ? (
          <Pressable testID="share-row" accessibilityRole="button" onPress={() => setShareOpen(true)}>
          <Card style={{ gap: t.space.xs }}>
            <SectionLabel>{msg('xshare.row')}</SectionLabel>
            <AppText variant="bodySm">
              {shareDraft.worker
                ? msg(shareDraft.discount.trim() ? 'xshare.rowDiscount' : 'xshare.rowOn', {
                    summary: msg('xshare.rowOn', { name: shareDraft.worker.name, pct: shareDraft.pct, settle: msg(`xshare.settle.${shareDraft.settle}`) }),
                    name: shareDraft.worker.name,
                    pct: shareDraft.pct,
                    settle: msg(`xshare.settle.${shareDraft.settle}`),
                  })
                : msg('xshare.rowOff')}
            </AppText>
            {unsharedNet !== null ? <AppText testID="share-unshared-net" variant="caption">{msg('xshare.unsharedNet', { net: formatSatang(unsharedNet) })}</AppText> : null}
            {showErrors && (shareProblems.length || badDiscount) ? <AppText testID="share-err" style={{ color: t.color.reject }}>{msg(badDiscount || shareProblems.includes('discount-over') ? 'xshare.err.discount' : 'xshare.err.pct')}</AppText> : null}
          </Card>
          </Pressable>
        ) : null}
        {shareOpen && category ? (
          <ShareSheet open onClose={() => setShareOpen(false)} billSatang={amountSatang ?? 0} title={category.name} draft={shareDraft} onChange={setShareDraft} />
        ) : null}

        {isAid ? (
          <Card testID="aid-section">
            <SectionLabel>{msg('aid.worker')}</SectionLabel>
            <PayerPicker testID="aid-worker" role="worker" value={worker} onChange={setWorker} />
            <SectionLabel>{msg('aid.kind')}</SectionLabel>
            <ChoiceRow>
              {AID_KINDS.map((k) => <ChoiceChip key={k} testID={`aid-kind-${k}`} label={msg(`aid.kind.${k}`)} on={aidKind === k} onPress={() => setAidKind(k)} />)}
            </ChoiceRow>
            <AppText variant="caption">{msg('aid.note')}</AppText>
          </Card>
        ) : null}

        {isTrip ? (
          <Card testID="trip-section">
            <SectionLabel>{msg('trip.title')}</SectionLabel>
            <TextField testID="trip-from" label={msg('trip.from')} value={tripFrom} onChangeText={setTripFrom} />
            <TextField testID="trip-to" label={msg('trip.to')} value={tripTo} onChangeText={setTripTo} />
            <TextField testID="trip-purposes" label={msg('trip.purposes')} value={purposes} onChangeText={setPurposes} />
            <TextField testID="trip-farms" label={msg('trip.farms')} value={farms} onChangeText={setFarms} />
            <SectionLabel>{msg('trip.lines')}</SectionLabel>
            {TRIP_KINDS.map((k) => (
              <TextField key={k} testID={`trip-line-${k}`} label={msg(`trip.kind.${k}`)} keyboardType="decimal-pad" value={lines[k]} onChangeText={(v) => setLines((l) => ({ ...l, [k]: v }))} />
            ))}
            {fromLines ? <AppText testID="trip-total">{msg('trip.total', { amount: formatSatang(amountSatang ?? 0) })}</AppText> : null}
            {tripFarms.length ? (
              <ChoiceRow>
                <ChoiceChip testID="trip-unsplit" label={msg('trip.unsplit')} on={split === null} onPress={() => setSplit(null)} />
                <ChoiceChip testID="trip-split" label={msg('trip.split')} on={split !== null} onPress={() => setSplit(split ?? {})} />
              </ChoiceRow>
            ) : null}
            {split
              ? tripFarms.map((f) => (
                  <TextField key={f.id} testID={`trip-split-${f.name}`} label={f.name} keyboardType="decimal-pad" value={split[f.id] ?? ''} onChangeText={(v) => setSplit((x) => ({ ...(x ?? {}), [f.id]: v }))} />
                ))
              : null}
            {showErrors && tripProblems.includes('split-total') ? <AppText testID="trip-err-split" style={{ color: t.color.reject }}>{msg('trip.err.split-total')}</AppText> : null}
          </Card>
        ) : null}

        <View style={{ gap: t.space.sm }}>
          <SectionLabel hint={existing ? undefined : msg('fin.form.payerHint')}>{msg('fin.form.payer')}</SectionLabel>
          <PayerPicker testID="expense-payer" value={payer} onChange={setPayer} extra={knownPayers} allowNone />
          {owed ? (
            <Card testID="owed-preview" style={{ backgroundColor: t.color.surfaceSunk }}>
              <FactRow icon={(c) => <PersonIcon color={c} size={14} />}>{msg('v2m.owedTo', { name: payer!.name })}</FactRow>
              <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>
                {stage === 'actual' && amountSatang !== null ? `${formatSatang(amountSatang)} ${msg('v2m.baht')}` : msg('fin.form.owedLater', { name: payer!.name })}
              </FactRow>
              <AppText variant="caption">{msg('v2m.owedWhy', { name: payer!.name })}</AppText>
            </Card>
          ) : null}
        </View>

        <View style={{ gap: t.space.sm }}>
          <SectionLabel hint={msg('v2m.optional')}>{msg('v2m.farm')}</SectionLabel>
          <ChoiceRow>
            {farmsList.map((f) => <ChoiceChip key={f.id} testID={`expense-farm-${f.id}`} label={f.name} on={propertyId === f.id} onPress={() => setPropertyId(propertyId === f.id ? null : f.id)} />)}
            {propertyId === null ? <NotRecordedPill testID="expense-farm-none" /> : null}
          </ChoiceRow>
        </View>

        <TextField testID="expense-item" label={msg('fin.form.item')} value={item} onChangeText={setItem} placeholder={msg('fin.form.itemPlaceholder')} />
        <TextField testID="expense-note" label={msg('fin.form.note')} multiline value={note} onChangeText={setNote} placeholder={msg('fin.form.notePlaceholder')} />
        </>
        )}

        {failed ? <AppText testID="save-failed" style={{ color: t.color.reject }}>{msg('fin.form.saveFailed')}</AppText> : null}

        {existing && existing.history.length > 1 ? (
          <View testID="expense-history" style={{ gap: t.space.xs }}>
            <SectionLabel>{msg('fin.form.history')}</SectionLabel>
            <AppText variant="bodySm">{existing.history.map((h) => msg(`fin.stage.${h.stage}`)).filter((s, i, a) => i === 0 || a[i - 1] !== s).join(' → ')}</AppText>
          </View>
        ) : null}

        {existing && !existing.deleted && !derived ? (
          confirmDelete ? (
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <Button testID="expense-delete-cancel" variant="ghost" onPress={() => setConfirmDelete(false)}>{msg('fin.form.cancel')}</Button>
              <Button testID="expense-delete-confirm" variant="destructive" onPress={() => void setDeleted(true)}>{msg('fin.form.deleteConfirm')}</Button>
            </View>
          ) : (
            <Button testID="expense-delete" variant="destructive" onPress={() => setConfirmDelete(true)}>{msg('fin.form.delete')}</Button>
          )
        ) : null}
        <Text style={{ height: 1 }} />
      </ScrollView>
    </>
  );
}

/** Back to where the user came from — replacing would stack a second copy of that screen. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace(LIST);
}
