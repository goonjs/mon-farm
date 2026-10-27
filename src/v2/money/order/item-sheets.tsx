/**
 * The sheets that put one item on the order (E11-S11, mockups a2–a4):
 *   PickProductSheet — "ซื้อปุ๋ยอะไร": products bought before, "+ ปุ๋ยใหม่", and a small secondary link to other items.
 *   ItemSheet        — "กี่กระสอบ ราคาเท่าไหร่": QuantityField + price (per sack or the typed total) + the item discount link.
 *   OtherItemSheet   — "ซื้ออะไรอีก": a non-fertilizer item; its unit is a dropdown.
 *   NewProductSheet  — "ปุ๋ยใหม่": type tiles, formula, brand, kg, "จำไว้ใช้ครั้งหน้า".
 * Numbers are only ever typed on the NumberPad (QuantityField / MoneyField): no OS keyboard, no steppers, no quick chips.
 */

import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatSatang } from '../../../core/finance/money';
import type { FertProduct } from '../../../core/finance/fert-products';
import type { FertOption } from '../../../core/finance/ledger';
import type { FertilizerType } from '../../../core/finance/types';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import {
  AppText,
  BasketIcon,
  BottomSheet,
  BoxIcon,
  Button,
  cardStyle,
  ChevronRight,
  CTA,
  FieldError,
  IconTile,
  LeafIcon,
  MoneyField,
  QuantityField,
  SegmentedControl,
  TextField,
  type TileTone,
} from '../../../ui';
import { ChoiceChip, ChoiceRow, SectionLabel, TickCard } from '../pieces';
import {
  moneyOk,
  moneyProblems,
  perUnit,
  productName,
  withGross,
  withQty,
  withUnitPrice,
  type ItemMoney,
  type ProductSpec,
} from './order-model';

const FERT_TONE: Record<FertilizerType, TileTone> = { chemical: 'accept', manure: 'cream', other: 'neutral' };
const FertIcon = ({ type, colour }: { type: FertilizerType; colour: string }) =>
  type === 'manure' ? <BasketIcon color={colour} /> : type === 'other' ? <BoxIcon color={colour} /> : <LeafIcon color={colour} />;

/** The small round-cornered icon tile an item carries in lists and headers. */
export function ItemIcon({ spec }: { spec: ProductSpec }) {
  const type = spec.fertilizer?.type;
  return <IconTile tone={type ? FERT_TONE[type] : 'warn'} icon={(c) => (type ? <FertIcon type={type} colour={c} /> : <BoxIcon color={c} />)} />;
}

/** A small underlined secondary link (never a button): one line, ≥ 48pt tall to tap. */
export function TextLink({ children, onPress, testID, tone = 'soft' }: { children: ReactNode; onPress: () => void; testID: string; tone?: 'soft' | 'ok' }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{ minHeight: t.target.min, justifyContent: 'center', alignSelf: 'flex-start' }}
    >
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.bodyMd,
          fontWeight: t.font.weight.semibold,
          color: tone === 'ok' ? t.color.accept : t.color.inkSoft,
          textDecorationLine: 'underline',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

// ─── Pick product ───────────────────────────────────────────────────────────────

