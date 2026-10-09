/**
 * "เริ่มใช้งาน" and "สร้างกลุ่มฟาร์ม" (E02-S02) — docs/ux/flows/
 * e02-access-and-sync-states.md §3.1/§3.2. Shown to a signed-in user with
 * no farm group: the only ways forward are create or join (D-24), and there
 * is nothing to record into until one of them happens.
 *
 * Creating works offline: the group gets its id on the device and is sent
 * by the outbox later (E01-S09). Joining is E02-S03 — its button is here, as
 * the flow draws it, but stays disabled until that story exists. There is no
 * role choice and no permissions UI: the creator is the owner (ACC-4).
 */

import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { EmptyGroupNameError } from '../core/group';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './chrome';

type Problem = 'nameRequired' | 'createFailed' | null;

export function GroupStartScreen({
  displayName,
  onCreate,
}: {
  displayName: string | null;
  /** Rejects with `EmptyGroupNameError` for a blank name, anything else when it cannot be kept. */
  onCreate: (name: string) => Promise<void>;
}) {
  const t = useTheme();
  const msg = useT();
  const [mode, setMode] = useState<'start' | 'create'>('start');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  type Weight = (typeof t.font.weight)[keyof typeof t.font.weight];
  const text = (size: number, color: string, weight: Weight = t.font.weight.regular) =>
    ({ fontFamily: t.font.family.sans, fontSize: size, color, fontWeight: weight }) as const;

  // Set synchronously: a keyboard submit and a tap in one frame both see
  // `busy` false, and would create two groups.
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      await onCreate(name);
    } catch (err) {
      if (err instanceof EmptyGroupNameError) {
        setProblem('nameRequired');
      } else {
        console.error('Farm group could not be kept on this device.', err);
        setProblem('createFailed');
      }
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (mode === 'start') {
    return (
      <View
        testID="group-start"
        style={{ flex: 1, backgroundColor: t.color.surface, justifyContent: 'center', padding: t.space.xl, gap: t.space.lg }}
      >
        <View style={{ gap: t.space.sm }}>
          <Text accessibilityRole="header" style={text(t.font.size.title, t.color.ink, t.font.weight.bold)}>
            {displayName ? msg('group.welcome', { name: displayName }) : msg('group.welcomeNoName')}
          </Text>
          <Text style={text(t.font.size.body, t.color.inkSoft)}>{msg('group.needGroup')}</Text>
        </View>
        <Button testID="group-create" variant="primary" onPress={() => setMode('create')}>
          {msg('group.create')}
        </Button>
        {/* E02-S03 (invite codes) is not built yet. */}
        <Button testID="group-join" disabled>
          {msg('group.join')}
        </Button>
      </View>
    );
  }

  return (
    <View testID="group-create-form" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          padding: t.space.md,
          borderBottomWidth: t.border.hair,
          borderBottomColor: t.color.rule,
        }}
      >
        <Button
          testID="group-back"
          onPress={() => {
            setProblem(null);
            setMode('start');
          }}
        >
          {msg('group.back')}
        </Button>
        <Text accessibilityRole="header" style={text(t.font.size.lead, t.color.ink, t.font.weight.bold)}>
          {msg('group.createTitle')}
        </Text>
      </View>

      <View style={{ padding: t.space.xl, gap: t.space.md }}>
        <Text style={text(t.font.size.body, t.color.ink, t.font.weight.medium)}>{msg('group.nameLabel')}</Text>
        <TextInput
          testID="group-name"
          value={name}
          onChangeText={(next) => {
            setName(next);
            // Once the name is valid the "name required" message is stale.
            if (problem === 'nameRequired' && next.trim()) setProblem(null);
          }}
          placeholder={msg('group.nameHint')}
          placeholderTextColor={t.color.inkFaint}
          accessibilityLabel={msg('group.nameLabel')}
          onSubmitEditing={submit}
          style={{
            minHeight: t.target.min,
            ...text(t.font.size.body, t.color.ink),
            paddingHorizontal: t.space.md,
            borderWidth: t.border.hair,
            borderColor: problem === 'nameRequired' ? t.color.reject : t.color.ruleStrong,
            borderRadius: t.radius.md,
            backgroundColor: t.color.surfaceRaised,
          }}
        />
        {problem ? (
          <Text testID="group-problem" accessibilityRole="alert" style={text(t.font.size.body, t.color.reject)}>
            {msg(problem === 'nameRequired' ? 'group.nameRequired' : 'group.createFailed')}
          </Text>
        ) : null}
        <Text style={text(t.font.size.small, t.color.inkSoft)}>{msg('group.ownerNote')}</Text>
        <Button testID="group-submit" variant="primary" onPress={submit} disabled={busy}>
          {msg('group.submit')}
        </Button>
      </View>
    </View>
  );
}
