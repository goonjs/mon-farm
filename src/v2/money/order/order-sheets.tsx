/**
 * The order-level sheets of the order capture screen (E11-S11): the shop (+ who ordered), who paid first (a7), and the
 * shop's discount on the whole bill. Each applies what is picked straight to the draft; the CTA only closes.
 */

import { useState } from 'react';
import { View } from 'react-native';

import { formatSatang } from '../../../core/finance/money';
import { FARM_FUNDS, type Payer } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, CTA, FieldError, MoneyField, RadioCard, TextField } from '../../../ui';
import { ChoiceChip, ChoiceRow, PayerPicker, SectionLabel } from '../pieces';
import { TextLink } from './item-sheets';

export function ShopSheet({
  shop,
  orderedBy,
  recentShops,
  recentPeople,
  onChange,
  onClose,
}: {
  shop: string;
  orderedBy: string;
  recentShops: readonly string[];
  recentPeople: readonly string[];
  onChange: (p: { shop?: string; orderedBy?: string }) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return (
    <BottomSheet open onClose={onClose} title={msg('ordc.shopTitle')} testID="ordc-shop-sheet">
      <TextField testID="ordc-shop-name" label={msg('ordc.shopName')} hint={msg('ordc.optional')} value={shop} onChangeText={(v) => onChange({ shop: v })} />
      {recentShops.length ? (
        <View style={{ gap: t.space.xs }}>
          <SectionLabel>{msg('ordc.shopRecent')}</SectionLabel>
          <ChoiceRow>
            {recentShops.map((s) => (
              <ChoiceChip key={s} testID={`ordc-shop-opt-${s}`} label={s} on={same(s, shop)} onPress={() => onChange({ shop: s })} />
            ))}
          </ChoiceRow>
        </View>
      ) : null}
      <TextField testID="ordc-ordered-by" label={msg('ordc.orderedBy')} hint={msg('ordc.optional')} value={orderedBy} onChangeText={(v) => onChange({ orderedBy: v })} />
      {recentPeople.length ? (
        <ChoiceRow>
          {recentPeople.map((s) => (
            <ChoiceChip key={s} testID={`ordc-by-opt-${s}`} label={s} on={same(s, orderedBy)} onPress={() => onChange({ orderedBy: s })} />
          ))}
        </ChoiceRow>
      ) : null}
      <CTA testID="ordc-shop-done" onPress={onClose}>
        {msg('ordc.shopDone')}
      </CTA>
    </BottomSheet>
  );
}

export function PayerSheet({
  payer,
  choices,
  lastPayerId,
  netSatang,
  onPick,
  onClose,
}: {
  payer: Payer | null;
  /** Farm funds first, then whoever paid before, then known people. */
  choices: readonly Payer[];
  /** The device's last payer (or farm funds the first time): tagged "เหมือนครั้งก่อน". */
  lastPayerId: string | null;
  netSatang: number;
  onPick: (p: Payer) => void;
  onClose: () => void;
}) {
  const msg = useT();
  const [more, setMore] = useState(false);
  const shown = payer && !choices.some((c) => c.id === payer.id) ? [...choices, payer] : choices;
  return (
    <BottomSheet open onClose={onClose} title={msg('ordc.payerTitle')} testID="ordc-payer-sheet">
      {shown.map((p) => (
        <RadioCard
          key={p.id}
          testID={`ordc-payer-${p.id}`}
          selected={payer?.id === p.id}
          title={p.name}
          detail={p.id === lastPayerId ? msg('ordc.sameAsLast') : p.id === FARM_FUNDS ? undefined : msg('ordc.owedBack', { name: p.name, amount: formatSatang(netSatang) })}
          onPress={() => onPick(p)}
        />
      ))}
      {more ? (
        <PayerPicker
          testID="ordc-payer-more"
          value={payer}
          onChange={(p) => {
            if (p) onPick(p);
            setMore(false);
          }}
          extra={choices}
        />
      ) : (
        <ChoiceRow>
          <ChoiceChip testID="ordc-payer-other" dashed label={msg('fin.form.addPerson')} onPress={() => setMore(true)} />
        </ChoiceRow>
      )}
      <CTA testID="ordc-payer-done" onPress={onClose}>
        {msg('ordc.payerDone')}
      </CTA>
    </BottomSheet>
  );
}

export function BillDiscountSheet({
  value,
  maxSatang,
  onChange,
  onClose,
}: {
  value: number;
  /** Sum of the items' nets: the discount cannot go past it. */
  maxSatang: number;
  onChange: (satang: number) => void;
  onClose: () => void;
}) {
  const msg = useT();
  return (
    <BottomSheet open onClose={onClose} title={msg('ordc.billTitle')} testID="ordc-bill-sheet">
      <AppText variant="bodySm">{msg('ordc.billSub')}</AppText>
      <MoneyField testID="ordc-bill-amount" label={msg('ordc.billLabel')} satang={value || null} unit={msg('ordc.baht')} maxSatang={maxSatang} words={false} onChange={onChange} />
      {value > maxSatang ? <FieldError testID="ordc-bill-err">{msg('ordc.err.billOver')}</FieldError> : null}
      <CTA testID="ordc-bill-ok" onPress={onClose}>
        {msg('ordc.billDone')}
      </CTA>
      {value > 0 ? (
        <View style={{ alignItems: 'center' }}>
          <TextLink
            testID="ordc-bill-remove"
            onPress={() => {
              onChange(0);
              onClose();
            }}
          >
            {msg('ordc.billRemove')}
          </TextLink>
        </View>
      ) : null}
    </BottomSheet>
  );
}

