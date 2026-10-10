/**
 * Small building blocks shared by the finance screens (E11): chips that wrap
 * row by row (F4 — fill the row before breaking to the next), a field label,
 * the payer picker, and the stage treatment (actual = solid, committed =
 * outlined, planned = dashed outline — always with a word, §12.9 rule 9).
 */

import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { FARM_FUNDS, type Payer, type Stage } from '../../core/finance/types';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import { Button } from '../chrome';

export function Chip({
  children,
  on,
  onPress,
  testID,
  accessibilityLabel,
}: {
  children: ReactNode;
  on?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        minHeight: t.target.min - 8,
        justifyContent: 'center',
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.pill,
        borderWidth: t.border.hair,
        borderColor: on ? t.color.action : t.color.ruleStrong,
        backgroundColor: on ? t.color.action : t.color.surface,
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.small,
          fontWeight: on ? t.font.weight.bold : t.font.weight.regular,
          color: on ? t.color.inkInverse : t.color.ink,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/** Chips flow left to right and wrap only when the row is full (D-74 F4). */
export function ChipRow({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }}>{children}</View>;
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
        {children}
      </Text>
      {hint ? (
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color: t.color.inkSoft }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Note({ children, tone = 'soft', testID }: { children: ReactNode; tone?: 'soft' | 'warn' | 'reject'; testID?: string }) {
  const t = useTheme();
  const color = { soft: t.color.inkSoft, warn: t.color.warn, reject: t.color.reject }[tone];
  return (
    <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color }}>
      {children}
    </Text>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  testID,
  numeric,
  multiline,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  testID?: string;
  numeric?: boolean;
  multiline?: boolean;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.color.inkFaint}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      multiline={multiline}
      accessibilityLabel={accessibilityLabel ?? placeholder}
      style={{
        minHeight: t.target.min,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.sm,
        borderWidth: t.border.hair,
        borderColor: t.color.ruleStrong,
        borderRadius: t.radius.md,
        backgroundColor: t.color.surfaceRaised,
        color: t.color.ink,
        fontFamily: numeric ? t.font.family.mono : t.font.family.sans,
        fontSize: numeric ? t.font.size.body : t.font.size.small,
      }}
    />
  );
}

/** Stage word + shape: solid, outlined, dashed (never colour alone — NFR-4). */
export function StageTag({ stage }: { stage: Stage }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View
      testID={`stage-${stage}`}
      style={{
        paddingHorizontal: t.space.sm,
        paddingVertical: 2,
        borderRadius: t.radius.pill,
        borderWidth: stage === 'actual' ? 0 : t.border.thick,
        borderStyle: stage === 'planned' ? 'dashed' : 'solid',
        borderColor: t.color.ink,
        backgroundColor: stage === 'actual' ? t.color.ink : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.micro,
          fontWeight: t.font.weight.bold,
          color: stage === 'actual' ? t.color.inkInverse : t.color.ink,
        }}
      >
        {msg(`fin.stage.${stage}`)}
      </Text>
    </View>
  );
}

/** Card frame for one expense, in the stage's own treatment. */
export function stageFrame(stage: Stage, t: ReturnType<typeof useTheme>) {
  return {
    borderRadius: t.radius.lg,
    padding: t.space.md,
    borderWidth: stage === 'actual' ? t.border.hair : t.border.thick,
    borderStyle: stage === 'planned' ? ('dashed' as const) : ('solid' as const),
    borderColor: stage === 'actual' ? t.color.rule : t.color.ruleStrong,
    backgroundColor: stage === 'actual' ? t.color.surfaceSunk : t.color.surface,
  };
}

export function farmPayer(name: string): Payer {
  return { id: FARM_FUNDS, name };
}

/**
 * Farm funds first, then people. "+ someone else" adds a person to the shared
 * people list (E03-S01's store) and picks them. `allowNone` offers "later"
 * (F7: fertilizer owner-share expenses may leave the payer for later).
 */
