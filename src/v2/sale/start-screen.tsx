/**
 * /v2/sale/start — เริ่มการขาย (sale mockup v1.1.0 page 5, E04-S02): the sale
 * header filled from farm data so "ถัดไป" is one tap — the sale day (today, or
 * an earlier day picked on the in-app calendar, E04-S19 BF-9), the latest buyer,
 * the farm manager, the group's default net weight, numbering mode and scale
 * type. Price, note and start time may wait (SALE-3, D-11). Numbering and scale
 * type are chosen here, before the first basket (D-53, D-66, D-70 S3).
 *
 * "ถัดไป" writes `sale_started` (+ `numbering_set`, `price_set`) to the new
 * sale's log — offline, on this device — and opens the point picker.
 *
 * E15-S02: when a prep (เตรียมการขาย) is waiting, the buyer and the price start from it ("ที่นัดไว้ ·
 * แก้ได้", "ราคาที่ตกลงไว้ · แก้ได้"); a prep for a later day is asked about first. Read-only: the sale
 * still writes `sale_started.buyerId` and `price_set`, and keeps no link to the prep.
 *
 * The price row opens the app number pad straight away (E01-S20 row 17, NP-12):
 * no sheet on a sheet; up to 999.99 ฿/kg (NP-14); "เว้นว่าง" leaves it for later.
 */

import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { prepFill, salePrep, type SalePrep } from '../../core/finance/sale-prep';
import { defaultBuyer, filterPeople, formatSaleDate, todayIso } from '../../core/master';
import type { NumberingMode } from '../../core/types';
import { useI18n, useT } from '../../i18n';
import { newId } from '../../lib/id';
import { financeStore } from '../../store/finance';
import { peopleStore } from '../../store/people';
import { SaleProvider } from '../../store/SaleProvider';
import { useTheme } from '../../theme';
import {
  AppText,
  BottomSheet,
  cardStyle,
  ChevronRight,
  CTA,
  DatePickerSheet,
  MoneyField,
  Plus,
  RadioCard,
  TextField,
  TextLink,
  UsersIcon,
  FarmMateArt,
} from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { keepPerKg, prepDayText } from '../prepare/prep-format';
import { loadHomeSales } from './open-sale';
import { EmptyPill, FieldRow, IconLine, SegOptions, useSaleView } from './pieces';
import { PRICE_MAX_SATANG } from './sale-options';
import { saleHref } from '../routes';

type Sheet = 'none' | 'buyer' | 'price' | 'pair' | 'note';

/**
 * One sale at a time: while a sale is still open, เริ่มการขาย opens it (at its
 * counter, or the point picker) instead of starting another. Only with no open
 * sale does the form below mint a new sale id.
 */
