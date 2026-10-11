/**
 * "เริ่มใช้งาน" (E02-S02, flow-v1 screen 2 with no group yet): a signed-in
 * person with no farm group sees only "create group" and a join-by-code that
 * is shown but disabled until E02-S03 (D-24). There is nothing to record into
 * until a group exists.
 *
 * Creating works offline: the group gets its id on the device and the outbox
 * sends it later (E01-S09). There is no role choice and no permissions UI —
 * the creator is the owner (ACC-4).
 */

import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyGroupNameError } from '../../core/group';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, Button, Card, CTA, FieldError, ScreenHeader, TextField } from '../../ui';

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
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

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

  return (
    <View testID="group-start" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('acct.group.title')} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: t.space.xs }}>
          <AppText accessibilityRole="header" variant="title" style={{ color: t.color.ink }}>
            {displayName ? msg('acct.group.welcome', { name: displayName }) : msg('acct.group.welcomeNoName')}
          </AppText>
          <AppText variant="body" style={{ color: t.color.inkSoft }}>
            {msg('acct.group.needGroup')}
          </AppText>
        </View>
        <Card style={{ padding: t.space.md, gap: t.space.md }}>
          <TextField
            testID="group-name"
            label={msg('acct.group.nameLabel')}
            required
            helper={msg('acct.group.nameHelper')}
            error={problem === 'nameRequired' ? msg('acct.group.nameRequired') : undefined}
            value={name}
            onChangeText={(next) => {
              setName(next);
              // Once the name is valid the "name required" message is stale.
              if (problem === 'nameRequired' && next.trim()) setProblem(null);
            }}
            onSubmitEditing={submit}
          />
          <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>
            {msg('acct.group.ownerNote')}
          </AppText>
          {problem === 'createFailed' ? <FieldError testID="group-problem">{msg('acct.group.createFailed')}</FieldError> : null}
          <CTA testID="group-create" onPress={submit} disabled={busy}>
            {busy ? msg('acct.group.creating') : msg('acct.group.create')}
          </CTA>
        </Card>
        {/* E02-S03 (invite codes) is not built yet: shown, not usable. */}
        <Card style={{ padding: t.space.sm }}>
          <Button testID="group-join" variant="row" disabled>
            {msg('acct.group.join')}
          </Button>
          <AppText variant="caption" style={{ color: t.color.inkSoft, paddingHorizontal: t.space.xs }}>
            {msg('acct.group.joinSoon')}
          </AppText>
        </Card>
      </ScrollView>
    </View>
  );
}
