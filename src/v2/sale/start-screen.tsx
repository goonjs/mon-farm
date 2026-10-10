/**
 * /v2/sale/start — เริ่มการขาย (sale mockup v1.1.0 page 5, E04-S02): the sale
 * header filled from farm data so "ถัดไป" is one tap — today, the latest buyer,
 * the farm manager, the group's default net weight, numbering mode and scale
 * type. Price, note and start time may wait (SALE-3, D-11). Numbering and scale
 * type are chosen here, before the first basket (D-53, D-66, D-70 S3).
 *
 * "ถัดไป" writes `sale_started` (+ `numbering_set`, `price_set`) to the new
 * sale's log — offline, on this device — and opens the point picker.
 */

import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { defaultBuyer, filterPeople, formatThaiDate } from '../../core/master';
import { parsePrice } from '../../core/sale-points';
import type { NumberingMode } from '../../core/types';
import { useI18n, useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import {
  AppText,
  BottomSheet,
  CalendarIcon,
  cardStyle,
  ChevronRight,
  ClockIcon,
  CoinIcon,
  CTA,
  LeafIcon,
  PersonIcon,
  Plus,
  RadioCard,
  ReceiptIcon,
  TextField,
  UsersIcon,
} from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { EmptyPill, FieldRow, IconLine, SegOptions, useSaleView } from './pieces';

type Sheet = 'none' | 'buyer' | 'price' | 'pair' | 'note';

export function StartSaleScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { era, toggleEra } = useI18n();
  const { saleId, append, ready, master, settings } = useSaleView();
  const [now] = useState(() => Date.now());
  const [latestId, setLatestId] = useState<string | null | undefined>(undefined);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [numbering, setNumbering] = useState<NumberingMode | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<Sheet>('none');

  useEffect(() => {
    peopleStore.latestBuyerId().then(setLatestId, () => setLatestId(null));
  }, []);

  const loading = !ready || !master || !settings || latestId === undefined;
  if (loading) return <FarmScreen title={msg('start.title')} fallback={'/v2' as Href} />;

  const latest = defaultBuyer(master, latestId);
  const buyers = master.buyers.filter((b) => !b.deleted);
  const buyer = buyers.find((b) => b.id === (buyerId ?? latest?.id)) ?? null;
  const manager = filterPeople(master.people, 'manager').find((p) => !p.deleted) ?? null;
  const mode = numbering ?? settings.numbering;
  const pair = settings.pairs.find((p) => p.pairId === pairId) ?? settings.pairs.find((p) => p.isDefault)!;
  const priceParsed = parsePrice(price);
  const weekday = msg('v2s.weekdays').split(',')[new Date(now + 7 * 3_600_000).getUTCDay()];

  const next = () => {
    if (!priceParsed.ok) {
      setSheet('price');
      return;
    }
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
      },
    });
    append({ kind: 'sys', payload: { t: 'numbering_set', numbering: mode } });
    // Kept in the log, so a reload before the first point still weighs with it (review #10).
    append({ kind: 'sys', payload: { t: 'pair_set', netG: pair.netG, basketG: pair.basketG } });
    if (priceParsed.satang !== null) append({ kind: 'sys', payload: { t: 'price_set', satangPerKg: priceParsed.satang, indexRef: '' } });
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
          <BottomSheet open={sheet === 'price'} onClose={() => setSheet('none')} title={msg('v2s.price')} testID="price-sheet">
            <TextField
              testID="start-price"
              label={msg('v2s.price')}
              hint={msg('v2s.priceLater')}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              error={!priceParsed.ok ? msg('start.badPrice') : undefined}
            />
            {sheetDone}
          </BottomSheet>
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
      <View style={{ ...cardStyle(t), paddingHorizontal: t.space.lg }}>
        <FieldRow
          testID="start-date"
          icon={(c) => <CalendarIcon color={c} size={20} />}
          label={msg('start.date')}
          value={`${weekday} ${formatThaiDate(now, era)}`}
          lines={[msg('v2s.eraHint')]}
          onPress={toggleEra}
        />
        <Rule />
        <FieldRow
          testID="start-buyer"
          icon={(c) => <UsersIcon color={c} size={20} />}
          label={msg('start.buyer')}
          value={buyer?.name ?? msg('start.noBuyer')}
          lines={buyer && buyer.id === latest?.id ? [msg('start.buyerLatest')] : []}
          trailing={<ChevronRight color={t.color.inkFaint} />}
          onPress={() => setSheet('buyer')}
        />
        <Rule />
        <FieldRow
          testID="start-manager"
          icon={(c) => <PersonIcon color={c} size={20} />}
          label={msg('start.manager')}
          value={manager?.name ?? msg('start.noBuyer')}
          lines={manager ? [msg('start.managerAuto')] : []}
        />
        <Rule />
        <FieldRow
          testID="start-time"
          icon={(c) => <ClockIcon color={c} size={20} />}
          label={msg('v2s.startTime')}
          value={<EmptyPill label={msg('v2s.notRecorded')} />}
          lines={[msg('backfill.optional')]}
        />
        <Rule />
        <FieldRow
          testID="start-price-row"
          icon={(c) => <CoinIcon color={c} size={20} />}
          label={msg('v2s.price')}
          value={priceParsed.ok && priceParsed.satang !== null ? msg('v2s.perKg', { price: price.trim() }) : <EmptyPill label={msg('v2s.notRecorded')} />}
          lines={[msg('v2s.priceLater'), msg('v2s.priceNow')]}
          onPress={() => setSheet('price')}
        />
        <Rule />
        <FieldRow
          testID="start-pair"
          icon={(c) => <LeafIcon color={c} size={20} />}
          label={msg('start.pair')}
          value={msg('v2f.kg', { n: pair.netG / 1000 })}
          lines={[pair.isDefault ? msg('v2s.pairDefault') : msg('v2s.basketKg', { n: pair.basketG / 1000 })]}
          onPress={() => setSheet('pair')}
        />
        <Rule />
        <FieldRow
          testID="start-note-row"
          icon={(c) => <ReceiptIcon color={c} size={20} />}
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
