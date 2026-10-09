/**
 * Picks a worker from the reusable people list, or adds a new one inline.
 *
 * This is the UI half of S16's people store — the answer to "worker identity"
 * being a picker rather than free text. A typed name makes "ประยุทธ" and
 * "ประยุทธ์" two different people, silently, on a money screen; picking from a
 * list makes that mistake structurally harder.
 *
 * Deliberately small: no search, no avatars. It lists active people —
 * optionally only those holding one role (E03-S01) — lets you pick one, or
 * type a name and create+pick it in one step, giving the new person the
 * picker's role (a person needs at least one, D-68). That is the entire job.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { BuiltinRole } from '../core/types';
import { peopleStore, type Person } from '../store/people';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './chrome';

export interface PeoplePickerProps {
  /** The currently selected person, or null if none picked yet. */
  value: Person | null;
  /** Called with a person on pick, or null when "change" clears the selection. */
  onChange: (person: Person | null) => void;
  /** Only offer people with this role; a person added here gets it. Defaults to tapper. */
  role?: BuiltinRole;
  testID?: string;
}

export function PeoplePicker({ value, onChange, role, testID = 'people-picker' }: PeoplePickerProps) {
  const t = useTheme();
  const msg = useT();
  const [people, setPeople] = useState<Person[] | null>(null); // null = still loading
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');

  const reload = useCallback(() => {
    peopleStore.list(role ?? 'all').then(setPeople);
  }, [role]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createAndSelect = useCallback(async () => {
    const name = draftName.trim();
    if (!name) return;
    const person = await peopleStore.create(name, [role ?? 'tapper']);
    setDraftName('');
    setAdding(false);
    reload();
    onChange(person);
  }, [draftName, onChange, reload, role]);

  if (people === null) {
    return (
      <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
        {msg('people.loading')}
      </Text>
    );
  }

  return (
    <View testID={testID} style={{ gap: t.space.xs }}>
      {value ? (
        <View
          testID={`${testID}-selected`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space.sm,
            padding: t.space.sm,
            borderRadius: t.radius.sm,
            backgroundColor: t.color.actionSunk,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontFamily: t.font.family.sans,
              fontSize: t.font.size.small,
              fontWeight: t.font.weight.bold,
              color: t.color.action,
            }}
          >
            {value.name}
          </Text>
          <Button testID={`${testID}-change`} onPress={() => onChange(null)}>
            {msg('people.change')}
          </Button>
        </View>
      ) : (
        <>
          {people.length === 0 && !adding ? (
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
              {msg('people.empty')}
            </Text>
          ) : null}

          <View style={{ gap: 2 }}>
            {people.map((p) => (
              <Pressable
                key={p.id}
                testID={`${testID}-option-${p.id}`}
                accessibilityRole="button"
                onPress={() => onChange(p)}
                style={{
                  padding: t.space.sm,
                  borderRadius: t.radius.sm,
                  backgroundColor: t.color.surfaceSunk,
                }}
              >
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {adding ? (
            <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
              <TextInput
                testID={`${testID}-new-name`}
                value={draftName}
                onChangeText={setDraftName}
                placeholder={msg('people.namePlaceholder')}
                placeholderTextColor={t.color.inkFaint}
                autoFocus
                onSubmitEditing={createAndSelect}
                style={{
                  flex: 1,
                  fontFamily: t.font.family.sans,
                  fontSize: t.font.size.small,
                  minHeight: 34,
                  paddingHorizontal: t.space.sm,
                  borderWidth: t.border.hair,
                  borderColor: t.color.ruleStrong,
                  borderRadius: t.radius.sm,
                  color: t.color.ink,
                }}
              />
              <Button testID={`${testID}-confirm-new`} variant="primary" onPress={createAndSelect} disabled={!draftName.trim()}>
                {msg('people.add')}
              </Button>
              <Button testID={`${testID}-cancel-new`} onPress={() => { setAdding(false); setDraftName(''); }}>
                {msg('common.cancel')}
              </Button>
            </View>
          ) : (
            <Button testID={`${testID}-add`} onPress={() => setAdding(true)}>
              {msg('people.addNew')}
            </Button>
          )}
        </>
      )}
    </View>
  );
}
