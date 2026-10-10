/**
 * The counter screen — the one the buyer is looking at.
 *
 * Three tabs (finding F-19): Count / Pile / Log. When any tab other than Count
 * is active a mini-count stays in the topbar: leaving the Count tab must never
 * mean losing sight of the number.
 *
 * Pile/zone/sale lifecycle (S13, docs/ux/pile-zone-sale-lifecycle.md): closing
 * a pile hands off to `PileClosedTransition`'s decision point rather than a
 * bare "continue"; closing a zone force-closes any pile still counting in it,
 * named in the warning first; closing the sale is a real event, not just a
 * navigation, and reopening anything is a typed-reason, publicly-shown act —
 * never a silent undo.
 */

import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, CardLabel, Pill, Tabs, TopBar, cardStyle } from '../../../components/chrome';
import { HoldStage } from '../../../components/HoldStage';
import { PileClosedTransition } from '../../../components/PileClosedTransition';
import { BasketEditor } from '../../../components/BasketEditor';
import { Card as FarmCard } from '../../../components/farm-ui';
import { MoneyReasonPrompt } from '../../../components/MoneyReasonPrompt';
import { RecorderView } from '../../../components/RecorderView';
import { ReopenPrompt } from '../../../components/ReopenPrompt';
import { ShortBasketPanel } from '../../../components/ShortBasketPanel';
import { ZeroTareGate } from '../../../components/ZeroTareGate';
import { ZonePileSwitcher } from '../../../components/ZonePileSwitcher';
import { canCount, canReopenPile, lastAnnounceOk, pilesStillCounting } from '../../../core/project';
import { compareEvents } from '../../../core/order';
import { formatBaht, formatKg } from '../../../core/settle';
import { basketNetG, lastLiveBasket, liveBaskets, pileTotals, saleTotals, zoneTotals } from '../../../core/totals';
import type { BasketEvent, Pile, SaleEvent, SaleState, Zone } from '../../../core/types';
import { useT, type Translate } from '../../../i18n';
import { announceCount } from '../../../speech/announcer';
import { speaker } from '../../../speech/speaker';
import { useSpeech } from '../../../speech';
import { formatThaiDate, saleSettings, tapperOn, todayIso, type MasterState } from '../../../core/master';
import { basketList, nextBasketNo, pointSetupPayloads, recorderFigures, sameSequence, saleNumbering } from '../../../core/sale-points';
import { canComplete } from '../../../core/sale-status';
import { expectedReadingG, gateNeeded, saleSkewG } from '../../../core/scale-check';
import { readHoldMs } from '../../../store/hold-preference';
import { peopleStore } from '../../../store/people';
import { store as eventStore } from '../../../store/store';
import { useSale } from '../../../store/SaleProvider';
import { useTheme, useThemeControls } from '../../../theme';

type TabKey = 'count' | 'pile' | 'log';

/**
 * Message ids, resolved at the call site rather than here. `Tabs` stays a
 * presentational component that renders whatever string it is handed — it has
 * no business knowing about locales, and a module-level constant cannot call a
 * hook to resolve one anyway.
 */
const TABS = [
  { key: 'count' as const, label: 'tabs.count' as const },
  { key: 'pile' as const, label: 'tabs.pile' as const },
  { key: 'log' as const, label: 'tabs.log' as const },
];

/**
 * What's on top of the stage right now, besides the ordinary tab content.
 * Reopening the sale itself lives on the settlement screen, not here — that's
 * the screen you land on once the sale closes, and the hard boundary
 * (docs/ux/pile-zone-sale-lifecycle.md) belongs where it's actually crossed.
 */
type Overlay =
  | { kind: 'none' }
  | { kind: 'switcher' }
  | { kind: 'reopen-pile'; pileId: string }
  | { kind: 'reopen-zone'; zoneId: string };

