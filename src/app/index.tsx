/**
 * The counter screen — the one the buyer is looking at.
 *
 * Three tabs (finding F-19): Count / Pile / Log. When any tab other than Count
 * is active a mini-count stays in the topbar: leaving the Count tab must never
 * mean losing sight of the number.
 */

import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Button, Pill, Tabs, TopBar } from '../components/chrome';
import { HoldStage } from '../components/HoldStage';
import { canCount } from '../core/project';
import { formatBaht, formatKg } from '../core/settle';
import { basketNetG, lastLiveBasket, liveBaskets, pileTotals, saleTotals, zoneTotals } from '../core/totals';
import type { SaleEvent } from '../core/types';
import { useSale } from '../store/SaleProvider';
import { useTheme, useThemeControls } from '../theme';

type TabKey = 'count' | 'pile' | 'log';

const TABS = [
  { key: 'count' as const, label: 'นับ · Count' },
  { key: 'pile' as const, label: 'กอง · Pile' },
  { key: 'log' as const, label: 'บันทึก · Log' },
];

export default function CounterScreen() {
  const t = useTheme();
  const { toggle, scheme } = useThemeControls();
  const { events, state, append, ready } = useSale();
  const [tab, setTab] = useState<TabKey>('count');

  // The pile being counted: the first one in a counting state.
  const pile = useMemo(
    () => state.piles.find((p) => p.status === 'counting') ?? state.piles[0],
    [state.piles],
  );
  const zone = state.zones.find((z) => z.id === pile?.zoneId);

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

  const onShort = () => {
    // MVP: logs a representative off-standard basket. The three-way input
    // (slider / ±0.5kg / typed) from finding F-22 is story S11.
    append({ kind: 'short', pileId: pile.id, readingG: 43_000, tareG: pile.tareG });
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
            <Pill testID="theme-toggle">
              <Text onPress={toggle}>{scheme === 'light' ? '◐ light' : '◑ dark'}</Text>
            </Pill>
          </>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'count' ? (
        <>
          <HoldStage
            count={totals?.baskets ?? 0}
            onCount={onCount}
            onReject={onReject}
            enabled={countable}
            caption={countable ? expected : 'กองยังไม่พร้อม · pile not ready'}
            holdMs={holdMsOverride()}
          />
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
            <Button testID="short" onPress={onShort} disabled={!countable}>
              ⚖ เข่งไม่เต็ม · short basket
            </Button>
            <View style={{ flex: 1 }} />
            <Link href="/settlement" asChild>
              <Button testID="to-settlement" variant="destructive">ปิดการขาย · close sale</Button>
            </Link>
          </View>
        </>
      ) : null}

      {tab === 'pile' ? <PilePanel /> : null}
      {tab === 'log' ? <LogPanel /> : null}
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

function PilePanel() {
  const t = useTheme();
  const { events, state } = useSale();
  const pile = state.piles.find((p) => p.status === 'counting') ?? state.piles[0];
  if (!pile) return null;

  const pt = pileTotals(events, pile.id);
  const zt = zoneTotals(events, state, pile.zoneId);
  const st = saleTotals(events);
  const zone = state.zones.find((z) => z.id === pile.zoneId);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.space.md, gap: t.space.md, flexDirection: 'row' }}>
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
        <Stat label={`${zone?.name ?? 'zone'}`} value={`${formatKg(zt.netG)} กก.`} />
        <Stat label="ทั้งการขาย · whole sale" value={`${formatKg(st.netG)} กก.`} big rule />
        <Stat label="เข่งทั้งหมด" value={String(st.baskets)} />
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
    case 'pile_added': return `เพิ่มกอง ${String(p.name)}`;
    case 'zero_check': return p.ok ? 'ตาชั่งขึ้นศูนย์ ✓' : `ตาชั่งไม่ศูนย์ ⚠ ${formatKg(Number(p.readingG))} กก.`;
    case 'tare_confirmed': return `ถังเปล่า ${formatKg(Number(p.tareG))} กก.`;
    case 'ready': return 'พร้อมนับ';
    case 'pile_closed': return 'ปิดกอง';
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
