/**
 * The money end of a v2 sale (sale mockup v1.1.0 section 4, pages 16–19,
 * 17a, 18, 18a, 17b/17c), on MONEY's logic (`use-sale-money`, the finance
 * log) — nothing is computed here that core does not already compute:
 *
 * - CheckScreen (page 16, E05-S03, D-72): our figures for the buyer, one tap
 *   "ตรงกันทั้งหมด" or "ไม่ตรงกัน" + a reason. Settling waits for a price and
 *   for a tapper on every weighed point (D-63).
 * - SettlementScreen (page 17, 17a, 18): each tapper's share, the debt
 *   deducted at this sale and how it is taken (D-60, D-71), rounding asked
 *   once for the sale, the owner's share and where the transfer goes (D-80).
 * - TallyScreen (page 18a): every pile of money adds up to the sale (D-72).
 * - PaymentScreen (page 19, E05-S05): a tick per payee, then close the sale.
 * - ShowAccountScreen (page 17b/17c): the transfer, full screen, for the buyer.
 *
 * Every write is an event in the sale log or the finance log; offline.
 */

import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { projectAccounts, type Account } from '../../core/finance/accounts';
import { buyerCheck, buyerCheckPayload, buyerCheckTarget, saleFigures } from '../../core/finance/buyer-check';
import type { Settlement } from '../../core/settle';
import { cashNotes, deductSheet, nettingPayloads, overDeducted, pickNotes, pilesCheck, roundCash, type RoundingMode } from '../../core/finance/deduct';
import { balanceAfterSale } from '../../core/finance/debts';
import { formatSatang, parseBahtToSatang } from '../../core/finance/money';
import { OWNER_PAYEE, paymentMarkPayload, paymentStatus, paymentTarget, salePaymentConflicts } from '../../core/finance/payments';
import { BANKS } from '../../core/finance/promptpay';
import { FARM_FUNDS, type DebtPaymentMethod, type SaleAccountChoice } from '../../core/finance/types';
import { tapperOn } from '../../core/master';
import { unassignedPoints } from '../../core/point-settle';
import { canComplete } from '../../core/sale-status';
import { basketList, parsePrice, saleRollup } from '../../core/sale-points';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { newId } from '../../lib/id';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import {
  AlertIcon,
  AppText,
  BankIcon,
  BottomSheet,
  Button,
  cardStyle,
  Check,
  ChevronLeft,
  ChevronRight,
  Chip,
  CTA,
  DebtIcon,
  ExpandIcon,
  IconTile,
  Minus,
  PersonIcon,
  PinIcon,
  Plus,
  RadioCard,
  ScaleIcon,
  TapperIcon,
  TextField,
  UsersIcon,
  ClockIcon,
  toneColours,
} from '../../ui';
import { useSaleMoney } from '../money/sale/use-sale-money';
import { FarmScreen } from '../farm/pieces';
import { MoneyLines, WayLabel } from './person-money';
import { Banner, IconLine, Kv, bahtText, kgText, markClosing, tapperTone, useLeaveIfClosed, useSaleView } from './pieces';

const baht = formatSatang;

/** Remounts its child after a finance write, so every money hook reads the log again. */
function Fresh({ children }: { children: (bump: () => void) => ReactNode }) {
  const [v, setV] = useState(0);
  return <View key={v} style={{ flex: 1 }}>{children(() => setV((x) => x + 1))}</View>;
}

function Big({ value, unit, testID, size = 24, tone }: { value: string; unit?: string; testID?: string; size?: number; tone?: string }) {
  const t = useTheme();
  return (
    <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: size, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: tone ?? t.color.ink }}>
      {value}
      {unit ? <Text style={{ fontSize: t.font.size.bodySm, fontWeight: t.font.weight.regular, color: t.color.inkSoft }}> {unit}</Text> : null}
    </Text>
  );
}

function TotalRow({ label, value, unit, testID, size }: { label: string; value: string; unit?: string; testID?: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm, marginTop: t.space.xs }}>
      <AppText style={{ flexShrink: 1, fontWeight: t.font.weight.bold }}>{unit ? `${label} (${unit})` : label}</AppText>
      <Big value={value} testID={testID} size={size} />
    </View>
  );
}

function LinkRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const t = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="link" onPress={onPress} style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.action, textDecorationLine: 'underline' }}>{label}</Text>
      <ChevronRight color={t.color.action} size={7} />
    </Pressable>
  );
}

/**
 * Our figures for the sale (pages 16 and 18a): weight, price, baskets, the short
 * baskets and where each was weighed, then the sale total. Straight from the
 * settlement (D-15). `prefix` names the test ids so a screen's ids stay its own.
 */
function SaleFigures({ s, prefix, children }: { s: Settlement; prefix: string; children?: ReactNode }) {
  const msg = useT();
  const { events, master, day, nameOf } = useSaleView();
  const shorts = basketList(events).filter((r) => r.status === 'live' && r.short);
  const placeOf = (pointId: string) => {
    const pt = master?.points.find((p) => p.id === pointId);
    return `${master?.properties.find((f) => f.id === pt?.propertyId)?.name ?? ''} ${pt?.name ?? ''}`;
  };
  const ownerOf = (pointId: string) => {
    const id = master ? tapperOn(master, pointId, day) : null;
    return id ? nameOf(id) : '';
  };
  return (
    <>
      <Kv label={msg('v2s.weight')} value={msg('v2f.kg', { n: kgText(s.totals.netG) })} testID={`${prefix}-weight`} />
      <Kv label={msg('v2s.priceLabel')} value={msg('v2s.perKg', { price: baht(s.satangPerKg) })} />
      <Kv label={msg('v2s.basketCount')} value={msg('sales.baskets', { n: s.totals.baskets })} testID={`${prefix}-baskets`} />
      <Kv label={msg('v2s.shortCount', { n: s.totals.shortBaskets })} value={msg('v2f.kg', { n: kgText(s.totals.shortNetG) })} />
      {shorts.map((r) => (
        <Kv key={r.id} indent tone="muted" label={ownerOf(r.pointId) ? msg('v2s.shortAtBy', { place: placeOf(r.pointId), n: r.basketNo, name: ownerOf(r.pointId) }) : msg('v2s.shortAt', { place: placeOf(r.pointId), n: r.basketNo })} value={msg('v2f.kg', { n: kgText(r.netG) })} />
      ))}
      {children}
      <TotalRow label={msg('v2s.saleTotal')} value={baht(s.grossSatang)} unit={msg('v2s.bahtUnit')} testID={`${prefix}-total`} size={26} />
    </>
  );
}

/** The top card of pages 16 and 17: title, then our figures (owner 2026-10-17, "the top card is very good"). */
function SaleCard({ s, title, subtitle, prefix, testID, children }: { s: Settlement; title: string; subtitle?: string; prefix: string; testID: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
      <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{title}</AppText>
      {subtitle ? <AppText variant="label">{subtitle}</AppText> : null}
      <SaleFigures s={s} prefix={prefix} />
      {children}
    </View>
  );
}

// ── 16 · ตรวจยอดกับคนรับซื้อยาง ───────────────────────────────────────────────

export function CheckScreen() {
  return <Fresh>{(bump) => <CheckBody bump={bump} />}</Fresh>;
}