export default function CounterScreen() {
  // This device's hold time (E03-S07, D-7) — read once per visit to the counter.
  const [deviceHoldMs] = useState(readHoldMs);
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { toggle, scheme } = useThemeControls();
  const { speechOn, setSpeechOn } = useSpeech();
  const { saleId, events, state, append, ready } = useSale();
  const [tab, setTab] = useState<TabKey>('count');
  const [shortOpen, setShortOpen] = useState(false);
  const [shortReadingG, setShortReadingG] = useState(0);
  // E04-S02: the point-picking screen opens the counter on the point it chose.
  const { pile: pileParam } = useLocalSearchParams<{ pile?: string }>();
  const [selectedPileId, setSelectedPileId] = useState<string | null>(pileParam ?? null);
  // Farm master data, for numbering baskets at weighing points (E04-S01).
  const [master, setMaster] = useState<MasterState | null>(null);
  useEffect(() => {
    peopleStore.state().then(setMaster);
  }, []);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [confirmCloseSale, setConfirmCloseSale] = useState(false);
  const [confirmCloseZone, setConfirmCloseZone] = useState(false);
  const [confirmClosePile, setConfirmClosePile] = useState(false);

  // The pile in view: whatever the operator explicitly picked (switcher),
  // falling back to the one being counted, falling back to the first pile —
  // same default as before S13, now overridable.
  const fallbackPile = state.piles.find((p) => p.status === 'counting') ?? state.piles[0];
  const pile = (selectedPileId && state.piles.find((x) => x.id === selectedPileId)) || fallbackPile;
  const zone = state.zones.find((z) => z.id === pile?.zoneId);

  // Lock the very first auto-selected pile to its id (React's "adjust state
  // during render" pattern — no ref, no effect). Without this, closing the
  // pile currently in view would change its status away from 'counting' and
  // the fallback above would silently re-target a DIFFERENT counting pile on
  // the very same render — the decision point would never appear, because
  // the screen would already be looking at something else.
  if (!selectedPileId && fallbackPile) {
    setSelectedPileId(fallbackPile.id);
  }

  const totals = pile ? pileTotals(events, pile.id) : null;
  const countable = pile ? canCount(state, pile.id) : false;
  const lastBasket = pile ? lastLiveBasket(events, pile.id) : null;

  // E04-S03: at a weighing point the gate follows the group's check mode.
  // When this point needs no check, record that it was skipped and open it
  // (SALE-6) — never silently. Piles from the old setup flow always ask.
  const isPoint = !!master && !!pile && master.points.some((p) => p.id === pile.id);
  const skipGate =
    ready && isPoint && pile?.status === 'not-started' && !gateNeeded(state, events, pile.id, saleSettings(master!).zeroCheck);
  useEffect(() => {
    if (!skipGate || !pile || !master) return;
    append({ kind: 'sys', payload: { t: 'gate_skipped', pileId: pile.id, mode: saleSettings(master).zeroCheck } });
    append({ kind: 'sys', payload: { t: 'ready', pileId: pile.id } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per point that needs no check; `append` and the log are read at that moment.
  }, [skipGate, pile?.id]);
  const [waiting, setWaiting] = useState(false);
  const skewG = saleSkewG(events);
  // E04-S05: recorder mode at a weighing point; public mode is the classic stage.
  const [publicMode, setPublicMode] = useState(false);
  // E04-S09: the basket being edited from the recorder's list.
  const [editingId, setEditingId] = useState<string | null>(null);
  // E04-S11: a money-changing edit on a Completed sale waits here for its reason.
  const [moneyGate, setMoneyGate] = useState<{ targetId: string; run: () => void } | null>(null);
  const [confirmCancelSale, setConfirmCancelSale] = useState(false);
  const [now] = useState(() => Date.now());
  // Events of this sale not sent yet (SYNC-3) — re-read whenever the log grows.
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let live = true;
    eventStore.pending().then((all) => live && setPending(all.filter((e) => e.saleId === saleId).length));
    return () => {
      live = false;
    };
  }, [events.length, saleId]);

  if (!ready || !pile || !zone) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>{msg('counter.loading')}</Text>
      </View>
    );
  }

  // With a skew accepted, "the scale should read" includes it (D-75).
  const expected = skewG
    ? msg('gate.expectedSkew', {
        tare: formatKg(pile.tareG),
        std: formatKg(pile.stdNetG),
        skew: formatKg(skewG),
        expected: formatKg(expectedReadingG(pile.stdNetG, pile.tareG, skewG)),
      })
    : msg('gate.expected', {
        tare: formatKg(pile.tareG),
        std: formatKg(pile.stdNetG),
        expected: formatKg(pile.tareG + pile.stdNetG),
      });

  // The count about to exist once this basket lands — `totals` here is a
  // closure over state from before the append below, so this is the number
  // that needs speaking, not the one currently on screen (FR-11.3).
  const pointFields = (): { pointId?: string; basketNo?: number } => {
    // A pile that is a master-data weighing point gets its point and number
    // (E04-S01, SALE-10); a pile from the old setup flow stays as it was.
    if (!master || !master.points.some((p) => p.id === pile.id)) return {};
    const mode = saleNumbering(events, saleSettings(master).numbering);
    const day = todayIso(state.startedTs ?? now);
    return { pointId: pile.id, basketNo: nextBasketNo(events, pile.id, mode, (id) => tapperOn(master, id, day)) };
  };
  const nextCount = (totals?.baskets ?? 0) + 1;

  const onCount = () => {
    const point = pointFields();
    append({ kind: 'accept', pileId: pile.id, input: 'hold', netG: pile.stdNetG, tareG: pile.tareG, ...point });
    // At a point the spoken number is the basket's own number (D-79), else the pile count.
    if (speechOn) announceCount(point.basketNo ?? nextCount, speaker, append);
  };

  const onReject = (heldMs: number) =>
    append({ kind: 'reject', pileId: pile.id, input: 'hold', reason: 'released-early', heldMs });

  const doUndo = (target: BasketEvent | null = lastBasket) => {
    if (!target) return;
    append({
      kind: 'correction',
      pileId: target.pileId,
      targetId: target.id,
      mode: 'undo-last',
      reason: msg('counter.mistapReason'),
    });
    setConfirmUndo(false);
  };

  const openShort = () => {
    setShortReadingG(pile.tareG + pile.stdNetG);
    setShortOpen(true);
  };

  const confirmShort = () => {
    const point = pointFields();
    append({ kind: 'short', pileId: pile.id, readingG: shortReadingG, tareG: pile.tareG, ...(skewG ? { skewG } : {}), ...point });
    if (speechOn) announceCount(point.basketNo ?? nextCount, speaker, append);
    setShortOpen(false);
  };

  const onZeroChecked = (ok: boolean, readingG: number) => {
    append({ kind: 'sys', payload: { t: 'zero_check', pileId: pile.id, ok, readingG } });
    // At a weighing point a failed check carries on with the skew (D-75).
    if (!ok && isPoint) append({ kind: 'sys', payload: { t: 'skew_accepted', pileId: pile.id, skewG: readingG } });
  };

  const onWait = () => {
    append({ kind: 'sys', payload: { t: 'scale_wait', pileId: pile.id } });
    setWaiting(true);
  };

  const onTareConfirmed = (confirmedTareG: number) =>
    append({ kind: 'sys', payload: { t: 'tare_confirmed', pileId: pile.id, tareG: confirmedTareG } });

  const onGateReady = () => append({ kind: 'sys', payload: { t: 'ready', pileId: pile.id } });

  // FR-11.11: the on/off switch is the live device preference (reactive
  // everywhere, exactly like theme/locale — see src/speech/index.tsx). The
  // `speech_set` event is an audit-trail entry, not the gate: it is what
  // lets the log explain, later, why a stretch of the sale has no
  // `announced` events, the same reasoning as `clock_anomaly` and the S23
  // gate-skip event.
  const onToggleSpeech = () => {
    const next = !speechOn;
    setSpeechOn(next);
    append({ kind: 'sys', payload: { t: 'speech_set', on: next } });
  };
  const speechDegraded = speechOn && lastAnnounceOk(events) === false;

  const pickPile = (pileId: string) => {
    setSelectedPileId(pileId);
    setOverlay({ kind: 'none' });
    setTab('count');
  };

  // ── Decision point after a pile closes ──────────────────────────────────
  const nextPileInZone = state.piles.find((p) => p.zoneId === zone.id && p.status === 'not-started');

  // Closing the pile you're actively counting into is the single most
  // frequent close action in the whole lifecycle, and touches nothing but
  // itself — unlike zone-close, it has no other pile or worker to warn about.
  // It belongs beside undo/short on the live-counting row it was previously
  // missing from, not one tab away, matching how PilePanel's own equivalent
  // button already behaves.
  const doClosePile = () => {
    if (!pile) return;
    append({ kind: 'sys', payload: { t: 'pile_closed', pileId: pile.id, forced: false } });
    setConfirmClosePile(false);
  };

  const doCloseSale = () => {
    if (state.status === 'open') append({ kind: 'sys', payload: { t: 'sale_closed' } });
    setConfirmCloseSale(false);
    router.push({ pathname: '/sale/[id]/settlement', params: { id: saleId } });
  };

  // Force-closing every pile still counting in a zone is destructive and
  // irreversible-except-by-an-appended-reopen, so it goes through the same
  // two-step, names-every-pile confirm the Pile tab's `close-zone` uses. It
  // was previously wired straight to the append: one tap from the decision
  // point silently stopped every other pile in the zone, which is exactly
  // the silent close docs/ux/pile-zone-sale-lifecycle.md §4/§7.1 rules out.
  const closeZoneFromTransition = () => {
    const stillCounting = pilesStillCounting(state, zone.id);
    append({
      kind: 'sys',
      payload: { t: 'zone_closed', zoneId: zone.id, forcedPiles: stillCounting.map((p) => p.id) },
    });
    setConfirmCloseZone(false);
  };

  const closeSaleOverlay = confirmCloseSale ? (
    <CloseSaleConfirmOverlay state={state} events={events} onConfirm={doCloseSale} onCancel={() => setConfirmCloseSale(false)} />
  ) : null;

  const day = todayIso(state.startedTs ?? now);
  const figures =
    isPoint && master
      ? recorderFigures(events, master, day, pile.id, saleNumbering(events, saleSettings(master).numbering), state.price?.satangPerKg ?? null)
      : null;

  // At a point, undo means the last basket of the number sequence, in either
  // mode (review S3); a finished sale is only edited from the recorder's list.
  const sequenceLast = figures ? ((events.find((e) => e.id === figures.lastId) as BasketEvent | undefined) ?? null) : lastBasket;
  const classicUndo = figures && state.saleStatus !== 'draft' ? null : sequenceLast;

  if (figures && master && pile.status === 'counting' && !waiting && !publicMode) {
    const tapperId = tapperOn(master, pile.id, day);
    const pointName = (id: string) => master.points.find((p) => p.id === id)?.name ?? '';
    const numbering = saleNumbering(events, saleSettings(master).numbering);
    // "ย้อนกลับ" undoes the last basket of this number sequence, wherever it was weighed.
    const undoTarget = sequenceLast;
    const editing = editingId ? (events.find((e) => e.id === editingId) as BasketEvent | undefined) : undefined;
    const rows = basketList(events);
    const editingRow = rows.find((r) => r.id === editingId);
    const saleDayPoints = master.points.filter((p) => !p.deleted && master.properties.some((f) => f.id === p.propertyId && !f.deleted));

    // After Completed, an edit that changes money asks why first and flags the
    // payment for a recheck (SALE-21); a draft edits straight away.
    const guardMoney = (targetId: string, run: () => void) => {
      if (state.saleStatus === 'completed') setMoneyGate({ targetId, run });
      else run();
    };
    const confirmMoney = (reason: string) => {
      if (!moneyGate) return;
      append({ kind: 'sys', payload: { t: 'money_edit', reason, targetId: moneyGate.targetId } });
      moneyGate.run();
      setMoneyGate(null);
    };
    const draft = state.saleStatus === 'draft';

    // An edit is a void of the old basket plus a new one that names it (E04-S09):
    // same number, same kind; the original stays in the log.
    const saveEdit = (change: { netG: number; pointId: string }) => {
      if (!editing || !editingRow) return;
      if (change.netG === editingRow.netG && change.pointId === editingRow.pointId) return setEditingId(null);
      guardMoney(editing.id, () => applyEdit(change));
    };
    const applyEdit = ({ netG, pointId }: { netG: number; pointId: string }) => {
      if (!editing || editing.basketNo === undefined) return;
      // Voided meanwhile (another device), or nothing changed: write nothing.
      if (editingRow?.status !== 'live' || (netG === editingRow.netG && pointId === editingRow.pointId)) {
        setEditingId(null);
        return;
      }
      // A new pile takes the source pile's standard weights, never the edited basket's (review S2).
      const source = state.piles.find((p) => p.id === editing.pileId) ?? pile;
      const pair = { pairId: '', netG: source.stdNetG, basketG: source.tareG };
      for (const payload of pointSetupPayloads(state, master, pointId, pair)) append({ kind: 'sys', payload });
      append({ kind: 'correction', pileId: editing.pileId, targetId: editing.id, mode: 'void', reason: msg('edit.reason') });
      const at = { pileId: pointId, pointId, basketNo: editing.basketNo, editOf: editing.id };
      if (editing.kind === 'accept') append({ kind: 'accept', input: 'edit', netG, tareG: editing.tareG, ...at });
      else append({ kind: 'short', readingG: netG + editing.tareG + (editing.skewG ?? 0), tareG: editing.tareG, ...(editing.skewG ? { skewG: editing.skewG } : {}), ...at });
      setEditingId(null);
    };
    const voidEditing = () => {
      if (!editing) return;
      guardMoney(editing.id, () => {
        append({ kind: 'correction', pileId: editing.pileId, targetId: editing.id, mode: 'void', reason: msg('edit.voidReason') });
        setEditingId(null);
      });
    };
    return (
      <View style={{ flex: 1 }}>
        <RecorderView
          saleDate={formatThaiDate(state.startedTs ?? now, 'be')}
          pending={pending}
          farmName={zone.name}
          pointName={pile.name}
          tapperName={tapperId ? (master.people.find((p) => p.id === tapperId)?.name ?? null) : null}
          figures={figures}
          expectedKg={formatKg(expectedReadingG(pile.stdNetG, pile.tareG, skewG))}
          // New baskets only while Draft; a finished sale is edited from the list (E04-S11).
          hold={{ onCount, onReject, enabled: countable && draft, holdMs: holdMsOverride() ?? deviceHoldMs }}
          status={state.saleStatus}
          menuItems={
            draft
              ? [
                  {
                    testID: 'rec-menu-complete',
                    label: msg('status.complete'),
                    disabled: !canComplete(state),
                    hint: state.price ? undefined : msg('status.needPrice'),
                    onPress: () => append({ kind: 'sys', payload: { t: 'sale_status_set', status: 'completed' } }),
                  },
                  { testID: 'rec-menu-cancel', label: msg('status.cancel'), onPress: () => setConfirmCancelSale(true) },
                ]
              : []
          }
          overlay={
            moneyGate ? (
              <MoneyReasonPrompt onConfirm={confirmMoney} onCancel={() => setMoneyGate(null)} />
            ) : confirmCancelSale ? (
              <FarmCard testID="cancel-sale">
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                  {msg('status.cancelTitle')}
                </Text>
                <Text testID="cancel-sale-body" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
                  {msg('status.cancelBody')}
                </Text>
                <View style={{ flexDirection: 'row', gap: t.space.sm }}>
                  <Button testID="cancel-sale-no" onPress={() => setConfirmCancelSale(false)}>
                    {msg('common.cancel')}
                  </Button>
                  <Button
                    testID="cancel-sale-confirm"
                    variant="destructive"
                    onPress={() => {
                      append({ kind: 'sys', payload: { t: 'sale_status_set', status: 'cancelled' } });
                      setConfirmCancelSale(false);
                    }}
                  >
                    {msg('status.cancelConfirm')}
                  </Button>
                </View>
              </FarmCard>
            ) : undefined
          }
          baskets={rows.map((r) => ({ ...r, pointName: pointName(r.pointId) }))}
          onRowPress={setEditingId}
          editor={
            editing && editingRow ? (
              <BasketEditor
                key={editing.id}
                basketNo={editingRow.basketNo}
                netG={editingRow.netG}
                pointId={editingRow.pointId}
                // A move stays inside the basket's own number sequence, so no number
                // is ever doubled or taken from someone else's (review S1, SALE-10).
                points={saleDayPoints
                  .filter((p) => sameSequence(p.id, editingRow.pointId, numbering, (id) => tapperOn(master, id, day)))
                  .map((p) => ({ id: p.id, name: p.name }))}
                by={msg('edit.by', { device: editingRow.by.deviceId, time: new Date(editingRow.by.ts).toLocaleTimeString('th-TH') })}
                onSave={saveEdit}
                onVoid={voidEditing}
                onCancel={() => setEditingId(null)}
              />
            ) : undefined
          }
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          // Opens on this farm and tapper, so another of their points is one tap (AC ≤ 2 taps).
          onSwitch={() =>
            router.replace({
              pathname: '/sale/[id]/points',
              params: { id: saleId, switch: '1', farm: zone.id, ...(tapperId ? { tapper: tapperId } : {}) },
            })
          }
          onShort={openShort}
          onUndo={() => setConfirmUndo(true)}
          onPublic={() => setPublicMode(true)}
          onFinish={() => setConfirmCloseSale(true)}
          canUndo={!!undoTarget}
          below={
            shortOpen ? (
              <ShortBasketPanel
                tareG={pile.tareG}
                stdNetG={pile.stdNetG}
                readingG={shortReadingG}
                onChangeReading={setShortReadingG}
                onConfirm={confirmShort}
                onCancel={() => setShortOpen(false)}
              />
            ) : confirmUndo && undoTarget ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, padding: t.space.sm }}>
                <UndoConfirmRow
                  event={undoTarget}
                  onConfirm={() => {
                    setConfirmUndo(false);
                    guardMoney(undoTarget.id, () => doUndo(undoTarget));
                  }}
                  onCancel={() => setConfirmUndo(false)}
                />
              </View>
            ) : undefined
          }
        />
        {closeSaleOverlay}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={`${state.parties?.farmName ?? ''} ▸ ${zone.name} ▸ ${pile.name}`}
        right={
          <>
            {tab !== 'count' && totals ? (
              <Pill tone="count" testID="mini-count">{msg('counter.miniCount', { n: totals.baskets })}</Pill>
            ) : null}
            <Pill tone={countable ? 'accept' : 'neutral'} dot={countable ? 'filled' : 'hollow'}>
              {countable ? msg('counter.counting') : msg('counter.stopped')}
            </Pill>
            {isPoint && publicMode ? (
              // A full-size target: the only way back to the recorder (review S7).
              <Button testID="public-exit" variant="primary" onPress={() => setPublicMode(false)}>
                {msg('rec.publicExit')}
              </Button>
            ) : null}
            {state.clockSuspect ? <Pill tone="warn">{msg('counter.clockSuspect')}</Pill> : null}
            {speechDegraded ? <Pill tone="warn">{msg('counter.speechDegraded')}</Pill> : null}
            <Pill testID="open-switcher">
              <Text onPress={() => setOverlay({ kind: 'switcher' })}>{`${msg('counter.switcher')} ▾`}</Text>
            </Pill>
            <Pill testID="speech-toggle" tone={speechOn ? 'accept' : 'neutral'} dot={speechOn ? 'filled' : 'hollow'}>
              <Text onPress={onToggleSpeech}>
                {speechOn ? msg('common.speechOn') : msg('common.speechOff')}
              </Text>
            </Pill>
            <Pill testID="theme-toggle">
              <Text onPress={toggle}>
                {scheme === 'light' ? `◐ ${msg('common.themeLight')}` : `◑ ${msg('common.themeDark')}`}
              </Text>
            </Pill>
          </>
        }
      />

      <Tabs tabs={TABS.map((x) => ({ key: x.key, label: msg(x.label) }))} active={tab} onChange={setTab} />

      {tab === 'count' ? (
        <>
          {pile.status === 'closed' ? (
            <PileClosedTransition
              pileName={pile.name}
              baskets={totals?.baskets ?? 0}
              netG={totals?.netG ?? 0}
              hasNextPileInZone={!!nextPileInZone}
              onNextPile={() => nextPileInZone && pickPile(nextPileInZone.id)}
              onSwitchZone={() => setOverlay({ kind: 'switcher' })}
              onCloseZone={() => setConfirmCloseZone(true)}
              onCloseSale={() => setConfirmCloseSale(true)}
            />
          ) : waiting ? (
            // D-75: the operator chose to wait for another scale; back to the check after.
            <View testID="scale-waiting" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space.md, padding: t.space.xl }}>
              <Text style={{ fontSize: t.font.size.figure, color: t.color.action }}>⌛</Text>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                {msg('gate.waiting')}
              </Text>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.inkSoft }}>{msg('gate.waitingBody')}</Text>
              <Button testID="waiting-ok" variant="primary" onPress={() => setWaiting(false)}>
                {msg('gate.waitingOk')}
              </Button>
            </View>
          ) : pile.status === 'not-started' ? (
            <ZeroTareGate
              pileName={pile.name}
              tareG={pile.tareG}
              stdNetG={pile.stdNetG}
              zeroChecked={pile.zeroChecked}
              tareConfirmed={pile.tareConfirmed}
              onZeroChecked={onZeroChecked}
              onTareConfirmed={onTareConfirmed}
              onReady={onGateReady}
              onWait={isPoint ? onWait : undefined}
              skewG={skewG}
            />
          ) : (
            <HoldStage
              // Public mode at a point shows the basket being weighed (D-40, E04-S07).
              count={figures ? figures.currentNo : (totals?.baskets ?? 0)}
              onCount={onCount}
              onReject={onReject}
              enabled={countable && (!figures || state.saleStatus === 'draft')}
              caption={countable ? expected : msg('counter.pileNotReady')}
              holdMs={holdMsOverride() ?? deviceHoldMs}
            />
          )}
          {pile.status === 'counting' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space.sm,
                padding: t.space.xs,
                paddingHorizontal: t.space.sm,
                borderTopWidth: t.border.hair,
                borderTopColor: t.color.rule,
              }}
            >
              {confirmUndo && classicUndo ? (
                <UndoConfirmRow event={classicUndo} onConfirm={() => doUndo(classicUndo)} onCancel={() => setConfirmUndo(false)} />
              ) : (
                <>
                  <Button testID="undo" onPress={() => setConfirmUndo(true)} disabled={!classicUndo}>
                    {`↺ ${msg('counter.undo')}`}
                  </Button>
                  <Button testID="short" onPress={openShort} disabled={!countable || shortOpen}>
                    {`⚖ ${msg('short.open')}`}
                  </Button>
                  <Button
                    testID="row-close-pile"
                    onPress={() => setConfirmClosePile(true)}
                    disabled={!totals?.baskets}
                  >
                    {msg('pile.close')}
                  </Button>
                  <View style={{ flex: 1 }} />
                  <Button testID="to-settlement" variant="destructive" onPress={() => setConfirmCloseSale(true)}>
                    {msg('counter.closeSale')}
                  </Button>
                </>
              )}
            </View>
          ) : null}
          {shortOpen ? (
            <ShortBasketPanel
              tareG={pile.tareG}
              stdNetG={pile.stdNetG}
              readingG={shortReadingG}
              onChangeReading={setShortReadingG}
              onConfirm={confirmShort}
              onCancel={() => setShortOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      {tab === 'pile' ? (
        <PilePanel
          pile={pile}
          zone={zone}
          state={state}
          onCloseZone={() => setOverlay({ kind: 'switcher' })}
          onReopenPile={(pileId) => setOverlay({ kind: 'reopen-pile', pileId })}
          onReopenZone={(zoneId) => setOverlay({ kind: 'reopen-zone', zoneId })}
        />
      ) : null}
      {tab === 'log' ? <LogPanel /> : null}

      {overlay.kind === 'switcher' ? (
        <ZonePileSwitcher state={state} onPick={pickPile} onClose={() => setOverlay({ kind: 'none' })} />
      ) : null}

      {overlay.kind === 'reopen-pile' ? (
        <ReopenPromptOverlay
          targetLabel={state.piles.find((p) => p.id === overlay.pileId)?.name ?? ''}
          consequence={msg('reopen.pileConsequence')}
          onConfirm={(reason) => {
            append({ kind: 'sys', payload: { t: 'pile_reopened', pileId: overlay.pileId, reason } });
            setOverlay({ kind: 'none' });
          }}
          onCancel={() => setOverlay({ kind: 'none' })}
        />
      ) : null}

      {overlay.kind === 'reopen-zone' ? (
        <ReopenPromptOverlay
          targetLabel={state.zones.find((z) => z.id === overlay.zoneId)?.name ?? ''}
          consequence={msg('reopen.zoneConsequence')}
          onConfirm={(reason) => {
            append({ kind: 'sys', payload: { t: 'zone_reopened', zoneId: overlay.zoneId, reason } });
            setOverlay({ kind: 'none' });
          }}
          onCancel={() => setOverlay({ kind: 'none' })}
        />
      ) : null}

      {confirmClosePile && pile ? (
        <ClosePileConfirmOverlay
          pile={pile}
          events={events}
          onConfirm={doClosePile}
          onCancel={() => setConfirmClosePile(false)}
        />
      ) : null}

      {confirmCloseZone ? (
        <CloseZoneConfirmOverlay
          zone={zone}
          state={state}
          events={events}
          onConfirm={closeZoneFromTransition}
          onCancel={() => setConfirmCloseZone(false)}
        />
      ) : null}

      {closeSaleOverlay}
    </View>
  );
}

function ReopenPromptOverlay(props: {
  targetLabel: string;
  consequence: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.color.stage, zIndex: 10 }}>
      <ReopenPrompt {...props} />
    </View>
  );
}

