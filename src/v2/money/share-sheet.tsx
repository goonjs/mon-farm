/**
 * แชร์กับคนกรีดยาง — simple design E2 (owner 2026-10-23; E11-S10 B). A
 * general category's expense shared with one tapper, on one screen:
 * discount first (a switch, off until wanted), then the tapper, their % as
 * a small button (the category's, tap to change), whether their part is a
 * debt or already paid, and the result big; ตกลง at the bottom. The split itself is
 * `splitShare` — this sheet only collects and previews.
 */

import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatSatang, parseBahtToSatang, satangToInput } from '../../core/finance/money';
import { checkShare, splitShare } from '../../core/finance/share';
import type { ExpenseShare, Payer, ShareSettle, Stage } from '../../core/finance/types';
import { filterPeople } from '../../core/master';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Card, CTA, SegmentedControl, TextField } from '../../ui';
import { useMaster } from '../farm/pieces';
import { ChoiceChip, ChoiceRow, SectionLabel, SwitchRow } from './pieces';

export interface ShareDraft {
  readonly discount: string;
  readonly worker: Payer | null;
  readonly pct: string;
  readonly settle: ShareSettle;
}

export function draftOf(share: ExpenseShare | null | undefined, categoryPct: number | null): ShareDraft {
  const line = share?.lines[0];
  return {
    discount: share?.discountSatang ? satangToInput(share.discountSatang) : '',
    worker: line?.worker ?? null,
    pct: String(line?.workerPct ?? categoryPct ?? 0),
    settle: line?.settle ?? 'debt',
  };
}

/** The share to store, or null when no tapper is picked. Throws nothing; `checkShare` says what is wrong. */
export function shareOf(d: ShareDraft, billSatang: number): ExpenseShare | null {
  if (!d.worker) return null;
  return {
    billSatang,
    discountSatang: d.discount.trim() ? (parseBahtToSatang(d.discount) ?? -1) : 0,
    totalSacks: null,
    // Only whole digits: an empty or partial % must fail `checkShare`, never read as 0.
    lines: [{ worker: d.worker, sacks: null, workerPct: /^\d+$/.test(d.pct.trim()) ? Number(d.pct.trim()) : NaN, settle: d.settle }],
  };
}

