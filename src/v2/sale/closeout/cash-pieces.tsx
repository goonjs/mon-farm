/**
 * What the cash step (A6, A11, A13, A17) and the buyer view (A7, A12, A18)
 * share: the piles the buyer pays, read straight from the close-out plan
 * (nothing is summed here that core does not already give), and the note
 * chips "฿1,000 ×9" of the break sheet (CO-24).
 */

import { Text, View } from 'react-native';

import type { CloseoutPlan, NoteCount } from '../../../core/finance/closeout';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';

export interface BuyerPile {
  /** cash = a worker's cash (as the buyer hands it); repay = cash for debt handed apart (buyer-split). */
  readonly kind: 'cash' | 'repay';
  readonly id: string;
  readonly name: string;
  readonly satang: number;
  /** cash-from-share: what the farm lifts out of this pile for the debt (CO-24). */
  readonly pickedSatang: number;
}

/**
 * The buyer's piles in mockup order: per worker their cash, then (buyer-split)
 * the debt cash handed apart. A cash-from-share worker's pile is handed whole
 * (cash + what the farm lifts out of it), so Σ piles + transfer = the sale.
 */
export function buyerPiles(plan: CloseoutPlan): BuyerPile[] {
  return plan.workers.flatMap((w) => {
    const picked = w.route === 'cash-from-share' ? w.routeSatang : 0;
    const cash: BuyerPile = { kind: 'cash', id: w.id, name: w.name, satang: w.cashSatang + picked, pickedSatang: picked };
    return w.route === 'buyer-split' && w.routeSatang > 0 ? [cash, { kind: 'repay', id: w.id, name: w.name, satang: w.routeSatang, pickedSatang: 0 }] : [cash];
  });
}

/** "คืนหนี้นัด" when one worker's repayment rides on the transfer, else "คืนหนี้" (A6 vs A17). */
export function transferRepayName(plan: CloseoutPlan): string {
  const on = plan.workers.filter((w) => w.route === 'transfer-with-owner' && w.routeSatang > 0);
  return on.length === 1 ? on[0].name : '';
}

export function useNoteLabel(): (n: NoteCount) => string {
  const msg = useT();
  return (n) =>
    n.satang >= 100
      ? msg('cop.noteBaht', { n: (n.satang / 100).toLocaleString('en-US'), count: n.count })
      : msg('cop.noteSatang', { n: n.satang, count: n.count });
}

/** One note chip (not a control): `fresh` = what the buyer breaks a note into. */
export function NoteChip({ note, fresh, testID }: { note: NoteCount; fresh?: boolean; testID?: string }) {
  const t = useTheme();
  const label = useNoteLabel();
  return (
    <View
      testID={testID}
      style={{
        borderWidth: t.border.hair,
        borderColor: fresh ? t.color.accept : t.color.ruleStrong,
        backgroundColor: fresh ? t.color.acceptSunk : t.color.surfaceRaised,
        borderRadius: t.radius.md,
        paddingHorizontal: t.space.sm,
        paddingVertical: t.space.xxs,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink, fontVariant: ['tabular-nums'] }}>{label(note)}</Text>
    </View>
  );
}

export function NoteRow({ notes, fresh, testID }: { notes: readonly NoteCount[]; fresh?: boolean; testID?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }}>
      {notes.map((n) => (
        <NoteChip key={n.satang} note={n} fresh={fresh} />
      ))}
    </View>
  );
}