/**
 * Undo has an 8-second window and is meant to stay quick — a full-screen,
 * typed-reason confirm (like reopen's) would defeat that. But it also had
 * ZERO confirmation before this: one tap, no way back except another manual
 * correction. This names exactly what's about to be voided — which basket,
 * what it weighed — inline, in place of the action row, so a second glance
 * is enough without leaving the screen.
 */
function UndoConfirmRow({
  event,
  onConfirm,
  onCancel,
}: {
  event: BasketEvent;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const kindLabel = msg(event.kind === 'accept' ? 'pile.standard' : 'pile.short');
  return (
    <>
      <Text
        testID="undo-confirm-detail"
        style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.reject }}
      >
        {msg('counter.undoDetail', {
          // At a point, the basket's own number (E04-S09); else its log position.
          seq: event.basketNo ?? event.seq,
          kind: kindLabel,
          weight: formatKg(basketNetG(event)),
        })}
      </Text>
      <Button testID="undo-confirm" variant="destructive" onPress={onConfirm}>
        {msg('counter.undoConfirm')}
      </Button>
      <Button testID="undo-cancel" onPress={onCancel}>
        {msg('counter.undoCancel')}
      </Button>
    </>
  );
}

/**
 * Closing the sale had NO confirmation at all before this, from either entry
 * point (the action row's own button, or the decision point after a pile
 * closes) — one tap ended counting for the whole sale. Names the actual
 * scope (zones, piles, baskets, weight so far) rather than a bare "are you
 * sure?", and says plainly that closing does not force-close piles still
 * counting — it only stops them from being countable (`canCount` gates on
 * sale status), which is easy to assume incorrectly otherwise.
 */
