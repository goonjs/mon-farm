/**
 * The transition card after a pile closes (docs/ux/pile-zone-sale-lifecycle.md
 * §4): the pile's final total, read at title size so the buyer can read it
 * from a distance too, followed by the decision point — next pile, switch
 * zone, close zone, close sale — as visible one-tap alternatives.
 *
 * This exists because the original prototype's single "continue" button chose
 * a destination for the operator and told them afterwards. Naming all four
 * options is the fix.
 */

import { Text, View } from 'react-native';

import { Button } from './chrome';
import { useTheme } from '../theme';

const kg = (g: number) => (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

export interface PileClosedTransitionProps {
  pileName: string;
  baskets: number;
  netG: number;
  /** Only offered when another not-started pile exists in the same zone. */
  hasNextPileInZone: boolean;
  onNextPile: () => void;
  onSwitchZone: () => void;
  onCloseZone: () => void;
  onCloseSale: () => void;
}

export function PileClosedTransition({
  pileName,
  baskets,
  netG,
  hasNextPileInZone,
  onNextPile,
  onSwitchZone,
  onCloseZone,
  onCloseSale,
}: PileClosedTransitionProps) {
  const t = useTheme();

  return (
    <View
      testID="pile-closed-transition"
      style={{
        flex: 1,
        backgroundColor: t.color.stage,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space.xl,
        gap: t.space.md,
      }}
    >
      <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, letterSpacing: t.font.tracking.wide, color: t.color.accept }}>
        ปิดกองแล้ว · pile closed
      </Text>
      <Text
        testID="pile-closed-total"
        style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.ink, textAlign: 'center' }}
      >
        {`${pileName} — ${baskets} เข่ง · ${kg(netG)} กก.`}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm, justifyContent: 'center' }}>
        {hasNextPileInZone ? (
          <Button testID="decision-next-pile" variant="primary" onPress={onNextPile}>
            กองถัดไปในโซนนี้ → · next pile in this zone
          </Button>
        ) : null}
        <Button testID="decision-switch-zone" onPress={onSwitchZone}>
          เปลี่ยนโซน · switch zone
        </Button>
        <Button testID="decision-close-zone" onPress={onCloseZone}>
          ปิดโซนนี้ · close this zone
        </Button>
        <Button testID="decision-close-sale" variant="destructive" onPress={onCloseSale}>
          ปิดการขาย · close sale
        </Button>
      </View>
    </View>
  );
}
