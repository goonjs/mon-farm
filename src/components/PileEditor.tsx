/**
 * Correcting a pile that was set up wrong (S26).
 *
 * The FR-3.4 lock is the whole shape of this form. A name carries no money,
 * so it is editable at every status; `tareG`/`stdNetG` are what the NEXT
 * basket is counted against, so they stop being editable the moment a basket
 * has been counted — shown here as read-only fields plus a line saying why,
 * rather than fields that vanish, so the operator can still see what the pile
 * is counting at. That mirrors the 🔒 the counter already shows beside a
 * locked standard net.
 *
 * `canEditNet` is decided by `canEditPileNet` in core and passed in; this
 * form renders the answer and refuses to emit an edited weight without it,
 * but it is not the enforcement — the guard at the call site and the fold in
 * `projectSale` are (see the note on `pile_edited` in core/types.ts).
 */

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from './chrome';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export interface PileEdit {
  name: string;
  tareG: number;
  stdNetG: number;
}

/**
 * What this form needs of a pile, and nothing more: an id and the three
 * editable fields. A sale's `Pile` satisfies it, and so does a farm-profile
 * pile (S27) — the form is the same correction either way, so it is typed on
 * the shape it actually touches rather than on the sale's record.
 */
export interface PileEditorTarget {
  readonly id: string;
  readonly name: string;
  readonly tareG: number;
  readonly stdNetG: number;
}

export interface PileEditorProps {
  pile: PileEditorTarget;
  canEditNet: boolean;
  onSave: (edit: PileEdit) => void;
  onCancel: () => void;
}

export function PileEditor({ pile, canEditNet, onSave, onCancel }: PileEditorProps) {
  const t = useTheme();
  const msg = useT();
  const [name, setName] = useState(pile.name);
  const [tareKg, setTareKg] = useState(String(pile.tareG / 1000));
  const [stdKg, setStdKg] = useState(String(pile.stdNetG / 1000));

  const tare = Number(tareKg);
  const std = Number(stdKg);
  const netUsable = Number.isFinite(tare) && tare >= 0 && Number.isFinite(std) && std > 0;
  const canSave = name.trim().length > 0 && (!canEditNet || netUsable);

  const save = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      // A locked pile is saved at the weights it already has — never at
      // whatever is in the (read-only) fields. Same rule as the fold's.
      tareG: canEditNet ? Math.round(tare * 1000) : pile.tareG,
      stdNetG: canEditNet ? Math.round(std * 1000) : pile.stdNetG,
    });
  };

  return (
    <View testID={`pile-editor-${pile.id}`} style={{ gap: t.space.xs, marginVertical: t.space.xs }}>
      <Field label={msg('setup.pileNamePlaceholder')}>
        <TextInput
          testID={`pile-edit-name-${pile.id}`}
          value={name}
          onChangeText={setName}
          style={inputStyle(t, true)}
        />
      </Field>
      <View style={{ flexDirection: 'row', gap: t.space.xs }}>
        <View style={{ flex: 1 }}>
          <Field label={msg('pile.tare')}>
            <TextInput
              testID={`pile-edit-tare-${pile.id}`}
              value={tareKg}
              onChangeText={setTareKg}
              editable={canEditNet}
              keyboardType="decimal-pad"
              style={inputStyle(t, canEditNet)}
            />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label={msg('pile.stdNet')}>
            <TextInput
              testID={`pile-edit-std-${pile.id}`}
              value={stdKg}
              onChangeText={setStdKg}
              editable={canEditNet}
              keyboardType="decimal-pad"
              style={inputStyle(t, canEditNet)}
            />
          </Field>
        </View>
      </View>
      {!canEditNet ? (
        <Text
          testID={`pile-edit-locked-${pile.id}`}
          style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.warn }}
        >
          {msg('setup.pileNetLocked')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: t.space.xs }}>
        <Button
          testID={`pile-edit-save-${pile.id}`}
          variant="primary"
          disabled={!canSave}
          onPress={save}
        >
          {msg('common.save')}
        </Button>
        <Button testID={`pile-edit-cancel-${pile.id}`} onPress={onCancel}>
          {msg('common.cancel')}
        </Button>
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View>
      <Text
        style={{
          fontFamily: t.font.family.mono,
          fontSize: t.font.size.micro,
          letterSpacing: t.font.tracking.wide,
          color: t.color.inkSoft,
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>, editable: boolean) {
  return {
    fontFamily: t.font.family.sans,
    fontSize: t.font.size.small,
    minHeight: 34,
    paddingHorizontal: t.space.sm,
    borderWidth: t.border.hair,
    borderColor: t.color.ruleStrong,
    borderRadius: t.radius.sm,
    backgroundColor: editable ? t.color.surfaceRaised : t.color.surfaceSunk,
    color: editable ? t.color.ink : t.color.inkSoft,
  } as const;
}