/**
 * The live-counting row's "close this pile" confirm. A separate overlay from
 * PilePanel's own inline close-pile card on the Pile tab — same event, same
 * two-step shape, but this entry point is reached from a screen with other
 * live controls around it, so it takes over the screen the same way
 * close-sale's confirm already does, rather than expanding in place.
 */
function ClosePileConfirmOverlay({
  pile,
  events,
  onConfirm,
  onCancel,
}: {
  pile: Pile;
  events: readonly SaleEvent[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const pt = pileTotals(events, pile.id);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.color.stage,
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space.xl,
        gap: t.space.md,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.reject }}>
        {msg('pile.close')}
      </Text>
      <Text
        testID="row-close-pile-detail"
        style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft, textAlign: 'center', maxWidth: 480 }}
      >
        {msg('pile.closeDetail', { name: pile.name, baskets: pt.baskets, weight: formatKg(pt.netG) })}
      </Text>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button testID="row-close-pile-confirm" variant="destructive" onPress={onConfirm}>
          {msg('pile.closeConfirm')}
        </Button>
        <Button testID="row-close-pile-cancel" onPress={onCancel}>
          {msg('common.cancel')}
        </Button>
      </View>
    </View>
  );
}

/**
 * The decision point's "close this zone" confirm. Deliberately the same two
 * steps, the same warning and the same message ids as the Pile tab's
 * `close-zone` — one destructive action reached from two places must not
 * behave differently depending on which one you came in through.
 */
