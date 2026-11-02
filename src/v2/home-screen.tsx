/**
 * The v2 home (e03-v2-splash-home): flow-v1 mockup screen 3 ("หน้าแรก วันนี้")
 * with the farm v1.1.0 screens 1 (top and the ☰ menu) and 25 (the lower
 * half) on top, v1.1.0 winning where they differ. Top to bottom: header
 * with today's date, the drawn cover, three actions (เริ่มการขาย the main
 * one), "ควรรู้ / ควรจัดการ" with only the rows that apply, the way to the
 * sale list, and the "ไปที่" module grid.
 *
 * Everything shown is read from the local log (sales, farm data, finance),
 * so it is the same offline. Modules with no screen yet open a placeholder.
 */

import { Link, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';

import { farmSection, SALE_START, saleHref, sectionHref } from './routes';
import { useMaster, useMounted } from './farm/pieces';
import { ORDER_NEW, orderHref } from './money/order-routes';
import { loadHomeSales } from './sale/open-sale';
import { useRepayHome, type OwesRow } from './home-repay';
import { groupOrders, missingDetails } from '../core/finance/fert-order';
import { owedByPerson, payableSatang } from '../core/finance/ledger';
import { formatDate, formatSatang, todayIso } from '../core/finance/money';
import type { HomeSales, SaleLine } from '../core/home';
import { filterPeople, formatThaiDate, formatThaiDay } from '../core/master';
import { formatKg } from '../core/settle';
import { useFinance } from '../finance/use-finance';
import { useI18n, useT } from '../i18n';
import { useSyncStatus } from '../sync/use-sync-status';
import { useTheme, type Theme } from '../theme';
import {
  ActionTile,
  BankIcon,
  BasketIcon,
  BoxIcon,
  cardStyle,
  ChartIcon,
  Chip,
  ChevronRight,
  ClockIcon,
  CoinIcon,
  CompactMoney,
  DebtIcon,
  DeviceIcon,
  ExternalIcon,
  Drawer,
  FactRow,
  FarmIcon,
  FarmMateIcon,
  GearIcon,
  IconTile,
  LeafIcon,
  ListIcon,
  MenuItem,
  MenuSection,
  PercentIcon,
  PersonIcon,
  PinIcon,
  ReceiptIcon,
  ScreenHeader,
  SpeakerIcon,
  SwapIcon,
  UsersIcon,
  WalletIcon,
  WeatherIcon,
  type IconRender,
  type TileTone,
} from '../ui';

const href = (slug: string) => sectionHref(farmSection(slug));

/** The ISO date `n` days before today (device calendar). */
const isoDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayIso(d);
};

