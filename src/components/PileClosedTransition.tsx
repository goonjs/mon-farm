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
import { useT } from '../i18n';
import { useTheme } from '../theme';

const kg = (g: number) => (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

export interface PileClosedTransitionProps {
  pileName: string;
  baskets: number;
  netG: number;
  /** Only offered when another not-started pile exists in the same zone. */
  hasNextPileInZone: boolean;
  /**
   * True when nothing anywhere in the sale is still `counting` (S25). A pile
   * closes many times per sale, the sale closes once — so close-sale is only
   * offered here once it is genuinely the next step. While another pile is
   * still counting, in this zone or any other, the operator's next move is
   * that pile, and the option is not shown at all.
   *
   * Stated as a fact computed at the call site, like `hasNextPileInZone`
   * above: this component knows about buttons, not about the projection.
   */
  noPileStillCounting: boolean;
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
  noPileStillCounting,
  onNextPile,
  onSwitchZone,
  onCloseZone,
  onCloseSale,
}: PileClosedTransitionProps) {
  const t = useTheme();
  const msg = useT();

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
        {msg('closed.title')}
      </Text>
      <Text
        testID="pile-closed-total"
        style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.ink, textAlign: 'center' }}
      >
        {msg('closed.total', { name: pileName, baskets, weight: kg(netG) })}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm, justifyContent: 'center' }}>
        {hasNextPileInZone ? (
          <Button testID="decision-next-pile" variant="primary" onPress={onNextPile}>
            {msg('closed.nextPile')}
          </Button>
        ) : null}
        <Button testID="decision-switch-zone" onPress={onSwitchZone}>
          {msg('closed.switchZone')}
        </Button>
        <Button testID="decision-close-zone" onPress={onCloseZone}>
          {msg('closed.closeZone')}
        </Button>
        {noPileStillCounting ? (
          <Button testID="decision-close-sale" variant="destructive" onPress={onCloseSale}>
            {msg('counter.closeSale')}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