function CloseZoneConfirmOverlay({
  zone,
  state,
  events,
  onConfirm,
  onCancel,
}: {
  zone: SaleState['zones'][number];
  state: SaleState;
  events: readonly SaleEvent[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const zt = zoneTotals(events, state, zone.id);
  const stillCounting = pilesStillCounting(state, zone.id);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.color.stage,
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space.xl,
        gap: t.space.md,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.reject }}>
        {msg('zone.close')}
      </Text>
      <Text
        testID="decision-close-zone-detail"
        style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft, textAlign: 'center', maxWidth: 480 }}
      >
        {msg('zone.closeDetail', { name: zone.name, baskets: zt.baskets, weight: formatKg(zt.netG) })}
      </Text>
      {stillCounting.length > 0 ? (
        <Text
          testID="decision-close-zone-warning"
          style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.warn, textAlign: 'center', maxWidth: 480 }}
        >
          {msg('zone.closeWarning', { n: stillCounting.length, names: stillCounting.map((p) => p.name).join(', ') })}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button testID="decision-close-zone-confirm" variant="destructive" onPress={onConfirm}>
          {msg('zone.closeConfirm')}
        </Button>
        <Button testID="decision-close-zone-cancel" onPress={onCancel}>
          {msg('common.cancel')}
        </Button>
      </View>
    </View>
  );
}

