/**
 * E05-S11 · "สวนค้างจ่ายคนกรีด" (mockup A26 · CO-26, CO-7, CO-15): per tapper
 * what the farm owes and where it came from, and the owner's own choice —
 * "ไว้ก่อน" (default) or "↗ หักกลบกับหนี้{ชื่อ}", which raises that tapper's
 * deduction by the amount up to the cap. A tapper without debt only has
 * "ไว้ก่อน". "ถูกต้อง" checks the card; closing without it puts the draft back.
 * A double deduction still open (review 3, B1): the choice waits for the
 * deduct sheet's one / both — shown as the recorded lines stand, off, with
 * "แก้หักซ้ำที่แถวหักหนี้ของ{ชื่อ}ก่อน".
 */

import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { CloseoutWorker } from '../../../core/finance/closeout';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BottomSheet, Button, cardStyle, Check, CTA, FarmMateIcon, Plus } from '../../../ui';
import { useDay } from '../../farm/pieces';
import type { Closeout, CloseoutDraft } from './use-closeout';
import { baht, MARK, netOff, netOn, shortBaht } from './summary-parts';

export interface OwedPerson {
  readonly id: string;
  readonly name: string;
  readonly satang: number;
  /** Day of the oldest bill the farm still owes for. */
  readonly date: string | null;
  readonly w: CloseoutWorker | undefined;
}

export function OwedSheet({ co, people, onAdd, onClose }: { co: Closeout; people: readonly OwedPerson[]; onAdd: () => void; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const day = useDay();
  const [before] = useState<CloseoutDraft>(() => co.draft);

  const cancel = () => {
    co.update((d) => ({ ...d, workers: before.workers, owedChoice: before.owedChoice }));
    onClose();
  };
  const ok = () => {
    co.update((d) => ({ ...d, owedChecked: [...new Set([...d.owedChecked, ...people.map((p) => p.id)])] }));
    onClose();
  };

  return (
    <BottomSheet open onClose={cancel} title={msg('co.owed.title')} testID="co-owed-sheet" closeLabel={msg('co.close')}>
      <AppText testID="co-owed-sub" variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.owed.sub')}</AppText>
      {people.map((p) => {
        const w = p.w;
        // B1: a double still open nets nothing from here; the recorded lines' netting is what shows (S3 nets over what is owed).
        const waiting = !!w && w.doubleOpen;
        const canNet = !!w && w.hasDebt && (w.netCapSatang > 0 || waiting);
        const netted = !!w && (waiting ? w.typedNettingSatang > 0 : w.nettingSatang > 0);
        const option = (id: string, label: string, selected: boolean, onPress: () => void) => (
          <Pressable
            testID={id}
            role="radio"
            accessibilityRole="radio"
            aria-checked={selected}
            aria-disabled={waiting}
            accessibilityState={{ selected, checked: selected, disabled: waiting }}
            disabled={waiting}
            onPress={waiting ? undefined : onPress}
            style={{ flex: 1, minHeight: t.target.min, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space.sm, borderRadius: t.radius.pill, backgroundColor: selected ? (waiting ? t.color.inkSoft : t.color.action) : 'transparent' }}
          >
            <AppText style={{ textAlign: 'center', fontWeight: t.font.weight.bold, color: selected ? t.color.inkInverse : waiting ? t.color.inkFaint : t.color.ink }}>{label}</AppText>
          </Pressable>
        );
        return (
          <View key={p.id} testID={`co-owed-row-${p.id}`} style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, flexWrap: 'wrap' }}>
              <View aria-hidden style={{ width: t.target.min, height: t.target.min, borderRadius: t.radius.md, backgroundColor: t.color.brandCream, alignItems: 'center', justifyContent: 'center' }}>
                <FarmMateIcon id="people.tapper" size={32} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{p.name}</AppText>
                {p.date ? <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.owed.source', { date: day(p.date) })}</AppText> : null}
              </View>
              <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
                <AppText style={{ fontWeight: t.font.weight.black, fontSize: t.font.size.headingLg, fontVariant: ['tabular-nums'], color: t.color.debtOut }}>{MARK.out} {baht(p.satang)}</AppText>
                <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.owed.of', { name: p.name })}</AppText>
              </View>
            </View>
            {canNet && w ? (
              <>
                <View testID={`co-owed-choice-${p.id}`} role="radiogroup" accessibilityRole="radiogroup" accessibilityLabel={p.name} style={{ flexDirection: 'row', gap: t.space.xs, backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.pill, padding: t.space.xs }}>
                  {option(`co-owed-hold-${p.id}`, msg('co.owed.hold'), !netted, () => co.update((d) => netOff(d, w)))}
                  {option(`co-owed-net-${p.id}`, `${MARK.out} ${msg('co.owed.netWith', { name: p.name })}`, netted, () => co.update((d) => netOn(d, w)))}
                </View>
                {waiting ? (
                  <AppText testID={`co-owed-double-${p.id}`} variant="bodySm" style={{ color: t.color.warn, fontWeight: t.font.weight.bold }}>
                    {msg('co.owed.doubleFirst', { name: p.name })}
                  </AppText>
                ) : (
                  <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.owed.explain', { amount: shortBaht(w.netCapSatang), name: p.name })}</AppText>
                )}
              </>
            ) : (
              <>
                <View testID={`co-owed-choice-${p.id}`} role="radiogroup" accessibilityRole="radiogroup" accessibilityLabel={p.name} style={{ flexDirection: 'row', backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.pill, padding: t.space.xs }}>
                  {option(`co-owed-hold-${p.id}`, msg('co.owed.hold'), true, () => undefined)}
                </View>
                <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>{msg('co.owed.noDebt', { name: p.name })}</AppText>
              </>
            )}
          </View>
        );
      })}
      <Button testID="co-owed-add" icon={(c) => <Plus color={c} />} onPress={onAdd}>
        {msg('co.owed.add')}
      </Button>
      <CTA testID="co-owed-ok" icon={(c) => <Check color={c} />} onPress={ok}>
        {msg('co.ok')}
      </CTA>
    </BottomSheet>
  );
}
