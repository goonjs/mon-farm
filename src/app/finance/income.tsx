/**
 * Income and leases (E11-S07, FIN-8, FIN-10).
 *
 * Rubber income is the owner's share of each closed sale, pulled from the
 * sale logs (never typed twice) and linked to the sale. Leases record what is
 * known; anything unknown stays "ไม่ทราบ", never zero (SYNC-12). Income
 * received is recorded apart from income expected, and can be tagged for its
 * intended use. Nothing about a particular farm is built in (D-73): the
 * owner enters each lease.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '../../components/chrome';
import { Card, CardTitle, Chip, ChipRow, Fact, Input, Label, MoneyLine, Note, ScreenHeader } from '../../components/finance/parts';
import { formatDate, formatSatang, isIsoDate, parseBahtToSatang, todayIso } from '../../core/finance/money';
import { projectPlan } from '../../core/finance/plan';
import type { IncomeFields, IncomeTag, LeaseFields } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useRubberIncome } from '../../finance/use-rubber-income';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { useTheme } from '../../theme';

const TAGS: readonly IncomeTag[] = ['family', 'insurance', 'reserve'];

export default function IncomeScreen() {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const inFlight = useInFlight();
  const rubber = useRubberIncome().income;
  const plan = useMemo(() => projectPlan(fin.events ?? []), [fin.events]);
  const [leaseForm, setLeaseForm] = useState(false);
  const [incomeForm, setIncomeForm] = useState(false);

  const unknown = msg('inc.unknown');
  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader testID="income" title={msg('inc.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.lg }}>
        <View style={{ gap: t.space.xs }}>
          <Label>{msg('inc.rubber')}</Label>
          {rubber.length === 0 ? <Note testID="rubber-empty">{msg('inc.rubberEmpty')}</Note> : null}
          {rubber.map((r) => (
            <Pressable
              key={r.saleId}
              testID={`rubber-${r.saleId}`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/sale/[id]/settlement', params: { id: r.saleId } })}
              style={{ padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.ruleFaint, backgroundColor: t.color.surfaceRaised }}
            >
              <MoneyLine testID={`rubber-amount-${r.saleId}`} label={formatDate(r.date)} satang={r.satang} dir="in" />
            </Pressable>
          ))}
        </View>

        <View style={{ gap: t.space.xs }}>
          <Label>{msg('inc.leases')}</Label>
          {plan.leases.filter((l) => !l.deleted).map((l) => (
            <Card key={l.id} testID={`lease-${l.id}`}>
              <CardTitle>
                {msg('inc.leaseLine', {
                  farm: l.farmName || unknown,
                  tenant: l.tenant || unknown,
                  rent: l.rentSatang === null ? unknown : formatSatang(l.rentSatang),
                  period: l.period ? msg(`inc.period.${l.period}`) : '',
                })}
              </CardTitle>
              <Fact mark="date" tone={l.start ? 'soft' : 'warn'}>{`${msg('inc.start')}: ${l.start ? formatDate(l.start) : unknown}`}</Fact>
              <Fact mark="person" tone={l.sharePct === null ? 'warn' : 'soft'}>{`${msg('inc.share')}: ${l.sharePct === null ? unknown : `${l.sharePct}%`}`}</Fact>
              {l.note ? <Fact mark="note">{l.note}</Fact> : null}
            </Card>
          ))}
          {leaseForm ? (
            <LeaseForm
              onCancel={() => setLeaseForm(false)}
              onSave={(fields) => inFlight.run(async () => { await fin.write(newId('lease-'), null, { t: 'lease_added', fields }); setLeaseForm(false); })}
            />
          ) : (
            <Button testID="lease-add" onPress={() => setLeaseForm(true)}>{msg('inc.leaseAdd')}</Button>
          )}
        </View>

        <View style={{ gap: t.space.xs }}>
          <Label>{msg('inc.received')}</Label>
          {plan.incomes.filter((i) => !i.deleted).map((i) => (
            <Card key={i.id} testID={`income-${i.id}`}>
              <MoneyLine testID={`income-amount-${i.id}`} strong label={formatDate(i.date)} satang={i.amountSatang} dir="in" />
              <Fact mark={i.stage === 'actual' ? 'check' : 'half'} tone={i.stage === 'actual' ? 'accept' : 'warn'}>{msg(`inc.stage.${i.stage}`)}</Fact>
              {i.tag ? <Fact mark="note">{msg(`inc.tag.${i.tag}`)}</Fact> : null}
              {i.note ? <Fact mark="note">{i.note}</Fact> : null}
            </Card>
          ))}
          {incomeForm ? (
            <IncomeForm
              leases={plan.leases.filter((l) => !l.deleted).map((l) => ({ id: l.id, name: l.farmName }))}
              onCancel={() => setIncomeForm(false)}
              onSave={(fields) => inFlight.run(async () => { await fin.write(newId('inc-'), null, { t: 'income_recorded', fields }); setIncomeForm(false); })}
            />
          ) : (
            <Button testID="income-add" onPress={() => setIncomeForm(true)}>{msg('inc.record')}</Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Text that may be "ไม่ทราบ": a value, or an explicit unknown chip. */
