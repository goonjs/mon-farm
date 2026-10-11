/**
 * ค้างใคร — เงินที่สวนต้องคืน, v1.1.0 farm mockup screen 20 (E11-S02,
 * E11-S03 · D-69), rebuilt on src/ui (D-82).
 *
 * The total the farm owes back, per person: what is still open, the oldest
 * date, repaid or netted at a sale. Tapping a person opens their items and
 * repayments; a repayment can be voided and restored (Soft Delete).
 * Money a worker borrowed from someone else is not here — the farm is not
 * that lender's debtor (D-69).
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { owedByPerson, type OwedTo, type Repayment } from '../../core/finance/ledger';
import { formatDate, formatSatang } from '../../core/finance/money';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, Button, CalendarIcon, Card, Check, ChevronRight, CTA, FactRow, IconTile, PersonIcon, PinnedActions, ReceiptIcon, ScreenHeader } from '../../ui';
import { V2_HOME } from '../routes';
import { HalfDot } from './expenses-screen';
import { Day } from './pieces';

export function OwedScreen() {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const fin = useFinance();
  const owed = fin.state ? owedByPerson(fin.state) : null;
  const total = (owed ?? []).reduce((s, o) => s + Math.max(0, o.remainingSatang), 0);
  const people = (owed ?? []).filter((o) => o.remainingSatang > 0).length;
  const items = (owed ?? []).reduce((s, o) => s + o.items.filter((i) => i.remainingSatang > 0).length, 0);
  const firstOwed = (owed ?? []).find((o) => o.remainingSatang > 0);

  const setDeleted = async (r: Repayment, deleted: boolean) => {
    await fin.write(r.id, r.headEventId, { t: 'repayment_changed', patch: { deleted } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('fin.list.owed')} subtitle={msg('v2.owed')} back={{ label: msg('v2.back'), href: V2_HOME, testID: 'owed-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space[16] * 2 }}>
        <Card style={{ alignItems: 'center' }}>
          <AppText variant="bodySm">{msg('fin.owed.total')}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
            <Text testID="owed-total" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayXl, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
              {formatSatang(total)}
            </Text>
            <AppText>{msg('v2m.baht')}</AppText>
          </View>
          <FactRow icon={(c) => <PersonIcon color={c} size={14} />}>{msg('v2m.people', { n: people })}</FactRow>
          <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>{msg('fin.list.count', { n: items })}</FactRow>
        </Card>

        {owed === null ? (
          <AppText variant="bodySm">{msg('counter.loading')}</AppText>
        ) : owed.length === 0 ? (
          <AppText variant="bodySm" testID="owed-empty">{msg('fin.owed.empty')}</AppText>
        ) : (
          <Card style={{ gap: 0, paddingVertical: t.space.xs }}>
            {owed.map((o, i) => (
              <Person
                key={o.payer.id}
                o={o}
                first={i === 0}
                categoryName={(expenseId) => {
                  const x = fin.state?.expenses.find((e) => e.id === expenseId);
                  return fin.state?.categories.find((c) => c.id === x?.categoryId)?.name ?? '';
                }}
                onDelete={setDeleted}
              />
            ))}
          </Card>
        )}

        {(fin.state?.repayments ?? [])
          .filter((r) => r.deleted)
          .map((r) => (
            <Card key={r.id} style={{ backgroundColor: t.color.surfaceSunk }}>
              <AppText variant="bodySm">{msg('fin.owed.repayment', { amount: formatSatang(r.amountSatang), date: formatDate(r.date), from: r.from.name, to: r.to.name })}</AppText>
              <Button testID={`repayment-restore-${r.id}`} variant="ghost" onPress={() => void setDeleted(r, false)}>{msg('fin.owed.repaymentRestore')}</Button>
            </Card>
          ))}

        <Card style={{ backgroundColor: t.color.surfaceSunk }}>
          <AppText variant="bodySm">{msg('fin.owed.loanNote')}</AppText>
        </Card>
      </ScrollView>
      <PinnedActions>
        <CTA
          testID="owed-repay"
          disabled={!firstOwed}
          onPress={() => firstOwed && router.push({ pathname: '/v2/repay', params: { payerId: firstOwed.payer.id } })}
        >
          {msg('fin.repay.title')}
        </CTA>
      </PinnedActions>
    </View>
  );
}

function Person({
  o,
  first,
  categoryName,
  onDelete,
}: {
  o: OwedTo;
  first: boolean;
  categoryName: (expenseId: string) => string;
  onDelete: (r: Repayment, deleted: boolean) => Promise<void>;
}) {
  const t = useTheme();
  const msg = useT();
  const [open, setOpen] = useState(false);
  const flagged = o.items.some((i) => i.status === 'overpaid');
  const openItems = o.items.filter((i) => i.remainingSatang > 0).length;
  const atSale = o.items.flatMap((i) => i.repayments).find((r) => r.saleId);

  return (
    <View testID={`owed-${o.payer.id}`} style={{ borderTopWidth: first ? 0 : t.border.hair, borderTopColor: t.color.ruleFaint, paddingVertical: t.space.sm, gap: t.space.sm }}>
      <Pressable testID={`owed-open-${o.payer.id}`} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
        <IconTile tone="category1" icon={(c) => <PersonIcon color={c} />} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" style={{ fontSize: t.font.size.bodyLg }}>{o.payer.name}</AppText>
          {o.remainingSatang > 0 ? (
            <>
              <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>{msg('fin.list.count', { n: openItems })}</FactRow>
              <FactRow icon={(c) => <CalendarIcon color={c} size={14} />}>{msg('v2m.oldest', { date: formatDate(o.oldestDate) })}</FactRow>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
              <Check color={t.color.accept} />
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.accept }}>{msg('fin.status.repaid')}</Text>
            </View>
          )}
          {atSale ? <FactRow icon={(c) => <ReceiptIcon color={c} size={14} />}>{msg('v2m.nettedAtSale', { date: formatDate(atSale.date) })}</FactRow> : null}
          {flagged ? <Text testID={`owed-flag-${o.payer.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.reject }}>{msg('fin.status.overpaid')}</Text> : null}
        </View>
        <Text testID={`owed-amount-${o.payer.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
          {formatSatang(o.remainingSatang)}
        </Text>
        <ChevronRight color={t.color.inkSoft} />
      </Pressable>

      {open ? (
        <View style={{ gap: t.space.sm, paddingLeft: t.target.min + t.space.md }}>
          {o.items.map((r) => (
            <View key={r.expenseId} style={{ gap: 2 }}>
              <Pressable testID={`owed-item-${r.expenseId}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/v2/expense/[id]', params: { id: r.expenseId } })}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{`${categoryName(r.expenseId)} · ${formatSatang(r.originalSatang)}`}</AppText>
              </Pressable>
              <FactRow icon={(c) => <CalendarIcon color={c} size={14} />}>
                <Day iso={r.date} />
              </FactRow>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                {r.status === 'repaid' ? <Check color={t.color.accept} /> : <HalfDot />}
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: r.status === 'repaid' ? t.color.accept : r.status === 'overpaid' ? t.color.reject : t.color.warn }}>
                  {`${msg(`fin.status.${r.status}`)} · ${formatSatang(r.remainingSatang)}`}
                </Text>
              </View>
              {r.repayments.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                  <AppText variant="bodySm" style={{ flex: 1 }}>
                    {msg('fin.owed.repayment', {
                      amount: formatSatang(p.allocations.filter((a) => a.expenseId === r.expenseId).reduce((s, a) => s + a.satang, 0)),
                      date: formatDate(p.date),
                      from: p.from.name,
                      to: p.to.name,
                    })}
                  </AppText>
                  <Button testID={`repayment-void-${p.id}`} variant="destructive" onPress={() => void onDelete(p, true)}>{msg('fin.owed.repaymentDelete')}</Button>
                </View>
              ))}
            </View>
          ))}
          {o.remainingSatang > 0 ? (
            <Button testID={`owed-repay-${o.payer.id}`} onPress={() => router.push({ pathname: '/v2/repay', params: { payerId: o.payer.id } })}>
              {msg('fin.repay.title')}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
