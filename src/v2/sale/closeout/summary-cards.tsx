/**
 * E05-S11 · the cards of "สรุปจ่ายเงิน" (mockup A0–A3, A14–A16, A22, A24):
 * progress, sale strip (CO-18), debt card (CO-17/CO-21), owed card (CO-26),
 * one card per tapper (CO-2/CO-4/CO-7), the cash card (CO-19 summary) and
 * the tally bar (CO-9). Short figures through `CompactMoney` only.
 */

import { Fragment, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CloseoutPlan, CloseoutWorker, RepayRoute, TallyBar as Tally } from '../../../core/finance/closeout';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AlertIcon, AppText, Button, cardStyle, ChevronRight, CompactMoney, FarmMateIcon, Plus, toneColours, type TileTone } from '../../../ui';
import { CardIcon, RoundButton, baht, minus } from './summary-parts';

// ── progress ────────────────────────────────────────────────────────────────

export function Progress() {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID="co-progress" style={{ gap: t.space.xs }}>
      <AppText variant="label">{msg('co.progress')}</AppText>
      <View style={{ height: 8, borderRadius: t.radius.pill, backgroundColor: t.color.surfaceSunk, overflow: 'hidden' }}>
        <View style={{ width: '66%', height: '100%', borderRadius: t.radius.pill, backgroundColor: t.color.accept }} />
      </View>
    </View>
  );
}

const row = { flexDirection: 'row', alignItems: 'center' } as const;

// ── sale strip (CO-18) ──────────────────────────────────────────────────────

export function SaleStrip({ grossSatang, checked, onOpen }: { grossSatang: number; checked: boolean; onOpen: () => void }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID="co-sale-strip" style={{ ...cardStyle(t), ...row, paddingVertical: t.space.sm, paddingLeft: t.space.md, paddingRight: t.space.xs, gap: t.space.md }}>
      <CardIcon id="finance.income" tone="accept" />
      <View style={{ flex: 1 }}>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg(checked ? 'co.sale.stripChecked' : 'co.sale.strip')}</AppText>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingXl, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
          {baht(grossSatang)}
          <Text style={{ fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.regular, color: t.color.inkSoft }}> {msg('v2.baht')}</Text>
        </Text>
      </View>
      <RoundButton testID="co-sale-open" label={msg('co.sale.open')} onPress={onOpen} icon={(c) => <View style={{ transform: [{ rotate: '90deg' }] }}><ChevronRight color={c} size={9} /></View>} />
    </View>
  );
}

// ── shell of the debt / owed cards ──────────────────────────────────────────

function BigCard({ testID, done, tone, children }: { testID: string; done: boolean; tone: 'debt' | 'owed'; children: ReactNode }) {
  const t = useTheme();
  const bg = done ? t.color.surfaceRaised : tone === 'debt' ? t.color.debtInSunk : t.color.debtOutSunk;
  const border = done ? t.color.ruleStrong : tone === 'debt' ? t.color.debtIn : t.color.debtOut;
  return (
    <View testID={testID} style={{ ...cardStyle(t), backgroundColor: bg, borderColor: border, borderWidth: t.border.thick, paddingVertical: t.space.sm, paddingLeft: t.space.md, paddingRight: t.space.xs, gap: t.space.xs }}>
      {children}
    </View>
  );
}

/** "ไม่มี" / "มี · จด…" — the asking card's two buttons (A0). */
function AskButtons({ none, add, answered, idNone, idAdd }: { none: () => void; add: () => void; answered: boolean; idNone: string; idAdd: string }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View style={{ ...row, gap: t.space.sm, paddingRight: t.space.sm }}>
      <View style={{ flex: 1 }}>
        <Button testID={idNone} variant={answered ? 'primary' : 'ghost'} onPress={none}>
          {msg('co.none')}
        </Button>
      </View>
      <View style={{ flex: 1 }}>
        <Button testID={idAdd} variant="primary" icon={(c) => <Plus color={c} />} onPress={add}>
          {idAdd === 'co-debt-add-first' ? msg('co.debt.addFirst') : msg('co.owed.addFirst')}
        </Button>
      </View>
    </View>
  );
}

const Name = ({ children }: { children: string }) => {
  const t = useTheme();
  return <Text style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{children}</Text>;
};

