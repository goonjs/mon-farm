/**
 * "แก้รายการ": quantity, price (per unit or the typed total, as on the capture screen) and the item discount of one
 * item of an existing order. Saving is one patch (`editItemPatch`); a quantity below what is already told is blocked.
 */

import { useState } from 'react';
import { Text, View } from 'react-native';

import type { Expense } from '../../../core/finance/ledger';
import { formatSatang } from '../../../core/finance/money';
import type { ExpensePatch } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, CTA, Check, FieldError, MoneyField, QuantityField, SegmentedControl } from '../../../ui';
import { moneyOfLine, moneyOk, moneyProblems, perUnit, withGross, withQty, withUnitPrice, type ItemMoney } from '../order/order-model';
import { TextLink } from '../order/item-sheets';
import { SheetTitle } from './parts';
import { editItemPatch, editItemProblems, itemGross, itemSacks } from './tell';

export function EditItemSheet({ item, onSave, onDelete, onClose }: { item: Expense; onSave: (patch: ExpensePatch) => Promise<boolean>; onDelete: () => void; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const unit = item.line?.unit ?? msg('ordd.zones.unit');
  const [m, setM] = useState<ItemMoney>(() =>
    moneyOfLine({ qty: itemSacks(item), grossSatang: itemGross(item), itemDiscountSatang: item.line?.itemDiscountSatang ?? item.fertilizer?.itemDiscountSatang ?? 0 }),
  );
  const [discountOpen, setDiscountOpen] = useState(m.discount > 0);
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);

  const mp = moneyProblems(m);
  const ep = editItemProblems(item, m);
  const blocked = !moneyOk(mp) || ep.tappers !== undefined || ep.zones !== undefined || ep.discount === true;
  const per = m.unitPrice ?? (m.gross !== null && m.qty ? perUnit(m.gross, m.qty) : null);
  const net = m.gross === null ? null : Math.max(0, m.gross - m.discount);

  const save = async () => {
    setTried(true);
    if (blocked) return;
    if (await onSave(editItemPatch(item, m, unit))) onClose();
    else setFailed(true);
  };

  return (
    <BottomSheet open onClose={onClose} testID="ordd-edit-sheet" title={msg('ordd.edit.title')}>
      <View style={{ gap: t.space.md }}>
        <SheetTitle>{item.item}</SheetTitle>
        <QuantityField testID="ordd-edit-qty" label={msg('ordc.qty')} value={m.qty} unit={unit} min={1} onChange={(q) => setM(withQty(m, q))} />
        {tried && mp.qty ? <FieldError testID="ordd-edit-err-qty">{msg('ordc.err.qty')}</FieldError> : null}
        {ep.tappers !== undefined ? <FieldError testID="ordd-edit-err-tappers">{msg('ordd.edit.errTappers', { n: ep.tappers })}</FieldError> : null}
        {ep.zones !== undefined ? <FieldError testID="ordd-edit-err-zones">{msg('ordd.edit.errZones', { n: ep.zones })}</FieldError> : null}

        <SegmentedControl
          testID="ordd-edit-mode"
          value={m.mode}
          onChange={(mode) => setM({ ...m, mode })}
          options={[
            { value: 'per', label: msg('ordc.perUnit', { unit }) },
            { value: 'total', label: msg('ordc.priceTotal') },
          ]}
        />
        {m.mode === 'per' ? (
          <MoneyField testID="ordd-edit-price" label={msg('ordc.perUnit', { unit })} satang={per} unit={msg('ordc.bahtPer', { unit })} onChange={(v) => setM(withUnitPrice(m, v))} />
        ) : (
          <MoneyField testID="ordd-edit-price" label={msg('ordc.priceTotal')} satang={m.gross} unit={msg('ordc.baht')} onChange={(v) => setM(withGross(m, v))} />
        )}
        {tried && mp.price ? <FieldError testID="ordd-edit-err-price">{msg('ordc.err.price')}</FieldError> : null}

        {discountOpen ? (
          <View style={{ gap: t.space.xs }}>
            <MoneyField testID="ordd-edit-discount" label={`${msg('ordc.discountLabel')} (${msg('ordc.optional')})`} satang={m.discount} unit={msg('ordc.baht')} maxSatang={m.gross ?? undefined} words={false} onChange={(v) => setM({ ...m, discount: v })} />
            <TextLink testID="ordd-edit-discount-remove" onPress={() => { setM({ ...m, discount: 0 }); setDiscountOpen(false); }}>{msg('ordc.discountRemove')}</TextLink>
          </View>
        ) : (
          <TextLink testID="ordd-edit-discount-link" onPress={() => setDiscountOpen(true)}>{msg('ordc.discountLink')}</TextLink>
        )}
        {mp.discount || ep.discount ? <FieldError testID="ordd-edit-err-discount">{msg('ordc.err.itemDiscount')}</FieldError> : null}

        <View style={{ borderRadius: t.radius.lg, backgroundColor: t.color.acceptSunk, padding: t.space.lg, flexDirection: 'row', alignItems: 'center', gap: t.space.md, flexWrap: 'wrap' }}>
          <AppText style={{ flex: 1, minWidth: 120, fontWeight: t.font.weight.bold, color: t.color.accept }}>{msg('ordc.lineTotal')}</AppText>
          <Text testID="ordd-edit-total" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>{net === null ? '–' : formatSatang(net)}</Text>
        </View>

        {failed ? <AppText testID="ordd-edit-failed" style={{ color: t.color.reject }}>{msg('ordd.saveFailed')}</AppText> : null}
        <CTA testID="ordd-edit-save" disabled={blocked && tried} icon={(c) => <Check color={c} />} onPress={() => void save()}>{msg('ordd.hdr.save')}</CTA>
        <View style={{ alignItems: 'center' }}>
          <TextLink testID="ordd-edit-delete" onPress={onDelete}>{msg('ordd.edit.delete')}</TextLink>
        </View>
      </View>
    </BottomSheet>
  );
}
