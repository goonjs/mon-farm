/**
 * "ค้างใคร" — what the farm owes back, per person (E11-S02, E11-S03).
 *
 * Each person drills down to the expenses behind the total and the
 * repayments against each (NFR-3). A repayment can be deleted (restorable);
 * the balance is recomputed from the log. Loans tappers took from other
 * people are not here — the farm does not owe the lender (D-69).
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, TopBar } from '../../components/chrome';
import { Note } from '../../components/finance/parts';
import { owedByPerson, type OwedTo, type Repayment } from '../../core/finance/ledger';
import { formatDate, formatSatang } from '../../core/finance/money';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

export default function OwedScreen() {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const owed = fin.state ? owedByPerson(fin.state) : null;
  const total = (owed ?? []).reduce((s, o) => s + Math.max(0, o.remainingSatang), 0);
  const items = (owed ?? []).reduce((s, o) => s + o.items.filter((i) => i.remainingSatang > 0).length, 0);
  const people = (owed ?? []).filter((o) => o.remainingSatang > 0).length;

  const setDeleted = async (r: Repayment, deleted: boolean) => {
    await fin.write(r.id, r.headEventId, { t: 'repayment_changed', patch: { deleted } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={msg('fin.owed.title')}
        right={<Button testID="owed-back" onPress={() => router.replace('/finance/expenses')}>{msg('common.back')}</Button>}
      />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        <View style={{ padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk, gap: t.space.xxs }}>
          <Note>{msg('fin.owed.total')}</Note>
          <Text testID="owed-total" style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.ink }}>
            {formatSatang(total)}
          </Text>
          <Note>{msg('fin.owed.summary', { people, items })}</Note>
        </View>

        {owed === null ? (
          <Note>{msg('counter.loading')}</Note>
        ) : owed.length === 0 ? (
          <Note testID="owed-empty">{msg('fin.owed.empty')}</Note>
        ) : (
          owed.map((o) => (
            <Person
              key={o.payer.id}
              o={o}
              categoryName={(id) => fin.state?.categories.find((c) => c.id === id)?.name ?? ''}
              expenseCategory={(id) => fin.state?.expenses.find((x) => x.id === id)?.categoryId ?? null}
              onDelete={setDeleted}
            />
          ))
        )}

        {(fin.state?.repayments ?? [])
          .filter((r) => r.deleted)
          .map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
              <View style={{ flex: 1 }}>
                <Note>
                  {msg('fin.owed.repayment', { amount: formatSatang(r.amountSatang), date: formatDate(r.date), from: r.from.name, to: r.to.name })}
                </Note>
              </View>
              <Button testID={`repayment-restore-${r.id}`} onPress={() => void setDeleted(r, false)}>
                {msg('fin.owed.repaymentRestore')}
              </Button>
            </View>
          ))}

        <Note>{msg('fin.owed.loanNote')}</Note>
      </ScrollView>
    </View>
  );
}

function Person({
  o,
  categoryName,
  expenseCategory,
  onDelete,
}: {
  o: OwedTo;
  categoryName: (id: string | null) => string;
  expenseCategory: (expenseId: string) => string | null;
  onDelete: (r: Repayment, deleted: boolean) => Promise<void>;
}) {
  const t = useTheme();
  const msg = useT();
  const [open, setOpen] = useState(false);
  const flagged = o.items.some((i) => i.status === 'overpaid');

  return (
    <View testID={`owed-${o.payer.id}`} style={{ borderWidth: t.border.hair, borderColor: t.color.rule, borderRadius: t.radius.lg, padding: t.space.md, gap: t.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>{o.payer.name}</Text>
          <Note>
            {o.remainingSatang > 0
              ? msg('fin.owed.person', { n: o.items.filter((i) => i.remainingSatang > 0).length, date: formatDate(o.oldestDate) })
              : msg('fin.status.repaid')}
          </Note>
          {flagged ? <Note tone="reject" testID={`owed-flag-${o.payer.id}`}>{msg('fin.status.overpaid')}</Note> : null}
        </View>
        <Text testID={`owed-amount-${o.payer.id}`} style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {formatSatang(o.remainingSatang)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: t.space.sm, flexWrap: 'wrap' }}>
        <Button testID={`owed-open-${o.payer.id}`} onPress={() => setOpen((v) => !v)}>{open ? '▴' : '▾'}</Button>
        {o.remainingSatang > 0 ? (
          <Button testID={`owed-repay-${o.payer.id}`} variant="primary" onPress={() => router.push({ pathname: '/finance/repay', params: { payerId: o.payer.id } })}>
            {msg('fin.owed.repay')}
          </Button>
        ) : null}
      </View>
      {open
        ? o.items.map((r) => (
            <View key={r.expenseId} style={{ gap: t.space.xxs, paddingLeft: t.space.sm, borderLeftWidth: t.border.thick, borderLeftColor: t.color.rule }}>
              <Button testID={`owed-item-${r.expenseId}`} onPress={() => router.push({ pathname: '/finance/expense/[id]', params: { id: r.expenseId } })}>
                {msg('fin.owed.item', { category: categoryName(expenseCategory(r.expenseId)), date: formatDate(r.date), original: formatSatang(r.originalSatang) })}
              </Button>
              <Note tone={r.status === 'overpaid' ? 'reject' : 'soft'}>
                {`${msg(`fin.status.${r.status}`)} · ${formatSatang(r.remainingSatang)}`}
              </Note>
              {r.repayments.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                  <View style={{ flex: 1 }}>
                    <Note>
                      {msg('fin.owed.repayment', {
                        amount: formatSatang(p.allocations.filter((a) => a.expenseId === r.expenseId).reduce((s, a) => s + a.satang, 0)),
                        date: formatDate(p.date),
                        from: p.from.name,
                        to: p.to.name,
                      })}
                      {p.saleId ? ` · ${msg('fin.status.sale')}` : ''}
                    </Note>
                  </View>
                  <Button testID={`repayment-delete-${p.id}`} variant="destructive" onPress={() => void onDelete(p, true)}>
                    {msg('fin.owed.repaymentDelete')}
                  </Button>
                </View>
              ))}
            </View>
          ))
        : null}
    </View>
  );
}
