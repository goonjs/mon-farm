/**
 * At the tapper's next point with their basket still short (E04-S06, D-42,
 * D-57, mockup v1.1.0 screen 12): fill it up and read the whole basket, weigh
 * the top-up on its own, or leave it short and count the next full basket.
 * Each way says what the scale should read.
 */

import { Pressable, Text, View } from 'react-native';

import { formatKg } from '../core/settle';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import { Sheet } from './farm-ui';

export interface FillChoiceSheetProps {
  readonly basketNo: number;
  readonly haveG: number;
  readonly missingG: number;
  readonly fromPoint: string;
  readonly tapperName: string;
  /** What the scale should read for each way, gross (skew included when there is one). */
  readonly fullReadG: number;
  readonly partReadG: number;
  readonly tareG: number;
  /** The next full basket's number if this one is left short. */
  readonly nextNo: number;
  readonly onFull: () => void;
  readonly onPart: () => void;
  readonly onNext: () => void;
  readonly onClose: () => void;
}

export function FillChoiceSheet(p: FillChoiceSheetProps) {
  const t = useTheme();
  const msg = useT();
  const kg = (g: number) => formatKg(g);
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft };
  const option = (testID: string, title: string, lines: string[], onPress: () => void, first = false) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        gap: 2,
        padding: t.space.md,
        borderRadius: t.radius.lg,
        borderWidth: first ? t.border.thick : t.border.hair,
        borderColor: first ? t.color.action : t.color.ruleStrong,
        backgroundColor: first ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{title}</Text>
      {lines.map((line) => (
        <Text key={line} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
          {line}
        </Text>
      ))}
    </Pressable>
  );

  return (
    <Sheet testID="fill-sheet" onClose={p.onClose}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, color: t.color.ink }}>
        {msg('fill.title', { n: p.basketNo })}
      </Text>
      <View style={{ gap: 2 }}>
        <Text style={small}>{msg('fill.have', { kg: kg(p.haveG) })}</Text>
        <Text style={small}>{msg('fill.from', { point: p.fromPoint })}</Text>
        <Text style={small}>{msg('fill.tapper', { name: p.tapperName })}</Text>
      </View>
      {option(
        'fill-full',
        msg('fill.full'),
        [msg('fill.fullBody', { kg: kg(p.missingG), n: p.basketNo }), msg('fill.fullRead', { kg: kg(p.fullReadG) })],
        p.onFull,
        true,
      )}
      {option(
        'fill-part',
        msg('fill.part'),
        [
          msg('fill.partBody', { kg: kg(p.missingG), n: p.basketNo }),
          msg('fill.partRead', { kg: kg(p.partReadG), part: kg(p.missingG), tare: kg(p.tareG) }),
        ],
        p.onPart,
      )}
      {option('fill-next', msg('fill.next'), [msg('fill.nextBody', { n: p.basketNo, kg: kg(p.haveG), next: p.nextNo })], p.onNext)}
      <Text style={small}>{msg('fill.note', { n: p.basketNo })}</Text>
    </Sheet>
  );
}
