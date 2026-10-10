/**
 * ActionButton — the one filled pill for Save, in a screen header (right of
 * the sync pill) or a sheet's title row. Its own file so BottomSheet does not
 * pull in the header's router import. Disabled and saving are their own
 * states (dashed edge, "กำลังบันทึก"), never a faded copy. Tokens only.
 */

import { Pressable, Text } from 'react-native';

import { useT } from '../i18n';
import { useTheme } from '../theme';

export interface HeaderPrimaryAction {
  readonly onPress?: () => void;
  readonly testID?: string;
  readonly label: string;
  readonly disabled?: boolean;
  /** A write is in flight: shows "กำลังบันทึก", busy, and ignores taps. */
  readonly saving?: boolean;
}

export function ActionButton({ action }: { action: HeaderPrimaryAction }) {
  const t = useTheme();
  const msg = useT();
  const off = !!action.disabled || !!action.saving;
  return (
    <Pressable
      testID={action.testID}
      onPress={off ? undefined : action.onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: off, busy: !!action.saving }}
      style={{
        minHeight: t.target.min,
        minWidth: t.target.min,
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.pill,
        borderWidth: t.border.thick,
        borderStyle: off ? 'dashed' : 'solid',
        borderColor: off ? t.color.ruleStrong : t.color.action,
        backgroundColor: off ? t.color.disabledFill : t.color.action,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.bodyMd,
          fontWeight: t.font.weight.bold,
          color: off ? t.color.disabledInk : t.color.inkInverse,
        }}
      >
        {action.saving ? msg('common.saving') : action.label}
      </Text>
    </Pressable>
  );
}
