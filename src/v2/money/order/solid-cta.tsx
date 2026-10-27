/**
 * The order screens' disabled look (mockup a1): a solid disabled fill with readable disabled ink, never the dashed edge
 * that `ui/Button` draws (it reads as the dashed "+ add" row). Enabled, it is the design system's own CTA / Button.
 */

import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { Button, CTA } from '../../../ui';

type Props = React.ComponentProps<typeof Button>;

function Off({ children, testID, large, accessibilityLabel, icon }: { children: React.ReactNode; testID?: string; large: boolean; accessibilityLabel?: string; icon?: Props['icon'] }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: true }}
      disabled
      style={{ minHeight: large ? t.target.comfortable : t.target.min, paddingHorizontal: large ? t.space.xl : t.space.lg, borderRadius: t.radius.pill, backgroundColor: t.color.disabledFill, flexDirection: 'row', gap: t.space.sm, alignItems: 'center', justifyContent: 'center' }}
    >
      {icon ? <View aria-hidden>{icon(t.color.disabledInk)}</View> : null}
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.disabledInk, textAlign: 'center' }}>{children}</Text>
    </Pressable>
  );
}

export function SolidCTA(props: Omit<Props, 'size' | 'variant'>) {
  return props.disabled ? <Off testID={props.testID} large accessibilityLabel={props.accessibilityLabel} icon={props.icon}>{props.children}</Off> : <CTA {...props} />;
}

export function SolidButton(props: Props) {
  return props.disabled ? <Off testID={props.testID} large={props.size === 'large'} accessibilityLabel={props.accessibilityLabel} icon={props.icon}>{props.children}</Off> : <Button {...props} />;
}
