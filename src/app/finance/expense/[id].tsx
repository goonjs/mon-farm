/**
 * Record or edit one expense (E11-S01, E11-S02).
 *
 * Only amount + date are required (D-62); the stage starts at "actual"; a
 * planned expense may say "unknown" instead of an amount, and cannot move to
 * committed/actual until it has one. The payer starts as this device's last
 * payer; a payer who is not farm funds is owed the money back once the
 * expense is actual — previewed here, created by the projection.
 *
 * An edit writes only the fields that changed, naming the head it saw, so a
 * concurrent edit on another phone merges or surfaces as a conflict instead
 * of being overwritten (D-30).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '../../../components/chrome';
import { Chip, ChipRow, Input, Label, Note, PayerPicker, ScreenHeader } from '../../../components/finance/parts';
import { checkExpense, defaultPayer, OWNER_SHARE_SUFFIX, type Expense } from '../../../core/finance/ledger';
import { formatDate, formatSatang, parseBahtToSatang, satangToInput, todayIso } from '../../../core/finance/money';
import { FARM_FUNDS, type ExpenseFields, type ExpensePatch, type Payer, type Stage } from '../../../core/finance/types';
import { useFinance } from '../../../finance/use-finance';
import { useT } from '../../../i18n';
import { newId } from '../../../lib/id';
import { useTheme } from '../../../theme';
import { useInFlight } from '../../../finance/use-in-flight';

const STAGES: readonly Stage[] = ['actual', 'committed', 'planned'];
const LIST = '/finance/expenses' as const;

export default function ExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fin = useFinance();
  const msg = useT();
  const t = useTheme();

  const existing = id && id !== 'new' ? fin.state?.expenses.find((x) => x.id === id) ?? null : null;
  const ready = fin.state !== null && (id === 'new' || existing !== null) && fin.deviceId !== null;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader testID="expense" title={msg(existing ? 'fin.form.titleEdit' : 'fin.form.titleNew')} onBack={leave} />
      {ready ? (
        <Form key={existing?.headEventId ?? 'new'} existing={existing} fin={fin} />
      ) : (
        <Text style={{ padding: t.space.md, fontFamily: t.font.family.mono, color: t.color.inkSoft }}>
          {msg('counter.loading')}
        </Text>
      )}
    </View>
  );
}

function Form({ existing, fin }: { existing: Expense | null; fin: ReturnType<typeof useFinance> }) {
  const t = useTheme();
  const msg = useT();
  const state = fin.state!;

  const initialPayer = useMemo<Payer | null>(
    () => (existing ? existing.payer : defaultPayer(fin.events ?? [], fin.deviceId ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the default is taken once, when the form opens
    [],
  );

  const [amount, setAmount] = useState(existing?.amountSatang != null ? satangToInput(existing.amountSatang) : '');
  // "Unknown" belongs to planned only; any other stage needs an amount.
  const [unknownWanted, setUnknown] = useState(existing ? existing.amountSatang === null : false);
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [stage, setStage] = useState<Stage>(existing?.stage ?? 'actual');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [payer, setPayer] = useState<Payer | null>(initialPayer);
  const [item, setItem] = useState(existing?.item ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [addingCat, setAddingCat] = useState<'add' | 'rename' | null>(null);
  const [catName, setCatName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const inFlight = useInFlight();
  const saving = inFlight.busy;
  // The owner share of a fertilizer debt follows the debt: only its payer, item and note are edited here (review #5).
  const ownerShare = !!existing?.id.endsWith(OWNER_SHARE_SUFFIX);

  const unknown = stage === 'planned' && unknownWanted;
  const amountSatang = unknown ? null : parseBahtToSatang(amount);
  const amountTyped = !unknown && amount.trim() !== '';
  // Something typed that does not parse is "invalid", not "missing".
  const problems = checkExpense({ amountSatang, date, stage }).map((p) =>
    p === 'amount-required' && amountTyped ? 'amount-invalid' : p,
  );

  const knownPayers = useMemo(() => {
    const seen = new Map<string, Payer>();
    for (const x of state.expenses) if (x.payer && x.payer.id !== FARM_FUNDS) seen.set(x.payer.id, x.payer);
    return [...seen.values()];
  }, [state.expenses]);

  const save = async () => {
    setShowErrors(true);
    if (problems.length) return;
    const fields: ExpenseFields = { amountSatang, date, stage, categoryId, propertyId: existing?.propertyId ?? null, item: item.trim(), note: note.trim(), payer };
    try {
      if (!existing) {
        await fin.write(newId('exp-'), null, { t: 'expense_created', fields });
      } else {
        const patch: Record<string, unknown> = {};
        for (const k of Object.keys(fields) as (keyof ExpenseFields)[]) {
          if (JSON.stringify(fields[k]) !== JSON.stringify(existing[k])) patch[k] = fields[k];
        }
        if (Object.keys(patch).length) {
          await fin.write(existing.id, existing.headEventId, { t: 'expense_changed', patch: patch as ExpensePatch });
        }
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
    // Heads from the projection, which includes synthesised ones the raw log lacks (review #5).
    const others = existing.heads.filter((h) => h !== existing.headEventId);
    await fin.write(existing.id, existing.headEventId, {
      t: 'expense_changed',
      patch: { [field]: value } as ExpensePatch,
      alsoBasedOn: others,
    });
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

  const owedPreview =
    payer && payer.id !== FARM_FUNDS
      ? stage === 'actual' && amountSatang !== null
        ? msg('fin.form.owedPreview', { name: payer.name, amount: formatSatang(amountSatang) })
        : msg('fin.form.owedLater', { name: payer.name })
      : null;

  const fieldLabel = (f: string) =>
    f === 'amountSatang' ? msg('fin.field.amountSatang') : f === 'stage' ? msg('fin.field.stage') : msg('fin.field.payer');
  const valueLabel = (f: string, v: unknown) =>
    f === 'amountSatang'
      ? v === null ? msg('fin.row.unknown') : formatSatang(v as number)
      : f === 'stage' ? msg(`fin.stage.${v as Stage}`) : ((v as Payer | null)?.name ?? msg('fin.form.payerLater'));

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.lg }}>
      {existing?.deleted ? (
        <View style={{ gap: t.space.xs }}>
          <Note tone="warn" testID="expense-deleted">{msg('fin.form.deleted')}</Note>
          <Button testID="expense-restore" onPress={() => void setDeleted(false)}>{msg('fin.form.restore')}</Button>
        </View>
      ) : null}

      {existing?.conflicts.map((c) => (
        <View key={c.field} testID={`conflict-${c.field}`} style={{ gap: t.space.xs, padding: t.space.sm, borderRadius: t.radius.md, backgroundColor: t.color.rejectSunk }}>
          <Note tone="reject">{msg('fin.form.conflict', { field: fieldLabel(c.field) })}</Note>
          <ChipRow>
            {c.values.map((v, i) => (
              <Chip key={i} testID={`conflict-${c.field}-${i}`} onPress={() => void pickConflict(c.field, v)}>
                {msg('fin.form.pick', { value: valueLabel(c.field, v) })}
              </Chip>
            ))}
          </ChipRow>
        </View>
      ))}

      {ownerShare ? (
        <Note testID="owner-share-locked">{`${msg('fin.form.ownerShareLocked')} · ${amountSatang === null ? msg('fin.row.unknown') : formatSatang(amountSatang)} · ${formatDate(date)}`}</Note>
      ) : (
      <>
      <View style={{ gap: t.space.xs }}>
        <Label hint={msg('fin.form.amountHint')}>{msg('fin.form.amount')}</Label>
        <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            {unknown ? (
              <Note testID="amount-unknown">{msg('fin.row.unknown')}</Note>
            ) : (
              <Input testID="expense-amount" numeric value={amount} onChangeText={setAmount} placeholder="0.00" accessibilityLabel={msg('fin.form.amount')} />
            )}
          </View>
          {stage === 'planned' ? (
            <Chip testID="expense-unknown" on={unknown} onPress={() => setUnknown((u) => !u)}>
              {msg('fin.form.amountUnknown')}
            </Chip>
          ) : null}
        </View>
        {showErrors && problems.includes('amount-required') ? <Note tone="reject" testID="err-amount-required">{msg('fin.form.err.amount-required')}</Note> : null}
        {showErrors && problems.includes('amount-invalid') ? <Note tone="reject" testID="err-amount-invalid">{msg('fin.form.err.amount-invalid')}</Note> : null}
      </View>

      <View style={{ gap: t.space.xs }}>
        <Label hint={msg('fin.form.dateHint', { shown: formatDate(date) })}>{msg('fin.form.date')}</Label>
        <Input testID="expense-date" value={date} onChangeText={setDate} placeholder="2026-09-28" accessibilityLabel={msg('fin.form.date')} />
        {showErrors && problems.includes('date-required') ? <Note tone="reject" testID="err-date-required">{msg('fin.form.err.date-required')}</Note> : null}
      </View>

      <View style={{ gap: t.space.xs }}>
        <Label>{msg('fin.form.stage')}</Label>
        <ChipRow>
          {STAGES.map((s) => (
            <Chip key={s} testID={`expense-stage-${s}`} on={stage === s} onPress={() => setStage(s)}>
              {msg(`fin.stage.${s}`)}
            </Chip>
          ))}
        </ChipRow>
      </View>
      </>
      )}

      <View style={{ gap: t.space.xs }}>
        <Label>{msg('fin.form.category')}</Label>
        <ChipRow>
          {state.categories.map((c) => (
            <Chip key={c.id} testID={`expense-cat-${c.id}`} on={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}>
              {c.name}
            </Chip>
          ))}
          <Chip testID="expense-cat-add" onPress={() => { setAddingCat('add'); setCatName(''); }}>{msg('fin.form.addCategory')}</Chip>
          {categoryId ? (
            <Chip testID="expense-cat-rename" onPress={() => { setAddingCat('rename'); setCatName(state.categories.find((c) => c.id === categoryId)?.name ?? ''); }}>
              {msg('fin.form.renameCategory')}
            </Chip>
          ) : null}
        </ChipRow>
        {addingCat ? (
          <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Input testID="expense-cat-name" value={catName} onChangeText={setCatName} placeholder={msg('fin.form.categoryPlaceholder')} />
            </View>
            <Button testID="expense-cat-save" variant="primary" onPress={() => void saveCategory()}>{msg('common.save')}</Button>
          </View>
        ) : null}
      </View>

      <View style={{ gap: t.space.xs }}>
        <Label hint={existing ? undefined : msg('fin.form.payerHint')}>{msg('fin.form.payer')}</Label>
        <PayerPicker testID="expense-payer" value={payer} onChange={setPayer} extra={knownPayers} allowNone />
        {owedPreview ? <Note tone="warn" testID="owed-preview">{owedPreview}</Note> : null}
      </View>

      <View style={{ gap: t.space.xs }}>
        <Label>{msg('fin.form.item')}</Label>
        <Input testID="expense-item" value={item} onChangeText={setItem} placeholder={msg('fin.form.itemPlaceholder')} />
      </View>

      <View style={{ gap: t.space.xs }}>
        <Label>{msg('fin.form.note')}</Label>
        <Input testID="expense-note" multiline value={note} onChangeText={setNote} placeholder={msg('fin.form.notePlaceholder')} />
      </View>

      {failed ? <Note tone="reject" testID="save-failed">{msg('fin.form.saveFailed')}</Note> : null}

      <Button testID="expense-save" variant="primary" disabled={saving} onPress={() => void inFlight.run(save)}>
        {msg('fin.form.save')}
      </Button>

      {existing && existing.history.length > 1 ? (
        <View style={{ gap: t.space.xxs }} testID="expense-history">
          <Label>{msg('fin.form.history')}</Label>
          <Note>
            {existing.history.map((h) => msg(`fin.stage.${h.stage}`)).filter((s, i, a) => i === 0 || a[i - 1] !== s).join(' → ')}
          </Note>
        </View>
      ) : null}

      {existing && !existing.deleted && !ownerShare ? (
        confirmDelete ? (
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            <Button testID="expense-delete-cancel" onPress={() => setConfirmDelete(false)}>{msg('fin.form.cancel')}</Button>
            <Button testID="expense-delete-confirm" variant="destructive" onPress={() => void setDeleted(true)}>{msg('fin.form.deleteConfirm')}</Button>
          </View>
        ) : (
          <Button testID="expense-delete" variant="destructive" onPress={() => setConfirmDelete(true)}>{msg('fin.form.delete')}</Button>
        )
      ) : null}
    </ScrollView>
  );
}

/** Back to where the user came from — replacing would stack a second copy of that screen. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace(LIST);
}
