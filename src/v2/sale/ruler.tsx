/**
 * The short-basket ruler (mockup page 10, D-70 S9, D-79): drag left–right to
 * pick a whole-kg reading fast, then fine-tune with ±. A tick per kg, a label
 * every 5; a dashed mark at "ตาชั่งควรอ่าน" (a full basket) and the part past
 * it shaded — over a full basket. The needle and its bold label show the
 * value. Drawn with Views; children ignore touches so the drag reads the
 * ruler's own x.
 */

import { useState } from 'react';
import { Text, View } from 'react-native';

import { useT } from '../../i18n';
import { useTheme } from '../../theme';

export function Ruler({
  min,
  max,
  mark,
  value,
  onChange,
  testID = 'ruler',
}: {
  min: number;
  max: number;
  mark: number;
  value: number;
  onChange: (kg: number) => void;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  const [width, setWidth] = useState(0);
  const pad = 12;
  const span = Math.max(1, max - min);
  const x = (kg: number) => pad + ((kg - min) / span) * Math.max(0, width - 2 * pad);
  const pick = (locX: number) => {
    if (!width) return;
    const kg = Math.round(min + ((locX - pad) / Math.max(1, width - 2 * pad)) * span);
    onChange(Math.min(max, Math.max(min, kg)));
  };
  const ticks: number[] = [];
  for (let kg = min; kg <= max; kg++) ticks.push(kg);
  const label = (kg: number) => kg % 5 === 0 && Math.abs(kg - value) > 3 && Math.abs(kg - mark) > 3;

  return (
    <View
      testID={testID}
      accessibilityRole="adjustable"
      accessibilityLabel={msg('v2s.ruler')}
      accessibilityValue={{ min, max, now: value }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
      onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      style={{ height: 76, borderRadius: t.radius.md, backgroundColor: t.color.surfaceSunk, overflow: 'hidden' }}
    >
      {width ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: x(mark), right: 0, backgroundColor: t.color.warnSunk }} />
          {ticks.map((kg) => (
            <View
              key={kg}
              style={{ position: 'absolute', top: 8, left: x(kg), width: 1.5, height: kg % 5 === 0 ? 22 : 12, backgroundColor: t.color.inkSoft }}
            />
          ))}
          {ticks.filter(label).map((kg) => (
            <Text key={`l${kg}`} style={{ position: 'absolute', top: 40, left: x(kg) - 12, width: 24, textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: t.color.inkSoft }}>
              {kg}
            </Text>
          ))}
          <View style={{ position: 'absolute', top: 2, left: x(mark), height: 36, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: t.color.accept }} />
          <Text style={{ position: 'absolute', top: 40, left: x(mark) - 14, width: 28, textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: t.color.accept }}>
            {mark}
          </Text>
          <Text style={{ position: 'absolute', top: 56, left: x(mark) - 40, width: 80, textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.micro, fontWeight: t.font.weight.bold, color: t.color.accept }}>
            {msg('rec.shouldRead')}
          </Text>
          <View testID={`${testID}-needle`} style={{ position: 'absolute', top: 4, left: x(value) - 1.5, width: 3, height: 34, borderRadius: 2, backgroundColor: t.color.ink }} />
          <Text style={{ position: 'absolute', top: 40, left: x(value) - 14, width: 28, textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.black, color: t.color.ink }}>
            {value}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