export function V2Home() {
  const t = useTheme();
  const msg = useT();
  const { era } = useI18n();
  const sync = useSyncStatus();
  // The date is today's on the device, not the build's: wait for the client.
  const mounted = useMounted();
  const now = useNow();
  const [menuOpen, setMenuOpen] = useState(false);

  const sales = useHomeSales();
  const { state: master } = useMaster();
  const fin = useFinance();
  const owed = useMemo(() => (fin.state ? owedByPerson(fin.state).filter((o) => o.remainingSatang > 0) : []), [fin.state]);
  const owedTotal = owed.reduce((s, o) => s + o.remainingSatang, 0);
  const payable = fin.state ? payableSatang(fin.state) : 0;
  const tappers = master ? filterPeople(master.people, 'tapper').length : 0;
  // E06-S08 (H1, H2): repayments not in yet, and what a buyer still owes the farm per sale.
  const repay = useRepayHome(fin.events, era);

  // Shop orders (E11-S11): ordered and not yet arrived; arrived fertilizer not yet placed on a plot.
  const orders = useMemo(() => {
    const live = (fin.state?.expenses ?? []).filter((x) => !x.deleted);
    const overdueBefore = isoDaysAgo(2);
    if (!live.some((x) => x.fertilizer)) return { committed: [], zoneItems: [] };
    const views = groupOrders(live);
    return {
      // FD-0: remind only when the goods are overdue (ordered more than 2 days ago).
      committed: views.filter((o) => o.stage === 'committed' && o.date < overdueBefore && o.items.some((x) => x.fertilizer)),
      zoneItems: live.filter((x) => x.stage === 'actual' && x.fertilizer && missingDetails(x).includes('zones')),
    };
  }, [fin.state]);
  const committedNewest = orders.committed[0];
  const zoneNewest = orders.zoneItems.reduce<(typeof orders.zoneItems)[number] | undefined>((a, x) => (!a || x.date > a.date ? x : a), undefined);

  const saleLine = (s: SaleLine) =>
    s.ts === null
      ? msg('home.saleKg', { kg: formatKg(s.netG) })
      : msg('home.saleLine', { date: formatThaiDate(s.ts, era), kg: formatKg(s.netG) });

  const knowRows = [
    sales?.open ? (
      <KnowRow
        key="open"
        testID="home-open-sale"
        tone="action"
        icon={(c) => <BasketIcon color={c} size={24} />}
        label={msg('home.openSale')}
        value={saleLine(sales.open)}
        chip={<Chip tone="warn" label={msg(sales.open.weighing ? 'sales.weighing' : 'status.open')} />}
        to={saleHref(sales.open.id, { closed: false, point: sales.open.point })}
      />
    ) : null,
    sales?.latest ? (
      <KnowRow
        key="latest"
        testID="home-latest-sale"
        tone="accept"
        icon={(c) => <BasketIcon color={c} size={24} />}
        label={msg('home.latestSale')}
        value={saleLine(sales.latest)}
        chip={<Chip tone="accept" label={msg('status.closed')} />}
        to={saleHref(sales.latest.id, { closed: true, point: sales.latest.point })}
      />
    ) : null,
    owedTotal > 0 ? (
      <KnowRow
        key="owed"
        testID="home-owed"
        tone="cream"
        icon={(c) => <DebtIcon color={c} size={24} />}
        value={msg('v2.owed')}
        to={'/v2/owed' as Href}
      >
        <FactRow icon={(c) => <CoinIcon color={c} size={13} />}>
          <Text style={{ fontWeight: t.font.weight.semibold, color: t.color.ink, fontVariant: ['tabular-nums'] }}>{formatSatang(owedTotal)}</Text>{' '}
          {msg('v2m.baht')}
        </FactRow>
        <FactRow icon={(c) => <PersonIcon color={c} size={13} />}>
          {owed.length === 1 ? owed[0].payer.name : msg('v2m.people', { n: owed.length })}
        </FactRow>
      </KnowRow>
    ) : null,
    committedNewest ? (
      <KnowRow
        key="order-committed"
        testID="home-order-committed"
        tone="action"
        icon={(c) => <LeafIcon color={c} size={24} />}
        value={orders.committed.length > 1 ? msg('ords.homeDeliveredMany', { n: orders.committed.length }) : msg('ords.homeDelivered', { date: formatDate(committedNewest.date) })}
        to={orderHref(committedNewest.orderId)}
      />
    ) : null,
    repay.waiting.length ? (
      <KnowRow
        key="repay-wait"
        testID="home-repay-wait"
        tone="action"
        icon={() => <FarmMateIcon id="finance.otherCost" size={28} />}
        label={msg('rp.home.waiting')}
        to={'/v2/debts' as Href}
      >
        {pairsOf(repay.waiting).map((two, i) => (
          <SumLine key={i} testID={`home-repay-wait-line-${i}`}>
            {two.map((p, k) => (
              <Text key={p.workerId}>
                {k ? ' · ' : ''}
                {`${p.name} `}
                <CompactMoney satang={p.satang} />
              </Text>
            ))}
          </SumLine>
        ))}
        <SumLine testID="home-repay-wait-sum">
          {`Σ ${msg('rp.home.sum')} `}
          <CompactMoney satang={repay.waitTotal} />
        </SumLine>
      </KnowRow>
    ) : null,
    ...repay.owes.map((o) => <OwesKnowRow key={`owes-${o.saleId}`} o={o} />),
    zoneNewest ? (
      <KnowRow
        key="order-zones"
        testID="home-order-zones"
        tone="cream"
        icon={(c) => <LeafIcon color={c} size={24} />}
        value={msg('ords.homeZones', { n: orders.zoneItems.length })}
        to={orderHref(zoneNewest.orderId ?? zoneNewest.id)}
      />
    ) : null,
  ].filter((r) => r !== null);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        title={msg('v2.home')}
        subtitle={mounted ? formatThaiDay(now, era) : undefined}
        menu={{ onPress: () => setMenuOpen(true) }}
        sync={sync}
      />
      <ScrollView
        testID="v2-home"
        contentContainerStyle={{
          paddingHorizontal: t.layout.screenPaddingX,
          paddingTop: t.space.md,
          paddingBottom: t.space.xl,
          gap: t.space.md,
        }}
      >
        <Cover />

        <View style={{ flexDirection: 'row', gap: t.space.sm }}>
          <ActionTile
            testID="home-prepare"
            label={msg('v2.prepare')}
            tone="cream"
            icon={(c) => <ListIcon color={c} size={26} />}
            href={href('prepare')}
          />
          <ActionTile
            testID="home-sale-start"
            label={msg('v2.saleStart')}
            tone="action"
            main
            icon={(c) => <BasketIcon color={c} size={26} />}
            href={SALE_START}
          />
          <ActionTile
            testID="home-record-expense"
            label={msg('v2.recordExpense')}
            tone="accept"
            icon={(c) => <ReceiptIcon color={c} size={26} />}
            href={'/v2/expense/new' as Href}
          />
        </View>

        <Heading hint={msg('home.importantFirst')}>{msg('v2.toKnow')}</Heading>
        <View testID="home-to-know" style={{ ...cardStyle(t), paddingHorizontal: t.space.md, paddingVertical: t.space.xs }}>
          {knowRows.length === 0 ? (
            <Text style={{ ...body(t), color: t.color.inkSoft, paddingVertical: t.space.md }}>{msg('home.nothingToKnow')}</Text>
          ) : (
            knowRows.map((row, i) => (
              <View key={i} style={i > 0 ? { borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint } : undefined}>
                {row}
              </View>
            ))
          )}
        </View>
        <Link href={href('sales')} asChild>
          <Pressable
          testID="home-sales"
          accessibilityRole="link"
          style={{ alignSelf: 'flex-end', minHeight: t.target.min, marginVertical: -t.space.md, flexDirection: 'row', alignItems: 'center', gap: t.space.xs, paddingHorizontal: t.space.xs }}
        >
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.action }}>
            {msg('home.allSales')}
          </Text>
          <ChevronRight color={t.color.action} size={7} />
          </Pressable>
        </Link>

        <Heading>{msg('home.goTo')}</Heading>
        <View testID="home-go-to" style={{ gap: t.space.sm }}>
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            <Mod slug="reports" tone="action" icon={(c) => <ChartIcon color={c} size={18} />} label={msg('v2.reports')} />
            <Mod slug="weather" tone="action" icon={(c) => <WeatherIcon color={c} size={20} />} label={msg('v2.weather')} small={msg('home.external')} external />
          </View>
          <Mod
            slug="payables"
            tone="cream"
            icon={(c) => <WalletIcon color={c} size={20} />}
            label={msg('v2.payables')}
            badge={{ value: formatSatang(payable), word: msg('v2m.baht') }}
          />
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            <Mod slug="expenses" tone="cream" icon={(c) => <ReceiptIcon color={c} size={20} />} label={msg('v2.expenses')} />
            <Mod slug="order" to={ORDER_NEW as Href} tone="accept" icon={(c) => <LeafIcon color={c} size={20} />} label={msg('ords.homeBuy')} />
          </View>
          <Mod slug="stock" tone="accept" icon={(c) => <BoxIcon color={c} size={20} />} label={msg('v2.stock')} />
          <Mod
            slug="workers"
            to={'/v2/people?filter=tapper' as Href}
            tone="neutral"
            icon={(c) => <UsersIcon color={c} size={20} />}
            label={msg('v2.workers')}
            badge={{ value: String(tappers), word: msg('role.tapper') }}
          />
        </View>
      </ScrollView>

      <HomeMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

