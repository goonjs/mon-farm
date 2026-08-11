/**
 * Logs an off-standard basket (F-13, F-22): the operator supplies the actual
 * gross scale reading, this shows the live net preview, and only "confirm"
 * appends the event — cancel writes nothing.
 *
 * Opens BELOW the stage, never over it. The count is the one thing on this
 * screen that must never be obscured, even by a panel about a different
 * basket entirely.
 */

import { Text, View } from 'react-native';

import { Button } from './chrome';
import { WeightInput } from './WeightInput';
import { useTheme } from '../theme';

const kg = (g: number) => (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

export interface ShortBasketPanelProps {
  tareG: number;
  stdNetG: number;
  readingG: number;
  onChangeReading: (g: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ShortBasketPanel({
  tareG,
  stdNetG,
  readingG,
  onChangeReading,
  onConfirm,
  onCancel,
}: ShortBasketPanelProps) {
  const t = useTheme();
  const netG = readingG - tareG;

  return (
    <View
      testID="short-basket-panel"
      style={{
        padding: t.space.md,
        borderTopWidth: t.border.hair,
        borderTopColor: t.color.rule,
        backgroundColor: t.color.surfaceRaised,
        gap: t.space.sm,
      }}
    >
      <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, letterSpacing: t.font.tracking.wide, color: t.color.inkSoft }}>
        เข่งไม่เต็ม · short basket — ชั่งได้เท่าไหร่ (กก.), น้ำหนักรวม
      </Text>

      <WeightInput
        testID="short-reading"
        label="ตาชั่งอ่านได้ · scale reading (gross), kg"
        valueG={readingG}
        minG={tareG}
        maxG={tareG + stdNetG}
        onChange={onChangeReading}
      />

      <Text testID="short-preview" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>
        {`ยางสุทธิ = ชั่งได้ ${kg(readingG)} − ตะกร้า ${kg(tareG)} = ${kg(netG)} กก. · net rubber = reading − tare = ${kg(netG)} kg`}
      </Text>

      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button testID="short-confirm" variant="primary" onPress={onConfirm} disabled={netG < 0}>
          บันทึก · log this basket
        </Button>
        <Button testID="short-cancel" onPress={onCancel}>
          ยกเลิก · cancel
        </Button>
      </View>
    </View>
  );
}