export function PayerPicker({
  value,
  onChange,
  extra = [],
  allowNone,
  testID = 'payer',
}: {
  value: Payer | null;
  onChange: (p: Payer | null) => void;
  /** Payers seen in the ledger (snapshots) that may no longer be in the people list. */
  extra?: readonly Payer[];
  allowNone?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  const [people, setPeople] = useState<Payer[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    peopleStore.list().then(
      (list) => setPeople(list.map((p) => ({ id: p.id, name: p.name }))),
      () => setPeople([]),
    );
  }, []);

  const farm = farmPayer(msg('fin.payer.farm'));
  const all = [farm, ...people];
  for (const p of extra) if (p.id !== FARM_FUNDS && !all.some((q) => q.id === p.id)) all.push(p);
  if (value && !all.some((q) => q.id === value.id)) all.push(value);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const person = await peopleStore.create(n);
    const p = { id: person.id, name: person.name };
    setPeople((list) => [...list, p]);
    setName('');
    setAdding(false);
    onChange(p);
  };

  return (
    <View style={{ gap: t.space.xs }}>
      <ChipRow>
        {all.map((p) => (
          <Chip key={p.id} testID={`${testID}-${p.id}`} on={value?.id === p.id} onPress={() => onChange(p)}>
            {p.name}
          </Chip>
        ))}
        {allowNone ? (
          <Chip testID={`${testID}-none`} on={value === null} onPress={() => onChange(null)}>
            {msg('fin.form.payerLater')}
          </Chip>
        ) : null}
        {!adding ? (
          <Chip testID={`${testID}-add`} onPress={() => setAdding(true)}>
            {msg('fin.form.addPerson')}
          </Chip>
        ) : null}
      </ChipRow>
      {adding ? (
        <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Input testID={`${testID}-name`} value={name} onChangeText={setName} placeholder={msg('fin.form.personPlaceholder')} />
          </View>
          <Button testID={`${testID}-add-save`} variant="primary" onPress={() => void add()}>
            {msg('common.save')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

// ── v1.1.0 screen language (flow-farm / flow-sale mockups) ──────────────────

/**
 * The v1.1.0 app bar: a back arrow, the title with its context line under
 * it, and a slot on the right (a status chip). Replaces the old "กลับ"
 * text button on the finance screens.
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
  testID = 'screen',
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs,
        paddingHorizontal: t.space.xs,
        paddingVertical: t.space.xs,
        backgroundColor: t.color.surface,
      }}
    >
      <Pressable
        testID={`${testID}-back`}
        accessibilityRole="button"
        accessibilityLabel={msg('common.back')}
        onPress={back}
        style={{ width: t.target.min, height: t.target.min, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, color: t.color.ink }}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          testID="crumb"
          numberOfLines={1}
          style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>{right}</View> : null}
    </View>
  );
}

/** A white card on the screen ground — the v1.1.0 unit of grouping. */
export function Card({ children, tone = 'plain', testID }: { children: ReactNode; tone?: 'plain' | 'accent'; testID?: string }) {
  const t = useTheme();
  const look = {
    plain: { bg: t.color.surfaceRaised, border: t.color.ruleFaint, style: 'solid' as const },
    accent: { bg: t.color.acceptSunk, border: t.color.accept, style: 'dashed' as const },
  }[tone];
  return (
    <View
      testID={testID}
      style={{
        gap: t.space.xs,
        padding: t.space.md,
        borderRadius: t.radius.lg,
        borderWidth: t.border.hair,
        borderStyle: look.style,
        borderColor: look.border,
        backgroundColor: look.bg,
      }}
    >
      {children}
    </View>
  );
}

/** A card's small heading ("สรุปเทียบยอด", "ประวัติ"). */
export function CardTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>{children}</Text>
  );
}

export type FactMark = 'date' | 'person' | 'place' | 'money' | 'note' | 'check' | 'half';

/**
 * One fact per line, led by its mark (D-70). The mark is a slot: E01-S13's
 * line icons go here when they land; until then a small shape keeps the
 * line's rhythm without inventing glyphs.
 */
export function Fact({ mark, children, tone = 'soft', testID }: { mark: FactMark; children: ReactNode; tone?: 'soft' | 'warn' | 'accept'; testID?: string }) {
  const t = useTheme();
  const color = { soft: t.color.inkSoft, warn: t.color.warn, accept: t.color.accept }[tone];
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
      <View
        testID={`fact-mark-${mark}`}
        style={{
          width: 8,
          height: 8,
          borderRadius: mark === 'person' || mark === 'half' ? 4 : 2,
          borderWidth: t.border.hair,
          borderColor: color,
          backgroundColor: mark === 'check' || mark === 'half' ? color : 'transparent',
        }}
      />
      <Text style={{ flexShrink: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color }}>{children}</Text>
    </View>
  );
}

/**
 * A label and an amount on one line. Money in or out always carries its
 * sign and a word — "+2,000.00 เข้า" / "−1,500.00 ออก" — so the colour is
 * never the only carrier (NFR-4). null reads "ไม่ทราบ", never 0 (SYNC-12).
 */
export function MoneyLine({
  label,
  satang,
  dir,
  strong,
  testID = 'money',
}: {
  label: string;
  satang: number | null;
  dir?: 'in' | 'out';
  strong?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  // Zero moves no money: no sign, no word, no colour.
  if (satang === 0) dir = undefined;
  const text =
    satang === null ? msg('fin.row.unknown') : dir === 'in' ? `+${formatSatang(Math.abs(satang))}` : dir === 'out' ? `−${formatSatang(Math.abs(satang))}` : formatSatang(satang);
  const color = dir === 'in' ? t.color.accept : dir === 'out' ? t.color.reject : t.color.ink;
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm }}>
      <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: strong ? t.color.ink : t.color.inkSoft, fontWeight: strong ? t.font.weight.bold : t.font.weight.regular }}>
        {label}
      </Text>
      <Text testID={`${testID}-amount`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: satang === null ? t.color.inkSoft : color }}>
        {text}
      </Text>
      {dir && satang !== null ? (
        <Text testID={`${testID}-word`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color }}>
          {msg(dir === 'in' ? 'fin.money.in' : 'fin.money.out')}
        </Text>
      ) : null}
    </View>
  );
}

/** A thin divider inside a card. */
export function Rule() {
  const t = useTheme();
  return <View style={{ height: t.border.hair, backgroundColor: t.color.ruleFaint, marginVertical: t.space.xs }} />;
}

/** The hero figure at the top of a summary card: caption, big number, unit. */
export function BigAmount({ satang, caption, children, testID = 'big' }: { satang: number; caption?: string; children?: ReactNode; testID?: string }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View testID={`${testID}-card`} style={{ alignItems: 'center', gap: 2 }}>
      {caption ? <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color: t.color.inkSoft }}>{caption}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
        <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayXl, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {formatSatang(satang)}
        </Text>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('fin.baht')}</Text>
      </View>
      {children}
    </View>
  );
}
