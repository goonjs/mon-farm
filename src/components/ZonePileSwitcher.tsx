/**
 * Picks a zone and pile to make current on the counter screen. Needed once a
 * sale has more than one pile — closing one has to lead somewhere the
 * operator explicitly chose, not wherever `.find()` happens to land next.
 */

import { ScrollView, Text, View } from 'react-native';

import { Button } from './chrome';
import type { SaleState } from '../core/types';
import { useTheme } from '../theme';

export interface ZonePileSwitcherProps {
  state: SaleState;
  onPick: (pileId: string) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  'not-started': 'ยังไม่เริ่ม',
  counting: 'กำลังนับ',
  closed: 'ปิดแล้ว',
};

export function ZonePileSwitcher({ state, onPick, onClose }: ZonePileSwitcherProps) {
  const t = useTheme();

  return (
    <View
      testID="zone-pile-switcher"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.color.stage,
        zIndex: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: t.space.sm,
          borderBottomWidth: t.border.hair,
          borderBottomColor: t.color.rule,
        }}
      >
        <Text style={{ flex: 1, fontFamily: t.font.family.mono, fontSize: t.font.size.micro, letterSpacing: t.font.tracking.wide, color: t.color.inkSoft }}>
          เลือกโซนและกอง · pick a zone and pile
        </Text>
        <Button testID="switcher-close" onPress={onClose}>
          ✕
        </Button>
      </View>

      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        {state.zones.map((zone) => (
          <View key={zone.id}>
            <Text style={{ fontFamily: t.font.family.sans, fontWeight: t.font.weight.bold, fontSize: t.font.size.small, color: t.color.ink, marginBottom: t.space.xs }}>
              {`${zone.name} · ${zone.status === 'closed' ? 'ปิดแล้ว' : 'เปิดอยู่'}`}
            </Text>
            <View style={{ gap: t.space.xs }}>
              {state.piles
                .filter((p) => p.zoneId === zone.id)
                .map((pile) => (
                  <Button key={pile.id} testID={`switcher-pile-${pile.id}`} onPress={() => onPick(pile.id)}>
                    {`${pile.name} · ${STATUS_LABEL[pile.status]}`}
                  </Button>
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
