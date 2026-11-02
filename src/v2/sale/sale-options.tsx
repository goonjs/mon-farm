/**
 * The sale's own options, in the ⋯ menu of the point picker and the counter:
 * the agreed price (add it, or change it until the sale closes), the sale's
 * info as it was started, and deleting a sale that should not exist (one open
 * sale at a time, so a stray one has to be removable). Every write is an event
 * in the sale's log — offline, on this device.
 *
 * The price opens the app number pad straight from the menu (E01-S20 row 18,
 * NP-12). A set price cannot be cleared (there is no event for that), so there
 * is no "เว้นว่าง" here.
 */

import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { formatThaiDate } from '../../core/master';
import { saleTotals } from '../../core/totals';
import { useI18n, useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Button, CTA, MoneyField, TrashIcon } from '../../ui';
import { Kv, kgText, type useSaleView } from './pieces';

export type OptionSheet = 'none' | 'price' | 'info' | 'delete';

/** A price per kg is at most 999.99 ฿ (E01-S20 NP-14): stops a slipped 00 / 000 (52 → 5,200 / 52,000) without cutting a real price. */
export const PRICE_MAX_SATANG = 99_999;

type View_ = ReturnType<typeof useSaleView>;

/** The sheets behind those rows; the screen owns which one is open. */
export function SaleOptionSheets({ view, open, onClose }: { view: View_; open: OptionSheet; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { era } = useI18n();
  const { saleId, state, events, append, closed } = view;
  const current = state.price?.satangPerKg ?? null;
  const totals = saleTotals(events);

  // Only a price that differs from the current one is written; ตกลง then closes the pad.
  const savePrice = (satang: number) => {
    if (satang === current || closed) return;
    append({ kind: 'sys', payload: { t: 'price_set', satangPerKg: satang, indexRef: '' } });
  };
  const remove = () => {
    if (closed) return;
    append({ kind: 'delete', targetId: saleId });
    onClose();
    router.replace('/v2' as Href);
  };

  const pair = [...events].reverse().map((e) => (e.kind === 'sys' && e.payload.t === 'pair_set' ? e.payload : null)).find((p) => p !== null) ?? null;
  const row = (label: string, value: ReactNode, testID?: string) => <Kv key={label} label={label} value={value} testID={testID} />;

  return (
    <>
      <MoneyField
        testID="option-price"
        label={msg('opt.priceTitle')}
        satang={current}
        onChange={savePrice}
        unit={msg('npsale.perKg')}
        minSatang={1}
        maxSatang={PRICE_MAX_SATANG}
        words={false}
        // A closed sale keeps its price: say so on the pad rather than close it as if saved (review N2).
        validate={() => (closed ? msg('npsale.closedPrice') : undefined)}
        below={() => msg('opt.priceHint')}
        card={false}
        open={open === 'price'}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      />

      <BottomSheet open={open === 'info'} onClose={onClose} title={msg('opt.infoTitle')} testID="info-sheet">
        <View style={{ gap: t.space.xs }}>
          {row(msg('start.date'), state.startedTs ? formatThaiDate(state.startedTs, era) : msg('v2s.notRecorded'), 'info-date')}
          {row(msg('start.buyer'), state.parties?.buyer || msg('opt.noValue'), 'info-buyer')}
          {row(msg('start.manager'), state.parties?.manager || msg('opt.noValue'), 'info-manager')}
          {row(msg('opt.infoPrice'), current === null ? msg('opt.infoNotSet') : msg('v2s.perKg', { price: formatSatang(current) }), 'info-price')}
          {pair ? row(msg('start.pair'), `${msg('v2f.kg', { n: pair.netG / 1000 })} · ${msg('v2s.basketKg', { n: pair.basketG / 1000 })}`, 'info-pair') : null}
          {row(msg('opt.infoNumbering'), msg(view.mode === 'per-tapper' ? 'saleSettings.perTapper' : 'saleSettings.perPoint'), 'info-numbering')}
          {row(msg('opt.infoWeighed'), `${msg('sales.baskets', { n: totals.baskets })} · ${msg('v2f.kg', { n: kgText(totals.netG) })}`, 'info-weighed')}
          {row(msg('opt.infoStatus'), msg(closed ? 'status.closed' : 'sales.weighing'), 'info-status')}
          {state.parties?.note ? row(msg('opt.infoNote'), state.parties.note, 'info-note') : null}
        </View>
        <CTA testID="info-done" onPress={onClose}>
          {msg('gate.waitingOk')}
        </CTA>
      </BottomSheet>

      <BottomSheet open={open === 'delete'} onClose={onClose} title={msg('opt.deleteTitle')} testID="delete-sheet">
        <AppText variant="bodySm">{msg('opt.deleteBody', { n: totals.baskets, kg: kgText(totals.netG) })}</AppText>
        <View style={{ flexDirection: 'row', gap: t.space.sm }}>
          <View style={{ flex: 1 }}>
            <Button testID="delete-cancel" onPress={onClose}>
              {msg('common.cancel')}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button testID="delete-confirm" variant="destructive" icon={(c) => <TrashIcon color={c} size={14} />} onPress={remove}>
              {msg('opt.deleteConfirm')}
            </Button>
          </View>
        </View>
      </BottomSheet>
    </>
  );
}

