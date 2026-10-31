/**
 * E05-S11 · "จัดการหนี้" (mockup A2 · CO-3, CO-17, CO-22): per tapper the
 * deduction proposed and why, what is left after it, and the pieces oldest
 * first with what each has left. A tapper's row opens the deduct sheet;
 * "ถูกต้อง" checks every tapper. Pieces and amounts are core's (`debtPieces`).
 */

import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import type { CloseoutWorker, DebtPiece } from '../../../core/finance/closeout';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Button, cardStyle, Check, ChevronRight, CTA, FarmMateIcon, Plus } from '../../../ui';
import { useDay } from '../../farm/pieces';
import { baht, minus } from './summary-parts';

/** "เงินยืม 1 ก.ย." — kind and day without the year, as the mockup (A2, A5). */
export function usePieceName(): (p: DebtPiece) => string {
  const msg = useT();
  const day = useDay();
  return useCallback((p: DebtPiece) => `${msg(`co.kind.${p.kind}` as 'co.kind.loan')} ${day(p.date).replace(/ \d{4}$/, '')}`, [msg, day]);
}

export function DebtSheet({
  people,
  onPiece,
  onAdd,
  onOk,
  onClose,
}: {
  people: readonly { readonly w: CloseoutWorker; readonly pieces: readonly DebtPiece[]; readonly edited: boolean }[];
  onPiece: (workerId: string) => void;
  onAdd: () => void;
  onOk: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const pieceName = usePieceName();
  return (
    <BottomSheet open onClose={onClose} title={msg('co.debt.sheet')} testID="co-debt-sheet">
      {people.map(({ w, pieces, edited }) => (
        <Pressable
          key={w.id}
          testID={`co-debt-row-${w.id}`}
          accessibilityRole="button"
          accessibilityLabel={msg('co.debt.pieceOpen', { name: w.name })}
          onPress={() => onPiece(w.id)}
          style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.xs }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, flexWrap: 'wrap' }}>
            <View aria-hidden style={{ width: t.target.min, height: t.target.min, borderRadius: t.radius.md, backgroundColor: t.color.brandCream, alignItems: 'center', justifyContent: 'center' }}>
              <FarmMateIcon id="people.tapper" size={32} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{w.name}</AppText>
              <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.debt.pieces', { n: pieces.length })}</AppText>
              <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg(edited ? 'co.reason.edited' : `co.reason.${w.reason}` as 'co.reason.plan')}</AppText>
            </View>
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              <AppText style={{ fontWeight: t.font.weight.black, fontSize: t.font.size.headingLg, fontVariant: ['tabular-nums'], color: t.color.debtIn }}>{minus(w.totalSatang)}</AppText>
              <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.debt.leftAfterFull', { amount: baht(w.debtLeftSatang) })}</AppText>
            </View>
            <ChevronRight color={t.color.action} size={9} />
          </View>
          {pieces.map((p) => (
            <View key={p.id} testID={`co-piece-${p.id}`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: t.space.sm }}>
              <AppText variant="bodySm" style={{ flexShrink: 1, color: t.color.inkSoft }}>{pieceName(p)}</AppText>
              <AppText variant="bodySm" style={{ marginLeft: 'auto', fontVariant: ['tabular-nums'], color: t.color.inkSoft }}>{baht(p.amountSatang)}</AppText>
              <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'] }}>{msg('co.debt.pieceLeft', { amount: baht(p.leftAfterSatang) })}</AppText>
            </View>
          ))}
        </Pressable>
      ))}
      <Button testID="co-debt-add" icon={(c) => <Plus color={c} />} onPress={onAdd}>
        {msg('co.debt.add')}
      </Button>
      <AppText variant="bodySm" style={{ textAlign: 'center', color: t.color.inkSoft }}>{msg('co.debt.oldestFirst')}</AppText>
      <CTA testID="co-debt-ok" icon={(c) => <Check color={c} />} onPress={onOk}>
        {msg('co.ok')}
      </CTA>
    </BottomSheet>
  );
}