type FactIcon = (p: { color: string; size?: number }) => React.ReactNode;

/** The ☰ menu (v1.1.0 screen 1), then the built lists the mockup reaches elsewhere. */
function HomeMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const msg = useT();
  const item = (slug: string, tone: TileTone, icon: IconRender, facts?: [FactIcon, string][]) => (
    <MenuItem
      key={slug}
      testID={`nav-${slug}`}
      label={msg(farmSection(slug).titleId)}
      leading={<IconTile tone={tone} icon={icon} />}
      href={href(slug)}
      onPress={onClose}
    >
      {facts?.map(([Icon, text]) => (
        <FactRow key={text} icon={(c) => <Icon color={c} size={12} />}>
          {text}
        </FactRow>
      ))}
    </MenuItem>
  );
  return (
    <Drawer open={open} onClose={onClose}>
      <MenuSection title={msg('menu.shared')}>
        {item('farm', 'accept', (c) => <FarmIcon color={c} size={22} />, [
          [FarmIcon, msg('v2.farms')],
          [UsersIcon, msg('menu.factPeople')],
          [BankIcon, msg('v2.accounts')],
          [GearIcon, msg('saleSettings.title')],
        ])}
        {item('expenses', 'cream', (c) => <ReceiptIcon color={c} size={22} />)}
        {item('points', 'action', (c) => <PinIcon color={c} size={22} />)}
        {item('shares', 'action', (c) => <PercentIcon color={c} size={22} />)}
        {item('debts', 'cream', (c) => <DebtIcon color={c} size={22} />)}
        {item('sales', 'accept', (c) => <BasketIcon color={c} size={22} />)}
      </MenuSection>
      <MenuSection title={msg('menu.device')}>
        {item('device', 'neutral', (c) => <DeviceIcon color={c} size={22} />, [
          [GearIcon, msg('settings.textSize')],
          [ClockIcon, msg('menu.factHold')],
          [SpeakerIcon, msg('menu.factSound')],
        ])}
        {item('sync', 'neutral', (c) => <SwapIcon color={c} size={22} />)}
      </MenuSection>
    </Drawer>
  );
}

