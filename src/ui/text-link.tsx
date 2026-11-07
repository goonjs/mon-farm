/**
 * TextLink: an underlined bold word, no box (owner rule 2026-11-06, styles B
 * and F in the round-button review). It replaces a short word in a round or
 * near-round outlined button: `action` for a secondary step ("กู้คืน",
 * "ใช้เป็นค่าเริ่มต้น"), `reject` for a delete ("ลบการคืน"). One line of
 * text inside a 48pt target, left-aligned. Tokens only.
 */
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '../theme';

export function TextLink({
  children,
  onPress,
  testID,
  tone = 'action',
  disabled,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  testID?: string;
  tone?: 'action' | 'reject';
  disabled?: boolean;
  /** When the word alone does not say what it acts on. */
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: t.target.min, minWidth: t.target.min, justifyContent: 'center', alignSelf: 'flex-start' }}
    >
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.bodyMd,
          fontWeight: t.font.weight.bold,
          color: disabled ? t.color.disabledInk : tone === 'reject' ? t.color.reject : t.color.action,
          textDecorationLine: 'underline',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
