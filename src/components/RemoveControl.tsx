/**
 * Removing a pile or a zone (S26) — never a delete.
 *
 * One control with two registers, because the log has one event for both:
 * a target that never held anything goes in a single confirm with no reason
 * (a typo, corrected), and a target that has history is a VOID, in the same
 * typed-reason register as S12's void-from-log — the removal is a statement
 * about numbers that were said out loud, so it says why. `needsReason` is
 * answered by `pileNeedsVoidReason`/`zoneNeedsVoidReason` in core, not here:
 * this component renders the fork, it does not decide it.
 *
 * `blockedReason` is the third state, and the reason it is a prop rather than
 * just `disabled`: a zone that still has piles cannot be removed at all, and
 * a dead button with no explanation is exactly the dead end the story rules
 * out ("remove its piles first", said on screen).
 *
 * The collapsed trigger is a small icon, not a labelled button: this sits
 * beside "แก้ไข" on every pile row, and a full-width destructive button
 * there reads as the loudest thing on the screen for the row's least common
 * action. `accessibilityLabel` carries the real label for anyone not reading
 * the glyph, and the confirm step underneath is unchanged — the icon only
 * replaces the collapsed state, never skips the confirmation.
 */

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from './chrome';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export interface RemoveControlProps {
  testID: string;
  /** The collapsed button's label — "เอากองออก", "เอาโซนออก". */
  label: string;
  /** What removing this actually does, shown before the confirm. */
  detail: string;
  /** True once the target has history worth a typed reason. */
  needsReason: boolean;
  /** When set, removal is not available at all, and this says why. */
  blockedReason?: string | null;
  onRemove: (reason: string) => void;
}

export function RemoveControl({
  testID,
  label,
  detail,
  needsReason,
  blockedReason = null,
  onRemove,
}: RemoveControlProps) {
  const t = useTheme();
  const msg = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const canConfirm = !needsReason || reason.trim().length > 0;

  const close = () => {
    // The typed reason is deliberately not remembered. A reason kept from an
    // abandoned attempt would be a sentence nobody meant to write attached to
    // a removal somebody else confirmed.
    setReason('');
    setOpen(false);
  };

  if (!open) {
    return (
      <View style={{ gap: 2, alignSelf: 'flex-start' }}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={!!blockedReason}
          onPress={() => setOpen(true)}
          style={{
            width: 36,
            height: 36,
            borderRadius: t.radius.md,
            borderWidth: t.border.hair,
            borderColor: t.color.reject,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: blockedReason ? t.opacity.disabled : 1,
          }}
        >
          <Text style={{ fontSize: t.font.size.small, color: t.color.reject }}>✕</Text>
        </Pressable>
        {blockedReason ? (
          <Text
            testID={`${testID}-blocked`}
            style={{
              fontFamily: t.font.family.mono,
              fontSize: t.font.size.micro,
              color: t.color.inkSoft,
            }}
          >
            {blockedReason}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: t.space.xs }}>
      <Text
        testID={`${testID}-detail`}
        style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.reject }}
      >
        {detail}
      </Text>
      {needsReason ? (
        <TextInput
          testID={`${testID}-reason`}
          value={reason}
          onChangeText={setReason}
          placeholder={msg('setup.removeReasonPlaceholder')}
          placeholderTextColor={t.color.inkFaint}
          style={{
            minHeight: 34,
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
      ) : null}
      <View style={{ flexDirection: 'row', gap: t.space.xs }}>
        <Button
          testID={`${testID}-confirm`}
          variant="destructive"
          disabled={!canConfirm}
          onPress={() => {
            if (!canConfirm) return;
            onRemove(reason.trim());
            close();
          }}
        >
          {needsReason ? msg('setup.voidConfirm') : msg('setup.removeConfirm')}
        </Button>
        <Button testID={`${testID}-cancel`} onPress={close}>
          {msg('common.cancel')}
        </Button>
      </View>
    </View>
  );
}
