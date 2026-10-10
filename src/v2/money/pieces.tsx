/**
 * Small pieces the v2 money screens share (D-82: built from src/ui and theme
 * tokens only — never the old src/components).
 *
 * - ChoiceChip / ChoiceRow: the selectable pills of the v1.1.0 forms
 *   (category, payer); selected = action-tinted fill with an action border.
 * - stageCard: an expense card's treatment by stage — actual = tinted fill,
 *   committed = white with an action outline, planned = dashed — always with
 *   the stage word beside the amount (never shape or colour alone, NFR-4).
 * - UnknownPill (dashed "ไม่ทราบ", SYNC-12) and NotRecordedPill (grey
 *   "ไม่ได้บันทึก") — the two field-state labels of mockup screen 28.
 * - PayerPicker: farm funds first, then people; "+ คนอื่น" adds a person.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { formatDate } from '../../core/finance/money';
import { FARM_FUNDS, type Payer, type Stage } from '../../core/finance/types';
import type { BuiltinRole } from '../../core/types';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme, type Theme } from '../../theme';
import { AppText, Button, DateText, TextField } from '../../ui';

export function ChoiceChip({
  label,
  on,
  onPress,
  testID,
  dashed,
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
  testID?: string;
  dashed?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={{
        minHeight: t.target.min,
        justifyContent: 'center',
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.pill,
        borderWidth: on ? t.border.thick : t.border.hair,
        borderStyle: dashed && !on ? 'dashed' : 'solid',
        borderColor: on ? t.color.action : t.color.ruleStrong,
        backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.semibold, color: t.color.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Pills fill the row before wrapping (D-74 F4). */
export function ChoiceRow({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>{children}</View>;
}

/** Label over a form section, with an optional soft hint ("ไม่บังคับ"). */
export function SectionLabel({ children, hint, required }: { children: ReactNode; hint?: string; required?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
      <AppText variant="label">{children}</AppText>
      {required ? <Text style={{ color: t.color.reject, fontWeight: t.font.weight.bold }}>*</Text> : null}
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </View>
  );
}

export function stageCard(stage: Stage, t: Theme): ViewStyle {
  return {
    borderRadius: t.radius.lg,
    padding: t.space.md,
    borderWidth: stage === 'actual' ? 0 : stage === 'committed' ? t.border.thick : t.border.hair,
    borderStyle: stage === 'planned' ? 'dashed' : 'solid',
    borderColor: stage === 'committed' ? t.color.action : t.color.ruleStrong,
    backgroundColor: stage === 'actual' ? t.color.actionSunk : t.color.surfaceRaised,
  };
}

function Pill({ children, dashed, testID }: { children: ReactNode; dashed?: boolean; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: t.space.sm,
        paddingVertical: 2,
        borderRadius: t.radius.pill,
        borderWidth: dashed ? t.border.hair : 0,
        borderStyle: 'dashed',
        borderColor: t.color.ruleStrong,
        backgroundColor: dashed ? t.color.surfaceRaised : t.color.surfaceSunk,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: t.color.inkSoft }}>{children}</Text>
    </View>
  );
}

/** Nobody knows (SYNC-12): dashed. Never shown as 0. */
export function UnknownPill({ testID }: { testID?: string }) {
  const msg = useT();
  return (
    <Pill dashed testID={testID}>
      {msg('fin.row.unknown')}
    </Pill>
  );
}

/** Not filled in yet: grey ground. */
export function NotRecordedPill({ testID }: { testID?: string }) {
  const msg = useT();
  return <Pill testID={testID}>{msg('dataState.not-recorded')}</Pill>;
}

/** A recorded calendar day ("YYYY-MM-DD") in the app's era, dotted like every date (D-74 F14). */
export function Day({ iso, testID }: { iso: string; testID?: string }) {
  return <DateText testID={testID} value={formatDate(iso)} />;
}

/**
 * Farm funds first, then people, then payers seen in the ledger; "+ คนอื่น"
 * adds a person to the shared people list and picks them. `allowNone`
 * offers "ใส่ทีหลัง" (F7).
 */
export function PayerPicker({
  value,
  onChange,
  extra = [],
  allowNone,
  role = 'payer',
  testID = 'payer',
}: {
  value: Payer | null;
  onChange: (p: Payer | null) => void;
  extra?: readonly Payer[];
  allowNone?: boolean;
  /** The role a person added here gets in the people list (E03-S01 needs one). */
  role?: BuiltinRole;
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

  const all: Payer[] = [{ id: FARM_FUNDS, name: msg('fin.payer.farm') }, ...people];
  for (const p of extra) if (p.id !== FARM_FUNDS && !all.some((q) => q.id === p.id)) all.push(p);
  if (value && !all.some((q) => q.id === value.id)) all.push(value);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const person = await peopleStore.create(n, [role]);
    const p = { id: person.id, name: person.name };
    setPeople((list) => [...list, p]);
    setName('');
    setAdding(false);
    onChange(p);
  };

  return (
    <View style={{ gap: t.space.sm }}>
      <ChoiceRow>
        {all.map((p) => (
          <ChoiceChip key={p.id} testID={`${testID}-${p.id}`} label={p.name} on={value?.id === p.id} onPress={() => onChange(p)} />
        ))}
        {allowNone ? <ChoiceChip testID={`${testID}-none`} label={msg('fin.form.payerLater')} on={value === null} onPress={() => onChange(null)} /> : null}
        {!adding ? <ChoiceChip testID={`${testID}-add`} label={msg('fin.form.addPerson')} onPress={() => setAdding(true)} /> : null}
      </ChoiceRow>
      {adding ? (
        <View style={{ gap: t.space.sm }}>
          <TextField testID={`${testID}-name`} label={msg('fin.form.personPlaceholder')} value={name} onChangeText={setName} />
          <Button testID={`${testID}-add-save`} onPress={() => void add()}>
            {msg('common.save')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
