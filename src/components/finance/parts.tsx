/**
 * Small building blocks shared by the finance screens (E11): chips that wrap
 * row by row (F4 — fill the row before breaking to the next), a field label,
 * the payer picker, and the stage treatment (actual = solid, committed =
 * outlined, planned = dashed outline — always with a word, §12.9 rule 9).
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

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