function CloseSaleConfirmOverlay({
  state,
  events,
  onConfirm,
  onCancel,
}: {
  state: SaleState;
  events: readonly SaleEvent[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const st = saleTotals(events);
  const stillCounting = state.piles.filter((p) => p.status === 'counting');

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.color.stage,
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space.xl,
        gap: t.space.md,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.reject }}>
        {msg('counter.closeSaleTitle')}
      </Text>
      <Text
        testID="close-sale-detail"
        style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft, textAlign: 'center', maxWidth: 480 }}
      >
        {msg('counter.closeSaleDetail', {
          zones: state.zones.length,
          piles: state.piles.length,
          baskets: st.baskets,
          weight: formatKg(st.netG),
        })}
        {stillCounting.length > 0
          ? `\n${msg('counter.closeSaleStillCounting', { n: stillCounting.length })}`
          : ''}
        {`\n${msg('counter.closeSaleAfter')}`}
      </Text>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button testID="close-sale-confirm" variant="destructive" onPress={onConfirm}>
          {msg('counter.closeSaleConfirm')}
        </Button>
        <Button testID="close-sale-cancel" onPress={onCancel}>
          {msg('common.cancel')}
        </Button>
      </View>
    </View>
  );
}

/**
 * Test-only shortening of the hold, on web only.
 *
 * Twelve real three-second holds is 36 seconds of wall clock per Playwright
 * run and grows with every story; a suite that times out is worse than one
 * with a deliberate seam. Guarded so it cannot be reached in a native build.
 */
