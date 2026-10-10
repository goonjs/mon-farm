/**
 * A date as the farm reads it: Buddhist era by default (`1 ต.ค. 2569`), and a
 * tap switches to the common era (D-65 Q1). The choice is per date on screen,
 * not a setting — it is for the moment someone needs to cross-check a
 * document printed in ค.ศ.
 */

import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { formatThaiDate } from '../core/master';
import { useTheme } from '../theme';

export function ThaiDate({ ts, testID }: { ts: number; testID?: string }) {
  const t = useTheme();
  const [era, setEra] = useState<'be' | 'ce'>('be');
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={() => setEra((e) => (e === 'be' ? 'ce' : 'be'))}>
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.small,
          color: t.color.inkSoft,
          textDecorationLine: 'underline',
          textDecorationStyle: 'dotted',
        }}
      >
        {formatThaiDate(ts, era)}
      </Text>
    </Pressable>
  );
}
