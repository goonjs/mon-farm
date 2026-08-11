/**
 * The reopen flow (docs/ux/pile-zone-sale-lifecycle.md §7.2): a typed reason
 * — not a canned chip — a restatement of what reopening actually does, and a
 * second confirm. Reopening is an appended event, never an undo, and the
 * mechanism that makes the original close trustworthy has to cover its own
 * correction: this is written as a public, full-stage moment, the same
 * register the close itself uses, not a quiet settings toggle.
 *
 * Thai speech is not wired here — S10 doesn't exist yet — so "spoken aloud"
 * is text only for now, same caveat as `ZeroTareGate`'s read-back.
 */

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from './chrome';
import { useTheme } from '../theme';

export interface ReopenPromptProps {
  testID?: string;
  /** What's being reopened, e.g. "กอง 1", "โซน A", "การขาย". */
  targetLabel: string;
  /** What reopening actually restores — shown so the second confirm is informed. */
  consequence: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function ReopenPrompt({ testID = 'reopen-prompt', targetLabel, consequence, onConfirm, onCancel }: ReopenPromptProps) {
  const t = useTheme();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const canSubmit = reason.trim().length > 0;

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: t.color.stage,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space.xl,
        gap: t.space.md,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.warn }}>
        {`เปิด ${targetLabel} อีกครั้ง — reopening`}
      </Text>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft, textAlign: 'center', maxWidth: 480 }}>
        {consequence}
      </Text>

      {!confirming ? (
        <>
          <TextInput
            testID={`${testID}-reason`}
            value={reason}
            onChangeText={setReason}
            placeholder="เหตุผลที่เปิดอีกครั้ง · reason for reopening"
            placeholderTextColor={t.color.inkFaint}
            style={{
              width: '100%',
              maxWidth: 480,
              minHeight: 40,
              fontFamily: t.font.family.sans,
              fontSize: t.font.size.small,
              paddingHorizontal: t.space.sm,
              borderWidth: t.border.hair,
              borderColor: t.color.ruleStrong,
              borderRadius: t.radius.sm,
              backgroundColor: t.color.surfaceRaised,
              color: t.color.ink,
            }}
          />
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            <Button testID={`${testID}-next`} variant="destructive" disabled={!canSubmit} onPress={() => setConfirming(true)}>
              ต่อไป · next
            </Button>
            <Button testID={`${testID}-cancel`} onPress={onCancel}>
              ยกเลิก · cancel
            </Button>
          </View>
        </>
      ) : (
        <>
          <Text testID={`${testID}-reason-echo`} style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.small, color: t.color.ink, fontStyle: 'italic' }}>
            {`"${reason.trim()}"`}
          </Text>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.reject, textAlign: 'center' }}>
            แน่ใจนะ? การเปิดอีกครั้งจะถูกบันทึกไว้ · are you sure? reopening will be recorded.
          </Text>
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            <Button testID={`${testID}-confirm`} variant="destructive" onPress={() => onConfirm(reason.trim())}>
              ยืนยันเปิดอีกครั้ง · confirm reopen
            </Button>
            <Button testID={`${testID}-back`} onPress={() => setConfirming(false)}>
              กลับ · back
            </Button>
          </View>
        </>
      )}
    </View>
  );
}