export function PickProductSheet({
  products,
  onPick,
  onNew,
  onOther,
  onClose,
}: {
  products: readonly FertProduct[];
  onPick: (p: FertProduct) => void;
  onNew: () => void;
  onOther: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const typeLabel = (type: FertilizerType) => msg(`ordc.type.${type}` as 'ordc.type.chemical');
  return (
    <BottomSheet open onClose={onClose} title={msg('ordc.pickTitle')} testID="ordc-pick-sheet">
      <AppText variant="bodySm">{msg('ordc.pickSub')}</AppText>
      {products.slice(0, 6).map((p) => {
        const detail =
          p.type === null
            ? msg('ordc.prodSavedOnly')
            : p.sackKg !== null
              ? msg('ordc.prodDetail', { type: typeLabel(p.type), kg: p.sackKg })
              : msg('ordc.prodDetailNoKg', { type: typeLabel(p.type) });
        return (
          <Pressable
            key={p.key}
            testID={`ordc-pick-${p.key}`}
            accessibilityRole="button"
            onPress={() => onPick(p)}
            style={[cardStyle(t), { flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable }]}
          >
            <ItemIcon spec={{ categoryId: '', item: '', unit: '', fertilizer: { type: p.type ?? 'chemical', formula: p.formula, brand: p.brand, sackKg: p.sackKg } }} />
            <View style={{ flex: 1, minWidth: 0, gap: t.space.xxs }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{productName(p.formula, p.brand)}</AppText>
              <AppText variant="bodySm">
                {p.lastPerSackSatang !== null ? msg('ordc.prodLast', { detail, price: formatSatang(p.lastPerSackSatang) }) : detail}
              </AppText>
            </View>
            <ChevronRight color={t.color.inkFaint} />
          </Pressable>
        );
      })}
      <Pressable
        testID="ordc-pick-new"
        accessibilityRole="button"
        onPress={onNew}
        style={{ minHeight: t.target.comfortable, borderRadius: t.radius.lg, borderWidth: t.border.thick, borderStyle: 'dashed', borderColor: t.color.ruleStrong, alignItems: 'center', justifyContent: 'center', padding: t.space.md }}
      >
        <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('ordc.newProduct')}</AppText>
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <TextLink testID="ordc-pick-other" onPress={onOther}>
          {msg('ordc.otherLink')}
        </TextLink>
      </View>
    </BottomSheet>
  );
}

// ─── The money part both item sheets share ─────────────────────────────────────

/** Quantity, price (per unit or the typed total), the item discount (a secondary link), and the live line total. */
function MoneyBlock({
  m,
  set,
  unit,
  qtyLabel,
  qtyCaption,
  tried,
  beside,
}: {
  m: ItemMoney;
  set: (m: ItemMoney) => void;
  unit: string;
  qtyLabel: string;
  qtyCaption?: (q: number | null) => string | undefined;
  tried: boolean;
  /** Shown beside the quantity (the unit dropdown of other items). */
  beside?: ReactNode;
}) {
  const t = useTheme();
  const msg = useT();
  const [discountOpen, setDiscountOpen] = useState(m.discount > 0);
  const problems = moneyProblems(m);
  const per = m.unitPrice ?? (m.gross !== null && m.qty ? perUnit(m.gross, m.qty) : null);
  const net = m.gross === null ? null : Math.max(0, m.gross - m.discount);
  const calc =
    m.mode === 'per' && per !== null && m.qty
      ? msg(m.discount > 0 ? 'ordc.lineCalcDiscount' : 'ordc.lineCalc', { qty: m.qty, price: formatSatang(per), discount: formatSatang(m.discount) })
      : m.mode === 'total'
        ? msg('ordc.lineCalcTotal')
        : '';
  return (
    <>
      <View style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <QuantityField testID="ordc-qty" label={qtyLabel} value={m.qty} unit={unit} min={1} onChange={(q) => set(withQty(m, q))} caption={qtyCaption} />
        </View>
        {beside ? <View style={{ flex: 1 }}>{beside}</View> : null}
      </View>
      {tried && problems.qty ? <FieldError testID="ordc-err-qty">{msg('ordc.err.qty')}</FieldError> : null}

      <SectionLabel>{msg('ordc.price')}</SectionLabel>
      <SegmentedControl
        testID="ordc-price-mode"
        value={m.mode}
        onChange={(mode) => set({ ...m, mode })}
        options={[
          { value: 'per', label: msg('ordc.perUnit', { unit }) },
          { value: 'total', label: msg('ordc.priceTotal') },
        ]}
      />
      {m.mode === 'per' ? (
        <MoneyField testID="ordc-price" label={msg('ordc.perUnit', { unit })} satang={per} unit={msg('ordc.bahtPer', { unit })} onChange={(v) => set(withUnitPrice(m, v))} />
      ) : (
        <MoneyField testID="ordc-price" label={msg('ordc.priceTotal')} satang={m.gross} unit={msg('ordc.baht')} onChange={(v) => set(withGross(m, v))} />
      )}
      {tried && problems.price ? <FieldError testID="ordc-err-price">{msg('ordc.err.price')}</FieldError> : null}

      {discountOpen ? (
        <View style={{ gap: t.space.xs }}>
          <MoneyField
            testID="ordc-discount"
            label={`${msg('ordc.discountLabel')} (${msg('ordc.optional')})`}
            satang={m.discount}
            unit={msg('ordc.baht')}
            maxSatang={m.gross ?? undefined}
            words={false}
            onChange={(v) => set({ ...m, discount: v })}
          />
          <TextLink
            testID="ordc-discount-remove"
            onPress={() => {
              set({ ...m, discount: 0 });
              setDiscountOpen(false);
            }}
          >
            {msg('ordc.discountRemove')}
          </TextLink>
          {problems.discount ? <FieldError testID="ordc-err-discount">{msg('ordc.err.itemDiscount')}</FieldError> : null}
        </View>
      ) : null}

      <View testID="ordc-line-total" style={{ borderRadius: t.radius.lg, backgroundColor: t.color.acceptSunk, padding: t.space.lg, flexDirection: 'row', alignItems: 'center', gap: t.space.md, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 120 }}>
          <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.accept }}>{msg('ordc.lineTotal')}</AppText>
          {calc ? <AppText variant="bodySm">{calc}</AppText> : null}
        </View>
        <Text
          testID="ordc-line-total-amount"
          style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}
        >
          {net === null ? '–' : formatSatang(net)}
        </Text>
      </View>

      {!discountOpen ? (
        <TextLink testID="ordc-discount-link" onPress={() => setDiscountOpen(true)}>
          {msg('ordc.discountLink')}
        </TextLink>
      ) : null}
    </>
  );
}