/** Sales for the home rows: every sale's log, read again whenever home is shown. */
function useHomeSales(): HomeSales | null {
  const [sales, setSales] = useState<HomeSales | null>(null);
  const reload = useCallback(() => {
    let live = true;
    (async () => {
      const loaded = await loadHomeSales();
      if (live) setSales(loaded);
    })().catch((err) => console.error('Sales could not be read.', err));
    return () => {
      live = false;
    };
  }, []);
  useEffect(reload, [reload]);
  useFocusEffect(reload);
  return sales;
}

const body = (t: Theme) => ({ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.ink });

/** Mockup `.sec-h b`: a bold section heading. */
function Heading({ children, hint }: { children: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: t.space.sm, paddingHorizontal: t.space.xs }}>
      <Text
        accessibilityRole="header"
        style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingSm, fontWeight: t.font.weight.bold, color: t.color.ink }}
      >
        {children}
      </Text>
      {hint ? <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: t.color.inkSoft }}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Now, kept current: read again whenever home is shown or the app comes back
 * to the front, so the header date never shows yesterday.
 */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    // Optional: the jest preset's AppState mock returns no subscription.
    return () => sub?.remove();
  }, []);
  return now;
}

/** One "ควรรู้ / ควรจัดการ" row (mockup `.row`): tile, small label, value, facts or a chip, chevron. */
function KnowRow({
  testID,
  tone,
  icon,
  label,
  value,
  chip,
  children,
  to,
}: {
  testID: string;
  tone: TileTone;
  icon: IconRender;
  label?: string;
  value?: string;
  chip?: React.ReactNode;
  children?: React.ReactNode;
  to: Href;
}) {
  const t = useTheme();
  return (
    <Link href={to} asChild>
    <Pressable
      testID={testID}
      accessibilityRole="link"
      style={{ minHeight: t.target.min, paddingVertical: t.space.sm, flexDirection: 'row', alignItems: 'center', gap: t.space.md }}
    >
      <IconTile tone={tone} icon={icon} />
      <View style={{ flex: 1, minWidth: 0, gap: t.space.xxs }}>
        {label ? <Text style={{ ...body(t), color: t.color.inkSoft }}>{label}</Text> : null}
        {value ? <Text style={{ ...body(t), fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.semibold, fontVariant: ['tabular-nums'] }}>{value}</Text> : null}
        {chip}
        {children}
      </View>
      <ChevronRight color={t.color.inkFaint} />
    </Pressable>
    </Link>
  );
}

