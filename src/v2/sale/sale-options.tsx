/**
 * The sale's own options, in the ⋯ menu of the point picker and the counter:
 * the agreed price (add it, or change it until the sale closes), the sale's
 * info as it was started, and deleting a sale that should not exist (one open
 * sale at a time, so a stray one has to be removable). Every write is an event
 * in the sale's log — offline, on this device.
 */

import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { formatThaiDate } from '../../core/master';
import { parsePrice } from '../../core/sale-points';
import { saleTotals } from '../../core/totals';
import { useI18n, useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Button, CTA, TextField, TrashIcon } from '../../ui';
import { Kv, kgText, type useSaleView } from './pieces';

export type OptionSheet = 'none' | 'price' | 'info' | 'delete';

type View_ = ReturnType<typeof useSaleView>;

/** The menu rows. `pick` closes the menu and opens the chosen sheet. */
export function SaleOptionRows({ view, pick }: { view: View_; pick: (s: OptionSheet) => void }) {
  const msg = useT();
  const price = view.state.price?.satangPerKg ?? null;
  return (
    <>
      <Button variant="row" testID="menu-price" onPress={() => pick('price')}>
        {price === null ? msg('opt.priceNone') : msg('opt.priceHave', { price: formatSatang(price) })}
      </Button>
      <Button variant="row" testID="menu-info" onPress={() => pick('info')}>
        {msg('opt.info')}
      </Button>
      <Button variant="row" testID="menu-delete" onPress={() => pick('delete')}>
        {msg('opt.delete')}
      </Button>
    </>
  );
}

/** The sheets behind those rows; the screen owns which one is open. */
export function SaleOptionSheets({ view, open, onClose }: { view: View_; open: OptionSheet; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { era } = useI18n();
  const { saleId, state, events, append, closed } = view;
  const current = state.price?.satangPerKg ?? null;
  const [text, setText] = useState('');
  const [typed, setTyped] = useState(false);
  const shown = typed ? text : current === null ? '' : (current / 100).toString();
  const parsed = parsePrice(shown);
  const canSave = parsed.ok && parsed.satang !== null && parsed.satang !== current && !closed;
  const totals = saleTotals(events);

  const savePrice = () => {
    if (!canSave || !parsed.ok || parsed.satang === null) return;
    append({ kind: 'sys', payload: { t: 'price_set', satangPerKg: parsed.satang, indexRef: '' } });
    setTyped(false);
    onClose();
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
      <BottomSheet open={open === 'price'} onClose={onClose} title={msg('opt.priceTitle')} testID="price-option-sheet">
        <TextField
          testID="option-price"
          label={msg('v2s.price')}
          hint={msg('opt.priceHint')}
          value={shown}
          onChangeText={(v) => {
            setTyped(true);
            setText(v);
          }}
          keyboardType="decimal-pad"
          error={!parsed.ok ? msg('start.badPrice') : undefined}
        />
        <CTA testID="option-price-save" disabled={!canSave} onPress={savePrice}>
          {msg('common.save')}
        </CTA>
      </BottomSheet>

      <BottomSheet open={open === 'info'} onClose={onClose} title={msg('opt.infoTitle')} testID="info-sheet">
        <View style={{ gap: t.space.xs }}>
          {row(msg('start.date'), state.startedTs ? formatThaiDate(state.startedTs, era) : msg('v2s.notRecorded'), 'info-date')}
          {row(msg('start.buyer'), state.parties?.buyer || msg('start.noBuyer'), 'info-buyer')}
          {row(msg('start.manager'), state.parties?.manager || msg('start.noBuyer'), 'info-manager')}
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