function Sentence({ children, testID }: { children: ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, color: t.color.ink, flexShrink: 1 }}>
      {children}
    </Text>
  );
}

const pairs = <T,>(list: readonly T[]): T[][] => list.reduce<T[][]>((a, x, i) => (i % 2 ? (a[a.length - 1].push(x), a) : [...a, [x]]), []);

// ── debt card (CO-17, CO-21) ────────────────────────────────────────────────

export interface DebtCardPerson {
  readonly w: CloseoutWorker;
  readonly pieces: number;
  readonly checked: boolean;
}

export function DebtCard({
  people,
  balanceSatang,
  answered,
  onOpen,
  onNone,
  onAdd,
}: {
  people: readonly DebtCardPerson[];
  /** Σ of what the debtors owe before this sale (the card's total line). */
  balanceSatang: number;
  answered: boolean;
  onOpen: () => void;
  onNone: () => void;
  onAdd: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  if (!people.length) {
    return (
      <BigCard testID="co-debt-ask" done={answered} tone="debt">
        <View style={{ ...row, gap: t.space.md, minHeight: t.target.min }}>
          <CardIcon id="finance.otherCost" checked={answered} />
          <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{msg('co.debt.ask')}</AppText>
        </View>
        <AskButtons none={onNone} add={onAdd} answered={answered} idNone="co-debt-none" idAdd="co-debt-add-first" />
      </BigCard>
    );
  }
  const open = people.filter((p) => !p.checked).length;
  const done = open === 0;
  const took = (p: DebtCardPerson) => (
    <>
      <Text style={{ color: t.color.debtIn }}> ↘ {msg('co.debt.took')} </Text>
      <CompactMoney satang={p.w.totalSatang} size="bodyLg" />
    </>
  );
  return (
    <BigCard testID="co-debt-card" done={done} tone="debt">
      <View style={{ ...row, gap: t.space.md }}>
        <CardIcon id="finance.otherCost" badge={open || undefined} checked={done} testID="co-debt-badge" />
        <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{msg(done ? 'co.debt.checked' : 'co.debt.title')}</AppText>
        <RoundButton testID="co-debt-open" label={msg('co.debt.open')} strong={!done} onPress={onOpen} />
      </View>
      {done
        ? people.map((p) => (
            <Sentence key={p.w.id} testID={`co-debt-line-${p.w.id}`}>
              <Name>{p.w.name}</Name>
              {took(p)}
              <Text style={{ color: t.color.inkSoft }}> {msg('co.debt.leftAfter')} </Text>
              <CompactMoney satang={p.w.debtLeftSatang} size="bodyLg" />
            </Sentence>
          ))
        : (
          <>
            {pairs(people).map((two, i) => (
              <View key={i} style={{ ...row, flexWrap: 'wrap', paddingRight: t.space.sm }}>
                {two.map((p) => (
                  <View key={p.w.id} style={{ flexBasis: '50%', flexGrow: 1 }}>
                    <Sentence testID={`co-debt-line-${p.w.id}`}>
                      <Name>{p.w.name}</Name>
                      {p.checked ? <Text style={{ color: t.color.inkSoft }}> ✓</Text> : null}
                      {p.checked ? took(p) : <Text style={{ color: t.color.inkSoft }}> {msg('co.debt.pieces', { n: p.pieces })}</Text>}
                    </Sentence>
                  </View>
                ))}
              </View>
            ))}
            <Sentence testID="co-debt-total">
              <Text style={{ fontWeight: t.font.weight.black }}>Σ </Text>
              <Text style={{ fontWeight: t.font.weight.bold }}>{msg('co.debt.sum')} </Text>
              <CompactMoney satang={balanceSatang} size="bodyLg" />
            </Sentence>
          </>
        )}
    </BigCard>
  );
}

// ── owed card (CO-26) ───────────────────────────────────────────────────────

export interface OwedCardPerson {
  readonly id: string;
  readonly name: string;
  readonly satang: number;
  /** Netted at this sale (draft), satang. */
  readonly nettedSatang: number;
}

export function OwedCard({
  people,
  checked,
  answered,
  onOpen,
  onNone,
  onAdd,
}: {
  people: readonly OwedCardPerson[];
  checked: ReadonlySet<string>;
  answered: boolean;
  onOpen: () => void;
  onNone: () => void;
  onAdd: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  if (!people.length) {
    return (
      <BigCard testID="co-owed-ask" done={answered} tone="owed">
        <View style={{ ...row, gap: t.space.md, minHeight: t.target.min }}>
          <CardIcon id="finance.workerPay" tone="category5" checked={answered} small />
          <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{msg('co.owed.ask')}</AppText>
        </View>
        <AskButtons none={onNone} add={onAdd} answered={answered} idNone="co-owed-none" idAdd="co-owed-add-first" />
      </BigCard>
    );
  }
  const open = people.filter((p) => !checked.has(p.id)).length;
  const done = open === 0;
  return (
    <BigCard testID="co-owed-card" done={done} tone="owed">
      <View style={{ ...row, gap: t.space.md }}>
        <CardIcon id="finance.workerPay" tone="category5" badge={open || undefined} checked={done} testID="co-owed-badge" small />
        <View style={{ flex: 1, gap: t.space.xxs }}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('co.owed.title')}</AppText>
          {people.map((p) => (
            <Sentence key={p.id} testID={`co-owed-line-${p.id}`}>
              <Name>{p.name}</Name>
              <Text style={{ color: t.color.debtOut }}> ↗ {msg(p.nettedSatang > 0 ? 'co.owed.netted' : 'co.owed.owes')} </Text>
              <CompactMoney satang={p.nettedSatang > 0 ? p.nettedSatang : p.satang} size="bodyLg" />
              {checked.has(p.id) && p.nettedSatang === 0 ? <Text style={{ color: t.color.inkSoft }}> · {msg('co.owed.hold')}</Text> : null}
            </Sentence>
          ))}
        </View>
        <RoundButton testID="co-owed-open" label={msg('co.owed.open')} strong={!done} onPress={onOpen} />
      </View>
    </BigCard>
  );
}

// ── a tapper's card (CO-2, CO-4, CO-7) ──────────────────────────────────────

/** "⚠ หนี้ยังเหลือ 3,100.00": symbol + words, never colour alone (CO-4). */
export function LeftChip({ satang, testID }: { satang: number; testID: string }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID={testID} style={{ ...row, alignSelf: 'flex-start', gap: t.space.xs, backgroundColor: t.color.warnSunk, borderRadius: t.radius.pill, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs }}>
      <AlertIcon color={t.color.warn} size={14} />
      <AppText variant="bodySm" style={{ color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('co.leftChip', { amount: baht(satang) })}</AppText>
    </View>
  );
}

export function WorkerCard({ w, roundingNone, tone, onDeduct }: { w: CloseoutWorker; roundingNone: boolean; tone: TileTone; onDeduct: () => void }) {
  const t = useTheme();
  const msg = useT();
  const fraction = w.cashBeforeSatang % 100 !== 0;
  const note = w.adjustSatang ? msg('co.cashRound', { adj: `${w.adjustSatang > 0 ? '+' : '−'}${baht(Math.abs(w.adjustSatang))}` }) : roundingNone && fraction ? msg('co.cashNoRound') : msg('co.cashToPay');
  const bg = toneColours(t, tone).bg;
  return (
    <View testID={`co-worker-${w.id}`} style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.sm }}>
      <View style={{ ...row, gap: t.space.md, flexWrap: 'wrap' }}>
        <View aria-hidden style={{ width: t.target.min, height: t.target.min, borderRadius: t.radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <FarmMateIcon id="people.tapper" size={32} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{w.name}</AppText>
          <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.share', { amount: baht(w.shareSatang) })}</AppText>
        </View>
        <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
          <Text testID={`co-cash-${w.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayXl, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
            {baht(w.cashSatang)}
          </Text>
          <AppText testID={`co-cash-note-${w.id}`} variant="bodySm" style={{ color: t.color.inkSoft }}>{note}</AppText>
        </View>
      </View>
      {w.hasDebt ? (
        <Pressable
          testID={`co-deduct-${w.id}`}
          accessibilityRole="button"
          accessibilityLabel={msg('co.debt.pieceOpen', { name: w.name })}
          onPress={onDeduct}
          style={{ ...row, minHeight: t.target.min, gap: t.space.sm, backgroundColor: t.color.debtInSunk, borderRadius: t.radius.md, paddingVertical: t.space.xs, paddingLeft: t.space.md, paddingRight: t.space.sm }}
        >
          <View style={{ flex: 1, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>↘ {msg('co.deductRow')}</AppText>
            {w.leftChip ? <LeftChip satang={w.debtLeftSatang} testID={`co-left-${w.id}`} /> : null}
          </View>
          <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd, fontVariant: ['tabular-nums'], color: t.color.debtIn }}>{minus(w.totalSatang)}</AppText>
          <ChevronRight color={t.color.action} size={9} />
        </Pressable>
      ) : null}
      {w.nettingSatang > 0 ? (
        <View testID={`co-net-${w.id}`} style={{ ...row, gap: t.space.sm, backgroundColor: t.color.debtOutSunk, borderRadius: t.radius.md, paddingVertical: t.space.xs, paddingHorizontal: t.space.md }}>
          <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, color: t.color.debtOut }}>↗ {msg('co.netRow', { name: w.name })}</AppText>
          <AppText style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.debtOut }}>+{baht(w.nettingSatang)}</AppText>
        </View>
      ) : null}
    </View>
  );
}

// ── the cash card (CO-19 summary) ───────────────────────────────────────────

export function CashCard({ plan, faded, onOpen }: { plan: CloseoutPlan; faded: boolean; onOpen: () => void }) {
  const t = useTheme();
  const msg = useT();
  const deducting = plan.workers.filter((w) => w.routeSatang > 0);
  const routes = [...new Set(deducting.map((w) => w.route))] as RepayRoute[];
  const routeLabel = routes.length > 1 ? msg('co.route.mixed') : routes.length ? msg(`co.route.${routes[0]}` as 'co.route.transfer-with-owner', { name: deducting[0].name }) : null;
  const parts = [routeLabel, plan.hasFraction ? msg(`co.round.${plan.rounding}` as 'co.round.worker') : null, msg('co.cash.transfer')].filter(Boolean);
  return (
    <Pressable
      testID="co-cash-card"
      accessibilityRole="button"
      accessibilityLabel={msg('co.cash.open')}
      accessibilityState={{ disabled: faded }}
      disabled={faded}
      onPress={onOpen}
      style={{ ...cardStyle(t), ...row, opacity: faded ? 0.5 : 1, paddingVertical: t.space.sm, paddingLeft: t.space.md, paddingRight: t.space.xs, gap: t.space.md }}
    >
      <CardIcon id="people.profitShare" tone="action" />
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{msg('co.cash.title')}</AppText>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.inkSoft }}>
          {parts.map((p, i) => (
            <Fragment key={i}>{i ? ' · ' : ''}{p}</Fragment>
          ))}{' '}
          <CompactMoney satang={plan.transferSatang} size="bodyLg" />
        </Text>
      </View>
      <View style={{ width: t.target.min, height: t.target.min, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 34, height: 34, borderRadius: t.radius.pill, backgroundColor: t.color.actionSunk, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight color={t.color.action} size={9} />
        </View>
      </View>
    </Pressable>
  );
}

// ── tally bar (CO-9) ────────────────────────────────────────────────────────

export function TallyBar({ tally, onSources }: { tally: Tally; onSources: () => void }) {
  const t = useTheme();
  const msg = useT();
  const fg = tally.ok ? t.color.accept : t.color.warn;
  const text = tally.ok ? msg('co.tally.ok') : msg(tally.diffSatang < 0 ? 'co.tally.short' : 'co.tally.over', { amount: baht(Math.abs(tally.diffSatang)) });
  return (
    <View testID="co-tally" style={{ ...row, gap: t.space.sm, backgroundColor: tally.ok ? t.color.acceptSunk : t.color.warnSunk, borderRadius: t.radius.lg, paddingLeft: t.space.md, paddingRight: t.space.xs, paddingVertical: t.space.xxs }}>
      {tally.ok ? <AppText style={{ color: fg, fontWeight: t.font.weight.bold }}>✓</AppText> : <AlertIcon color={fg} size={18} />}
      <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{text}</AppText>
      <Pressable testID="co-sources-open" accessibilityRole="button" onPress={onSources} style={{ minHeight: t.target.min, ...row, paddingHorizontal: t.space.sm, gap: t.space.xxs }}>
        <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.action }}>{msg('co.sources.open')}</AppText>
        <ChevronRight color={t.color.action} size={7} />
      </Pressable>
    </View>
  );
}