/** Two per line (summary-lines: more than 2 people go 2 per line). */
function pairsOf<T>(xs: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += 2) out.push(xs.slice(i, i + 2));
  return out;
}

/** One bold summary line under a "ควรรู้" row; wraps, never clips. */
function SumLine({ testID, children }: { testID: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text testID={testID} style={{ ...body(t), fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>
      {children}
    </Text>
  );
}

/** H2 · PR-16: one sale the buyer still owes the farm for — its parts, then Σ from the full total. */
function OwesKnowRow({ o }: { o: OwesRow }) {
  const msg = useT();
  const id = `home-owes-${o.saleId}`;
  return (
    <KnowRow
      testID={id}
      tone="warn"
      icon={() => <FarmMateIcon id="finance.otherCost" size={28} />}
      label={o.buyer ? msg('rp.home.owesBuyer', { date: o.dateText, buyer: o.buyer }) : msg('rp.home.owes', { date: o.dateText })}
      to={`/v2/sale/${o.saleId}/payment` as Href}
    >
      {o.transferSatang > 0 ? (
        <SumLine testID={`${id}-transfer`}>
          {`${msg('rp.home.transferPart')} `}
          <CompactMoney satang={o.transferSatang} />
        </SumLine>
      ) : null}
      {o.cash.map((c) => (
        <SumLine key={c.workerId} testID={`${id}-cash-${c.workerId}`}>
          {`${msg('rp.home.cashPart', { name: c.name })} `}
          <CompactMoney satang={c.satang} />
        </SumLine>
      ))}
      <SumLine testID={`${id}-sum`}>
        {`Σ ${msg('rp.home.sum')} `}
        <CompactMoney satang={o.totalSatang} />
      </SumLine>
    </KnowRow>
  );
}

/** One "ไปที่" module tile (mockup `.mod`); without a row around it, it spans the width (`.mod.wide`). */
function Mod({
  slug,
  to,
  tone,
  icon,
  label,
  small,
  external,
  badge,
}: {
  slug: string;
  to?: Href;
  tone: TileTone;
  icon: IconRender;
  label: string;
  small?: string;
  /** Opens outside the app: a small arrow-out after `small` (mockup `#i-ext`). */
  external?: boolean;
  badge?: { value: string; word: string };
}) {
  const t = useTheme();
  return (
    <Link href={to ?? href(slug)} asChild>
    <Pressable
      testID={`mod-${slug}`}
      accessibilityRole="link"
      style={{
        ...cardStyle(t),
        flex: 1,
        minHeight: t.layout.fabSize,
        borderRadius: t.radius.md,
        paddingVertical: t.space.sm,
        paddingHorizontal: t.space.sm + t.space.xxs,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.sm,
      }}
    >
      <IconTile size="sm" tone={tone} icon={icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...body(t), fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, lineHeight: t.font.size.bodySm * t.font.lineHeight.snug }}>
          {label}
        </Text>
        {small ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <Text style={{ ...body(t), fontSize: t.font.size.micro, color: t.color.inkSoft }}>{small}</Text>
            {external ? (
              <View testID="external-icon" aria-hidden>
                <ExternalIcon color={t.color.inkSoft} size={11} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {badge ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...body(t), fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>{badge.value}</Text>
          <Text style={{ ...body(t), fontSize: t.font.size.micro, fontWeight: t.font.weight.semibold, color: t.color.inkSoft }}>{badge.word}</Text>
        </View>
      ) : null}
    </Pressable>
    </Link>
  );
}

/**
 * The cover (flow-v1 `.cover`): a rubber farm in the morning — sun and rays,
 * a cloud, two hills and two rows of trees — drawn with Views on the
 * mockup's 316×148 grid, scaled to cover the width. Still: the mockup's slow
 * motion is left out.
 */
function Cover() {
  const t = useTheme();
  const msg = useT();
  const [w, setW] = useState(0);
  const H = 148;
  const s = Math.max(w / 316, 1);
  const dy = (H * s - H) / 2;
  /** A shape on the grid, `x`/`y` its top-left in mockup units. */
  const box = (x: number, y: number, bw: number, bh: number) => ({
    position: 'absolute' as const,
    left: x * s,
    top: y * s - dy,
    width: bw * s,
    height: bh * s,
  });
  const oval = (cx: number, cy: number, rx: number, ry: number, colour: string) => (
    <View key={`${cx},${cy}`} style={{ ...box(cx - rx, cy - ry, rx * 2, ry * 2), borderRadius: rx * s, backgroundColor: colour }} />
  );
  const tree = (cx: number, top: number, trunkW: number, trunkH: number, rx: number, ry: number, crown: string) => (
    <View key={cx}>
      <View style={{ ...box(cx - trunkW / 2, top, trunkW, trunkH), borderRadius: s * 2, backgroundColor: t.color.inkSoft }} />
      {oval(cx, top - 4, rx, ry, crown)}
    </View>
  );
  const ray = (deg: number) => (
    <View
      key={deg}
      style={{
        ...box(62 - 1.25, 40 - 3.5, 2.5, 7),
        borderRadius: s,
        backgroundColor: t.color.brandYellow,
        transform: [{ rotate: `${deg}deg` }, { translateY: -27.5 * s }],
      }}
    />
  );
  return (
    <View
      testID="home-cover"
      role="img"
      accessibilityLabel={msg('home.cover')}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: H, borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.color.actionSunk }}
    >
      {w > 0 ? (
        <View aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map(ray)}
          {oval(62, 40, 14, 14, t.color.brandYellow)}
          {oval(200, 34, 22, 9, t.color.surfaceRaised)}
          {oval(216, 28, 14, 10, t.color.surfaceRaised)}
          {oval(186, 30, 11, 8, t.color.surfaceRaised)}
          <View style={{ ...box(-60, 88, 436, 140), borderTopLeftRadius: 220 * s, borderTopRightRadius: 220 * s, backgroundColor: t.color.brandLight }} />
          {[122, 162, 202, 242, 282].map((x, i) => tree(x, [66, 62, 64, 60, 62][i], 4, 44, 15, 13, t.color.brand))}
          <View style={{ ...box(-80, 110, 476, 140), borderTopLeftRadius: 240 * s, borderTopRightRadius: 240 * s, backgroundColor: t.color.brand }} />
          {[99, 153, 207, 261].map((x, i) => tree(x, [70, 74, 72, 70][i], 6, 70, 22, 18, t.color.brandStrong))}
        </View>
      ) : null}
    </View>
  );
}
