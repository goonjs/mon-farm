/**
 * E15-S01 · เตรียมการขาย (owner 2026-11-17 "ก · ก · โอเค ทำตามนี้", mockup docs/ux/mockups/e15-s01-sale-prep.html).
 * One page, four rows, each the whole tap target with ☐/✓: who buys (a full-page list), the day on the in-app
 * calendar then an optional time, the agreed price on the app pad, and fertilizer left to split (E16's list).
 * A help to prepare, never a gate (PREP-9): nothing here stops a sale from starting.
 */

import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { fertilizingDebts, projectFertilizing, splitBadge } from '../../core/finance/fertilizing';
import { projectFinance } from '../../core/finance/ledger';
import { newFertDebts, SALE_PREP_TARGET, salePrep, type SalePrep } from '../../core/finance/sale-prep';
import type { FinanceEvent, Payer, SalePrepPatch } from '../../core/finance/types';
import { formatThaiDay, todayIso } from '../../core/master';
import { useFinance } from '../../finance/use-finance';
import { peopleStore } from '../../store/people';
import { useI18n } from '../../i18n';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, cardStyle, Check, ChevronRight, CompactMoney, DatePickerSheet, MoneyField, ScreenHeader, TextLink } from '../../ui';
import { CHIP_MIN_WIDTH } from '../../ui/chip-width';
import { useMaster } from '../farm/pieces';
import { loadHomeSales } from '../sale/open-sale';
import { PRICE_MAX_SATANG } from '../sale/sale-options';

/** Times offered after the day: a buyer comes in the morning, sometimes after lunch. */
const TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '13:00'] as const;

/** "ส. 21 พ.ย. 2569" for an ISO day; `short` drops the year ("ส. 21 พ.ย.") for a one-line summary. */
export function prepDayText(iso: string, era: 'be' | 'ce', short = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  const text = formatThaiDay(Date.UTC(y, m - 1, d, 5), era);
  return short ? text.replace(/ \d{4}$/, '') : text;
}

/** "฿/กก." never breaks after the slash (a word joiner, added here: the catalogue keeps to printable symbols). */
export const keepPerKg = (text: string) => text.replace(/฿\/(?=\S)/g, '฿/\u2060');

/** The prep in force: a sale started after its last write has used it (PREP-8). */
export function livePrep(events: readonly FinanceEvent[], lastSaleTs: number | null): SalePrep | null {
  const p = salePrep(events);
  return p && lastSaleTs !== null && lastSaleTs > p.updatedTs ? null : p;
}

/** Fertilizings not split yet (E16 "ยังไม่แบ่ง" / "แบ่งไม่ครบ" left for later), as the care list counts them. */
export function unsplitCount(events: readonly FinanceEvent[]): number {
  return projectFertilizing(events, projectFinance(events).expenses).records.filter((r) => !r.deleted && splitBadge(r) !== null).length;
}

export interface PrepViewProps {
  readonly events: readonly FinanceEvent[];
  /** The farm's day (Bangkok) for the calendar's "today"; absent = the device's. */
  readonly today?: string;
  /** The latest sale's day, for "new" fertilizer debt (PREP-7); null before any sale. */
  readonly lastSaleDay: string | null;
  /** When the latest sale started (wall clock): a prep written before it is used up. */
  readonly lastSaleTs: number | null;
  readonly onWrite: (patch: SalePrepPatch) => Promise<unknown>;
  readonly onBuyer: () => void;
  readonly onFert: () => void;
  readonly onBack: () => void;
  readonly sync?: ReturnType<typeof useSyncStatus>;
}

type Sheet = 'none' | 'date' | 'time' | 'price';