export function StartSaleGate() {
  const msg = useT();
  const router = useRouter();
  const [fresh, setFresh] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadHomeSales().then(
      ({ open }) => {
        if (!live) return;
        if (open) router.replace(saleHref(open.id, { closed: false, point: open.point }));
        else setFresh(newId('sale-'));
      },
      (err) => {
        // Not knowing whether a sale is open must not start a second one: ask again.
        console.error('Sales could not be read.', err);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [router, attempt]);
  if (failed) {
    return (
      <FarmScreen title={msg('start.title')} fallback={'/v2' as Href} testID="sale-start-failed">
        <AppText variant="bodySm">{msg('start.checkFailed')}</AppText>
        <CTA testID="sale-start-retry" onPress={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}>
          {msg('start.retry')}
        </CTA>
      </FarmScreen>
    );
  }
  if (!fresh) return <FarmScreen title={msg('start.title')} fallback={'/v2' as Href} testID="sale-start-check" />;
  return (
    <SaleProvider saleId={fresh}>
      <StartSaleScreen />
    </SaleProvider>
  );
}

export function StartSaleScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { era } = useI18n();
  const { saleId, append, ready, master, settings } = useSaleView();
  const [now] = useState(() => Date.now());
  const [latestId, setLatestId] = useState<string | null | undefined>(undefined);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [numbering, setNumbering] = useState<NumberingMode | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  // undefined = not touched: the prep's price (if any) shows; a typed price or "ใส่ทีหลัง" is the user's own.
  const [price, setPrice] = useState<number | null | undefined>(undefined);
  // The prep waiting for this sale (E15-S02): undefined while it is read, null when there is none.
  const [prep, setPrep] = useState<SalePrep | null | undefined>(undefined);
  const [prepChoice, setPrepChoice] = useState<'ask' | 'use' | 'skip'>('ask');
  const [note, setNote] = useState('');
  // The sale day (E04-S19 BF-9): today unless an earlier day is picked; never later.
  const [day, setDay] = useState(() => todayIso(now));
  const [dayOpen, setDayOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('none');

  useEffect(() => {
    peopleStore.latestBuyerId().then(setLatestId, () => setLatestId(null));
  }, []);

  useEffect(() => {
    let live = true;
    // A sale started after the prep was last written has used it, so the newest sale's time decides (PREP-8).
    Promise.all([financeStore.load(), loadHomeSales()]).then(
      ([events, sales]) => {
        const newest = (sales.open?.ts ?? 0) >= (sales.latest?.ts ?? 0) ? (sales.open ?? sales.latest) : sales.latest;
        if (live) setPrep(salePrep(events, newest?.ts ?? null));
      },
      // Not knowing the prep only means the page starts empty, as it always could.
      (err) => {
        console.error('The sale prep could not be read.', err);
        if (live) setPrep(null);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const loading = !ready || !master || !settings || latestId === undefined || prep === undefined;
  if (loading) return <FarmScreen title={msg('start.title')} fallback={'/v2' as Href} />;

  const latest = defaultBuyer(master, latestId);
  const buyers = master.buyers.filter((b) => !b.deleted);
  const fill = prepFill(prep, todayIso(now), buyers.map((b) => b.id));
  /** What the prep gives this page: at once, or after "ใช้ที่เตรียมไว้" when it is for a later day. */
  const given = fill && (!fill.ask || prepChoice === 'use') ? fill : null;
  const buyer = buyers.find((b) => b.id === (buyerId ?? given?.buyerId ?? latest?.id)) ?? null;
  const shownPrice = price !== undefined ? price : (given?.priceSatangPerKg ?? null);
  const fromPrep = buyerId === null && given?.buyerId != null && buyer?.id === given.buyerId;
  const manager = filterPeople(master.people, 'manager').find((p) => !p.deleted) ?? null;
  const mode = numbering ?? settings.numbering;
  const pair = settings.pairs.find((p) => p.pairId === pairId) ?? settings.pairs.find((p) => p.isDefault)!;
  const weekday = msg('v2s.weekdays').split(',')[new Date(`${day}T00:00:00Z`).getUTCDay()];

  const next = () => {
    append({
      kind: 'sys',
      payload: {
        t: 'sale_started',
        farmName: '',
        buyer: buyer?.name ?? '',
        ...(buyer ? { buyerId: buyer.id } : {}),
        manager: manager?.name ?? '',
        ...(manager ? { managerId: manager.id } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        workerLead: '',
        where: 'farm',
        day,
      },
    });
    append({ kind: 'sys', payload: { t: 'numbering_set', numbering: mode } });
    // Kept in the log, so a reload before the first point still weighs with it (review #10).
    append({ kind: 'sys', payload: { t: 'pair_set', netG: pair.netG, basketG: pair.basketG } });
    if (shownPrice !== null) append({ kind: 'sys', payload: { t: 'price_set', satangPerKg: shownPrice, indexRef: '' } });
    router.replace(`/v2/sale/${saleId}/point` as Href);
  };

  const groupDefault = <IconLine icon={(c) => <UsersIcon color={c} size={13} />}>{msg('start.groupDefault')}</IconLine>;
  const sheetDone = (
    <CTA testID="sheet-done" onPress={() => setSheet('none')}>
      {msg('gate.waitingOk')}
    </CTA>
  );

  return (
    <FarmScreen
      title={msg('start.title')}
      fallback={'/v2' as Href}
      testID="sale-start"
      footer={
        <CTA testID="start-next" onPress={next}>
          {msg('start.next')}
        </CTA>
      }
      overlay={
        <>
          <BottomSheet open={sheet === 'buyer'} onClose={() => setSheet('none')} title={msg('start.buyer')} testID="buyer-sheet">
            {buyers.map((b) => (
              <RadioCard
                key={b.id}
                testID={`start-buyer-${b.id}`}
                selected={b.id === buyer?.id}
                title={b.name}
                detail={b.id === latest?.id ? msg('start.buyerLatest') : undefined}
                onPress={() => {
                  setBuyerId(b.id);
                  setSheet('none');
                }}
              />
            ))}
            {buyers.length === 0 ? <AppText variant="bodySm">{msg('start.noBuyer')}</AppText> : null}
          </BottomSheet>
          <MoneyField
            testID="start-price"
            label={msg('v2s.price')}
            satang={shownPrice}
            onChange={setPrice}
            unit={msg('npsale.perKg')}
            minSatang={1}
            maxSatang={PRICE_MAX_SATANG}
            words={false}
            emptyText={msg('numpad.later')}
            clear={{ label: msg('numpad.clearLater'), onClear: () => setPrice(null) }}
            card={false}
            open={sheet === 'price'}
            onOpenChange={(o) => setSheet(o ? 'price' : 'none')}
          />
          <BottomSheet open={sheet === 'pair'} onClose={() => setSheet('none')} title={msg('start.pair')} testID="pair-sheet">
            {settings.pairs.map((p) => (
              <RadioCard
                key={p.pairId}
                testID={`start-pair-${p.pairId}`}
                selected={p.pairId === pair.pairId}
                title={msg('v2f.kg', { n: p.netG / 1000 })}
                detail={msg('v2s.basketKg', { n: p.basketG / 1000 })}
                onPress={() => {
                  setPairId(p.pairId);
                  setSheet('none');
                }}
              />
            ))}
          </BottomSheet>
          <BottomSheet open={sheet === 'note'} onClose={() => setSheet('none')} title={msg('v2s.noteRow')} testID="note-sheet">
            <TextField testID="start-note" label={msg('start.note')} value={note} onChangeText={setNote} />
            {sheetDone}
          </BottomSheet>
        </>
      }
    >
      {fill?.ask && prepChoice === 'ask' ? (
        <View testID="start-prep-ask" style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.sm }}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('start.prepAsk')}</AppText>
          {fill.buyerId !== null ? (
            <AppText variant="bodySm">
              {prep?.date
                ? msg('start.prepAskBuyer', { name: buyers.find((b) => b.id === fill.buyerId)?.name ?? '', day: prepDayText(prep.date, era, true) })
                : msg('start.prepAskBuyerNoDay', { name: buyers.find((b) => b.id === fill.buyerId)?.name ?? '' })}
            </AppText>
          ) : null}
          {fill.priceSatangPerKg !== null ? <AppText variant="bodySm">{keepPerKg(msg('start.prepAskPrice', { price: formatSatang(fill.priceSatangPerKg) }))}</AppText> : null}
          <CTA testID="start-prep-use" onPress={() => setPrepChoice('use')}>
            {msg('start.prepUse')}
          </CTA>
          <TextLink testID="start-prep-skip" align="center" onPress={() => setPrepChoice('skip')}>
            {msg('start.prepSkip')}
          </TextLink>
        </View>
      ) : null}

      <View style={{ ...cardStyle(t), paddingHorizontal: t.space.lg }}>
        <FieldRow
          testID="start-date"
          icon={() => <FarmMateArt id="farmwork.calendar" />}
          label={msg('start.date')}
          value={`${weekday} ${formatSaleDate(now, day, era)}`}
          trailing={<View testID="start-date-chevron" aria-hidden><ChevronRight color={t.color.inkFaint} /></View>}
          onPress={() => setDayOpen(true)}
        />
        <DatePickerSheet open={dayOpen} onClose={() => setDayOpen(false)} value={day} onChange={setDay} max={todayIso(now)} today={todayIso(now)} title={msg('start.date')} testID="start-date-picker" />
        <Rule />
        <FieldRow
          testID="start-buyer"
          icon={() => <FarmMateArt id="people.buyer" />}
          label={msg('start.buyer')}
          value={buyer?.name ?? msg('start.noBuyer')}
          lines={fromPrep ? [msg('start.buyerPrep')] : buyer && buyer.id === latest?.id ? [msg('start.buyerLatest')] : []}
          trailing={<ChevronRight color={t.color.inkFaint} />}
          onPress={() => setSheet('buyer')}
        />
        <Rule />
        <FieldRow
          testID="start-manager"
          icon={() => <FarmMateArt id="people.manager" />}
          label={msg('start.manager')}
          value={manager?.name ?? msg('start.noBuyer')}
          lines={manager ? [msg('start.managerAuto')] : []}
        />
        <Rule />
        <FieldRow
          testID="start-time"
          icon={() => <FarmMateArt id="farmwork.history" />}
          label={msg('v2s.startTime')}
          value={<EmptyPill label={msg('v2s.notRecorded')} />}
          lines={[msg('backfill.optional')]}
        />
        <Rule />
        <FieldRow
          testID="start-price-row"
          icon={() => <FarmMateArt id="sale.rubberPrice" />}
          label={msg('v2s.price')}
          value={shownPrice !== null ? msg('v2s.perKg', { price: formatSatang(shownPrice) }) : <EmptyPill label={msg('numpad.later')} />}
          lines={price === undefined && given?.priceSatangPerKg != null ? [msg('start.pricePrep')] : [msg('v2s.priceLater'), msg('v2s.priceNow')]}
          trailing={<View testID="start-price-row-chevron" aria-hidden><ChevronRight color={t.color.inkFaint} /></View>}
          onPress={() => setSheet('price')}
        />
        <Rule />
        <FieldRow
          testID="start-pair"
          icon={() => <FarmMateArt id="farmwork.tapping" />}
          label={msg('start.pair')}
          value={msg('v2f.kg', { n: pair.netG / 1000 })}
          lines={[pair.isDefault ? msg('v2s.pairDefault') : msg('v2s.basketKg', { n: pair.basketG / 1000 })]}
          trailing={<View testID="start-pair-chevron" aria-hidden><ChevronRight color={t.color.inkFaint} /></View>}
          onPress={() => setSheet('pair')}
        />
        <Rule />
        <FieldRow
          testID="start-note-row"
          icon={() => <FarmMateArt id="farm.photos" />}
          label={note.trim() ? msg('v2s.noteRow') : ''}
          value={note.trim() || msg('v2s.noteRow')}
          trailing={<Plus color={t.color.inkSoft} size={14} />}
          onPress={() => setSheet('note')}
        />
      </View>

      <View style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.sm }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('start.numbering')}</AppText>
        {groupDefault}
        <SegOptions<NumberingMode>
          testID="start-numbering"
          vertical
          value={mode}
          onChange={setNumbering}
          options={[
            { value: 'per-tapper', label: msg('saleSettings.perTapper'), detail: msg('v2s.perTapperShort') },
            { value: 'per-point', label: msg('saleSettings.perPoint'), detail: msg('v2s.perPointShort') },
          ]}
        />
      </View>

      <View style={{ ...cardStyle(t), padding: t.space.lg, gap: t.space.sm }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('start.scale')}</AppText>
        {groupDefault}
        {/* One decimal is shown but cannot be picked yet (D-66). */}
        <SegOptions
          testID="start-scale"
          value="whole"
          onChange={() => undefined}
          options={[
            { value: 'whole', label: msg('v2f.scaleWhole'), detail: msg('v2f.scaleWholeHint') },
            { value: 'decimal1', label: msg('v2f.scaleDecimal'), detail: msg('v2f.notReady'), disabled: true },
          ]}
        />
      </View>
    </FarmScreen>
  );
}

function Rule() {
  const t = useTheme();
  return <View style={{ height: t.border.hair, backgroundColor: t.color.ruleFaint }} />;
}
