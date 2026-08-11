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

import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Pill, Tabs, TopBar } from '../../../components/chrome';
import { HoldStage } from '../../../components/HoldStage';
import { PileClosedTransition } from '../../../components/PileClosedTransition';
import { ReopenPrompt } from '../../../components/ReopenPrompt';
import { ShortBasketPanel } from '../../../components/ShortBasketPanel';
import { ZeroTareGate } from '../../../components/ZeroTareGate';
import { ZonePileSwitcher } from '../../../components/ZonePileSwitcher';
import { canCount, canReopenPile, pilesStillCounting } from '../../../core/project';
import { formatBaht, formatKg } from '../../../core/settle';
import { basketNetG, lastLiveBasket, liveBaskets, pileTotals, saleTotals, zoneTotals } from '../../../core/totals';
import type { Pile, SaleEvent, SaleState, Zone } from '../../../core/types';
import { useSale } from '../../../store/SaleProvider';
import { useTheme, useThemeControls } from '../../../theme';

type TabKey = 'count' | 'pile' | 'log';

const TABS = [
  { key: 'count' as const, label: 'นับ · Count' },
  { key: 'pile' as const, label: 'กอง · Pile' },
  { key: 'log' as const, label: 'บันทึก · Log' },
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
  const t = useTheme();
  const router = useRouter();
  const { toggle, scheme } = useThemeControls();
  const { saleId, events, state, append, ready } = useSale();
  const [tab, setTab] = useState<TabKey>('count');
  const [shortOpen, setShortOpen] = useState(false);
  const [shortReadingG, setShortReadingG] = useState(0);
  const [selectedPileId, setSelectedPileId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });

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

  if (!ready || !pile || !zone) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>กำลังโหลด…</Text>
      </View>
    );
  }

  const expected = `${formatKg(pile.tareG)} + ${formatKg(pile.stdNetG)} = ${formatKg(pile.tareG + pile.stdNetG)} กก.`;

  const onCount = () =>
    append({ kind: 'accept', pileId: pile.id, source: 'hold', netG: pile.stdNetG, tareG: pile.tareG });

  const onReject = (heldMs: number) =>
    append({ kind: 'reject', pileId: pile.id, source: 'hold', reason: 'released-early', heldMs });

  const onUndo = () => {
    if (!lastBasket) return;
    append({
      kind: 'correction',
      pileId: pile.id,
      targetSeq: lastBasket.seq,
      mode: 'undo-last',
      reason: 'กดพลาด · mistap',
    });
  };

  const openShort = () => {
    setShortReadingG(pile.tareG + pile.stdNetG);
    setShortOpen(true);
  };

  const confirmShort = () => {
    append({ kind: 'short', pileId: pile.id, readingG: shortReadingG, tareG: pile.tareG });
    setShortOpen(false);
  };

  const onZeroChecked = (ok: boolean, readingG: number) =>
    append({ kind: 'sys', payload: { t: 'zero_check', pileId: pile.id, ok, readingG } });

  const onTareConfirmed = (confirmedTareG: number) =>
    append({ kind: 'sys', payload: { t: 'tare_confirmed', pileId: pile.id, tareG: confirmedTareG } });

  const onGateReady = () => append({ kind: 'sys', payload: { t: 'ready', pileId: pile.id } });

  const pickPile = (pileId: string) => {
    setSelectedPileId(pileId);
    setOverlay({ kind: 'none' });
    setTab('count');
  };

  // ── Decision point after a pile closes ──────────────────────────────────
  const nextPileInZone = state.piles.find((p) => p.zoneId === zone.id && p.status === 'not-started');

  const closeSale = () => {
    if (state.status === 'open') append({ kind: 'sys', payload: { t: 'sale_closed' } });
    router.push({ pathname: '/sale/[id]/settlement', params: { id: saleId } });
  };

  const closeZoneFromTransition = () => {
    const stillCounting = pilesStillCounting(state, zone.id);
    append({
      kind: 'sys',
      payload: { t: 'zone_closed', zoneId: zone.id, forcedPiles: stillCounting.map((p) => p.id) },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={`${state.parties?.farmName ?? ''} ▸ ${zone.name} ▸ ${pile.name}`}
        right={
          <>
            {tab !== 'count' && totals ? (
              <Pill tone="count" testID="mini-count">{`นับ ${totals.baskets}`}</Pill>
            ) : null}
            <Pill tone={countable ? 'accept' : 'neutral'} dot={countable ? 'filled' : 'hollow'}>
              {countable ? 'กำลังนับ' : 'หยุด'}
            </Pill>
            {state.clockSuspect ? <Pill tone="warn">⏱ เวลาผิด</Pill> : null}
            <Pill testID="open-switcher">
              <Text onPress={() => setOverlay({ kind: 'switcher' })}>โซน/กอง ▾</Text>
            </Pill>
            <Pill testID="theme-toggle">
              <Text onPress={toggle}>{scheme === 'light' ? '◐ light' : '◑ dark'}</Text>
            </Pill>
          </>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

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
              onCloseZone={closeZoneFromTransition}
              onCloseSale={closeSale}
            />
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
            />
          ) : (
            <HoldStage
              count={totals?.baskets ?? 0}
              onCount={onCount}
              onReject={onReject}
              enabled={countable}
              caption={countable ? expected : 'กองยังไม่พร้อม · pile not ready'}
              holdMs={holdMsOverride()}
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
              <Button testID="undo" onPress={onUndo} disabled={!lastBasket}>
                ↺ ยกเลิกเข่งล่าสุด · undo last
              </Button>
              <Button testID="short" onPress={openShort} disabled={!countable || shortOpen}>
                ⚖ เข่งไม่เต็ม · short basket
              </Button>
              <View style={{ flex: 1 }} />
              <Button testID="to-settlement" variant="destructive" onPress={closeSale}>
                ปิดการขาย · close sale
              </Button>
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
          consequence="กองนี้จะกลับมานับต่อได้ · this pile becomes countable again. บันทึกเดิมยังอยู่ครบ · nothing already recorded is erased."
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
          consequence="โซนนี้จะเปิดอีกครั้ง แต่กองที่ปิดไว้จะยังปิดอยู่ · the zone reopens, but piles already closed inside it stay closed."
          onConfirm={(reason) => {
            append({ kind: 'sys', payload: { t: 'zone_reopened', zoneId: overlay.zoneId, reason } });
            setOverlay({ kind: 'none' });
          }}
          onCancel={() => setOverlay({ kind: 'none' })}
        />
      ) : null}
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
 * Test-only shortening of the hold, on web only.
 *
 * Twelve real three-second holds is 36 seconds of wall clock per Playwright
 * run and grows with every story; a suite that times out is worse than one
 * with a deliberate seam. Guarded so it cannot be reached in a native build.
 */
function holdMsOverride(): number | undefined {
  if (typeof window === 'undefined') return undefined;
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
      <Card title={`${pile.name} · this pile`}>
        <Stat label="เข่งมาตรฐาน · standard" value={String(pt.standardBaskets)} big />
        <Stat label="เข่งไม่เต็ม · short" value={String(pt.shortBaskets)} />
        <Stat label="น้ำหนักรวม · weight" value={`${formatKg(pt.netG)} กก.`} rule />
      </Card>

      <Card title="ตาชั่ง · scale">
        <Stat label="ถังเปล่า · tare" value={`${formatKg(pile.tareG)} กก.`} />
        <Stat
          label="ยางต่อเข่ง · standard net"
          value={`${formatKg(pile.stdNetG)} กก.${pile.locked ? ' 🔒' : ''}`}
        />
        <Stat label="ต้องอ่านได้ · expected" value={`${formatKg(pile.tareG + pile.stdNetG)} กก.`} rule />
      </Card>

      <Card title="รวม · rollups">
        <Stat label={zone.name} value={`${formatKg(zt.netG)} กก.`} />
        <Stat label="ทั้งการขาย · whole sale" value={`${formatKg(st.netG)} กก.`} big rule />
        <Stat label="เข่งทั้งหมด" value={String(st.baskets)} />
      </Card>

      <Card title="ปิด / เปิดอีกครั้ง · close / reopen">
        {pile.status === 'counting' ? (
          !closePileConfirm ? (
            <Button testID="close-pile" onPress={() => setClosePileConfirm(true)} disabled={pt.baskets === 0}>
              ปิดกอง · close pile
            </Button>
          ) : (
            <View style={{ gap: t.space.xs }}>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.reject }}>
                แน่ใจนะ? · are you sure?
              </Text>
              <View style={{ flexDirection: 'row', gap: t.space.xs }}>
                <Button testID="close-pile-confirm" variant="destructive" onPress={closePile}>
                  ยืนยันปิดกอง · confirm
                </Button>
                <Button testID="close-pile-cancel" onPress={() => setClosePileConfirm(false)}>
                  ยกเลิก
                </Button>
              </View>
            </View>
          )
        ) : pile.status === 'closed' ? (
          <Button testID="reopen-pile" onPress={() => onReopenPile(pile.id)} disabled={!canReopenPile(state, pile.id)}>
            เปิดกองอีกครั้ง · reopen pile
          </Button>
        ) : (
          <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
            กองยังไม่เริ่ม · not started yet
          </Text>
        )}

        <View style={{ height: t.space.md }} />

        {zone.status === 'open' ? (
          !closeZoneConfirm ? (
            <Button testID="close-zone" onPress={() => setCloseZoneConfirm(true)}>
              ปิดโซน · close zone
            </Button>
          ) : (
            <View style={{ gap: t.space.xs }}>
              {stillCounting.length > 0 ? (
                <Text testID="close-zone-warning" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.warn }}>
                  {`ยังนับอยู่ ${stillCounting.length} กอง จะถูกปิดไปด้วย: ${stillCounting.map((p) => p.name).join(', ')}`}
                </Text>
              ) : null}
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.reject }}>
                แน่ใจนะ? · are you sure?
              </Text>
              <View style={{ flexDirection: 'row', gap: t.space.xs }}>
                <Button testID="close-zone-confirm" variant="destructive" onPress={closeZone}>
                  ยืนยันปิดโซน · confirm
                </Button>
                <Button testID="close-zone-cancel" onPress={() => setCloseZoneConfirm(false)}>
                  ยกเลิก
                </Button>
              </View>
            </View>
          )
        ) : (
          <Button testID="reopen-zone" onPress={() => onReopenZone(zone.id)} disabled={state.status !== 'open'}>
            เปิดโซนอีกครั้ง · reopen zone
          </Button>
        )}
      </Card>
    </ScrollView>
  );
}