function holdMsOverride(): number | undefined {
  // No location on native (and in the component tests).
  if (typeof window === 'undefined' || !window.location) return undefined;
  const v = new URLSearchParams(window.location.search).get('holdMs');
  return v ? Number(v) : undefined;
}

function PilePanel({
  pile,
  zone,
  state,
  onCloseZone,
  onReopenPile,
  onReopenZone,
}: {
  pile: Pile;
  zone: Zone;
  state: SaleState;
  onCloseZone: () => void;
  onReopenPile: (pileId: string) => void;
  onReopenZone: (zoneId: string) => void;
}) {
  const t = useTheme();
  const msg = useT();
  const { events, append } = useSale();
  const [closePileConfirm, setClosePileConfirm] = useState(false);
  const [closeZoneConfirm, setCloseZoneConfirm] = useState(false);

  const pt = pileTotals(events, pile.id);
  const zt = zoneTotals(events, state, pile.zoneId);
  const st = saleTotals(events);
  const stillCounting = pilesStillCounting(state, zone.id);

  const closePile = () => {
    append({ kind: 'sys', payload: { t: 'pile_closed', pileId: pile.id, forced: false } });
    setClosePileConfirm(false);
  };

  const closeZone = () => {
    append({
      kind: 'sys',
      payload: { t: 'zone_closed', zoneId: zone.id, forcedPiles: stillCounting.map((p) => p.id) },
    });
    setCloseZoneConfirm(false);
    onCloseZone();
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.space.md, gap: t.space.md, flexDirection: 'row', flexWrap: 'wrap' }}>
      <Card title={pile.name}>
        <Stat label={msg('pile.standard')} value={String(pt.standardBaskets)} big />
        <Stat label={msg('pile.short')} value={String(pt.shortBaskets)} />
        <Stat label={msg('pile.weight')} value={`${formatKg(pt.netG)} ${msg('common.kg')}`} rule />
      </Card>

      <Card title={msg('pile.scale')}>
        <Stat label={msg('pile.tare')} value={`${formatKg(pile.tareG)} ${msg('common.kg')}`} />
        <Stat
          label={msg('pile.stdNet')}
          value={`${formatKg(pile.stdNetG)} กก.${pile.locked ? ' 🔒' : ''}`}
        />
        <Stat
          label={msg('pile.expected')}
          value={`${formatKg(pile.tareG + pile.stdNetG)} ${msg('common.kg')}`}
          rule
        />
      </Card>

      <Card title={msg('pile.rollups')}>
        <Stat label={zone.name} value={`${formatKg(zt.netG)} กก.`} />
        <Stat label={msg('pile.wholeSale')} value={`${formatKg(st.netG)} ${msg('common.kg')}`} big rule />
        <Stat label="เข่งทั้งหมด" value={String(st.baskets)} />
      </Card>

      <Card title={msg('pile.closeReopen')}>
        {pile.status === 'counting' ? (
          !closePileConfirm ? (
            <Button testID="close-pile" onPress={() => setClosePileConfirm(true)} disabled={pt.baskets === 0}>
              {msg('pile.close')}
            </Button>
          ) : (
            <View style={{ gap: t.space.xs }}>
              <Text testID="close-pile-detail" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.reject }}>
                {msg('pile.closeDetail', {
                  name: pile.name,
                  baskets: pt.baskets,
                  weight: formatKg(pt.netG),
                })}
              </Text>
              <View style={{ flexDirection: 'row', gap: t.space.xs }}>
                <Button testID="close-pile-confirm" variant="destructive" onPress={closePile}>
                  {msg('pile.closeConfirm')}
                </Button>
                <Button testID="close-pile-cancel" onPress={() => setClosePileConfirm(false)}>
                  ยกเลิก
                </Button>
              </View>
            </View>
          )
        ) : pile.status === 'closed' ? (
          <Button testID="reopen-pile" onPress={() => onReopenPile(pile.id)} disabled={!canReopenPile(state, pile.id)}>
            {msg('pile.reopen')}
          </Button>
        ) : (
          <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
            {msg('pile.notStarted')}
          </Text>
        )}

        <View style={{ height: t.space.md }} />

        {zone.status === 'open' ? (
          !closeZoneConfirm ? (
            <Button testID="close-zone" onPress={() => setCloseZoneConfirm(true)}>
              {msg('zone.close')}
            </Button>
          ) : (
            <View style={{ gap: t.space.xs }}>
              <Text testID="close-zone-detail" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.reject }}>
                {msg('zone.closeDetail', {
                  name: zone.name,
                  baskets: zt.baskets,
                  weight: formatKg(zt.netG),
                })}
              </Text>
              {stillCounting.length > 0 ? (
                <Text testID="close-zone-warning" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.warn }}>
                  {msg('zone.closeWarning', {
                    n: stillCounting.length,
                    names: stillCounting.map((p) => p.name).join(', '),
                  })}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: t.space.xs }}>
                <Button testID="close-zone-confirm" variant="destructive" onPress={closeZone}>
                  {msg('zone.closeConfirm')}
                </Button>
                <Button testID="close-zone-cancel" onPress={() => setCloseZoneConfirm(false)}>
                  ยกเลิก
                </Button>
              </View>
            </View>
          )
        ) : (
          <Button testID="reopen-zone" onPress={() => onReopenZone(zone.id)} disabled={state.status !== 'open'}>
            {msg('zone.reopen')}
          </Button>
        )}
      </Card>
    </ScrollView>
  );
}

function LogPanel() {
  const { events } = useSale();
  const live = new Set(liveBaskets(events).map((b) => b.id));
  // A correction names its target by id; the log shows the target's `#seq`.
  const seqOf = new Map(events.map((e) => [e.id, e.seq]));

  // Newest first. Capped: a 400-basket log does not need to mount all at once,
  // and the log is for checking recent work, not archaeology.
  const recent = [...events].sort((a, b) => compareEvents(b, a)).slice(0, 60);

  return (
    <ScrollView style={{ flex: 1 }} testID="log">
      {recent.map((e) => (
        <LogRow
          key={e.id}
          event={e}
          targetSeq={e.kind === 'correction' ? seqOf.get(e.targetId) : undefined}
          voided={(e.kind === 'accept' || e.kind === 'short') && !live.has(e.id)}
        />
      ))}
    </ScrollView>
  );
}

