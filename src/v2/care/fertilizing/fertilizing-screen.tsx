/**
 * ใส่ปุ๋ย (E16-S02/S03, mockup v3 "B+", D-94/D-95): the main page (date · fertilizer and split ·
 * zones and reasons · save), the full-page fertilizer list where the split lives inside each card,
 * and the full page for zones and reasons. One route; the pages are views of one screen so what is
 * picked is kept while moving between them. Saving writes one `fertilizing_recorded` (new) or one
 * `fertilizing_changed` with only the fields that changed (edit).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { checkFertilizing, projectFertilizing, type Fertilizing } from '../../../core/finance/fertilizing';
import { initEditor, toFields, type EditorState } from '../../../core/finance/fertilizing-editor';
import { reasonLabel } from '../../../core/finance/fertilizer';
import { projectFinance } from '../../../core/finance/ledger';
import { todayIso } from '../../../core/finance/money';
import type { FertilizingFields, FertilizingZone, FinanceEvent, FinancePayload, Payer } from '../../../core/finance/types';
import type { EventId } from '../../../core/types';
import { activeZones, filterPeople } from '../../../core/master';
import { useFinance } from '../../../finance/use-finance';
import { useInFlight } from '../../../finance/use-in-flight';
import { useT } from '../../../i18n';
import { newId } from '../../../lib/id';
import { useSyncStatus } from '../../../sync/use-sync-status';
import { useTheme } from '../../../theme';
import { AppText, CTA, DatePickerSheet, PinnedActions, ScreenHeader, TextLink } from '../../../ui';
import { useMaster } from '../../farm/pieces';
import { ConfirmSheet } from '../../money/order-detail/parts';
import { ORDER_LIST } from './routes';
import { CardsPage } from './cards-page';
import { MainRows } from './main-rows';
import { WherePage } from './where-page';

export function FertilizingScreen() {
  const { id, fromOrder } = useLocalSearchParams<{ id?: string; fromOrder?: string }>();
  const fin = useFinance();
  const master = useMaster();
  const sync = useSyncStatus();
  const msg = useT();
  const t = useTheme();
  const tappers: Payer[] = master.state ? filterPeople(master.state.people, 'tapper').map((p) => ({ id: p.id, name: p.name })) : [];
  const zones: FertilizingZone[] = master.state
    ? master.state.properties.filter((p) => !p.deleted).flatMap((p) => activeZones(master.state!, p.id).map((z) => ({ zoneId: z.id, zoneName: z.name })))
    : [];
  if (!fin.events || !master.state) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface }}>
        <ScreenHeader title={msg('fz.title')} back={{ label: msg('v2.back'), onPress: leave, testID: 'fz-back' }} sync={sync} />
        <AppText variant="bodySm" style={{ padding: t.space.lg }}>{msg('fz.loading')}</AppText>
      </View>
    );
  }
  return (
    <FertilizingView
      events={fin.events}
      tappers={tappers}
      zones={zones}
      recordId={id ?? null}
      fromOrder={fromOrder ?? null}
      today={todayIso()}
      write={fin.write}
      sync={sync}
      onDone={leave}
      onBack={leave}
      onOrders={() => router.push(ORDER_LIST)}
    />
  );
}

type Page = 'main' | 'cards' | 'where';

export function FertilizingView({
  events,
  tappers,
  zones,
  recordId,
  fromOrder,
  today,
  write,
  sync,
  onDone,
  onBack,
  onOrders,
}: {
  events: readonly FinanceEvent[];
  /** Active tappers (people with the tapper role). */
  tappers: readonly Payer[];
  zones: readonly FertilizingZone[];
  /** null = a new fertilizing. */
  recordId: string | null;
  /** "ใส่ปุ๋ยจากใบนี้": the order whose cards start chosen (RM-1). */
  fromOrder: string | null;
  today: string;
  write: (targetId: string, base: EventId | null, payload: FinancePayload) => Promise<FinanceEvent>;
  sync?: ReturnType<typeof useSyncStatus>;
  onDone: () => void;
  onBack: () => void;
  onOrders: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const inFlight = useInFlight();
  const state = useMemo(() => projectFinance(events), [events]);
  // "ในสต็อก" leaves this record's own sacks out (FZ-9).
  const projection = useMemo(() => projectFertilizing(events, state.expenses, { exclude: recordId ?? undefined }), [events, state.expenses, recordId]);
  const record: Fertilizing | null = useMemo(
    () => (recordId ? (projectFertilizing(events, state.expenses).records.find((r) => r.id === recordId) ?? null) : null),
    [events, state.expenses, recordId],
  );
  const catPct = state.categories.find((c) => c.id === 'cat-fertilizer')?.workerPct ?? 50;

  const preselect = useMemo(() => (fromOrder ? state.expenses.filter((x) => !x.deleted && x.orderId === fromOrder).map((x) => x.id) : []), [fromOrder, state.expenses]);
  const startEditor = (): EditorState => initEditor({ cards: projection.cards, tappers, record, preselect });
  const [chosen, setChosen] = useState<EditorState>(startEditor);
  const [date, setDate] = useState(record?.date ?? today);
  const [where, setWhere] = useState<{ zones: readonly FertilizingZone[]; reasons: readonly string[] }>({ zones: record?.zones ?? [], reasons: record?.reasons ?? [] });
  const [page, setPage] = useState<Page>('main');
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState<'delete' | null>(null);
  const [failed, setFailed] = useState(false);
  // The lines are written only when the fertilizer page was applied: rebuilding them from the cards as they are now
  // (a new delivery on the card, a renamed tapper) must not rewrite them on a zone-only save (review #188 N1).
  const [linesTouched, setLinesTouched] = useState(false);
  const gone = !!record?.deleted;

  const used = chosen.cards.filter((c) => c.sacks > 0);
  const fields = (): FertilizingFields => {
    const f = toFields(chosen, { date, zones: where.zones, reasons: where.reasons, note: record?.note ?? '' });
    // The category % at the time of saving is kept per tapper, so a later change of the default does not move this debt.
    const takers = new Set(f.lines.flatMap((l) => l.takes.map((x) => x.worker.id)));
    const pct = Object.fromEntries([...takers].map((w) => [w, chosen.pct[w] ?? catPct]));
    return { ...f, pct };
  };

  const run = async (targetId: string, base: EventId | null, payload: FinancePayload) => {
    setFailed(false);
    try {
      await write(targetId, base, payload);
      return true;
    } catch (err) {
      console.error('Fertilizing could not be stored.', err);
      setFailed(true);
      return false;
    }
  };

  const save = async () => {
    const f = fields();
    if (checkFertilizing(f, today).length) {
      setFailed(true);
      return;
    }
    if (!record) {
      if (await run(`fz-${newId('')}`, null, { t: 'fertilizing_recorded', fields: f })) onDone();
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const k of ['date', 'lines', 'pct', 'settle', 'zones', 'reasons'] as const) {
      if ((k === 'lines' || k === 'pct' || k === 'settle') && !linesTouched) continue;
      const before = k === 'lines' ? record.lines.map((l) => ({ sources: l.sources, sacks: l.sacks, takes: l.takes, rest: l.rest })) : record[k];
      if (JSON.stringify(before) !== JSON.stringify(f[k])) patch[k] = f[k];
    }
    if (!Object.keys(patch).length || (await run(record.id, record.headEventId, { t: 'fertilizing_changed', patch }))) onDone();
  };

  if (page === 'cards') {
    return (
      <CardsPage
        initial={chosen}
        projection={projection}
        events={events}
        expenses={state.expenses}
        recordId={recordId}
        date={date}
        catPct={catPct}
        sync={sync}
        onApply={(s) => {
          setChosen(s);
          setLinesTouched(true);
          setPage('main');
        }}
        onClose={() => setPage('main')}
        onOrders={onOrders}
      />
    );
  }
  if (page === 'where') {
    return (
      <WherePage
        zones={zones}
        initial={where}
        fin={{ events, state, write }}
        sync={sync}
        onDone={(w) => {
          setWhere(w);
          setPage('main');
        }}
        onBack={() => setPage('main')}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('fz.title')} subtitle={msg('fz.subtitle')} back={{ label: msg('v2.back'), onPress: onBack, testID: 'fz-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.xl }}>
        <MainRows
          date={date}
          today={today}
          used={used}
          where={where}
          record={record}
          onDate={() => setPicking(true)}
          onFerts={() => setPage('cards')}
          onWhere={() => setPage('where')}
          reasonName={(r) => reasonLabel(r, state.fertOptions)}
          readOnly={gone}
        />
        {gone ? (
          <View testID="fz-deleted" style={{ gap: t.space.sm, padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.warnSunk }}>
            <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg('fz.deletedNote')}</AppText>
            <View style={{ flexDirection: 'row' }}>
              <TextLink testID="fz-restore" onPress={() => void inFlight.run(async () => void ((await run(record!.id, record!.headEventId, { t: 'fertilizing_changed', patch: { deleted: false } })) && onDone()))}>
                {msg('fz.restore')}
              </TextLink>
            </View>
          </View>
        ) : null}
        {failed ? <AppText testID="fz-failed" style={{ color: t.color.reject }}>{msg('fz.saveFailed')}</AppText> : null}
        {record && !gone ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <TextLink testID="fz-delete" onPress={() => setSheet('delete')}>{msg('fz.delete')}</TextLink>
          </View>
        ) : null}
      </ScrollView>
      {gone ? null : (
        <PinnedActions>
          <CTA testID="fz-save" disabled={used.length === 0 || inFlight.busy} onPress={() => void inFlight.run(save)}>{msg('fz.save')}</CTA>
        </PinnedActions>
      )}
      <DatePickerSheet open={picking} onClose={() => setPicking(false)} value={date} max={today} title={msg('fz.date')} testID="fz-date-sheet" onChange={(d) => setDate(d)} />
      {sheet === 'delete' && record ? (
        <ConfirmSheet
          testID="fz-delete-sheet"
          title={msg('fz.delete.title')}
          body={msg('fz.delete.body')}
          confirmLabel={msg('fz.delete.yes')}
          cancelLabel={msg('fz.delete.no')}
          failed={failed ? msg('fz.saveFailed') : undefined}
          onConfirm={() => void inFlight.run(async () => void ((await run(record.id, record.headEventId, { t: 'fertilizing_changed', patch: { deleted: true } })) && onDone()))}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/v2');
}