// ─── Item sheet (fertilizer) ───────────────────────────────────────────────────

export function ItemSheet({
  spec,
  initial,
  editing,
  onDone,
  onRemove,
  onChangeProduct,
  onClose,
}: {
  spec: ProductSpec;
  initial: ItemMoney;
  editing: boolean;
  onDone: (m: ItemMoney) => void;
  onRemove: () => void;
  /** Hands over what was typed so the next product keeps it. */
  onChangeProduct: (m: ItemMoney) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [m, setM] = useState(initial);
  const [tried, setTried] = useState(false);
  const f = spec.fertilizer;
  const sub = f ? (f.sackKg !== null ? msg('ordc.perSackKg', { type: msg(`ordc.type.${f.type}` as 'ordc.type.chemical'), kg: f.sackKg }) : msg('ordc.perSack', { type: msg(`ordc.type.${f.type}` as 'ordc.type.chemical') })) : '';
  const submit = () => {
    setTried(true);
    if (moneyOk(moneyProblems(m))) onDone(m);
  };
  return (
    <BottomSheet open onClose={onClose} title={msg('ordc.itemTitle')} testID="ordc-item-sheet">
      <View style={[cardStyle(t), { flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md }]}>
        <ItemIcon spec={spec} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText testID="ordc-item-name" style={{ fontWeight: t.font.weight.bold }}>{spec.item}</AppText>
          {sub ? <AppText variant="bodySm">{sub}</AppText> : null}
        </View>
        <View>
          <Button testID="ordc-change" onPress={() => onChangeProduct(m)}>
            {msg('ordc.change')}
          </Button>
        </View>
      </View>
      <MoneyBlock
        m={m}
        set={setM}
        unit={msg('ordc.sackUnit')}
        qtyLabel={msg('ordc.qtySacks')}
        qtyCaption={(q) => (q && f?.sackKg ? msg('ordc.sackKgTotal', { kg: (q * f.sackKg).toLocaleString('en-US') }) : undefined)}
        tried={tried}
      />
      <CTA testID="ordc-item-done" onPress={submit}>
        {msg('ordc.itemDone')}
      </CTA>
      {editing ? (
        <View style={{ alignItems: 'center' }}>
          <TextLink testID="ordc-item-remove" onPress={onRemove}>
            {msg('ordc.itemRemove')}
          </TextLink>
        </View>
      ) : null}
    </BottomSheet>
  );
}

// ─── Other items ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'cat-herbicide', key: 'ordc.cat.herbicide' },
  { id: 'cat-fuel', key: 'ordc.cat.fuel' },
  { id: 'cat-repair', key: 'ordc.cat.repair' },
  { id: 'cat-other', key: 'ordc.cat.other' },
] as const;
const UNIT_KEYS = ['ordc.unit.litre', 'ordc.unit.bottle', 'ordc.unit.piece', 'ordc.unit.bag', 'ordc.unit.kg'] as const;