function MaybeField({ label, value, onChange, unknown, setUnknown, testID, numeric }: {
  label: string; value: string; onChange: (s: string) => void; unknown: boolean; setUnknown: (b: boolean) => void; testID: string; numeric?: boolean;
}) {
  const t = useTheme();
  const msg = useT();
  return (
    <View style={{ gap: t.space.xxs }}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          {unknown ? <Note>{msg('inc.unknown')}</Note> : <Input testID={testID} numeric={numeric} value={value} onChangeText={onChange} accessibilityLabel={label} />}
        </View>
        <Chip testID={`${testID}-unknown`} on={unknown} onPress={() => setUnknown(!unknown)}>{msg('inc.unknown')}</Chip>
      </View>
    </View>
  );
}

function LeaseForm({ onSave, onCancel }: { onSave: (f: LeaseFields) => Promise<void>; onCancel: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [farm, setFarm] = useState('');
  const [tenant, setTenant] = useState('');
  const [rent, setRent] = useState('');
  const [rentUnknown, setRentUnknown] = useState(false);
  const [period, setPeriod] = useState<'year' | 'month' | null>('year');
  const [start, setStart] = useState('');
  const [startUnknown, setStartUnknown] = useState(false);
  const [end, setEnd] = useState('');
  const [share, setShare] = useState('');
  const [shareUnknown, setShareUnknown] = useState(true);
  const [note, setNote] = useState('');

  const rentSatang = rentUnknown ? null : parseBahtToSatang(rent);
  const sharePct = shareUnknown || share.trim() === '' ? null : /^\d{1,3}$/.test(share.trim()) ? Number(share.trim()) : NaN;
  const ok =
    farm.trim() !== '' &&
    (rentUnknown || rentSatang !== null) &&
    (startUnknown || isIsoDate(start)) &&
    (end.trim() === '' || isIsoDate(end)) &&
    (sharePct === null || (Number.isInteger(sharePct) && sharePct >= 0 && sharePct <= 100));

  return (
    <View testID="lease-form" style={{ gap: t.space.sm, padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk }}>
      <Label>{msg('inc.farm')}</Label>
      <Input testID="lease-farm" value={farm} onChangeText={setFarm} accessibilityLabel={msg('inc.farm')} />
      <Label>{msg('inc.tenant')}</Label>
      <Input testID="lease-tenant" value={tenant} onChangeText={setTenant} accessibilityLabel={msg('inc.tenant')} />
      <MaybeField label={msg('inc.rent')} value={rent} onChange={setRent} unknown={rentUnknown} setUnknown={setRentUnknown} testID="lease-rent" numeric />
      <Label>{msg('inc.period')}</Label>
      <ChipRow>
        <Chip testID="lease-period-year" on={period === 'year'} onPress={() => setPeriod('year')}>{msg('inc.period.year')}</Chip>
        <Chip testID="lease-period-month" on={period === 'month'} onPress={() => setPeriod('month')}>{msg('inc.period.month')}</Chip>
        <Chip testID="lease-period-unknown" on={period === null} onPress={() => setPeriod(null)}>{msg('inc.unknown')}</Chip>
      </ChipRow>
      <MaybeField label={msg('inc.start')} value={start} onChange={setStart} unknown={startUnknown} setUnknown={setStartUnknown} testID="lease-start" />
      <Label>{msg('inc.end')}</Label>
      <Input testID="lease-end" value={end} onChangeText={setEnd} accessibilityLabel={msg('inc.end')} />
      <MaybeField label={msg('inc.share')} value={share} onChange={setShare} unknown={shareUnknown} setUnknown={setShareUnknown} testID="lease-share" numeric />
      <Label>{msg('fin.form.note')}</Label>
      <Input testID="lease-note" multiline value={note} onChangeText={setNote} accessibilityLabel={msg('fin.form.note')} />
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button onPress={onCancel}>{msg('common.cancel')}</Button>
        <Button
          testID="lease-save"
          variant="primary"
          disabled={!ok}
          onPress={() =>
            void onSave({
              farmName: farm.trim(),
              tenant: tenant.trim(),
              rentSatang,
              period,
              start: startUnknown ? null : start,
              end: end.trim() || null,
              sharePct,
              note: note.trim(),
            })
          }
        >
          {msg('common.save')}
        </Button>
      </View>
    </View>
  );
}

function IncomeForm({ leases, onSave, onCancel }: { leases: { id: string; name: string }[]; onSave: (f: IncomeFields) => Promise<void>; onCancel: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [stage, setStage] = useState<'actual' | 'planned'>('actual');
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [tag, setTag] = useState<IncomeTag | null>(null);
  const [note, setNote] = useState('');
  const satang = parseBahtToSatang(amount);
  const ok = !!satang && isIsoDate(date);
  return (
    <View testID="income-form" style={{ gap: t.space.sm, padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk }}>
      <Label>{msg('fin.form.amount')}</Label>
      <Input testID="income-amount" numeric value={amount} onChangeText={setAmount} accessibilityLabel={msg('fin.form.amount')} />
      <Label>{msg('fin.form.date')}</Label>
      <Input testID="income-date" value={date} onChangeText={setDate} accessibilityLabel={msg('fin.form.date')} />
      <ChipRow>
        <Chip testID="income-stage-actual" on={stage === 'actual'} onPress={() => setStage('actual')}>{msg('inc.stage.actual')}</Chip>
        <Chip testID="income-stage-planned" on={stage === 'planned'} onPress={() => setStage('planned')}>{msg('inc.stage.planned')}</Chip>
      </ChipRow>
      {leases.length ? (
        <ChipRow>
          {leases.map((l) => (
            <Chip key={l.id} testID={`income-lease-${l.id}`} on={leaseId === l.id} onPress={() => setLeaseId(leaseId === l.id ? null : l.id)}>{l.name}</Chip>
          ))}
        </ChipRow>
      ) : null}
      <Label>{msg('inc.tag')}</Label>
      <ChipRow>
        {TAGS.map((g) => (
          <Chip key={g} testID={`income-tag-${g}`} on={tag === g} onPress={() => setTag(tag === g ? null : g)}>{msg(`inc.tag.${g}`)}</Chip>
        ))}
      </ChipRow>
      <Input testID="income-note" value={note} onChangeText={setNote} accessibilityLabel={msg('fin.form.note')} placeholder={msg('fin.form.notePlaceholder')} />
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button onPress={onCancel}>{msg('common.cancel')}</Button>
        <Button
          testID="income-save"
          variant="primary"
          disabled={!ok}
          onPress={() => void onSave({ amountSatang: satang!, date, stage, leaseId, note: note.trim(), tag })}
        >
          {msg('common.save')}
        </Button>
      </View>
    </View>
  );
}