function CheckBody({ bump }: { bump: () => void }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const view = useSaleView();
  const money = useSaleMoney();
  const fin = useFinance();
  // One money write at a time: a double tap must not write twice (review #4).
  const flight = useInFlight();
  const { saleId, events, state, master, day, append, nameOf, saleTitle } = view;
  const [price, setPrice] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);
  const [reason, setReason] = useState('');
  const base = `/v2/sale/${saleId}`;
  const shell = (children?: ReactNode, footer?: ReactNode, overlay?: ReactNode) => (
    <FarmScreen title={msg('v2s.checkTitle')} subtitle={saleTitle} fallback={`${base}/counter` as Href} testID="check" footer={footer} overlay={overlay}>
      {children}
    </FarmScreen>
  );
  if (!view.ready || !master || !money.loaded || fin.events === null) return shell();

  const missing = unassignedPoints(events, master, day);
  if (!state.price && !view.closed) {
    const p = parsePrice(price);
    return shell(
      <View style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.sm }}>
        <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg('v2s.priceFirst')}</AppText>
        <TextField testID="check-price" label={msg('v2s.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={!p.ok ? msg('start.badPrice') : undefined} />
        <CTA
          testID="check-price-save"
          disabled={!p.ok || p.satang === null}
          onPress={() => {
            if (p.ok && p.satang !== null) append({ kind: 'sys', payload: { t: 'price_set', satangPerKg: p.satang, indexRef: '' } });
          }}
        >
          {msg('common.save')}
        </CTA>
      </View>,
    );
  }
  if (missing.length || !money.settlement) {
    return shell(
      <>
        <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.cannotSettle')} lines={[msg('v2s.allNeedTapper')]} testID="check-unassigned" />
        {missing.map((id) => {
          const pt = master.points.find((p) => p.id === id);
          const fm = master.properties.find((f) => f.id === pt?.propertyId);
          return (
            <View key={id} style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.xs }}>
              <Chip tone="warn" label={msg('rec.noTapper')} />
              <AppText>{msg('v2s.place', { farm: fm?.name ?? '', point: pt?.name ?? '' })}</AppText>
              <LinkRow testID={`assign-${id}`} label={msg('v2s.assign')} onPress={() => router.push(`/v2/point/${id}?plan=1` as Href)} />
            </View>
          );
        })}
      </>,
      <CTA testID="to-settlement" disabled onPress={() => undefined}>
        {msg('v2s.toSettlement')}
      </CTA>,
    );
  }

  const s = money.settlement;
  const ours = saleFigures(s);
  const check = buyerCheck(fin.events, saleId, ours);
  const rollup = saleRollup(events, master, day);
  const record = (status: 'total' | 'diff') =>
    flight.run(async () => {
      await fin.write(buyerCheckTarget(saleId), check.head, buyerCheckPayload(saleId, status, ours, null, status === 'diff' ? reason : ''));
      setDiffOpen(false);
      bump();
    });
  const done = check.status === 'total' || check.status === 'weight' || check.status === 'diff';
  // A closed sale is read-only (review #2): its result shows, nothing is asked.
  const closed = view.closed;

  return shell(
    <>
      <SaleCard s={s} title={msg('v2s.buyerGotThis')} subtitle={msg('v2s.computed')} prefix="check" testID="check-card">
        {state.parties?.buyer ? <IconLine icon={(c) => <UsersIcon color={c} size={13} />}>{state.parties.buyer}</IconLine> : null}
        {done || closed ? (
          <View style={{ marginTop: t.space.sm }}>
            <Chip tone={check.status === 'diff' ? 'warn' : done ? 'accept' : 'neutral'} label={msg(check.status === 'diff' ? 'v2s.diffFound' : done ? 'v2s.matched' : 'v2s.notChecked')} testID="check-status" />
          </View>
        ) : (
          <View style={{ gap: t.space.sm, marginTop: t.space.sm }}>
            <Button testID="check-match" variant="primary" icon={(c) => <Check color={c} size={12} />} onPress={() => void record('total')}>
              {msg('v2s.allMatch')}
            </Button>
            <Button testID="check-diff" onPress={() => setDiffOpen(true)}>
              {msg('v2s.noMatch')}
            </Button>
          </View>
        )}
      </SaleCard>
      <View style={{ ...cardStyle(t), paddingHorizontal: t.space.lg }}>
        {s.perZone.map((z, i) => {
          const points = [...rollup.byPoint.entries()].filter(([p]) => tapperOn(master, p, day) === z.personId);
          return (
            <View key={z.zoneId} testID={`check-tapper-${z.personId}`} style={{ paddingVertical: t.space.sm, borderTopWidth: i ? t.border.hair : 0, borderTopColor: t.color.ruleFaint }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
                <IconTile tone={tapperTone(master, z.personId)} icon={(c) => <TapperIcon color={c} size={20} />} />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: t.font.weight.bold }}>{nameOf(z.personId)}</AppText>
                  <IconLine icon={(c) => <PinIcon color={c} size={12} />}>{msg('pick.points', { n: points.length })}</IconLine>
                </View>
                <Big value={msg('v2f.kg', { n: kgText(z.totals.netG) })} size={20} />
              </View>
              {points.map(([pid, tot]) => {
                // Slip-style: point name + total kg, then indented rows "full N baskets … kg" and
                // "short N baskets … kg" in the same right-hand kg column (words, not colour, mark short).
                const num = { fontFamily: t.font.family.sans, fontVariant: ['tabular-nums' as const] };
                const sub = (key: 'v2s.chkFull' | 'v2s.chkShort', n: number, g: number, id: string) => (
                  <View key={id} testID={`${id}-${pid}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.md, paddingLeft: t.space.xl }}>
                    <AppText variant="label" style={{ flex: 1 }}>{msg(key, { n })}</AppText>
                    <Text style={{ ...num, fontSize: t.font.size.bodySm, color: t.color.inkSoft }}>{msg('v2f.kg', { n: kgText(g) })}</Text>
                  </View>
                );
                return (
                  <View key={pid} testID={`check-point-${pid}`} style={{ paddingTop: t.space.sm, paddingLeft: t.space.xs, gap: t.space.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.md }}>
                      <AppText variant="bodySm" style={{ flex: 1, color: t.color.ink }}>{master.points.find((x) => x.id === pid)?.name ?? ''}</AppText>
                      <Text style={{ ...num, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('v2f.kg', { n: kgText(tot.netG) })}</Text>
                    </View>
                    {tot.standardBaskets ? sub('v2s.chkFull', tot.standardBaskets, tot.standardNetG, 'check-full') : null}
                    {tot.shortBaskets ? sub('v2s.chkShort', tot.shortBaskets, tot.shortNetG, 'check-short') : null}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </>,
    done ? (
      <CTA testID="to-settlement" onPress={() => router.push(`${base}/settlement` as Href)}>
        {msg('v2s.toSettlement')}
      </CTA>
    ) : null,
    <BottomSheet open={diffOpen} onClose={() => setDiffOpen(false)} title={msg('v2s.noMatch')} testID="diff-sheet">
      <IconLine>{msg('v2s.diffHint')}</IconLine>
      <TextField testID="diff-reason" label={msg('v2s.diffReason')} required value={reason} onChangeText={setReason} />
      <CTA testID="diff-save" disabled={!reason.trim() || flight.busy} onPress={() => void record('diff')}>
        {msg('v2s.diffSave')}
      </CTA>
    </BottomSheet>,
  );
}

/** Which way debt money moves (owner 2026-10-14): ↘ tapper → farm, ↗ farm → tapper, ⇄ netting — always with a word too. */
type DebtWay = 'in' | 'out' | 'net';
function Dir({ way }: { way: DebtWay }) {
  const t = useTheme();
  const fg = way === 'in' ? t.color.debtIn : way === 'out' ? t.color.debtOut : t.color.debtNet;
  const bg = way === 'in' ? t.color.debtInSunk : way === 'out' ? t.color.debtOutSunk : t.color.debtNetSunk;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderStyle: way === 'net' ? 'dashed' : 'solid', borderColor: fg, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontSize: 15, fontWeight: t.font.weight.bold, lineHeight: 18 }}>{way === 'in' ? '↘' : way === 'out' ? '↗' : '⇄'}</Text>
    </View>
  );
}

/** One debt movement in the "เรื่องหนี้" block: arrow, words, amount without a sign (the arrow says which way). */
function Move({ way, title, detail, amount, testID }: { way: DebtWay; title: string; detail?: string; amount: number; testID?: string }) {
  const t = useTheme();
  const fg = way === 'in' ? t.color.debtIn : way === 'out' ? t.color.debtOut : t.color.debtNet;
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm, paddingVertical: t.space.xs }}>
      <Dir way={way} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontWeight: t.font.weight.semibold }}>{title}</AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
      </View>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: fg }}>{baht(amount)}</Text>
    </View>
  );
}

/** A label with its direction mark, for a `din`/`dout`/`dnet` Kv: nested Text, so it keeps Kv's font and colour on native too. */
const DirLabel = ({ way, text }: { way: DebtWay; text: string }) => <WayLabel mark={way === 'in' ? '↘' : way === 'out' ? '↗' : '⇄'} text={text} />;

/** Section heading on page 17: ก / ข / ค, with an optional tag ("ไม่ใช่ยอดขาย"). */
function Section({ children, tag }: { children: string; tag?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, marginTop: t.space.sm }}>
      <AppText variant="label">{children}</AppText>
      {tag ? <Chip tone="neutral" label={tag} /> : null}
    </View>
  );
}

/** One amount in a tally pile's breakdown: its own row, sign, colour and direction mark (owner 2026-10-14). */
function Part({ testID, way, label, short, satang, base }: { testID: string; way?: DebtWay; label: string; short: string; satang: number; base?: boolean }) {
  const t = useTheme();
  const sign = base ? '' : satang >= 0 ? '+' : '−';
  const value = `${sign}${baht(Math.abs(satang))}`;
  const fg = way === 'in' ? t.color.debtIn : way === 'out' ? t.color.debtOut : t.color.inkSoft;
  return (
    <View testID={testID} accessible accessibilityLabel={`${short} ${value}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.sm, paddingVertical: 1 }}>
      <Text style={{ flexShrink: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: fg }}>
        {way ? <Text style={{ fontWeight: '700' }}>{way === 'in' ? '↘ ' : '↗ '}</Text> : null}
        {label}
      </Text>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: fg }}>{value}</Text>
    </View>
  );
}

/** One line of the tally's checks: the sum it states and ✓ or ✗. */
function CheckLine({ ok, children, testID }: { ok: boolean; children: string; testID: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.sm }}>
      <AppText variant="bodySm" style={{ flex: 1 }}>{children}</AppText>
      <AppText style={{ color: ok ? t.color.accept : t.color.reject, fontWeight: t.font.weight.bold }}>{ok ? '✓' : '✗'}</AppText>
    </View>
  );
}

/** An amount box with − and + beside it, ฿100 a step, kept between `min` and `max` (mockup 17a). */
function AmountStepper({ testID, label, value, placeholder, min = 0, max, onChange, error }: { testID: string; label: string; value: string; placeholder?: string; min?: number; max: number; onChange: (v: string) => void; error?: string }) {
  const t = useTheme();
  const msg = useT();
  const now = value.trim() === '' ? 0 : parseBahtToSatang(value) ?? 0;
  const step = (d: number) => onChange(formatSatang(Math.max(min, Math.min(max, now + d))));
  const round = (sign: 1 | -1, id: string, label2: string) => (
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label2} onPress={() => step(sign * 10_000)} style={{ width: t.target.min, height: t.target.min, borderRadius: t.target.min / 2, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.surface }}>
      {sign < 0 ? <Minus color={t.color.ink} size={14} /> : <Plus color={t.color.ink} size={14} />}
    </Pressable>
  );
  // In the field's own aside, so the row is the field's and the input never runs under the buttons.
  return (
    <TextField
      testID={testID}
      label={label}
      value={value}
      placeholder={placeholder}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      error={error}
      aside={
        <View style={{ flexDirection: 'row', gap: t.space.xs }}>
          {round(-1, `${testID}-minus`, msg('v2s.stepDown'))}
          {round(1, `${testID}-plus`, msg('v2s.stepUp'))}
        </View>
      }
    />
  );
}

const NOTE_KEYS: Record<number, string> = { 100000: '1000', 50000: '500', 10000: '100', 5000: '50', 2000: '20', 1000: '10', 500: '5', 200: '2', 100: '1' };
const noteName = (msg: ReturnType<typeof useT>, satang: number) => (NOTE_KEYS[satang] ? msg(`v2s.note.${NOTE_KEYS[satang]}` as 'v2s.note.1000') : baht(satang));

// ── 17 · สรุปยอดส่วนแบ่ง + 17a หักหนี้ + 18 ปัดเศษ ──────────────────────────────

export function SettlementScreen({ rounding = false }: { rounding?: boolean }) {
  return <Fresh>{(bump) => <SettlementBody bump={bump} openRounding={rounding} />}</Fresh>;
}