export function ShareSheet({
  open,
  onClose,
  billSatang,
  title,
  draft,
  onChange,
  stage = 'actual',
}: {
  open: boolean;
  onClose: () => void;
  billSatang: number;
  title: string;
  draft: ShareDraft;
  onChange: (d: ShareDraft) => void;
  stage?: Stage;
}) {
  const t = useTheme();
  const msg = useT();
  const { state } = useMaster();
  const tappers = state ? filterPeople(state.people, 'tapper').map((p) => ({ id: p.id, name: p.name })) : [];
  const [discountOn, setDiscountOn] = useState(draft.discount.trim() !== '');
  const [pctOpen, setPctOpen] = useState(false);
  const set = (p: Partial<ShareDraft>) => onChange({ ...draft, ...p });
  const share = shareOf(draft, billSatang);
  const problems = share ? checkShare(share) : [];
  const split = share && !problems.length ? splitShare(share) : null;
  const net = Math.max(0, billSatang - (discountOn && draft.discount.trim() ? (parseBahtToSatang(draft.discount) ?? 0) : 0));
  const pctBad = problems.includes('pct-invalid');

  // Simple design (owner 2026-10-23): discount on top, who, a small % button, debt/paid, the result big, ตกลง at the thumb.
  return (
    <BottomSheet open={open} onClose={onClose} title={msg('xshare.title')} testID="share-sheet">
      <View style={{ gap: t.space.md }}>
        <AppText variant="bodySm">{msg('xshare.subtitle', { category: title, bill: formatSatang(billSatang) })}</AppText>

        <SwitchRow
          testID="share-discount-switch"
          title={msg('fert.discountTitle')}
          hint={msg('xshare.discountHint')}
          on={discountOn}
          onToggle={() => {
            if (discountOn) set({ discount: '' });
            setDiscountOn(!discountOn);
          }}
        />
        {discountOn ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.md }}>
            <View style={{ flex: 1 }}>
              <TextField testID="share-discount" label={msg('xshare.discount')} keyboardType="decimal-pad" value={draft.discount} onChangeText={(v) => set({ discount: v })} placeholder="0.00" aside={<AppText variant="bodySm">{msg('v2m.baht')}</AppText>} error={problems.includes('discount-over') ? msg('xshare.err.discount') : undefined} />
            </View>
            <View testID="share-net" style={{ paddingTop: t.space.lg }}>
              <AppText variant="caption">{msg('fert.netTitle')}</AppText>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{formatSatang(net)}</AppText>
            </View>
          </View>
        ) : null}

        <View style={{ gap: t.space.sm }}>
          <SectionLabel>{msg('xshare.withWhom')}</SectionLabel>
          <ChoiceRow>
            <ChoiceChip testID="share-worker-none" label={msg('xshare.none')} on={!draft.worker} onPress={() => set({ worker: null })} />
            {tappers.map((p) => (
              <ChoiceChip key={p.id} testID={`share-worker-${p.id}`} label={p.name} on={draft.worker?.id === p.id} onPress={() => set({ worker: p })} />
            ))}
          </ChoiceRow>
        </View>

        {draft.worker ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <AppText variant="bodySm" style={{ flex: 1 }}>{msg('xshare.takes', { name: draft.worker.name })}</AppText>
              <ChoiceChip testID="share-pct-button" label={msg('fert.pctValue', { pct: draft.pct || '-' })} on={pctOpen} onPress={() => setPctOpen((o) => !o)} />
            </View>
            {pctOpen || pctBad ? (
              <TextField testID="share-pct" label={msg('xshare.pct')} keyboardType="number-pad" value={draft.pct} onChangeText={(v) => set({ pct: v })} helper={msg('xshare.pctHelper')} error={pctBad ? msg('xshare.err.pct') : undefined} />
            ) : null}
            <SegmentedControl testID="share-settle" value={draft.settle} onChange={(v) => set({ settle: v })} options={[{ value: 'debt', label: msg('xshare.settle.debt') }, { value: 'paid', label: msg('xshare.settle.paid') }]} />
            {split ? (
              <View testID="share-preview" style={{ gap: t.space.sm }}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.color.acceptSunk }}>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.accept }}>{draft.worker.name}</AppText>
                    <AppText variant="caption">{msg(draft.settle === 'paid' ? 'xshare.paidShort' : stage === 'actual' ? 'xshare.debtShort' : 'xshare.debtLaterShort')}</AppText>
                  </View>
                  <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayXl, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>{formatSatang(split.lines[0].workerSatang)}</Text>
                </Card>
                <View style={{ flexDirection: 'row' }}>
                  <AppText variant="bodySm" style={{ flex: 1 }}>{msg('xshare.ownerPays')}</AppText>
                  <AppText style={{ fontWeight: t.font.weight.bold }}>{formatSatang(split.lines[0].ownerSatang)}</AppText>
                </View>
              </View>
            ) : null}
          </>
        ) : null}
        <CTA testID="share-done" disabled={problems.length > 0} onPress={onClose}>{msg('xshare.done')}</CTA>
      </View>
    </BottomSheet>
  );
}

/** ตั้งค่าหมวด — whether a category is shared with tappers, and its default %. */
export function CategoryShareSheet({ open, onClose, name, pct, onSave }: { open: boolean; onClose: () => void; name: string; pct: number | null; onSave: (pct: number | null) => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [on, setOn] = useState(pct !== null);
  const [value, setValue] = useState(String(pct ?? 50));
  const n = Number(value);
  const valid = !on || (value.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 100);
  return (
    <BottomSheet open={open} onClose={onClose} title={msg('xshare.catTitle', { name })} testID="cat-share-sheet" action={{ label: msg('common.save'), testID: 'cat-share-save', disabled: !valid, onPress: () => void onSave(on ? n : null) }}>
      <View style={{ gap: t.space.lg }}>
        <ChoiceRow>
          <ChoiceChip testID="cat-share-switch" label={msg(on ? 'xshare.catOn' : 'xshare.catOff')} on={on} onPress={() => setOn(!on)} />
        </ChoiceRow>
        {on ? (
          <>
            <TextField testID="cat-share-pct" label={msg('xshare.pct')} keyboardType="number-pad" value={value} onChangeText={setValue} error={valid ? undefined : msg('xshare.err.pct')} />
            {valid ? <AppText variant="bodySm">{msg('xshare.catSplit', { worker: String(n), owner: String(100 - n) })}</AppText> : null}
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