function LogPanel() {
  const { events } = useSale();
  const live = new Set(liveBaskets(events).map((b) => b.seq));

  // Newest first. Capped: a 400-basket log does not need to mount all at once,
  // and the log is for checking recent work, not archaeology.
  const recent = [...events].sort((a, b) => b.seq - a.seq).slice(0, 60);

  return (
    <ScrollView style={{ flex: 1 }} testID="log">
      {recent.map((e) => (
        <LogRow key={e.seq} event={e} voided={(e.kind === 'accept' || e.kind === 'short') && !live.has(e.seq)} />
      ))}
    </ScrollView>
  );
}

function LogRow({ event: e, voided }: { event: SaleEvent; voided: boolean }) {
  const t = useTheme();
  const { mark, colour, body } = describe(e, t);

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

function describe(e: SaleEvent, t: ReturnType<typeof useTheme>) {
  switch (e.kind) {
    case 'accept':
      return { mark: '✓', colour: t.color.accept, body: `เข่งมาตรฐาน · ${formatKg(e.netG)} กก.` };
    case 'short':
      return {
        mark: '⚖',
        colour: t.color.warn,
        body: `เข่งไม่เต็ม · ชั่งได้ ${formatKg(e.readingG)} − ถัง ${formatKg(e.tareG)} = ${formatKg(basketNetG(e))} กก.`,
      };
    case 'reject':
      return {
        mark: '✗',
        colour: t.color.reject,
        body: `ไม่นับ — ปล่อยเร็วไป ${(e.heldMs / 1000).toFixed(1)} วิ`,
      };
    case 'correction':
      return { mark: '↩', colour: t.color.inkSoft, body: `แก้ไข — ยกเลิก #${e.targetSeq} · ${e.reason}` };
    case 'sys':
      return { mark: '·', colour: t.color.inkSoft, body: sysLabel(e.payload) };
  }
}

function sysLabel(p: { t: string } & Record<string, unknown>): string {
  switch (p.t) {
    case 'sale_started': return `เริ่มขาย — ${String(p.buyer)}`;
    case 'price_set': return `ราคา ${formatBaht(Number(p.satangPerKg))} ต่อ กก.`;
    case 'split_set': return `ส่วนแบ่ง ${String(p.ownerPct)}/${100 - Number(p.ownerPct)}`;
    case 'zone_added': return `เพิ่มโซน ${String(p.name)}`;
    case 'zone_contract_set': return `สัญญาโซน — ${String(p.workerName)} ${String(p.ownerPct)}%`;
    case 'pile_added': return `เพิ่มกอง ${String(p.name)}`;
    case 'zero_check': return p.ok ? 'ตาชั่งขึ้นศูนย์ ✓' : `ตาชั่งไม่ศูนย์ ⚠ ${formatKg(Number(p.readingG))} กก.`;
    case 'tare_confirmed': return `ถังเปล่า ${formatKg(Number(p.tareG))} กก.`;
    case 'ready': return 'พร้อมนับ';
    case 'pile_closed': return 'ปิดกอง';
    case 'pile_reopened': return `เปิดกองอีกครั้ง — ${String(p.reason)}`;
    case 'zone_closed': return 'ปิดโซน';
    case 'zone_reopened': return `เปิดโซนอีกครั้ง — ${String(p.reason)}`;
    case 'sale_closed': return 'ปิดการขาย';
    case 'sale_reopened': return `เปิดการขายอีกครั้ง — ${String(p.reason)}`;
    case 'clock_anomaly': return `⏱ เวลาเครื่องผิด (${String(p.anomaly)})`;
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
        borderWidth: t.border.hair,
        borderColor: t.color.rule,
        borderRadius: t.radius.md,
        backgroundColor: t.color.surfaceRaised,
        padding: t.space.md,
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.mono,
          fontSize: t.font.size.micro,
          letterSpacing: t.font.tracking.wide,
          color: t.color.inkSoft,
          marginBottom: t.space.sm,
        }}
      >
        {title}
      </Text>
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