/** A dropdown for the unit: a field that opens a short list under it, plus "+ หน่วยใหม่". */
function UnitSelect({ value, onChange, units }: { value: string; onChange: (u: string) => void; units: readonly string[] }) {
  const t = useTheme();
  const msg = useT();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const list = units.includes(value) || !value ? units : [...units, value];
  return (
    <View style={{ gap: t.space.xs }}>
      <Pressable
        testID="ordc-unit"
        accessibilityRole="button"
        accessibilityLabel={`${msg('ordc.unit')}: ${value}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={[cardStyle(t), { flex: 1, minHeight: t.target.comfortable, padding: t.space.lg, justifyContent: 'center', gap: t.space.xs }]}
      >
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: t.color.inkSoft }}>{msg('ordc.unit')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm }}>
          <Text style={{ flexShrink: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, color: t.color.ink }}>{value}</Text>
          <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }} aria-hidden>
            <ChevronRight color={t.color.inkSoft} />
          </View>
        </View>
      </Pressable>
      {open ? (
        <View testID="ordc-unit-list" style={[cardStyle(t), { padding: t.space.xs }]}>
          {list.map((u) => (
            <Pressable
              key={u}
              testID={`ordc-unit-${u}`}
              accessibilityRole="button"
              accessibilityState={{ selected: u === value }}
              onPress={() => {
                onChange(u);
                setOpen(false);
              }}
              style={{ minHeight: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.md, borderRadius: t.radius.md, backgroundColor: u === value ? t.color.actionSunk : 'transparent' }}
            >
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: u === value ? t.font.weight.bold : t.font.weight.semibold, color: t.color.ink }}>{u}</Text>
            </Pressable>
          ))}
          {adding ? (
            <View style={{ padding: t.space.sm, gap: t.space.sm }}>
              <TextField testID="ordc-unit-new-name" label={msg('ordc.unitNewLabel')} value={name} onChangeText={setName} />
              <Button
                testID="ordc-unit-new-add"
                disabled={!name.trim()}
                onPress={() => {
                  onChange(name.trim());
                  setName('');
                  setAdding(false);
                  setOpen(false);
                }}
              >
                {msg('ordc.unitNewAdd')}
              </Button>
            </View>
          ) : (
            <Pressable
              testID="ordc-unit-new"
              accessibilityRole="button"
              onPress={() => setAdding(true)}
              style={{ minHeight: t.target.min, justifyContent: 'center', paddingHorizontal: t.space.md, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint }}
            >
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('ordc.unitNew')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function OtherItemSheet({
  initialSpec,
  initial,
  editing,
  onDone,
  onRemove,
  onClose,
}: {
  initialSpec: ProductSpec | null;
  initial: ItemMoney;
  editing: boolean;
  onDone: (spec: ProductSpec, m: ItemMoney) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const units = UNIT_KEYS.map((k) => msg(k));
  const [categoryId, setCategoryId] = useState(initialSpec?.categoryId ?? CATEGORIES[0].id);
  const [name, setName] = useState(initialSpec?.item ?? '');
  const [unit, setUnit] = useState(initialSpec?.unit ?? units[0]);
  const [m, setM] = useState(initial);
  const [tried, setTried] = useState(false);
  const submit = () => {
    setTried(true);
    if (!name.trim() || !moneyOk(moneyProblems(m))) return;
    onDone({ categoryId, item: name.trim(), unit }, m);
  };
  return (
    <BottomSheet open onClose={onClose} title={msg('ordc.otherTitle')} testID="ordc-other-sheet">
      <AppText variant="bodySm">{msg('ordc.otherSub')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
        {CATEGORIES.map((c) => {
          const on = c.id === categoryId;
          return (
            <Pressable
              key={c.id}
              testID={`ordc-cat-${c.id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              onPress={() => setCategoryId(c.id)}
              style={{
                flexGrow: 1,
                flexBasis: '45%',
                minHeight: t.target.comfortable,
                alignItems: 'center',
                justifyContent: 'center',
                padding: t.space.md,
                borderRadius: t.radius.lg,
                borderWidth: on ? t.border.thick : t.border.hair,
                borderColor: on ? t.color.action : t.color.ruleStrong,
                backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised,
              }}
            >
              <Text style={{ textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg(c.key)}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextField testID="ordc-name" label={msg('ordc.itemName')} required value={name} onChangeText={setName} error={tried && !name.trim() ? msg('ordc.err.name') : undefined} />
      <MoneyBlock m={m} set={setM} unit={unit} qtyLabel={msg('ordc.qty')} tried={tried} beside={<UnitSelect value={unit} onChange={setUnit} units={units} />} />
      <CTA testID="ordc-item-done" onPress={submit}>
        {msg('ordc.itemDone')}
      </CTA>
      {editing ? (
        <View style={{ alignItems: 'center' }}>
          <TextLink testID="ordc-item-remove" onPress={onRemove}>
            {msg('ordc.itemRemove')}
          </TextLink>
        </View>
      ) : null}
    </BottomSheet>
  );
}

// ─── New product ───────────────────────────────────────────────────────────────

export interface NewProduct {
  readonly type: FertilizerType;
  readonly formula: string;
  readonly brand: string;
  readonly sackKg: number | null;
}

export function NewProductSheet({
  options,
  initial,
  onClose,
  onDone,
}: {
  options: readonly FertOption[];
  initial: NewProduct;
  onClose: () => void;
  onDone: (p: NewProduct, remember: boolean) => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [v, setV] = useState(initial);
  const [remember, setRemember] = useState(true);
  const [tried, setTried] = useState(false);
  const sizes = [...new Set([25, 50, ...options.filter((o) => o.kind === 'sackKg' && !o.hidden).map((o) => Number(o.name)).filter((n) => n > 0)])];
  const [otherKg, setOtherKg] = useState(initial.sackKg !== null && !sizes.includes(initial.sackKg));
  const brands = options.filter((o) => o.kind === 'brand' && !o.hidden && (!v.brand.trim() || o.name.toLowerCase().includes(v.brand.trim().toLowerCase()))).slice(0, 4);
  const types: FertilizerType[] = ['chemical', 'manure', 'other'];
  const submit = () => {
    setTried(true);
    if (!v.formula.trim()) return;
    onDone({ ...v, formula: v.formula.trim(), brand: v.brand.trim() }, remember);
  };
  return (
    <BottomSheet open onClose={onClose} title={msg('ordc.newTitle')} testID="ordc-new-sheet">
      <AppText variant="bodySm">{msg('ordc.newSub')}</AppText>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        {types.map((k) => {
          const on = v.type === k;
          return (
            <Pressable
              key={k}
              testID={`ordc-type-${k}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              onPress={() => setV({ ...v, type: k })}
              style={{
                flex: 1,
                minHeight: t.target.comfortable,
                alignItems: 'center',
                justifyContent: 'center',
                gap: t.space.xs,
                padding: t.space.sm,
                borderRadius: t.radius.lg,
                borderWidth: on ? t.border.thick : t.border.hair,
                borderColor: on ? t.color.action : t.color.ruleStrong,
                backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised,
              }}
            >
              <IconTile tone={FERT_TONE[k]} icon={(c) => <FertIcon type={k} colour={c} />} />
              <Text style={{ textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg(`ordc.type.${k}` as 'ordc.type.chemical')}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        testID="ordc-formula"
        label={msg('ordc.formula')}
        hint={msg('ordc.required')}
        required
        value={v.formula}
        onChangeText={(formula) => setV({ ...v, formula })}
        error={tried && !v.formula.trim() ? msg('ordc.err.formula') : undefined}
      />
      <View style={{ gap: t.space.xs }}>
        <TextField testID="ordc-brand" label={msg('ordc.brand')} hint={msg('ordc.optional')} placeholder={msg('ordc.brandPlaceholder')} value={v.brand} onChangeText={(brand) => setV({ ...v, brand })} />
        {brands.length ? (
          <ChoiceRow>
            {brands.map((o) => (
              <ChoiceChip key={o.id} testID={`ordc-brand-opt-${o.name}`} label={o.name} on={o.name.trim().toLowerCase() === v.brand.trim().toLowerCase()} onPress={() => setV({ ...v, brand: o.name })} />
            ))}
          </ChoiceRow>
        ) : null}
      </View>
      <View style={{ gap: t.space.xs }}>
        <SectionLabel>{msg('ordc.sackKg')}</SectionLabel>
        <ChoiceRow>
          {sizes.map((s) => (
            <ChoiceChip
              key={s}
              testID={`ordc-kg-${s}`}
              label={msg('ordc.kg', { kg: s })}
              on={!otherKg && v.sackKg === s}
              onPress={() => {
                setOtherKg(false);
                setV({ ...v, sackKg: s });
              }}
            />
          ))}
          <ChoiceChip testID="ordc-kg-other" dashed label={msg('ordc.kgOther')} on={otherKg} onPress={() => setOtherKg(true)} />
          <ChoiceChip
            testID="ordc-kg-unknown"
            label={msg('ordc.kgUnknown')}
            on={!otherKg && v.sackKg === null}
            onPress={() => {
              setOtherKg(false);
              setV({ ...v, sackKg: null });
            }}
          />
        </ChoiceRow>
        {otherKg ? <QuantityField testID="ordc-kg-value" label={msg('ordc.kgOtherLabel')} value={v.sackKg} unit={msg('ordc.unit.kg')} min={1} maxDigits={3} onChange={(n) => setV({ ...v, sackKg: n })} /> : null}
      </View>
      <TickCard testID="ordc-remember" title={msg('ordc.remember')} on={remember} onPress={() => setRemember((r) => !r)} />
      <CTA testID="ordc-new-done" onPress={submit}>
        {msg('ordc.useThis')}
      </CTA>
    </BottomSheet>
  );
}