export function PrepView({ events, today, lastSaleDay, lastSaleTs, onWrite, onBuyer, onFert, onBack, sync }: PrepViewProps) {
  const t = useTheme();
  const { t: msg, era } = useI18n();
  const [sheet, setSheet] = useState<Sheet>('none');
  const [day, setDay] = useState<string | null>(null);
  const prep = livePrep(events, lastSaleTs);
  const { unsplit, debts } = useMemo(() => {
    const fz = projectFertilizing(events, projectFinance(events).expenses);
    return {
      unsplit: fz.records.filter((r) => !r.deleted && splitBadge(r) !== null).length,
      debts: newFertDebts(fertilizingDebts(fz), lastSaleDay),
    };
  }, [events, lastSaleDay]);

  const buyerOk = !!prep?.buyerId;
  const dateOk = !!prep?.date;
  const priceOk = prep?.priceSatangPerKg != null;
  const fertOk = unsplit === 0;
  const ready = buyerOk && dateOk && priceOk && fertOk;
  const dayText = prep?.date ? prepDayText(prep.date, era) : null;

  return (
    <View testID="prep" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('prep.title')} subtitle={msg('prep.sub')} back={{ label: msg('v2.back'), onPress: onBack, testID: 'prep-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.sm, paddingBottom: t.space.xl }}>
        {ready ? (
          <View testID="prep-ready" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, padding: t.space.md, borderRadius: t.radius.md, backgroundColor: t.color.acceptSunk }}>
            <Check color={t.color.accept} size={16} />
            <AppText style={{ fontWeight: t.font.weight.black }}>{msg('prep.ready')}</AppText>
          </View>
        ) : null}
        <PrepRow testID="prep-buyer" done={buyerOk} title={msg('prep.buyer')} onPress={onBuyer}>
          <AppText variant="bodySm">{buyerOk ? prep!.buyerName : msg('prep.buyerNone')}</AppText>
        </PrepRow>
        <PrepRow testID="prep-date" done={dateOk} title={msg('prep.date')} onPress={() => setSheet('date')}>
          <AppText variant="bodySm">{dayText ? (prep?.time ? msg('prep.dateTime', { date: dayText, time: prep.time }) : dayText) : msg('prep.dateNone')}</AppText>
        </PrepRow>
        <PrepRow testID="prep-price" done={priceOk} title={msg('prep.price')} onPress={() => setSheet('price')}>
          <AppText variant="bodySm">{priceOk ? keepPerKg(msg('prep.pricePer', { price: formatSatang(prep!.priceSatangPerKg!) })) : msg('prep.priceNone')}</AppText>
        </PrepRow>
        <PrepRow testID="prep-fert" done={fertOk} title={msg('prep.fert')} onPress={onFert}>
          {!fertOk ? (
            <AppText variant="bodySm" style={{ color: t.color.warn }}>{msg('prep.fertLeft', { n: unsplit })}</AppText>
          ) : debts.length === 0 ? (
            <AppText variant="bodySm">{msg('prep.fertDone')}</AppText>
          ) : (
            <DebtLines debts={debts} />
          )}
        </PrepRow>
        {prep ? (
          <View style={{ alignItems: 'center', paddingTop: t.space.sm }}>
            <TextLink testID="prep-cancel" onPress={() => void onWrite({ cancelled: true })}>{msg('prep.cancel')}</TextLink>
          </View>
        ) : null}
      </ScrollView>

      <DatePickerSheet
        open={sheet === 'date'}
        // Done picks the day, then closes: keep the time sheet the pick opened.
        onClose={() => setSheet((s) => (s === 'date' ? 'none' : s))}
        value={day ?? prep?.date ?? ''}
        onChange={(iso) => {
          setDay(iso);
          setSheet('time');
        }}
        title={msg('prep.date')}
        today={today}
        testID="prep-date-picker"
      />
      <BottomSheet open={sheet === 'time'} onClose={() => setSheet('none')} title={msg('prep.time')} testID="prep-time">
        <AppText variant="bodySm">{msg('prep.timeHint')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
          {[...TIMES, null].map((time) => (
            <Pressable
              key={time ?? 'none'}
              testID={`prep-time-${time ?? 'none'}`}
              accessibilityRole="button"
              onPress={() => {
                setSheet('none');
                if (day) void onWrite({ date: day, time });
              }}
              style={{ minHeight: t.target.comfortable, minWidth: CHIP_MIN_WIDTH, paddingHorizontal: t.space.md, borderRadius: t.radius.pill, borderWidth: t.border.hair, borderColor: t.color.rule, backgroundColor: t.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppText style={{ fontWeight: t.font.weight.bold }}>{time ?? msg('prep.timeNone')}</AppText>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
      <MoneyField
        testID="prep-price-input"
        label={msg('prep.price')}
        satang={prep?.priceSatangPerKg ?? null}
        onChange={(s) => void onWrite({ priceSatangPerKg: s })}
        unit={msg('npsale.perKg')}
        minSatang={1}
        maxSatang={PRICE_MAX_SATANG}
        words={false}
        clear={{ label: msg('numpad.clearLater'), onClear: () => void onWrite({ priceSatangPerKg: null }) }}
        card={false}
        open={sheet === 'price'}
        onOpenChange={(o) => setSheet(o ? 'price' : 'none')}
      />
    </View>
  );
}

/** One checklist row: ☐/✓, the question, what is set; the whole row is the target (phone-form-ux rule 11). */
function PrepRow({ testID, done, title, onPress, children }: { testID: string; done: boolean; title: string; onPress: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ checked: done }}
      onPress={onPress}
      style={{ ...cardStyle(t), flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: t.radius.sm,
          borderWidth: t.border.thick,
          borderColor: done ? t.color.accept : t.color.rule,
          backgroundColor: done ? t.color.accept : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done ? <Check color={t.color.inkInverse} size={14} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{title}</AppText>
        {children}
      </View>
      <ChevronRight color={t.color.inkFaint} />
    </Pressable>
  );
}

/** New fertilizer debt per tapper (summary-lines rule: 2 per line past 2 people, then Σ on its own line). */
function DebtLines({ debts }: { debts: readonly { worker: Payer; satang: number }[] }) {
  const t = useTheme();
  const { t: msg } = useI18n();
  const per = debts.length > 2 ? 2 : debts.length;
  const lines: (typeof debts)[] = [];
  for (let i = 0; i < debts.length; i += per) lines.push(debts.slice(i, i + per));
  const total = debts.reduce((s, d) => s + d.satang, 0);
  const text = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.inkSoft };
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="bodySm">{msg('prep.fertDebts')}</AppText>
      <View testID="prep-fert-debts" style={{ gap: 2 }}>
        {lines.map((line, i) => (
          <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: t.space.sm }}>
            {line.map((d, j) => (
              <View key={d.worker.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                {j > 0 ? <Text style={text}>·</Text> : null}
                <Text style={text}>{d.worker.name}</Text>
                <CompactMoney satang={d.satang} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <View testID="prep-fert-total" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{ ...text, fontWeight: t.font.weight.black, color: t.color.ink }}>{'Σ'}</Text>
        <CompactMoney satang={total} />
      </View>
    </View>
  );
}

/** นัดคนรับซื้อ: a full page (phone-form-ux rule 12), the latest buyer first; a tap picks and goes back. */
export function PrepBuyerView({
  buyers,
  latestId,
  onPick,
  onAdd,
  onBack,
  sync,
}: {
  buyers: readonly { id: string; name: string }[];
  latestId: string | null;
  onPick: (b: { id: string; name: string }) => void;
  onAdd: () => void;
  onBack: () => void;
  sync?: ReturnType<typeof useSyncStatus>;
}) {
  const t = useTheme();
  const { t: msg } = useI18n();
  const sorted = [...buyers.filter((b) => b.id === latestId), ...buyers.filter((b) => b.id !== latestId)];
  return (
    <View testID="prep-buyers" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('prep.buyer')} back={{ label: msg('v2.back'), onPress: onBack, testID: 'prep-buyers-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.sm, paddingBottom: t.space.xl }}>
        {sorted.length === 0 ? <AppText variant="bodySm">{msg('prep.buyerEmpty')}</AppText> : null}
        {sorted.map((b) => (
          <Pressable
            key={b.id}
            testID={`prep-buyer-${b.id}`}
            accessibilityRole="button"
            onPress={() => onPick({ id: b.id, name: b.name })}
            style={{ ...cardStyle(t), flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{b.name}</AppText>
              {b.id === latestId ? <AppText variant="bodySm">{msg('prep.buyerLatest')}</AppText> : null}
            </View>
            <ChevronRight color={t.color.inkFaint} />
          </Pressable>
        ))}
        <View style={{ alignItems: 'center', paddingTop: t.space.sm }}>
          <TextLink testID="prep-buyer-add" onPress={onAdd}>{msg('prep.buyerAdd')}</TextLink>
        </View>
      </ScrollView>
    </View>
  );
}

export const PREP_HREF = '/v2/prepare' as Href;
export const PREP_BUYER_HREF = '/v2/prepare/buyer' as Href;

/** The latest sale's start (wall clock) and its Bangkok day; nulls before any sale. */
function useLastSale(): { ts: number | null; day: string | null } {
  const [last, setLast] = useState<{ ts: number | null; day: string | null }>({ ts: null, day: null });
  useEffect(() => {
    let live = true;
    loadHomeSales()
      .then((s) => {
        const ts = Math.max(s.open?.ts ?? 0, s.latest?.ts ?? 0) || null;
        if (live) setLast({ ts, day: ts === null ? null : todayIso(ts) });
      })
      .catch((err) => console.error('Sales could not be read.', err));
    return () => {
      live = false;
    };
  }, []);
  return last;
}

/** Writes one patch onto the prep record, based on its head. */
function usePrepWrite(fin: ReturnType<typeof useFinance>) {
  return (patch: SalePrepPatch) => {
    const head = [...(fin.events ?? [])].reverse().find((e) => e.targetId === SALE_PREP_TARGET)?.id ?? null;
    return fin.write(SALE_PREP_TARGET, head, { t: 'sale_prep_set', patch });
  };
}

const leave = () => (router.canGoBack() ? router.back() : router.replace('/v2' as Href));

/** /v2/prepare — เตรียมการขาย. */
export function PrepareScreen() {
  const fin = useFinance();
  const sync = useSyncStatus();
  const last = useLastSale();
  const write = usePrepWrite(fin);
  const [today] = useState(() => todayIso(Date.now()));
  if (!fin.events) return null;
  return (
    <PrepView
      events={fin.events}
      today={today}
      lastSaleDay={last.day}
      lastSaleTs={last.ts}
      onWrite={write}
      onBuyer={() => router.push(PREP_BUYER_HREF)}
      onFert={() => router.push('/v2/care' as Href)}
      onBack={leave}
      sync={sync}
    />
  );
}

/** /v2/prepare/buyer — นัดคนรับซื้อ. */
export function PrepareBuyerScreen() {
  const fin = useFinance();
  const sync = useSyncStatus();
  const { state: master } = useMaster();
  const [latestId, setLatestId] = useState<string | null>(null);
  useEffect(() => {
    peopleStore.latestBuyerId().then(setLatestId, () => setLatestId(null));
  }, []);
  const write = usePrepWrite(fin);
  if (!master || !fin.events) return null;
  return (
    <PrepBuyerView
      buyers={master.buyers.filter((b) => !b.deleted)}
      latestId={latestId}
      onPick={(b) => {
        void write({ buyerId: b.id, buyerName: b.name }).then(leave);
      }}
      onAdd={() => router.push('/v2/buyers' as Href)}
      onBack={leave}
      sync={sync}
    />
  );
}
