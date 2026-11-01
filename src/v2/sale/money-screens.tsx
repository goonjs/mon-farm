/**
 * The money end of a v2 sale that the close-out (E05-S11, `closeout/`) did
 * not replace, on MONEY's logic (`use-sale-money`, the finance log):
 *
 * - CheckScreen (page 16, E05-S03, D-72): our figures for the buyer, one tap
 *   "ตรงกันทั้งหมด" or "ไม่ตรงกัน" + a reason. Settling waits for a price and
 *   for a tapper on every weighed point (D-63).
 * - ShowAccountScreen (page 17b/17c): the transfer, full screen, for the buyer.
 *
 * The settlement, rounding, tally and payment pages (17, 17a, 18, 18a, 19)
 * are now `closeout/` (summary, cash step, buyer view, pay page).
 * Every write is an event in the sale log or the finance log; offline.
 */

import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { projectAccounts } from '../../core/finance/accounts';
import { buyerCheck, buyerCheckPayload, buyerCheckTarget, saleFigures } from '../../core/finance/buyer-check';
import type { Settlement } from '../../core/settle';
import { formatSatang } from '../../core/finance/money';
import { BANKS } from '../../core/finance/promptpay';
import { tapperOn } from '../../core/master';
import { unassignedPoints } from '../../core/point-settle';
import { basketList, parsePrice, saleRollup } from '../../core/sale-points';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
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
  IconTile,
  PinIcon,
  TapperIcon,
  TextField,
  UsersIcon,
} from '../../ui';
import { useSaleMoney } from '../money/sale/use-sale-money';
import { FarmScreen } from '../farm/pieces';
import { Banner, IconLine, Kv, kgText, tapperTone, useSaleView } from './pieces';

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