const METHODS: readonly Exclude<DebtPaymentMethod, 'outside' | 'netting'>[] = ['cash-from-share', 'buyer-split', 'transfer-with-owner'];

function SettlementBody({ bump, openRounding }: { bump: () => void; openRounding: boolean }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const view = useSaleView();
  const money = useSaleMoney();
  const fin = useFinance();
  // One money write at a time: a double tap must not write twice (review #4).
  const flight = useInFlight();
  const { saleId, master, saleTitle } = view;
  const [deductFor, setDeductFor] = useState<string | null>(null);
  // null = untouched: the box follows the proposal; an empty box is 0 (review F8).
  const [amount, setAmount] = useState<string | null>(null);
  const [netAmount, setNetAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash-from-share');
  const [showNotes, setShowNotes] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // D-60: netting is the owner's own press; a save without it, while the farm owes the worker, asks once more.
  const [netWarned, setNetWarned] = useState(false);
  const [roundOpen, setRoundOpen] = useState(openRounding);
  // /rounding is a write screen: a closed sale goes to its payment (re-review N4).
  useLeaveIfClosed({ ready: view.ready, closed: view.closed && openRounding, saleId: view.saleId });
  const [roundMode, setRoundMode] = useState<RoundingMode | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);
  const [note, setNote] = useState('');
  const base = `/v2/sale/${saleId}`;
  const shell = (children?: ReactNode, footer?: ReactNode, overlay?: ReactNode) => (
    <FarmScreen title={msg('v2s.settleTitle')} subtitle={saleTitle} fallback={`${base}/check` as Href} testID="settlement" footer={footer} overlay={overlay}>
      {children}
    </FarmScreen>
  );
  if (!view.ready || !master || !money.loaded || fin.events === null || !money.settlement) return shell();

  const s = money.settlement;
  const r = money.rounding;
  const asked = r.choice.asked;
  const accounts = projectAccounts(fin.events);
  const choice = accounts.choiceFor(saleId);
  const account = choice?.kind === 'account' ? accounts.accounts.find((a) => a.id === choice.accountId && !a.deleted) ?? null : null;
  const hereAll = (id: string) => (money.debts.get(id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted && p.counts);
  const here = (id: string) => hereAll(id).filter((p) => p.method !== 'netting');
  // Debt repaid in cash (routes 1 and 2) and with the owner's transfer (route 3), D-71.
  const cashIn = money.tappers.flatMap((tp) => here(tp.id).filter((p) => p.method === 'cash-from-share' || p.method === 'buyer-split').map((p) => ({ name: tp.name, satang: p.amountSatang, method: p.method })));
  const transferIn = money.tappers.flatMap((tp) => here(tp.id).filter((p) => p.method === 'transfer-with-owner').map((p) => ({ id: p.id, name: tp.name, satang: p.amountSatang })));
  const farmOf = (personId: string) => s.perZone.filter((z) => z.personId === personId).reduce((a, z) => a + z.ownerSatang, 0);
  const checkedWithBuyer = (() => {
    const c = buyerCheck(fin.events, saleId, saleFigures(s));
    return c.status === 'total' || c.status === 'weight';
  })();
  const farmPayer = { id: FARM_FUNDS, name: msg('fin.payer.farm') };

  // ── the deduction sheet (page 17a, owner 2026-10-14) ──
  // One deduction per worker per sale: the sheet edits this sale's lines as a whole,
  // so every amount below is "as if nothing were deducted here yet".
  const who = money.tappers.find((tp) => tp.id === deductFor) ?? null;
  const whoHere = who ? hereAll(who.id) : [];
  const whoNetHere = whoHere.filter((p) => p.method === 'netting');
  const voidedReps = whoNetHere.flatMap((p) => fin.state?.repayments.filter((r) => r.id === p.repaymentId && !r.deleted) ?? []);
  // Money the farm owes this worker (E11), with what this sale's netting took added back (D-60, D-67).
  const owedList = who && fin.state
    ? fin.state.reimbursements
        .filter((r) => r.to.id === who.id)
        .map((r) => {
          const back = voidedReps.reduce((a, rep) => a + rep.allocations.filter((x) => x.expenseId === r.expenseId).reduce((y, x) => y + x.satang, 0), 0);
          return { ...r, remainingSatang: r.remainingSatang + back };
        })
    : [];
  const owedBack = owedList.reduce((a, r) => a + Math.max(0, r.remainingSatang), 0);
  const whoBalance = who ? (who.account?.balanceSatang ?? 0) + whoHere.reduce((a, p) => a + p.amountSatang, 0) : 0;
  const netTyped = netAmount.trim() === '' ? 0 : parseBahtToSatang(netAmount);
  const totalTyped = amount === null ? null : amount.trim() === '' ? 0 : parseBahtToSatang(amount);
  const sheet = deductSheet({
    balanceSatang: whoBalance,
    shareSatang: who?.shareSatang ?? 0,
    owedBackSatang: owedBack,
    planPerSaleSatang: who?.account?.planPerSaleSatang ?? null,
    totalSatang: totalTyped ?? (amount === null ? null : -1),
    nettingSatang: netTyped ?? -1,
    editing: whoHere.length > 0,
  });
  const amountOk = sheet.problem === null;
  const openDeduct = (id: string) => {
    const tp = money.tappers.find((x) => x.id === id);
    const lines = hereAll(id);
    const net = lines.filter((p) => p.method === 'netting').reduce((a, p) => a + p.amountSatang, 0);
    const route = lines.find((p) => p.method !== 'netting')?.method;
    setAmount(lines.length && tp ? formatSatang(lines.reduce((a, p) => a + p.amountSatang, 0)) : null);
    setNetAmount(net ? formatSatang(net) : '');
    setMethod(route && route !== 'outside' && route !== 'netting' ? route : 'cash-from-share');
    setShowNotes(false);
    setSaveError(false);
    setNetWarned(false);
    setDeductFor(id);
  };
  const saveDeduct = () =>
    flight.run(async () => {
      if (!who || !amountOk || view.closed) return;
      // Nothing changed: no new events, and the lines keep their history (review 2 #2).
      const was = whoHere.reduce((a, p) => a + p.amountSatang, 0);
      const wasNet = whoNetHere.reduce((a, p) => a + p.amountSatang, 0);
      const wasRoutes = new Set(whoHere.filter((p) => p.method !== 'netting').map((p) => p.method));
      const sameRoute = sheet.routeSatang === 0 ? wasRoutes.size === 0 : wasRoutes.size === 1 && wasRoutes.has(method);
      if (whoHere.length && was === sheet.totalSatang && wasNet === sheet.nettingSatang && sameRoute) return setDeductFor(null);
      if (!whoHere.length && owedBack > 0 && sheet.nettingSatang === 0 && sheet.routeSatang > 0 && !netWarned) return setNetWarned(true);
      const repaymentId = newId('rep-');
      const plan = sheet.nettingSatang > 0 ? nettingPayloads({ worker: { id: who.id, name: who.name }, farm: farmPayer, owed: owedList, amountSatang: sheet.nettingSatang, saleId, date: view.day, repaymentId }) : null;
      // Said, not swallowed (review F11): nothing is written when the netting cannot be placed.
      if (plan && !plan.ok) return setSaveError(true);
      // Replace this sale's lines: the old ones go first, so a stop part-way leaves less deducted, never twice.
      for (const p of whoHere) await voidLine(p);
      if (plan?.ok) {
        // The debt payment counts only with its repayment, so writing it first means a stop between the two changes nothing.
        await fin.write(newId('dpay-'), null, plan.debtPayment);
        await fin.write(repaymentId, null, plan.repayment);
      }
      if (sheet.routeSatang > 0) {
        await fin.write(newId('dpay-'), null, {
          t: 'debt_payment_recorded',
          fields: { worker: { id: who.id, name: who.name }, creditor: farmPayer, amountSatang: sheet.routeSatang, date: view.day, note: '', method, saleId },
        });
      }
      setDeductFor(null);
      bump();
    });
  // One line out (the owner fixes a deduction before closing, D-61); a netting line takes its repayment with it.
  const voidLine = async (p: { id: string; headEventId: string; method: DebtPaymentMethod; repaymentId?: string }) => {
    // Repayment first: a netting payment stops counting with it, so a stop between the two leaves nothing half-done.
    const rep = p.method === 'netting' && p.repaymentId ? fin.state?.repayments.find((r) => r.id === p.repaymentId) : undefined;
    if (rep) await fin.write(rep.id, rep.headEventId, { t: 'repayment_changed', patch: { deleted: true } });
    await fin.write(p.id, p.headEventId, { t: 'debt_payment_changed', patch: { deleted: true } });
  };
  const owedTo = (id: string) => (fin.state?.reimbursements ?? []).filter((r) => r.to.id === id).reduce((a, r) => a + Math.max(0, r.remainingSatang), 0);
  const notesText = (notes: readonly number[]) => {
    const counts = new Map<number, number>();
    for (const n of notes) counts.set(n, (counts.get(n) ?? 0) + 1);
    return [...counts].map(([n, k]) => msg(n >= 2000 ? 'v2s.noteBills' : n >= 100 ? 'v2s.noteCoins' : 'v2s.noteSatang', { name: noteName(msg, n), n: k, amount: baht(n) })).join(' + ');
  };

  // One worker's debt at this sale, for blocks ข and ค (mockup v1.2.0).
  const debtOf = (tp: (typeof money.tappers)[number]) => {
    const lines = hereAll(tp.id);
    const routeLines = lines.filter((p) => p.method !== 'netting');
    const route = routeLines.reduce((a, p) => a + p.amountSatang, 0);
    // The pile the buyer hands over for this worker, before anything is lifted out of it (D-71 route 1).
    const pile = tp.shareSatang - routeLines.filter((p) => p.method !== 'cash-from-share').reduce((a, p) => a + p.amountSatang, 0);
    const taken = routeLines.filter((p) => p.method === 'cash-from-share').reduce((a, p) => a + p.amountSatang, 0);
    const owed = owedTo(tp.id);
    const kinds = (['fertilizer', 'loan', 'other'] as const)
      .filter((k) => tp.account?.summary.owed[k])
      .map((k) => `${msg(`debt.kind.${k}`)} ${baht(tp.account!.summary.owed[k])}`)
      .join(' · ');
    return {
      lines,
      routeLines,
      route,
      total: route + tp.nettedSatang,
      taken,
      notes: taken ? pickNotes(pile, taken) : null,
      owed,
      kinds,
      plan: (tp.account?.planPerSaleSatang ?? null) !== null,
      over: overDeducted(tp.debtDeductedSatang + tp.nettedSatang, tp.shareSatang, tp.nettedSatang),
    };
  };
  const debtTappers = money.tappers.filter((tp) => hereAll(tp.id).length > 0 || (tp.account?.balanceSatang ?? 0) > 0);
  const payers = debtTappers.filter((tp) => hereAll(tp.id).length > 0);
  const backs = money.tappers.filter((tp) => tp.nettedSatang > 0);
  const waiting = debtTappers.filter((tp) => hereAll(tp.id).length === 0);

  // ── rounding previews (page 18) ──
  const fraction = r.before.filter((b) => b.cashBeforeSatang % 100 !== 0);
  const preview = (mode: RoundingMode) => r.before.map((b) => ({ ...b, ...roundCash(b.cashBeforeSatang, mode) }));
  const chosenMode = roundMode ?? r.choice.mode;
  const confirmRounding = () =>
    flight.run(async () => {
      if (view.closed) return;
      await r.set(chosenMode);
      setRoundOpen(false);
      router.push(`${base}/tally` as Href);
    });
  const next = () => {
    if (r.result.needsAsking && !asked && !view.closed) setRoundOpen(true);
    else router.push(`${base}/tally` as Href);
  };

  const setAccount = (c: SaleAccountChoice | null) =>
    flight.run(async () => {
      if (view.closed) return;
      await fin.write(`sale-account-${saleId}`, accounts.saleChoiceHead(saleId), { t: 'sale_account_set', saleId, choice: c });
      setAcctOpen(false);
      bump();
    });
  const bank = (a: Account) => BANKS.find((b) => b.code === a.bankCode)?.name ?? a.label;

  return shell(
    <>
      <SaleCard s={s} title={msg('v2s.saleToday')} prefix="settle" testID="settle-card">
        {checkedWithBuyer ? <IconLine icon={(c) => <Check color={c} size={10} />}>{msg('v2s.checkedWithBuyer')}</IconLine> : null}
      </SaleCard>

      {/* ก · the sale, split: weight × price and the shares, nothing about debt (owner 2026-10-14). */}
      <Section>{msg('v2s.secSale')}</Section>
      <View testID="sale-split" style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
        {money.tappers.map((tp, i) => {
          const z = s.perZone.find((x) => x.personId === tp.id);
          return (
            <View key={tp.id} style={{ gap: t.space.xxs, marginTop: i ? t.space.sm : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                <IconTile tone={tapperTone(master, tp.id)} icon={(c) => <TapperIcon color={c} size={16} />} />
                <AppText style={{ fontWeight: t.font.weight.bold }}>{tp.name}</AppText>
                <AppText variant="caption">{msg('v2s.soldBy', { kg: kgText(tp.netG), amount: baht(tp.grossSatang) })}</AppText>
              </View>
              <Kv label={msg('v2s.shareOf', { name: tp.name, pct: z ? 100 - z.ownerPct : tp.pct })} value={baht(tp.shareSatang)} testID={`share-amt-${tp.id}`} />
              <Kv label={msg('v2s.farmPart')} value={baht(farmOf(tp.id))} />
            </View>
          );
        })}
        <Kv tone="total" label={msg('v2s.sumShares')} value={baht(money.tappers.reduce((a, tp) => a + tp.shareSatang, 0))} />
        <Kv label={msg('v2s.sumFarm')} value={baht(s.ownerSatang)} />
        {/* The line the whole block adds up to: as strong as the top card's total, in the ordinary ink (owner 2026-10-18). */}
        <View testID="sum-sale" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm, marginTop: t.space.xs }}>
          <AppText style={{ flexShrink: 1, fontWeight: t.font.weight.bold, fontSize: t.font.size.bodyLg }}>{msg('v2s.sumSale')}</AppText>
          <Big value={baht(s.grossSatang)} size={24} />
        </View>
      </View>

      {/* ข · debt, not the sale (owner 2026-10-14): what tappers pay the farm (↘, one colour) and what the farm
          repays tappers (↗) are two separate chunks; amounts carry no sign, the arrow and words say which way. */}
      {debtTappers.length ? (
        <>
          <View testID="debt-block" style={{ gap: t.space.sm }}>
            <Section tag={msg('v2s.notSale')}>{msg('v2s.secDebt')}</Section>
            {payers.length ? (
              <View testID="debt-in-chunk" style={{ ...cardStyle(t), backgroundColor: t.color.debtInSunk, borderColor: t.color.debtIn, borderWidth: 1.5, padding: t.space.lg, gap: t.space.xxs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                  <Dir way="in" />
                  <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.debtIn }}>{msg('v2s.chunkIn')}</AppText>
                </View>
                {payers.map((tp) => {
                  const d = debtOf(tp);
                  return (
                    <View key={tp.id} testID={`debt-${tp.id}`} style={{ gap: t.space.xxs, marginTop: t.space.xs }}>
                      {d.over ? <Chip tone="reject" label={msg('v2s.overDeducted')} /> : null}
                      <Move
                        way="in"
                        testID={`deducted-${tp.id}`}
                        title={msg(d.plan ? 'v2s.mvPlan' : 'v2s.mvPay', { name: tp.name })}
                        detail={[
                          ...d.routeLines.map((p) => msg(`v2s.how.${p.method}` as 'v2s.how.cash-from-share', { name: tp.name })),
                          tp.nettedSatang && d.route ? msg('v2s.repaySplit', { money: baht(d.route), net: baht(tp.nettedSatang) }) : '',
                        ].filter(Boolean).join(' · ')}
                        amount={d.total}
                      />
                      {d.taken ? (
                        d.notes ? (
                          <View testID={`notes-${tp.id}`}>
                            <IconLine icon={(c) => <Check color={c} size={10} />}>{msg('v2s.pickNotes', { notes: notesText(d.notes) })}</IconLine>
                          </View>
                        ) : (
                          <Chip tone="warn" label={msg('v2s.needsChange')} testID={`notes-${tp.id}`} />
                        )
                      ) : null}
                      {tp.account ? <Kv label={msg('v2s.debtLeftOf', { name: tp.name })} value={baht(Math.max(0, balanceAfterSale(tp.account, saleId, view.day)))} testID={`debt-left-${tp.id}`} /> : null}
                      {view.closed ? null : <LinkRow testID={`edit-deduct-${tp.id}`} label={msg('v2s.editDeduct')} onPress={() => openDeduct(tp.id)} />}
                    </View>
                  );
                })}
              </View>
            ) : null}
            {backs.length ? (
              <View testID="debt-out-chunk" style={{ ...cardStyle(t), backgroundColor: t.color.debtOutSunk, borderColor: t.color.debtOut, borderWidth: 1.5, padding: t.space.lg, gap: t.space.xxs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                  <Dir way="out" />
                  <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.debtOut }}>{msg('v2s.chunkOut')}</AppText>
                </View>
                {backs.map((tp) => {
                  const d = debtOf(tp);
                  return (
                    <View key={tp.id} style={{ gap: t.space.xxs, marginTop: t.space.xs }}>
                      <Move way="out" testID={`netted-${tp.id}`} title={msg('v2s.mvBack', { name: tp.name })} detail={msg('v2s.mvBackNet', { name: tp.name })} amount={tp.nettedSatang} />
                      <Kv label={msg('v2s.owedLeft', { name: tp.name })} value={baht(d.owed)} />
                    </View>
                  );
                })}
              </View>
            ) : null}
            {waiting.length ? (
              <View style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.chunkWaiting')}</AppText>
                {waiting.map((tp) => {
                  const d = debtOf(tp);
                  return (
                    <View key={tp.id} testID={`debt-${tp.id}`} style={{ gap: t.space.xxs, marginTop: t.space.xs }}>
                      <View testID={`owed-hint-${tp.id}`}>
                        <Move way="in" title={msg('v2s.mvOwes', { name: tp.name })} detail={d.kinds} amount={Math.max(0, tp.account?.balanceSatang ?? 0)} />
                        {d.owed > 0 ? <Move way="out" title={msg('v2s.mvOwed', { name: tp.name })} amount={d.owed} /> : null}
                      </View>
                      {view.closed ? null : (
                        <Button testID={`deduct-${tp.id}`} icon={(c) => <Minus color={c} size={12} />} onPress={() => openDeduct(tp.id)}>
                          {msg('v2s.deduct')}
                        </Button>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {/* ค · who gets how much: each one's money = share − what they really paid (route), ± rounding. */}
      <Section>{msg('v2s.secPay')}</Section>
      {money.tappers.map((tp) => {
        const d = debtOf(tp);
        const cash = asked ? tp.cashSatang : tp.cashBeforeSatang;
        const say = [
          msg('v2s.saySold', { name: tp.name, gross: baht(tp.grossSatang), share: baht(tp.shareSatang) }),
          d.total ? msg('v2s.sayPay', { route: baht(d.total) }) : '',
          tp.nettedSatang ? msg('v2s.sayBack', { net: baht(tp.nettedSatang) }) : '',
          msg('v2s.sayGet', { cash: bahtText(cash) }),
          d.lines.length && tp.account ? (balanceAfterSale(tp.account, saleId, view.day) > 0 ? msg('v2s.sayLeft', { left: baht(balanceAfterSale(tp.account, saleId, view.day)) }) : msg('v2s.sayClear')) : '',
        ].filter(Boolean);
        return (
          <View key={tp.id} testID={`share-${tp.id}`} style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, marginBottom: t.space.xs }}>
              <IconTile tone={tapperTone(master, tp.id)} icon={(c) => <TapperIcon color={c} size={18} />} />
              <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg('v2s.cashFor', { name: tp.name })}</AppText>
              {d.over ? <Chip tone="reject" label={msg('v2s.overDeducted')} /> : null}
            </View>
            <MoneyLines personId={tp.id} name={tp.name} shareSatang={tp.shareSatang} paidSatang={d.total} backSatang={tp.nettedSatang} adjustSatang={asked ? tp.adjustSatang : 0} />
            <TotalRow label={`${msg('v2s.cashToPayOf', { name: tp.name })}${asked ? '' : ` ${msg('v2s.notRounded')}`}`} value={bahtText(cash)} unit={msg('v2s.bahtUnit')} testID={`cash-${tp.id}`} />
            <View style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.md, padding: t.space.sm, marginTop: t.space.xs }}>
              <AppText variant="bodySm" testID={`say-${tp.id}`}>{`“${say.join(' · ')}”`}</AppText>
            </View>
          </View>
        );
      })}

      <View testID="owner-card" style={{ ...cardStyle(t), backgroundColor: t.color.brandCream, padding: t.space.lg, gap: t.space.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, marginBottom: t.space.xs }}>
          <IconTile tone="neutral" icon={(c) => <BankIcon color={c} size={18} />} />
          <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg('v2s.ownerTransferTitle')}</AppText>
        </View>
        <Kv label={msg('v2s.farmFromSale')} value={baht(s.ownerSatang)} />
        {asked && r.result.ownerSatang !== s.ownerSatang ? <Kv label={msg('v2s.rounding')} value={`${r.result.ownerSatang > s.ownerSatang ? '+' : '−'}${baht(Math.abs(r.result.ownerSatang - s.ownerSatang))}`} /> : null}
        {transferIn.length ? (
          <View testID="owner-transfer-in">
            {transferIn.map((x) => (
              <Kv key={x.id} tone="din" label={<DirLabel way="in" text={msg('v2s.moneyFrom', { name: x.name, how: msg('v2s.via2.transfer-with-owner') })} />} value={baht(x.satang)} />
            ))}
          </View>
        ) : null}
        <TotalRow label={`${msg('v2s.transferBy')}${asked ? '' : ` ${msg('v2s.notRounded')}`}`} value={baht(asked ? money.ownerTransferSatang : s.ownerSatang + r.transferInSatang)} unit={msg('v2s.bahtUnit')} testID="owner-transfer" size={22} />
        {transferIn.length ? <IconLine>{msg('v2s.transferRepayNote', { amount: baht(transferIn.reduce((a, x) => a + x.satang, 0)) })}</IconLine> : null}
        <View style={{ backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xs, marginTop: t.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="label">{msg('v2s.intoAccount')}</AppText>
            {view.closed ? null : (
              <Button testID="account-change" onPress={() => setAcctOpen(true)}>
                {msg(choice ? 'v2s.change' : 'v2s.choose')}
              </Button>
            )}
          </View>
          {account ? (
            <View testID="account-chosen" style={{ gap: t.space.xxs }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{`${bank(account)} ••${account.accountNo.slice(-4)}`}</AppText>
              {accounts.defaultId === account.id ? <IconLine icon={(c) => <Check color={c} size={10} />}>{msg('v2s.defaultAccount')}</IconLine> : null}
              {account.promptPay ? <IconLine>{msg('v2s.hasPromptPay')}</IconLine> : null}
            </View>
          ) : choice?.kind === 'cash' ? (
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.cashFromBuyer')}</AppText>
          ) : choice?.kind === 'note' ? (
            <AppText style={{ fontWeight: t.font.weight.bold }}>{choice.note}</AppText>
          ) : (
            <IconLine>{msg('v2s.noneChosen')}</IconLine>
          )}
          {account ? (
            <Button testID="show-account" icon={(c) => <ExpandIcon color={c} size={12} />} onPress={() => router.push(`${base}/show-account` as Href)}>
              {msg('v2s.showBuyer')}
            </Button>
          ) : null}
        </View>
      </View>

      {/* Debt repaid in cash today: its own card, not under the owner's share (accountant review); only when there is cash (E05-S10). */}
      {cashIn.length ? (
        <View testID="cash-today" style={{ ...cardStyle(t), backgroundColor: t.color.debtInSunk, padding: t.space.lg, gap: t.space.xxs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <Dir way="in" />
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.debtCashToday')}</AppText>
          </View>
          <AppText variant="bodySm">{msg('v2s.debtCashHint')}</AppText>
          {cashIn.map((c, k) => (
            <Kv key={k} tone="din" label={`${c.name} (${msg(`v2s.via2.${c.method}` as 'v2s.via2.cash-from-share')})`} value={baht(c.satang)} />
          ))}
          {transferIn.map((x) => (
            <Kv key={x.id} tone="muted" label={msg('v2s.viaTransferNoCash', { name: x.name, amount: baht(x.satang) })} value="—" />
          ))}
          <TotalRow label={msg('v2s.debtCashTotal')} value={baht(cashIn.reduce((a, c) => a + c.satang, 0))} size={18} />
        </View>
      ) : null}
    </>,
    <CTA testID="to-rounding" onPress={next}>
      {msg('v2s.toRounding')}
    </CTA>,
    <>
      <BottomSheet open={!!who} onClose={() => setDeductFor(null)} title={msg('v2s.deductTitle', { name: who?.name ?? '' })} testID="deduct-sheet">
        {who ? (
          <>
            <Kv label={msg('v2s.shareNow')} value={baht(who.shareSatang)} />
            <View testID="deduct-breakdown" style={{ backgroundColor: t.color.actionSunk, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xs }}>
              <Kv label={msg('v2s.canDeduct')} value={baht(Math.max(0, whoBalance))} />
              {(['fertilizer', 'loan', 'other'] as const).map((k) =>
                who.account?.summary.owed[k] ? <IconLine key={k} icon={(c) => <DebtIcon color={c} size={10} />}>{`${msg(`debt.kind.${k}`)} ${baht(who.account.summary.owed[k])}`}</IconLine> : null,
              )}
              {who.account && who.account.summary.owed.loan + who.account.summary.owed.fertilizer + who.account.summary.owed.other > whoBalance ? (
                <IconLine>{`${msg('v2s.repaidSoFar')} −${baht(who.account.summary.owed.loan + who.account.summary.owed.fertilizer + who.account.summary.owed.other - whoBalance)}`}</IconLine>
              ) : null}
              <View testID="deduct-reason">
                <IconLine>
                  {[
                    who.account?.planPerSaleSatang != null ? msg('v2s.reasonPlan', { amount: baht(who.account.planPerSaleSatang) }) : msg('v2s.reasonAll'),
                    sheet.proposedSatang < Math.min(Math.max(0, whoBalance), who.account?.planPerSaleSatang ?? Infinity) ? msg('v2s.reasonCut') : '',
                  ].filter(Boolean).join(' · ')}
                </IconLine>
              </View>
              <AmountStepper
                testID="deduct-amount"
                label={msg('v2s.deductNow', { max: baht(sheet.capSatang) })}
                value={amount ?? formatSatang(sheet.totalSatang)}
                min={sheet.nettingSatang}
                max={sheet.capSatang}
                onChange={(v) => {
                  setAmount(v);
                  setSaveError(false);
                  setNetWarned(false);
                }}
                error={sheet.problem === 'total-range' ? msg('v2s.deductRange', { max: baht(sheet.capSatang) }) : sheet.problem === 'below-netting' ? msg('v2s.belowNet', { min: baht(sheet.nettingSatang) }) : undefined}
              />
            </View>
            {owedBack > 0 ? (
              <View testID="net-card" style={{ backgroundColor: t.color.brandCream, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xs }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.netSuggest')}</AppText>
                <IconLine icon={(c) => <DebtIcon color={c} size={12} />}>{msg('v2s.netOwed', { name: who.name, amount: baht(owedBack) })}</IconLine>
                {owedList.filter((r) => r.remainingSatang > 0).map((r) => {
                  const e = fin.state?.expenses.find((x) => x.id === r.expenseId);
                  return e?.item ? <AppText key={r.expenseId} variant="caption">{`${e.item} · ${r.date}`}</AppText> : null;
                })}
                <AmountStepper
                  testID="net-amount"
                  label={msg('v2s.netAmount', { max: baht(sheet.netCapSatang) })}
                  value={netAmount}
                  placeholder={formatSatang(0)}
                  max={sheet.netCapSatang}
                  onChange={(v) => {
                    setNetAmount(v);
                    setSaveError(false);
                    setNetWarned(false);
                  }}
                  error={sheet.problem === 'net-range' ? msg('v2s.netRange', { max: baht(sheet.netCapSatang) }) : undefined}
                />
                {sheet.nettingSatang > 0 ? <Chip tone="neutral" label={msg('v2s.netApplied', { amount: baht(sheet.nettingSatang) })} testID="net-applied" /> : null}
                <AppText variant="caption">{msg('v2s.netHint')}</AppText>
              </View>
            ) : null}
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.howRepay', { name: who.name })}</AppText>
            {new Set(whoHere.filter((p) => p.method !== 'netting').map((p) => p.method)).size > 1 ? (
              <Banner tone="warn" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.mergeRoutes')} lines={[]} testID="deduct-merge-warning" />
            ) : null}
            {sheet.nettingSatang > 0 ? (
              <View testID="route-amount">
                <Kv label={msg('v2s.routeAmount', { name: who.name })} value={baht(sheet.routeSatang)} />
              </View>
            ) : null}
            {METHODS.map((m, k) => {
              const change = m === 'cash-from-share' && pickNotes(who.shareSatang, sheet.routeSatang) === null;
              const lines =
                m === 'cash-from-share'
                  ? [msg('v2s.toHand', { amount: baht(sheet.routeSatang) })]
                  : m === 'buyer-split'
                    ? [msg('v2s.toHandSplit', { amount: baht(sheet.routeSatang) }), msg('v2s.toPile', { name: who.name, amount: baht(sheet.cashSatang) })]
                    : [msg('v2s.toAccount', { amount: baht(sheet.routeSatang) }), msg('v2s.toPile', { name: who.name, amount: baht(sheet.cashSatang) })];
              return (
                <View key={m} style={{ gap: t.space.xxs }}>
                  <RadioCard testID={`method-${m}`} selected={method === m} title={msg(`v2s.method.${m}` as 'v2s.method.cash-from-share', { n: k + 1 })} detail={lines.join('\n')} onPress={() => setMethod(m)}>
                    {change ? <Chip tone="warn" label={msg('v2s.needsChange')} testID="needs-change" /> : null}
                  </RadioCard>
                  {/* Beside the card, not inside it: a button within a radio confuses a screen reader (review 2 #7). */}
                  {change ? (
                    <View style={{ paddingHorizontal: t.space.md, gap: t.space.xxs }}>
                      <Pressable testID="why-notes" accessibilityRole="button" onPress={() => setShowNotes((x) => !x)} style={{ minHeight: t.target.min, justifyContent: 'center' }}>
                        <AppText variant="bodySm" style={{ color: t.color.action, fontWeight: t.font.weight.bold }}>{msg('v2s.whyNotes')}</AppText>
                      </Pressable>
                      {showNotes ? (
                        <View testID="pile-notes">
                          <AppText variant="caption">{msg('v2s.pileNotes', { name: who.name, notes: cashNotes(who.shareSatang).map((n) => baht(n)).join(' · ') })}</AppText>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {/* What นัด gets today, then the debt on its own (mockup v1.2.0): the netting is never under the cash line. */}
            <View style={{ ...cardStyle(t), padding: t.space.md }}>
              <Kv label={msg('v2s.share')} value={baht(who.shareSatang)} />
              {sheet.totalSatang > 0 ? <Kv tone="din" testID="sheet-repay" label={<DirLabel way="in" text={msg('v2s.payRouteAll', { name: who.name })} />} value={baht(sheet.totalSatang)} /> : null}
              {sheet.nettingSatang > 0 ? <Kv tone="dout" testID="sheet-back" label={<DirLabel way="out" text={msg('v2s.payBack', { name: who.name })} />} value={baht(sheet.nettingSatang)} /> : null}
              <TotalRow label={`${msg('v2s.todayGets', { name: who.name })} ${msg('v2s.notRounded')}`} value={baht(sheet.cashSatang)} size={18} testID="sheet-pay" />
            </View>
            <View style={{ ...cardStyle(t), padding: t.space.md }}>
              <Kv tone="total" label={msg('v2s.debtDown', { name: who.name })} value={baht(sheet.totalSatang)} testID="sheet-deducted" />
              {sheet.nettingSatang > 0 ? <Kv tone="dnet" label={<DirLabel way="net" text={msg('v2s.byNetting')} />} value={baht(sheet.nettingSatang)} testID="sheet-netted" /> : null}
              {sheet.routeSatang > 0 ? <Kv label={msg('v2s.paidInMoney', { name: who.name })} value={baht(sheet.routeSatang)} /> : null}
              <Kv label={msg('v2s.debtLeft')} value={baht(sheet.debtLeftSatang)} testID="sheet-debt-left" />
            </View>
            {netWarned ? <Banner tone="warn" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.netWarnTitle', { name: who.name, amount: baht(owedBack) })} lines={[msg('v2s.netWarnLine')]} testID="deduct-net-warning" /> : null}
            {saveError ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.netFailed')} lines={[]} testID="deduct-error" /> : null}
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button testID="deduct-cancel" onPress={() => setDeductFor(null)}>
                  {msg('common.cancel')}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="deduct-save" variant="primary" disabled={!amountOk || flight.busy} onPress={() => void saveDeduct()}>
                  {msg('common.save')}
                </Button>
              </View>
            </View>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet open={roundOpen && !view.closed} onClose={() => setRoundOpen(false)} title={msg('v2s.roundTitle')} testID="rounding-sheet">
        <View style={{ gap: t.space.xxs }}>
          <IconLine icon={(c) => <Check color={c} size={10} />}>{msg('v2s.roundOnce')}</IconLine>
          <IconLine icon={(c) => <Minus color={c} size={10} />}>{msg('v2s.roundAfterDebt')}</IconLine>
          {r.before.map((b) => (
            <IconLine key={b.id} icon={(c) => <TapperIcon color={c} size={12} />}>
              {b.cashBeforeSatang % 100 ? msg('v2s.roundHas', { name: b.name, amount: baht(b.cashBeforeSatang), satang: b.cashBeforeSatang % 100 }) : msg('v2s.roundNone', { name: b.name })}
            </IconLine>
          ))}
        </View>
        {(['worker', 'owner', 'none'] as const).map((m) => {
          const p = preview(m);
          const adj = p.reduce((a, x) => a + x.adjustSatang, 0);
          return (
            <RadioCard
              key={m}
              testID={`round-${m}`}
              selected={chosenMode === m}
              title={msg(`v2s.round.${m}` as 'v2s.round.worker')}
              detail={[...fraction.map((f) => `${f.name} ${bahtText(p.find((x) => x.id === f.id)!.cashSatang)}`), msg('v2s.ownerFromAll', { amount: baht(s.ownerSatang - adj) }), ...(r.choice.mode === m && !asked ? [msg('v2s.lastUsed')] : [])].join('\n')}
              onPress={() => setRoundMode(m)}
            />
          );
        })}
        <AppText variant="bodySm">{msg('v2s.roundLine')}</AppText>
        <CTA testID="round-confirm" onPress={() => void confirmRounding()}>
          {msg('v2s.confirm')}
        </CTA>
      </BottomSheet>

      <BottomSheet open={acctOpen} onClose={() => setAcctOpen(false)} title={msg('v2s.intoAccount')} testID="account-sheet">
        {accounts.accounts
          .filter((a) => !a.deleted)
          .map((a) => (
            <RadioCard
              key={a.id}
              testID={`acct-${a.id}`}
              selected={account?.id === a.id}
              title={`${bank(a)} ••${a.accountNo.slice(-4)}`}
              detail={[a.accountName, msg(a.promptPay ? 'v2s.hasPromptPay' : 'v2s.noPromptPay'), ...(accounts.defaultId === a.id ? [msg('v2s.defaultAccount')] : [])].join('\n')}
              onPress={() => void setAccount({ kind: 'account', accountId: a.id })}
            />
          ))}
        <RadioCard testID="acct-cash" selected={choice?.kind === 'cash'} title={msg('v2s.cashFromBuyer')} detail={msg('v2s.cashFromBuyerHint')} onPress={() => void setAccount({ kind: 'cash' })} />
        <TextField testID="acct-note" label={msg('v2s.noteWhich')} value={note} onChangeText={setNote} />
        <Button testID="acct-note-save" disabled={!note.trim()} onPress={() => void setAccount({ kind: 'note', note: note.trim() })}>
          {msg('common.save')}
        </Button>
        <LinkRow testID="acct-settings" label={msg('v2s.accountSettings')} onPress={() => router.push('/v2/accounts' as Href)} />
        <AppText variant="caption">{msg('v2s.accountNote')}</AppText>
      </BottomSheet>
    </>,
  );
}

// ── 18a · เทียบยอด ─────────────────────────────────────────────────────────────

export function TallyScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const view = useSaleView();
  const money = useSaleMoney();
  const { saleId, master, saleTitle, nameOf } = view;
  const base = `/v2/sale/${saleId}`;
  const ready = view.ready && master && money.loaded && money.settlement;
  const s = money.settlement;
  const r = money.rounding;
  const lines = (id: string) => (money.debts.get(id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted && p.counts && p.method !== 'netting');
  const routeOf = (id: string) => lines(id).reduce((a2, p) => a2 + p.amountSatang, 0);
  const by = (m: DebtPaymentMethod) => money.tappers.flatMap((tp) => lines(tp.id).filter((p) => p.method === m).map((p) => ({ name: tp.name, satang: p.amountSatang })));
  const cashIn = by('cash-from-share');
  const splitIn = by('buyer-split');
  const transfers = by('transfer-with-owner');
  const total = (xs: readonly { satang: number }[]) => xs.reduce((a2, x) => a2 + x.satang, 0);
  const piles = s ? pilesCheck([...money.tappers.map((tp) => ({ satang: tp.cashSatang })), { satang: money.ownerTransferSatang }, { satang: total(cashIn) }, { satang: total(splitIn) }], s.grossSatang) : null;
  // The three checks, from the money as it stands (review 3 #1), so a wrong pile shows ✗:
  // the sale parts add to the sale; what debt moved, pile by pile, sums to 0; so does what rounding moved.
  const saleSum = s ? money.tappers.reduce((a2, tp) => a2 + tp.shareSatang, 0) + s.ownerSatang : 0;
  const ownerRound = s ? r.result.ownerSatang - s.ownerSatang : 0;
  // Listed as the rows above read them (นัด −1,500, +640, …); the sum itself comes from the piles as they stand,
  // so a pile that does not add up (D-61: cash held at 0) makes it non-zero and shows ✗.
  const debtParts = [...money.tappers.flatMap((tp) => [-(routeOf(tp.id) + tp.nettedSatang), tp.nettedSatang]), ...[...transfers, ...cashIn, ...splitIn].map((x) => x.satang)].filter(Boolean);
  const debtSum = piles ? piles.sumSatang - (s?.grossSatang ?? 0) - (money.tappers.reduce((a2, tp) => a2 + tp.cashSatang - tp.cashBeforeSatang, 0) + ownerRound) : 0;
  const roundParts = [...money.tappers.map((tp) => tp.cashSatang - tp.cashBeforeSatang), ownerRound].filter(Boolean);
  const roundSum = roundParts.reduce((a2, x) => a2 + x, 0);
  // A tapper whose line does not add up to the money shown (D-61: deducted over the share, cash held at 0).
  const lineOff = (tp: (typeof money.tappers)[number]) => tp.shareSatang - routeOf(tp.id) + tp.adjustSatang - tp.cashSatang;
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${baht(Math.abs(n))}`;
  const ink = (id: string) => toneColours(t, master ? tapperTone(master, id) : 'neutral').fg;

  return (
    <FarmScreen
      title={msg('v2s.tallyTitle')}
      subtitle={saleTitle}
      fallback={`${base}/settlement` as Href}
      testID="tally"
      footer={
        <CTA testID="to-payment" disabled={!piles?.ok} onPress={() => router.push(`${base}/payment` as Href)}>
          {msg('v2s.toPayment')}
        </CTA>
      }
    >
      {ready && s && piles ? (
        <>
          <View style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg('v2s.saleAll')}</AppText>
            <SaleFigures s={s} prefix="tally">
              {s.perZone.flatMap((z) => (z.personId ? [{ z, personId: z.personId }] : [])).map(({ z, personId }) => (
                <Kv key={z.zoneId} testID={`tally-tapper-${personId}`} label={<Text><TapperIcon color={ink(personId)} size={12} /> {nameOf(personId)} {msg('v2f.kg', { n: kgText(z.totals.netG) })}</Text>} value={baht(z.grossSatang)} />
              ))}
            </SaleFigures>
          </View>
          {/* Each one's money, and where it came from: the sale, a debt moved between hands, rounding (mockup v1.2.0). */}
          <View style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xs }}>
            <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg('v2s.tallyWhoGets')}</AppText>
            {money.tappers.map((tp) => {
              const repaid = routeOf(tp.id) + tp.nettedSatang;
              return (
                <View key={tp.id} style={{ gap: 2 }}>
                  <Kv label={<Text><TapperIcon color={ink(tp.id)} size={12} /> {msg('v2s.cashTo', { name: tp.name })}</Text>} value={baht(tp.cashSatang)} testID={`tally-cash-${tp.id}`} />
                  <View testID={`tally-from-${tp.id}`} style={{ gap: 2, marginLeft: t.space.md, paddingLeft: t.space.sm, borderLeftWidth: 2, borderLeftColor: t.color.ruleFaint }}>
                    <Part testID={`tally-part-${tp.id}-sale`} base label={msg('v2s.fromSale')} short={msg('v2s.fromSale')} satang={tp.shareSatang} />
                    {repaid ? <Part testID={`tally-part-${tp.id}-debt`} way="in" label={msg('v2s.payRouteAll', { name: tp.name })} short={msg('v2s.wayTo', { from: tp.name, to: msg('v2s.farmWord') })} satang={-repaid} /> : null}
                    {tp.nettedSatang ? <Part testID={`tally-part-${tp.id}-back`} way="out" label={msg('v2s.payBack', { name: tp.name })} short={msg('v2s.wayTo', { from: msg('v2s.farmWord'), to: tp.name })} satang={tp.nettedSatang} /> : null}
                    {tp.adjustSatang ? <Part testID={`tally-part-${tp.id}-round`} label={msg('v2s.rounding')} short={msg('v2s.rounding')} satang={tp.adjustSatang} /> : null}
                  </View>
                  {lineOff(tp) ? <Chip tone="reject" label={msg('v2s.lineOff', { amount: baht(Math.abs(lineOff(tp))) })} testID={`tally-mismatch-${tp.id}`} /> : null}
                </View>
              );
            })}
            <View>
              <Kv label={msg('v2s.transferOwner')} value={baht(money.ownerTransferSatang)} testID="tally-transfer" />
              <View testID="tally-owner-from" style={{ gap: 2, marginLeft: t.space.md, paddingLeft: t.space.sm, borderLeftWidth: 2, borderLeftColor: t.color.ruleFaint }}>
                <Part testID="tally-part-owner-sale" base label={msg('v2s.fromSale')} short={msg('v2s.fromSale')} satang={s.ownerSatang} />
                {transfers.map((x, k) => (
                  <Part key={k} testID={k ? `tally-part-owner-debt-${k}` : 'tally-part-owner-debt'} way="in" label={msg('v2s.moneyFrom', { name: x.name, how: msg('v2s.via2.transfer-with-owner') })} short={msg('v2s.wayTo', { from: x.name, to: msg('v2s.farmWord') })} satang={x.satang} />
                ))}
                {ownerRound ? <Part testID="tally-part-owner-round" label={msg('v2s.rounding')} short={msg('v2s.rounding')} satang={ownerRound} /> : null}
              </View>
            </View>
            {cashIn.length ? (
              <View>
                <Kv label={msg('v2s.cashDebt')} value={baht(cashIn.reduce((a2, x) => a2 + x.satang, 0))} testID="tally-cash-debt" />
                <View style={{ gap: 2, marginLeft: t.space.md, paddingLeft: t.space.sm, borderLeftWidth: 2, borderLeftColor: t.color.ruleFaint }}>
                {cashIn.map((x, k) => (
                  <Part key={k} testID={`tally-part-cash-${k}`} way="in" label={msg('v2s.payRouteAll', { name: x.name })} short={msg('v2s.wayTo', { from: x.name, to: msg('v2s.farmWord') })} satang={x.satang} />
                ))}
                </View>
              </View>
            ) : null}
            {splitIn.length ? (
              <View>
                <Kv label={msg('v2s.splitMoney')} value={baht(splitIn.reduce((a2, x) => a2 + x.satang, 0))} testID="tally-split" />
                <View style={{ gap: 2, marginLeft: t.space.md, paddingLeft: t.space.sm, borderLeftWidth: 2, borderLeftColor: t.color.ruleFaint }}>
                {splitIn.map((x, k) => (
                  <Part key={k} testID={`tally-part-split-${k}`} way="in" label={msg('v2s.payRouteAll', { name: x.name })} short={msg('v2s.wayTo', { from: x.name, to: msg('v2s.farmWord') })} satang={x.satang} />
                ))}
                </View>
              </View>
            ) : null}
            <TotalRow label={msg('v2s.allMoney')} value={baht(piles.sumSatang)} testID="tally-sum" size={20} />
          </View>
          <View style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.checksTitle')}</AppText>
            <CheckLine ok={saleSum === s.grossSatang} testID="tally-check-sale">{msg('v2s.checkSale', { amount: baht(saleSum) })}</CheckLine>
            <CheckLine ok={debtSum === 0} testID="tally-check-debt">{msg('v2s.checkDebt', { parts: debtParts.map(signed).join(' ') || '0.00', sum: baht(debtSum) })}</CheckLine>
            <CheckLine ok={roundSum === 0} testID="tally-check-round">{msg('v2s.checkRound', { parts: roundParts.map(signed).join(' ') || '0.00', sum: baht(roundSum) })}</CheckLine>
            <Kv label={msg('v2s.saleAll')} value={baht(s.grossSatang)} testID="tally-sale" />
            {piles.ok ? (
              <Chip tone="accept" label={msg('v2s.allMoneyMatch')} testID="tally-ok" />
            ) : (
              <>
                <Chip tone="warn" label={msg('v2s.offBy', { amount: baht(Math.abs(piles.diffSatang)) })} testID="tally-off" />
                <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.cannotClose')} lines={[msg('v2s.untilMatch')]} />
              </>
            )}
            {debtParts.length ? <AppText variant="caption">{msg('v2s.debtOnlyMoves')}</AppText> : null}
          </View>
          {money.tappers.some((tp) => tp.nettedSatang) ? (
            <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.color.debtNet, backgroundColor: t.color.debtNetSunk, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xxs }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.noCashTitle')}</AppText>
              {money.tappers.filter((tp) => tp.nettedSatang).map((tp) => (
                <View key={tp.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                  <Dir way="net" />
                  <AppText variant="bodySm" testID={`tally-net-${tp.id}`}>{msg('v2s.fromNet', { amount: baht(tp.nettedSatang), name: tp.name })}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </FarmScreen>
  );
}

// ── 19 · การจ่ายเงิน ───────────────────────────────────────────────────────────

export function PaymentScreen() {
  return <Fresh>{(bump) => <PaymentBody bump={bump} />}</Fresh>;
}

function PaymentBody({ bump }: { bump: () => void }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const view = useSaleView();
  const money = useSaleMoney();
  const fin = useFinance();
  // One money write at a time: a double tap must not write twice (review #4).
  const flight = useInFlight();
  const { saleId, state, master, append, saleTitle } = view;
  const draft = state.saleStatus === 'draft';
  const subtitle = draft ? msg('v2s.draftOf', { title: saleTitle }) : saleTitle;
  const ready = view.ready && master && money.loaded && money.settlement && fin.events !== null;
  if (!ready || !money.settlement || fin.events === null) return <FarmScreen title={msg('v2s.payTitle')} subtitle={subtitle} fallback={'/v2/sales' as Href} />;

  const s = money.settlement;
  const check = buyerCheck(fin.events, saleId, saleFigures(s));
  const accounts = projectAccounts(fin.events);
  const choice = accounts.choiceFor(saleId);
  const account = choice?.kind === 'account' ? accounts.accounts.find((a) => a.id === choice.accountId) : undefined;
  const over = money.tappers.some((tp) => overDeducted(tp.debtDeductedSatang + tp.nettedSatang, tp.shareSatang, tp.nettedSatang));
  const cashRepaid = (id: string) => (money.debts.get(id)?.payments ?? []).filter((x) => x.saleId === saleId && !x.deleted && x.counts && (x.method === 'cash-from-share' || x.method === 'buyer-split'));
  const payees = [
    ...money.tappers.map((tp) => ({ id: tp.id, name: tp.name, satang: tp.cashSatang, tp, repaid: null })),
    { id: OWNER_PAYEE, name: '', satang: money.ownerTransferSatang, tp: null, repaid: null },
    // The cash a tapper repays the farm is its own pile: the farm ticks that it got it (E05-S10).
    ...money.tappers.flatMap((tp) => {
      const ps = cashRepaid(tp.id);
      return ps.length ? [{ id: `debt-cash-${tp.id}`, name: tp.name, satang: ps.reduce((a, x) => a + x.amountSatang, 0), tp: null, repaid: { tp, methods: [...new Set(ps.map((x) => x.method))] } }] : [];
    }),
  ];
  // Only rows on the page block: a cash-repayment row goes when its deduction does, and a
  // conflict left on it must not keep the sale from closing with nothing to settle it on.
  const conflicts = salePaymentConflicts(fin.events, saleId).filter((id) => payees.some((p) => p.id === id));
  const tick = (payee: string, amount: number, done: boolean, head: string | null) =>
    flight.run(async () => {
      await fin.write(paymentTarget(saleId, payee), head, paymentMarkPayload(saleId, payee, done, amount));
      bump();
    });
  // Close only when every pile adds up and the rounding was answered (review #6), with
  // no tick in conflict (#5) and nothing deducted over a share (D-61).
  const sum = (m: DebtPaymentMethod) =>
    money.tappers.reduce((a, tp) => a + (money.debts.get(tp.id)?.payments ?? []).filter((x) => x.saleId === saleId && !x.deleted && x.counts && x.method === m).reduce((y, x) => y + x.amountSatang, 0), 0);
  const piles = pilesCheck([...money.tappers.map((tp) => ({ satang: tp.cashSatang })), { satang: money.ownerTransferSatang }, { satang: sum('cash-from-share') }, { satang: sum('buyer-split') }], s.grossSatang);
  const canClose = piles.ok && money.rounding.ready && conflicts.length === 0 && !over;
  const closeSale = () => {
    if (!canClose) return;
    // One navigation, no timing: the list is not in the sale's stack, so dismissTo pops
    // the whole sale (home → sales) and back never reaches a live counter (review #2, N3).
    // A browser keeps its own history: going back there reaches the sale's pages again,
    // each read-only now, and the write ones hand over to /payment.
    markClosing(saleId);
    if (canComplete(state)) append({ kind: 'sys', payload: { t: 'sale_status_set', status: 'completed' } });
    router.dismissTo('/v2/sales' as Href);
  };
  const closed = view.closed;
  // Ticks stay open after close (owner 2026-10-10, N1 option ก); none while ticks
  // conflict (review #5), or for a tapper deducted over the share (D-61).
  // The owner's tick waits on any over-deducted tapper too: route-3 repayments ride on his transfer (review F6).
  const locked = (tp: (typeof money.tappers)[number] | null) =>
    conflicts.length > 0 || flight.busy || (tp ? overDeducted(tp.debtDeductedSatang + tp.nettedSatang, tp.shareSatang, tp.nettedSatang) : over);

  return (
    <FarmScreen
      title={msg('v2s.payTitle')}
      subtitle={subtitle}
      fallback={'/v2/sales' as Href}
      testID="payment"
      footer={
        closed ? null : (
          <Button testID="close-sale" size="large" disabled={!canClose} icon={(c) => <Check color={c} size={14} />} onPress={closeSale}>
            {msg('v2s.closeSale')}
          </Button>
        )
      }
    >
      <View style={{ ...cardStyle(t), padding: t.space.md, flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
        <IconTile tone="accept" icon={(c) => <ScaleIcon color={c} size={18} />} />
        <View style={{ flex: 1, gap: t.space.xxs }}>
          <AppText variant="bodySm">{msg('v2s.checkTitle')}</AppText>
          <Chip tone={check.status === 'diff' ? 'warn' : check.status === 'pending' ? 'neutral' : 'accept'} label={msg(check.status === 'diff' ? 'v2s.diffFound' : check.status === 'pending' ? 'v2s.notChecked' : 'v2s.matched')} testID="pay-check" />
        </View>
      </View>
      {conflicts.length ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.tickConflict')} lines={[msg('v2s.tickConflictLine')]} testID="pay-conflict" /> : null}
      {over ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.overTitle')} lines={[msg('v2s.overLine')]} /> : null}
      {payees.map((p) => {
        const st = paymentStatus(fin.events!, saleId, p.id, p.satang);
        const ded = p.tp ? (money.debts.get(p.id)?.payments ?? []).filter((x) => x.saleId === saleId && !x.deleted && x.counts) : [];
        const gets = !p.tp; // the farm receives: the owner's transfer and the cash repayments
        const lines: { icon?: (c: string) => ReactNode; text: string }[] = [];
        if (st.done && st.at) {
          lines.push({ icon: (c) => <PersonIcon color={c} size={12} />, text: msg('v2s.byDevice') });
          lines.push({ icon: (c) => <ClockIcon color={c} size={12} />, text: new Date(st.at + 7 * 3_600_000).toISOString().slice(11, 16) });
        } else lines.push({ text: msg(gets ? 'v2s.notReceived' : 'v2s.notPaid') });
        if (p.repaid) lines.push({ text: p.repaid.methods.map((m) => msg(`v2s.via2.${m}` as 'v2s.via2.cash-from-share')).join(' · ') });
        if (p.id === OWNER_PAYEE && account) lines.push({ icon: (c) => <BankIcon color={c} size={12} />, text: `${BANKS.find((b) => b.code === account.bankCode)?.name ?? account.label} ••${account.accountNo.slice(-4)}` });
        if (p.id === OWNER_PAYEE && money.rounding.transferInSatang) lines.push({ icon: (c) => <Plus color={c} size={10} />, text: msg('v2s.withDebt', { amount: bahtText(money.rounding.transferInSatang) }) });
        if (st.recheck) lines.push({ icon: (c) => <AlertIcon color={c} size={12} />, text: msg('v2s.recheck') });
        return (
          <Pressable
            key={p.id}
            testID={`tick-${p.id}`}
            accessibilityRole="checkbox"
            aria-checked={st.done}
            disabled={locked(p.tp ?? p.repaid?.tp ?? null)}
            accessibilityState={{ checked: st.done, disabled: locked(p.tp ?? p.repaid?.tp ?? null) }}
            onPress={() => void tick(p.id, p.satang, !st.done, st.head)}
            style={{ ...cardStyle(t), flexDirection: 'row', gap: t.space.md, padding: t.space.md, borderWidth: st.done ? t.border.thick : t.border.hair, borderColor: st.done ? t.color.accept : t.color.ruleStrong, backgroundColor: st.done ? t.color.acceptSunk : t.color.surfaceRaised }}
          >
            <View style={{ width: 28, height: 28, borderRadius: t.radius.sm, borderWidth: t.border.thick, borderColor: st.done ? t.color.accept : t.color.ruleStrong, backgroundColor: st.done ? t.color.accept : t.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              {st.done ? <Check color={t.color.inkInverse} size={12} /> : null}
            </View>
            <View style={{ flex: 1, gap: t.space.xxs }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{p.tp ? msg('v2s.gotCash', { name: p.name }) : p.repaid ? msg('v2s.gotDebtCash', { name: p.name }) : msg('v2s.gotTransfer')}</AppText>
              {lines.map((l, k) => (
                <IconLine key={k} icon={l.icon}>
                  {l.text}
                </IconLine>
              ))}
              {p.tp ? <MoneyLines personId={p.id} name={p.name} shareSatang={p.tp.shareSatang} paidSatang={ded.reduce((a, x) => a + x.amountSatang, 0)} backSatang={p.tp.nettedSatang} adjustSatang={money.rounding.choice.asked ? p.tp.adjustSatang : 0} /> : null}
            </View>
            <Big value={bahtText(p.satang)} size={18} testID={`tick-amt-${p.id}`} />
          </Pressable>
        );
      })}
      <Banner lines={[msg('v2s.tickApart'), msg('v2s.tickRecheck')]} />
      {closed ? <Chip tone="accept" label={msg('status.closed')} testID="sale-closed" /> : null}
    </FarmScreen>
  );
}

// ── 17b / 17c · ให้คนรับซื้อยางดูบัญชี ────────────────────────────────────────

export function ShowAccountScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const view = useSaleView();
  const money = useSaleMoney();
  const fin = useFinance();
  const { saleId } = view;
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/v2/sale/${saleId}/settlement` as Href));
  const accounts = fin.events ? projectAccounts(fin.events) : null;
  const choice = accounts?.choiceFor(saleId);
  const account = choice?.kind === 'account' ? accounts?.accounts.find((a) => a.id === choice.accountId) : undefined;
  const field = (k: string, v: string, size = 24, testID?: string) => (
    <View style={{ alignItems: 'center', gap: t.space.xxs }}>
      <AppText variant="bodySm">{k}</AppText>
      <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: size, fontWeight: t.font.weight.black, color: t.color.ink, textAlign: 'center' }}>
        {v}
      </Text>
    </View>
  );
  const grouped = (n: string) => (n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 4)}-${n.slice(4, 9)}-${n.slice(9)}` : n.length === 12 ? `${n.slice(0, 4)}-${n.slice(4, 8)}-${n.slice(8)}` : n);
  const pp = account?.promptPay;
  const ppText = pp ? (pp.type === 'mobile' && pp.id.length === 10 ? `${pp.id.slice(0, 3)}-${pp.id.slice(3, 6)}-${pp.id.slice(6)}` : pp.id) : '';

  return (
    <View testID="show-account-screen" style={{ flex: 1, backgroundColor: t.color.stage }}>
      <View style={{ padding: t.space.md, alignItems: 'flex-start' }}>
        <Button testID="show-back" icon={(c) => <ChevronLeft color={c} size={10} />} onPress={back}>
          {msg('v2.back')}
        </Button>
      </View>
      {account && money.loaded ? (
        <View style={{ flex: 1, alignItems: 'center', gap: t.space.lg, paddingHorizontal: t.layout.screenPaddingX }}>
          <AppText variant="bodySm">{msg('v2s.transferToOwner')}</AppText>
          <Text testID="show-amount" style={{ fontFamily: t.font.family.sans, fontSize: 44, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.numeral }}>
            {baht(money.ownerTransferSatang)}
            <Text style={{ fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.regular }}> {msg('v2s.bahtUnit')}</Text>
          </Text>
          {pp ? (
            <>
              <IconLine strong icon={(c) => <BankIcon color={c} size={14} />}>{msg('v2s.payPromptPay')}</IconLine>
              {field(msg(pp.type === 'mobile' ? 'v2s.ppMobile' : 'v2s.ppId'), ppText, 32, 'show-promptpay')}
              {field(msg('v2s.accountName'), account.accountName, 22)}
            </>
          ) : (
            <>
              <IconLine strong icon={(c) => <BankIcon color={c} size={14} />}>{msg('v2s.payBank')}</IconLine>
              {field(msg('v2s.bank'), BANKS.find((b) => b.code === account.bankCode)?.name ?? account.label, 28)}
              {field(msg('v2s.accountNo'), grouped(account.accountNo), 32, 'show-account-no')}
              {field(msg('v2s.accountName'), account.accountName, 22)}
              <IconLine>{msg('v2s.noPromptPayHere')}</IconLine>
            </>
          )}
        </View>
      ) : (
        <View style={{ padding: t.layout.screenPaddingX }}>
          <AppText>{msg('v2s.noneChosen')}</AppText>
        </View>
      )}
    </View>
  );
}
