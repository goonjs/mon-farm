/**
 * "แก้รายการ": the name (E11-S13: fix a misspelling — fertilizer formula + brand, any other item its name), quantity, price (per unit or the typed total, as on the capture screen) and the item discount of one
 * item of an existing order. Saving is one patch (`editItemPatch`); a quantity below what is already told is blocked.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Expense, FertOption } from '../../../core/finance/ledger';
import { formatSatang } from '../../../core/finance/money';
import type { ExpensePatch } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Check, FieldError, MoneyField, QuantityField, SegmentedControl, TextField } from '../../../ui';
import { moneyOfLine, moneyOk, moneyProblems, perUnit, withGross, withQty, withUnitPrice, type ItemMoney } from '../order/order-model';
import { TextLink } from '../order/item-sheets';
import { editItemPatch, editItemProblems, itemGross, itemSacks, nameOf, optionRenames, type ItemNameDraft, type OptionWrite } from './tell';
import { TickCard } from '../pieces';
import { SolidCTA } from '../order/solid-cta';

export function EditItemSheet({
  item,
  options = [],
  onSave,
  onFixOptions,
  onDelete,
  onClose,
}: {
  item: Expense;
  /** Saved fertilizer choices, for "แก้ในรายการปุ๋ยด้วย" (E11-S13 Q4). */
  options?: readonly FertOption[];
  onSave: (patch: ExpensePatch) => Promise<boolean>;
  /** Written after the item saved; false = failed (the sheet stays open, saving again is harmless). */
  onFixOptions?: (writes: readonly OptionWrite[]) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const unit = item.line?.unit ?? msg('ordd.zones.unit');
  const [m, setM] = useState<ItemMoney>(() =>
    moneyOfLine({ qty: itemSacks(item), grossSatang: itemGross(item), itemDiscountSatang: item.line?.itemDiscountSatang ?? item.fertilizer?.itemDiscountSatang ?? 0 }),
  );
  // The name the sheet opened with: a retry after the item saved but the list fix failed still knows what to fix.
  const [startName] = useState<ItemNameDraft>(() => nameOf(item));
  const [name, setName] = useState<ItemNameDraft>(startName);
  const fert = !!item.fertilizer;
  // The name is fixed rarely (a misspelling): it stays one line until "แก้ชื่อ" opens the fields, so the usual edit fits one screen.
  const [renaming, setRenaming] = useState(false);
  const [fixList, setFixList] = useState(true);
  const renames = fert ? optionRenames(options, startName, name) : [];
  const [discountOpen, setDiscountOpen] = useState(m.discount > 0);
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);

  const mp = moneyProblems(m);
  const ep = editItemProblems(item, m, name);
  const blocked = !moneyOk(mp) || ep.tappers !== undefined || ep.zones !== undefined || ep.discount === true || ep.name === true;
  const per = m.unitPrice ?? (m.gross !== null && m.qty ? perUnit(m.gross, m.qty) : null);
  const net = m.gross === null ? null : Math.max(0, m.gross - m.discount);

  const save = async () => {
    setTried(true);
    if (blocked) return;
    const ok = (await onSave(editItemPatch(item, m, unit, name))) && (!fixList || !renames.length || !onFixOptions || (await onFixOptions(renames)));
    if (ok) onClose();
    else setFailed(true);
  };

  return (
    <BottomSheet open onClose={onClose} testID="ordd-edit-sheet" title={msg('ordd.edit.title')}>
      <View style={{ gap: t.space.md }}>
        {renaming ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            <View style={{ flexGrow: 2, flexBasis: 160, minWidth: 0 }}>
              <TextField
                testID="ordd-edit-name"
                label={msg(fert ? 'ordc.formula' : 'ordc.itemName')}
                required
                value={name.name}
                onChangeText={(v) => setName({ ...name, name: v })}
                error={tried && ep.name ? msg(fert ? 'ordc.err.formula' : 'ordc.err.name') : undefined}
              />
            </View>
            {fert ? (
              <View style={{ flexGrow: 1, flexBasis: 120, minWidth: 0 }}>
                <TextField testID="ordd-edit-brand" label={msg('ordc.brand')} hint={msg('ordc.optional')} value={name.brand} onChangeText={(v) => setName({ ...name, brand: v })} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: t.space.md }}>
            <AppText testID="ordd-edit-item-name" style={{ flexShrink: 1, minWidth: 0, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{item.item}</AppText>
            {/* Quiet on purpose (owner 2026-11-04): the name leads, fixing it is the rare case. */}
            <Pressable testID="ordd-edit-rename" accessibilityRole="button" onPress={() => setRenaming(true)} style={{ minHeight: t.target.min, justifyContent: 'center' }}>
              <AppText variant="bodySm" style={{ color: t.color.inkSoft, textDecorationLine: 'underline' }}>{msg('ordd.edit.rename')}</AppText>
            </Pressable>
          </View>
        )}
        {renames.length ? <TickCard testID="ordd-edit-fix-list" title={msg('ordd.edit.fixList')} on={fixList} onPress={() => setFixList((v) => !v)} /> : null}
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
        <SolidCTA testID="ordd-edit-save" disabled={blocked && tried} icon={(c) => <Check color={c} />} onPress={() => void save()}>{msg('ordd.hdr.save')}</SolidCTA>
        <View style={{ alignItems: 'center' }}>
          <TextLink testID="ordd-edit-delete" onPress={onDelete}>{msg('ordd.edit.delete')}</TextLink>
        </View>
      </View>
    </BottomSheet>
  );
}
