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
import { needsChange, overDeducted, pilesCheck, proposeDeduction, deductionCap, roundCash, type RoundingMode } from '../../core/finance/deduct';
import { formatSatang, parseBahtToSatang, todayIso } from '../../core/finance/money';
import { OWNER_PAYEE, paymentMarkPayload, paymentStatus, paymentTarget, salePaymentConflicts } from '../../core/finance/payments';
import { BANKS } from '../../core/finance/promptpay';
import { FARM_FUNDS, type DebtPaymentMethod, type SaleAccountChoice } from '../../core/finance/types';
import { tapperOn } from '../../core/master';
import { unassignedPoints } from '../../core/point-settle';
import { canComplete } from '../../core/sale-status';
import { basketList, parsePrice, saleRollup } from '../../core/sale-points';
import { useFinance } from '../../finance/use-finance';
import { newId } from '../../lib/id';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import {
  AlertIcon,
  AppText,
  BankIcon,
  BasketIcon,
  BottomSheet,
  Button,
  cardStyle,
  Check,
  ChevronLeft,
  ChevronRight,
  Chip,
  CoinIcon,
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
} from '../../ui';
import { useSaleMoney } from '../money/sale/use-sale-money';
import { FarmScreen } from '../farm/pieces';
import { Banner, IconLine, Kv, bahtText, kgText, tapperTone, useSaleView } from './pieces';

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
      <AppText style={{ fontWeight: t.font.weight.bold }}>{label}</AppText>
      <Big value={value} unit={unit} testID={testID} size={size} />
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
  if (!state.price) {
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
  const shorts = basketList(events).filter((r) => r.status === 'live' && r.short);
  const rollup = saleRollup(events, master, day);
  const placeOf = (pointId: string) => {
    const pt = master.points.find((p) => p.id === pointId);
    return `${master.properties.find((f) => f.id === pt?.propertyId)?.name ?? ''} ${pt?.name ?? ''}`;
  };
  const record = async (status: 'total' | 'diff') => {
    await fin.write(buyerCheckTarget(saleId), check.head, buyerCheckPayload(saleId, status, ours, null, status === 'diff' ? reason : ''));
    setDiffOpen(false);
    bump();
  };
  const done = check.status === 'total' || check.status === 'weight' || check.status === 'diff';

  return shell(
    <>
      <View testID="check-card" style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
        <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg('v2s.buyerGotThis')}</AppText>
        <AppText variant="label">{msg('v2s.computed')}</AppText>
        <Kv label={msg('v2s.weight')} value={msg('v2f.kg', { n: kgText(s.totals.netG) })} testID="check-weight" />
        <Kv label={msg('v2s.priceLabel')} value={msg('v2s.perKg', { price: baht(s.satangPerKg) })} />
        <Kv label={msg('v2s.basketCount')} value={msg('sales.baskets', { n: s.totals.baskets })} testID="check-baskets" />
        <Kv label={msg('v2s.shortCount', { n: s.totals.shortBaskets })} value={msg('v2f.kg', { n: kgText(s.totals.shortNetG) })} />
        {shorts.map((r) => (
          <Kv key={r.id} indent tone="muted" label={msg('v2s.shortAt', { place: placeOf(r.pointId), n: r.basketNo })} value={msg('v2f.kg', { n: kgText(r.netG) })} />
        ))}
        <TotalRow label={msg('v2s.saleTotal')} value={baht(s.grossSatang)} unit={msg('v2s.bahtUnit')} testID="check-total" size={26} />
        {state.parties?.buyer ? <IconLine icon={(c) => <UsersIcon color={c} size={13} />}>{state.parties.buyer}</IconLine> : null}
        {done ? (
          <View style={{ marginTop: t.space.sm }}>
            <Chip tone={check.status === 'diff' ? 'warn' : 'accept'} label={msg(check.status === 'diff' ? 'v2s.diffFound' : 'v2s.matched')} testID="check-status" />
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
      </View>
      <View style={{ ...cardStyle(t), paddingHorizontal: t.space.lg }}>
        {s.perZone.map((z, i) => {
          const points = [...rollup.byPoint.keys()].filter((p) => tapperOn(master, p, day) === z.personId).length;
          return (
            <View key={z.zoneId} testID={`check-tapper-${z.personId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingVertical: t.space.sm, borderTopWidth: i ? t.border.hair : 0, borderTopColor: t.color.ruleFaint }}>
              <IconTile tone={tapperTone(master, z.personId)} icon={(c) => <TapperIcon color={c} size={20} />} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{nameOf(z.personId)}</AppText>
                <IconLine icon={(c) => <PinIcon color={c} size={12} />}>{msg('pick.points', { n: points })}</IconLine>
                <IconLine icon={(c) => <BasketIcon color={c} size={12} />}>{msg('sales.baskets', { n: z.totals.baskets })}</IconLine>
              </View>
              <Big value={msg('v2f.kg', { n: kgText(z.totals.netG) })} size={16} />
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
      <CTA testID="diff-save" disabled={!reason.trim()} onPress={() => void record('diff')}>
        {msg('v2s.diffSave')}
      </CTA>
    </BottomSheet>,
  );
}

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
  const { saleId, master, saleTitle } = view;
  const [deductFor, setDeductFor] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash-from-share');
  const [roundOpen, setRoundOpen] = useState(openRounding);
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
  const here = (id: string) => (money.debts.get(id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted && p.method !== 'netting');
  const cashIn = money.tappers.flatMap((tp) => here(tp.id).filter((p) => p.method === 'cash-from-share').map((p) => ({ name: tp.name, satang: p.amountSatang })));

  // ── the deduction sheet ──
  const who = money.tappers.find((tp) => tp.id === deductFor) ?? null;
  const balance = who?.account?.balanceSatang ?? 0;
  const cap = who ? deductionCap({ balanceSatang: balance + who.debtDeductedSatang, shareSatang: who.shareSatang, nettingSatang: 0 }) - who.debtDeductedSatang : 0;
  const proposed = who ? Math.min(cap, proposeDeduction({ balanceSatang: balance, shareSatang: who.shareSatang - who.debtDeductedSatang, nettingSatang: 0, planPerSaleSatang: who.account?.planPerSaleSatang ?? null })) : 0;
  const typed = amount.trim() === '' ? proposed : parseBahtToSatang(amount);
  const amountOk = typed !== null && typed > 0 && typed <= cap;
  const openDeduct = (id: string) => {
    setAmount('');
    setMethod('cash-from-share');
    setDeductFor(id);
  };
  const saveDeduct = async () => {
    if (!who || !amountOk || typed === null) return;
    await fin.write(newId('dpay-'), null, {
      t: 'debt_payment_recorded',
      fields: { worker: { id: who.id, name: who.name }, creditor: { id: FARM_FUNDS, name: msg('fin.payer.farm') }, amountSatang: typed, date: todayIso(), note: '', method, saleId },
    });
    setDeductFor(null);
    bump();
  };

  // ── rounding previews (page 18) ──
  const fraction = r.before.filter((b) => b.cashBeforeSatang % 100 !== 0);
  const preview = (mode: RoundingMode) => r.before.map((b) => ({ ...b, ...roundCash(b.cashBeforeSatang, mode) }));
  const chosenMode = roundMode ?? r.choice.mode;
  const confirmRounding = async () => {
    await r.set(chosenMode);
    setRoundOpen(false);
    router.push(`${base}/tally` as Href);
  };
  const next = () => {
    if (r.result.needsAsking && !asked) setRoundOpen(true);
    else router.push(`${base}/tally` as Href);
  };

  const setAccount = async (c: SaleAccountChoice | null) => {
    await fin.write(`sale-account-${saleId}`, accounts.saleChoiceHead(saleId), { t: 'sale_account_set', saleId, choice: c });
    setAcctOpen(false);
    bump();
  };
  const bank = (a: Account) => BANKS.find((b) => b.code === a.bankCode)?.name ?? a.label;

  return shell(
    <>
      <IconLine icon={(c) => <CoinIcon color={c} size={14} />} strong>
        {msg('v2s.priceIs', { price: baht(s.satangPerKg) })}
      </IconLine>
      {money.tappers.map((tp) => {
        const z = s.perZone.find((x) => x.personId === tp.id);
        const deducted = tp.debtDeductedSatang;
        const ded = here(tp.id);
        const over = overDeducted(deducted, tp.shareSatang, tp.nettedSatang);
        const cash = asked ? tp.cashSatang : tp.cashBeforeSatang;
        return (
          <View key={tp.id} testID={`share-${tp.id}`} style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.xxs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, marginBottom: t.space.xs }}>
              <IconTile tone={tapperTone(master, tp.id)} icon={(c) => <TapperIcon color={c} size={18} />} />
              <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{tp.name}</AppText>
              {over ? <Chip tone="reject" label={msg('v2s.overDeducted')} /> : null}
            </View>
            <Kv label={msg('v2s.weight')} value={msg('v2f.kg', { n: kgText(tp.netG) })} />
            <Kv label={msg('v2s.sales')} value={baht(tp.grossSatang)} />
            <Kv label={msg('v2s.tapperShare', { pct: z ? 100 - z.ownerPct : tp.pct })} value={baht(tp.shareSatang)} testID={`share-amt-${tp.id}`} />
            {deducted ? <Kv tone="minus" label={msg('v2s.debtDeducted')} value={`−${baht(deducted)}`} /> : <Kv tone="muted" label={msg('v2s.debtDeductedShort')} value={msg('v2s.notDeducted')} />}
            {asked ? <Kv label={msg('v2s.rounding')} value={baht(tp.adjustSatang)} /> : <Kv tone="muted" label={msg('v2s.rounding')} value={msg('v2s.nextStep')} />}
            <TotalRow label={msg('v2s.cashToPay')} value={bahtText(cash)} unit={msg('v2s.bahtUnit')} testID={`cash-${tp.id}`} />
            {tp.account && (tp.account.balanceSatang > 0 || deducted > 0) ? <Kv label={msg('v2s.debtLeft')} value={baht(Math.max(0, tp.account.balanceSatang))} /> : null}
            {ded.length ? (
              <>
                {ded.map((p) => (
                  <IconLine key={p.id} icon={(c) => <CoinIcon color={c} size={12} />}>
                    {msg(`v2s.how.${p.method}` as 'v2s.how.cash-from-share', { name: tp.name })}
                  </IconLine>
                ))}
              </>
            ) : null}
            {tp.account && tp.account.balanceSatang > 0 ? (
              <>
                <View style={{ backgroundColor: t.color.brandCream, borderRadius: t.radius.md, padding: t.space.sm, marginTop: t.space.xs }}>
                  <IconLine icon={(c) => <DebtIcon color={c} size={12} />}>{msg('v2s.debtOwed', { amount: baht(tp.account.balanceSatang) })}</IconLine>
                </View>
                <Button testID={`deduct-${tp.id}`} icon={(c) => <Minus color={c} size={12} />} onPress={() => openDeduct(tp.id)}>
                  {msg('v2s.deduct')}
                </Button>
              </>
            ) : null}
          </View>
        );
      })}

      <View testID="owner-card" style={{ ...cardStyle(t), backgroundColor: t.color.brandCream, padding: t.space.lg, gap: t.space.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, marginBottom: t.space.xs }}>
          <IconTile tone="neutral" icon={(c) => <BankIcon color={c} size={18} />} />
          <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg('v2s.ownerShare')}</AppText>
        </View>
        {s.perZone.map((z) => (
          <Kv key={z.zoneId} label={msg('v2s.ownerFrom', { name: z.zoneName })} value={baht(z.ownerSatang)} />
        ))}
        {asked && r.result.ownerSatang !== s.ownerSatang ? <Kv label={msg('v2s.rounding')} value={baht(r.result.ownerSatang - s.ownerSatang)} /> : null}
        {r.transferInSatang ? <Kv tone="plus" label={msg('v2s.debtWithTransfer')} value={`+${baht(r.transferInSatang)}`} /> : null}
        <TotalRow label={msg('v2s.transfer')} value={baht(money.ownerTransferSatang)} unit={msg('v2s.bahtUnit')} testID="owner-transfer" size={22} />
        <View style={{ backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xs, marginTop: t.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="label">{msg('v2s.intoAccount')}</AppText>
            <Button testID="account-change" onPress={() => setAcctOpen(true)}>
              {msg(choice ? 'v2s.change' : 'v2s.choose')}
            </Button>
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
        {cashIn.length ? (
          <View testID="cash-today" style={{ backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xxs, marginTop: t.space.sm }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.cashToday')}</AppText>
            <AppText variant="bodySm">{msg('v2s.cashTodayHint')}</AppText>
            {cashIn.map((c, k) => (
              <Kv key={k} tone="plus" label={msg('v2s.repaysFarm', { name: c.name })} value={`+${baht(c.satang)}`} />
            ))}
            <TotalRow label={msg('v2s.cashTodayTotal')} value={baht(cashIn.reduce((a, c) => a + c.satang, 0))} size={18} />
          </View>
        ) : null}
      </View>
    </>,
    <CTA testID="to-rounding" onPress={next}>
      {msg('v2s.toRounding')}
    </CTA>,
    <>
      <BottomSheet open={!!who} onClose={() => setDeductFor(null)} title={msg('v2s.deductTitle', { name: who?.name ?? '' })} testID="deduct-sheet">
        {who ? (
          <>
            <Kv label={msg('v2s.shareNow')} value={baht(who.shareSatang)} />
            <View style={{ backgroundColor: t.color.actionSunk, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xs }}>
              <Kv label={msg('v2s.canDeduct')} value={baht(balance)} />
              <TextField testID="deduct-amount" label={msg('v2s.deductNow', { max: baht(cap) })} value={amount} placeholder={formatSatang(proposed)} onChangeText={setAmount} keyboardType="decimal-pad" error={amount.trim() && !amountOk ? msg('v2s.deductRange', { max: baht(cap) }) : undefined} />
            </View>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.howRepay', { name: who.name })}</AppText>
            {METHODS.map((m, k) => (
              <RadioCard
                key={m}
                testID={`method-${m}`}
                selected={method === m}
                title={msg(`v2s.method.${m}` as 'v2s.method.cash-from-share', { n: k + 1 })}
                detail={m === 'cash-from-share' && typed !== null && needsChange(who.cashBeforeSatang, typed) ? msg('v2s.needsChange') : undefined}
                onPress={() => setMethod(m)}
              />
            ))}
            <View style={{ ...cardStyle(t), padding: t.space.md }}>
              <Kv label={msg('v2s.share')} value={baht(who.shareSatang)} />
              <Kv tone="minus" label={msg('v2s.debtDeductedShort')} value={`−${baht((typed ?? 0) + who.debtDeductedSatang)}`} />
              <TotalRow label={msg('v2s.payBeforeRound', { name: who.name })} value={baht(Math.max(0, who.shareSatang - (typed ?? 0) - who.debtDeductedSatang))} size={18} />
            </View>
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button testID="deduct-cancel" onPress={() => setDeductFor(null)}>
                  {msg('common.cancel')}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="deduct-save" variant="primary" disabled={!amountOk} onPress={() => void saveDeduct()}>
                  {msg('common.save')}
                </Button>
              </View>
            </View>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet open={roundOpen} onClose={() => setRoundOpen(false)} title={msg('v2s.roundTitle')} testID="rounding-sheet">
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
  const { saleId, master, saleTitle } = view;
  const base = `/v2/sale/${saleId}`;
  const ready = view.ready && master && money.loaded && money.settlement;
  const s = money.settlement;
  const r = money.rounding;
  const sum = (m: DebtPaymentMethod) =>
    money.tappers.reduce((a, tp) => a + (money.debts.get(tp.id)?.payments ?? []).filter((p) => p.saleId === saleId && !p.deleted && p.method === m).reduce((x, p) => x + p.amountSatang, 0), 0);
  const cashIn = sum('cash-from-share');
  const split = sum('buyer-split');
  const piles = s ? pilesCheck([...money.tappers.map((tp) => ({ satang: tp.cashSatang })), { satang: money.ownerTransferSatang }, { satang: cashIn }, { satang: split }], s.grossSatang) : null;
  const tone = (id: string) => (master ? tapperTone(master, id) : 'neutral');

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
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.cashTappers')}</AppText>
            {money.tappers.map((tp) => (
              <Kv key={tp.id} label={<Text><TapperIcon color={t.color[tone(tp.id) as 'category3']} size={12} /> {tp.name}</Text>} value={baht(tp.cashSatang)} />
            ))}
            <AppText style={{ fontWeight: t.font.weight.bold, marginTop: t.space.sm }}>{msg('v2s.moneyIn')}</AppText>
            <Kv label={msg('v2s.transferOwner')} value={baht(money.ownerTransferSatang)} testID="tally-transfer" />
            <Kv label={msg('v2s.cashDebt')} value={cashIn ? baht(cashIn) : msg('rec.none')} tone={cashIn ? 'plain' : 'muted'} />
            <Kv label={msg('v2s.splitPile')} value={split ? baht(split) : msg('rec.none')} tone={split ? 'plain' : 'muted'} />
            <TotalRow label={msg('v2s.allPiles')} value={baht(piles.sumSatang)} testID="tally-sum" size={20} />
            <Kv label={msg('v2s.saleAll')} value={baht(s.grossSatang)} testID="tally-sale" />
            <AppText style={{ marginTop: t.space.xs }}>{msg('v2s.pilesRule')}</AppText>
            {r.result.workers.some((w) => w.adjustSatang) ? <IconLine>{msg('v2s.roundedNoAdd')}</IconLine> : null}
          </View>
          {piles.ok ? (
            <Chip tone="accept" label={msg('v2s.exact')} testID="tally-ok" />
          ) : (
            <>
              <Chip tone="warn" label={msg('v2s.offBy', { amount: baht(Math.abs(piles.diffSatang)) })} testID="tally-off" />
              <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.cannotClose')} lines={[msg('v2s.untilMatch')]} />
            </>
          )}
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
  const over = money.tappers.some((tp) => overDeducted(tp.debtDeductedSatang, tp.shareSatang, tp.nettedSatang));
  const conflicts = salePaymentConflicts(fin.events, saleId);
  const payees = [...money.tappers.map((tp) => ({ id: tp.id, name: tp.name, satang: tp.cashSatang, tp })), { id: OWNER_PAYEE, name: '', satang: money.ownerTransferSatang, tp: null }];
  const tick = async (payee: string, amount: number, done: boolean, head: string | null) => {
    await fin.write(paymentTarget(saleId, payee), head, paymentMarkPayload(saleId, payee, done, amount));
    bump();
  };
  const closeSale = () => {
    if (canComplete(state)) append({ kind: 'sys', payload: { t: 'sale_status_set', status: 'completed' } });
    router.replace('/v2/sales' as Href);
  };
  const closed = state.saleStatus === 'completed';

  return (
    <FarmScreen
      title={msg('v2s.payTitle')}
      subtitle={subtitle}
      fallback={'/v2/sales' as Href}
      testID="payment"
      footer={
        closed ? null : (
          <Button testID="close-sale" size="large" disabled={over || conflicts.length > 0} icon={(c) => <Check color={c} size={14} />} onPress={closeSale}>
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
      {over ? <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.overTitle')} lines={[msg('v2s.overLine')]} /> : null}
      {payees.map((p) => {
        const st = paymentStatus(fin.events!, saleId, p.id, p.satang);
        const ded = p.tp ? (money.debts.get(p.id)?.payments ?? []).filter((x) => x.saleId === saleId && !x.deleted) : [];
        const lines: { icon?: (c: string) => ReactNode; text: string }[] = [];
        if (st.done && st.at) {
          lines.push({ icon: (c) => <PersonIcon color={c} size={12} />, text: msg('v2s.byDevice') });
          lines.push({ icon: (c) => <ClockIcon color={c} size={12} />, text: new Date(st.at + 7 * 3_600_000).toISOString().slice(11, 16) });
        } else lines.push({ text: msg(p.tp ? 'v2s.notPaid' : 'v2s.notReceived') });
        for (const d of ded) lines.push({ icon: (c) => <Minus color={c} size={10} />, text: msg(d.method === 'cash-from-share' ? 'v2s.dedCash' : d.method === 'transfer-with-owner' ? 'v2s.dedTransfer' : 'v2s.dedOther', { amount: bahtText(d.amountSatang) }) });
        if (!p.tp && account) lines.push({ icon: (c) => <BankIcon color={c} size={12} />, text: `${BANKS.find((b) => b.code === account.bankCode)?.name ?? account.label} ••${account.accountNo.slice(-4)}` });
        if (!p.tp && money.rounding.transferInSatang) lines.push({ icon: (c) => <Plus color={c} size={10} />, text: msg('v2s.withDebt', { amount: bahtText(money.rounding.transferInSatang) }) });
        if (st.recheck) lines.push({ icon: (c) => <AlertIcon color={c} size={12} />, text: msg('v2s.recheck') });
        return (
          <Pressable
            key={p.id}
            testID={`tick-${p.id}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: st.done }}
            aria-checked={st.done}
            onPress={() => void tick(p.id, p.satang, !st.done, st.head)}
            style={{ ...cardStyle(t), flexDirection: 'row', gap: t.space.md, padding: t.space.md, borderWidth: st.done ? t.border.thick : t.border.hair, borderColor: st.done ? t.color.accept : t.color.ruleStrong, backgroundColor: st.done ? t.color.acceptSunk : t.color.surfaceRaised }}
          >
            <View style={{ width: 28, height: 28, borderRadius: t.radius.sm, borderWidth: t.border.thick, borderColor: st.done ? t.color.accept : t.color.ruleStrong, backgroundColor: st.done ? t.color.accept : t.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              {st.done ? <Check color={t.color.inkInverse} size={12} /> : null}
            </View>
            <View style={{ flex: 1, gap: t.space.xxs }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{p.tp ? msg('v2s.gotCash', { name: p.name }) : msg('v2s.gotTransfer')}</AppText>
              {lines.map((l, k) => (
                <IconLine key={k} icon={l.icon}>
                  {l.text}
                </IconLine>
              ))}
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
