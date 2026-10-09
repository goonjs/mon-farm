/**
 * Records one deduction against a worker's own share (S29, FR-7.3).
 *
 * One form for the whole sale, not one per worker card: a deduction can name
 * ANYONE — including someone who holds no zone contract in this sale (the
 * acceptance criterion that a deduction "against someone who holds no zone
 * contract in this sale is shown, with a share of zero and a negative
 * payout, rather than being dropped"). Picking the target from `PeoplePicker`
 * rather than typing a name is the same reasoning `zone_contract_set` already
 * follows.
 *
 * Amount, reason and who agreed it are all REQUIRED — the add button stays
 * disabled until every field is filled, mirroring how `setup.tsx`'s price
 * card gates its own save.
 */

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from './chrome';
import { PeoplePicker } from './PeoplePicker';
import type { Person } from '../store/people';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export interface DeductionFormInput {
  readonly personId: string;
  readonly personName: string;
  /** Positive integer satang — converted from the baht the field takes. */
  readonly satang: number;
  readonly reason: string;
  readonly agreedBy: string;
}

export interface DeductionFormProps {
  onAdd: (input: DeductionFormInput) => void;
  testID?: string;
}

export function DeductionForm({ onAdd, testID = 'deduction-add' }: DeductionFormProps) {
  const t = useTheme();
  const msg = useT();
  const [person, setPerson] = useState<Person | null>(null);
  const [baht, setBaht] = useState('');
  const [reason, setReason] = useState('');
  const [agreedBy, setAgreedBy] = useState('');

  const parsed = Number(baht);
  const canAdd =
    !!person && Number.isFinite(parsed) && parsed > 0 && reason.trim().length > 0 && agreedBy.trim().length > 0;

  const submit = () => {
    if (!canAdd || !person) return;
    // Baht -> satang at the entry boundary, mirroring setup.tsx's price field.
    onAdd({ personId: person.id, personName: person.name, satang: Math.round(parsed * 100), reason: reason.trim(), agreedBy: agreedBy.trim() });
    setPerson(null);
    setBaht('');
    setReason('');
    setAgreedBy('');
  };

  return (
    <View style={{ gap: t.space.sm }}>
      <PeoplePicker value={person} onChange={setPerson} testID="deduction-person" />
      <Field label={msg('settle.deductionAmount')}>
        <TextInput
          testID="deduction-amount"
          value={baht}
          onChangeText={setBaht}
          keyboardType="decimal-pad"
          style={inputStyle(t)}
        />
      </Field>
      <Field label={msg('settle.deductionReason')}>
        <TextInput testID="deduction-reason" value={reason} onChangeText={setReason} style={inputStyle(t)} />
      </Field>
      <Field label={msg('settle.deductionAgreedBy')}>
        <TextInput testID="deduction-agreed-by" value={agreedBy} onChangeText={setAgreedBy} style={inputStyle(t)} />
      </Field>
      <Button testID={testID} variant="primary" disabled={!canAdd} onPress={submit}>
        {msg('settle.deductionAdd')}
      </Button>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>) {
  return {
    minHeight: 36,
    ...t.face(t.font.weight.regular),
    fontSize: t.font.size.small,
    paddingHorizontal: t.space.sm,
    borderWidth: t.border.hair,
    borderColor: t.color.ruleStrong,
    borderRadius: t.radius.sm,
    backgroundColor: t.color.surfaceRaised,
    color: t.color.ink,
  } as const;
}