function LogRow({
  event: e,
  targetSeq,
  voided,
}: {
  event: SaleEvent;
  targetSeq: number | undefined;
  voided: boolean;
}) {
  const t = useTheme();
  const msg = useT();
  const { mark, colour, body } = describe(e, t, msg, targetSeq);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.sm,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.sm,
        borderBottomWidth: t.border.hair,
        borderBottomColor: t.color.ruleFaint,
      }}
    >
      <Text style={{ width: 18, textAlign: 'center', color: colour, fontWeight: t.font.weight.bold }}>{mark}</Text>
      <Text style={{ width: 46, fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
        #{e.seq}
      </Text>
      <Text
        style={{
          flex: 1,
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.small,
          color: voided ? t.color.inkSoft : t.color.ink,
          // Non-colour encoding: a voided row is struck through as well as greyed.
          textDecorationLine: voided ? 'line-through' : 'none',
        }}
      >
        {body}
      </Text>
    </View>
  );
}

/**
 * `msg` is threaded in rather than read from context, because these are plain
 * functions and not components — the log row calls them from its own render.
 * Passing it keeps them pure and keeps the switch statements readable, which
 * matters more here than anywhere else on the screen: this is the record two
 * parties read back when they disagree.
 */
function describe(
  e: SaleEvent,
  t: ReturnType<typeof useTheme>,
  msg: Translate,
  targetSeq: number | undefined,
) {
  switch (e.kind) {
    case 'accept':
      return { mark: '✓', colour: t.color.accept, body: msg('log.accept', { weight: formatKg(e.netG) }) };
    case 'short':
      return {
        mark: '⚖',
        colour: t.color.warn,
        body: msg('log.short', {
          reading: formatKg(e.readingG),
          tare: formatKg(e.tareG),
          net: formatKg(basketNetG(e)),
        }),
      };
    case 'reject':
      return {
        mark: '✗',
        colour: t.color.reject,
        body: msg('log.reject', { seconds: (e.heldMs / 1000).toFixed(1) }),
      };
    case 'correction':
      return {
        mark: '↩',
        colour: t.color.inkSoft,
        body: msg('log.correction', { seq: targetSeq ?? '?', reason: e.reason }),
      };
    case 'sys':
      return { mark: '·', colour: t.color.inkSoft, body: sysLabel(e.payload, msg) };
    case 'delete':
      return { mark: '·', colour: t.color.inkSoft, body: msg('log.deleted') };
    case 'restore':
      return { mark: '·', colour: t.color.inkSoft, body: msg('log.restored') };
    // Farm master data never lives in a sale's log; listed only so the switch stays total.
    case 'master':
      return { mark: '·', colour: t.color.inkSoft, body: sysLabel(e.payload, msg) };
  }
}

function sysLabel(p: { t: string } & Record<string, unknown>, msg: Translate): string {
  switch (p.t) {
    case 'sale_started': return msg('log.saleStarted', { buyer: String(p.buyer) });
    case 'price_set': return msg('log.priceSet', { price: formatBaht(Number(p.satangPerKg)) });
    case 'split_set': return msg('log.splitSet', { owner: String(p.ownerPct), worker: 100 - Number(p.ownerPct) });
    case 'zone_added': return msg('log.zoneAdded', { name: String(p.name) });
    case 'zone_contract_set':
      return msg('log.zoneContractSet', { worker: String(p.workerName), pct: String(p.ownerPct) });
    case 'zone_contract_cleared': return msg('log.zoneContractCleared');
    case 'pile_added': return msg('log.pileAdded', { name: String(p.name) });
    case 'zero_check':
      return p.ok
        ? msg('log.zeroOk')
        : msg('log.zeroNotOk', { reading: formatKg(Number(p.readingG)) });
    case 'tare_confirmed': return msg('log.tareConfirmed', { tare: formatKg(Number(p.tareG)) });
    case 'ready': return msg('log.ready');
    case 'pile_closed': return msg('log.pileClosed');
    case 'pile_reopened': return msg('log.pileReopened', { reason: String(p.reason) });
    case 'zone_closed': return msg('log.zoneClosed');
    case 'zone_reopened': return msg('log.zoneReopened', { reason: String(p.reason) });
    case 'sale_closed': return msg('log.saleClosed');
    case 'sale_reopened': return msg('log.saleReopened', { reason: String(p.reason) });
    case 'clock_anomaly': return msg('log.clockAnomaly', { anomaly: String(p.anomaly) });
    case 'deduction_added':
      return msg('log.deductionAdded', { amount: formatBaht(Number(p.satang)), reason: String(p.reason) });
    case 'deduction_voided': return msg('log.deductionVoided', { reason: String(p.reason) });
    case 'announced':
      return msg('log.announced', {
        thai: String(p.thai),
        note: p.ok === false ? msg('log.announceFailed') : '',
      });
    case 'speech_set':
      return msg('log.speechSet', { state: p.on ? msg('common.speechOn') : msg('common.speechOff') });
    default: return p.t;
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 220,
        ...cardStyle(t),
        padding: t.space.md,
      }}
    >
      <CardLabel>{title}</CardLabel>
      {children}
    </View>
  );
}

function Stat({ label, value, big, rule }: { label: string; value: string; big?: boolean; rule?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: t.space.sm,
        paddingVertical: 3,
        marginTop: rule ? t.space.sm : 0,
        borderTopWidth: rule ? t.border.hair : 0,
        borderTopColor: t.color.rule,
        paddingTop: rule ? t.space.sm : 3,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft, flexShrink: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: big ? t.font.size.lead : t.font.size.small,
          fontWeight: t.font.weight.bold,
          color: t.color.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
