/**
 * แชร์กับคนกรีดยาง — mockup 7b screens 21c/21d (E11-S10 B). A general
 * category's expense shared with one tapper: discount first (a switch, off
 * until wanted), then the tapper, their % (the category's, editable) and
 * whether their part is a debt or already paid. The split itself is
 * `splitShare` — this sheet only collects and previews.
 */

import { useState } from 'react';
import { View } from 'react-native';

import { formatSatang, parseBahtToSatang, satangToInput } from '../../core/finance/money';
import { checkShare, splitShare } from '../../core/finance/share';
import type { ExpenseShare, Payer, ShareSettle } from '../../core/finance/types';
import { filterPeople } from '../../core/master';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Card, SegmentedControl, TextField } from '../../ui';
import { useMaster } from '../farm/pieces';
import { ChoiceChip, ChoiceRow, SectionLabel } from './pieces';

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
    lines: [{ worker: d.worker, sacks: null, workerPct: Number(d.pct), settle: d.settle }],
  };
}

export function ShareSheet({
  open,
  onClose,
  billSatang,
  title,
  draft,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  billSatang: number;
  title: string;
  draft: ShareDraft;
  onChange: (d: ShareDraft) => void;
}) {
  const t = useTheme();
  const msg = useT();
  const { state } = useMaster();
  const tappers = state ? filterPeople(state.people, 'tapper').map((p) => ({ id: p.id, name: p.name })) : [];
  const [discountOn, setDiscountOn] = useState(draft.discount.trim() !== '');
  const set = (p: Partial<ShareDraft>) => onChange({ ...draft, ...p });
  const share = shareOf(draft, billSatang);
  const problems = share ? checkShare(share) : [];
  const split = share && !problems.length ? splitShare(share) : null;
  const net = Math.max(0, billSatang - (discountOn && draft.discount.trim() ? (parseBahtToSatang(draft.discount) ?? 0) : 0));

  return (
    <BottomSheet open={open} onClose={onClose} title={msg('xshare.title')} testID="share-sheet" action={{ label: msg('xshare.done'), testID: 'share-done', disabled: problems.length > 0, onPress: onClose }}>
      <View style={{ gap: t.space.lg }}>
        <AppText variant="bodySm">{msg('xshare.subtitle', { category: title, bill: formatSatang(billSatang) })}</AppText>

        <Card testID="share-discount-card" style={{ gap: t.space.sm }}>
          <ChoiceRow>
            <ChoiceChip
              testID="share-discount-switch"
              label={msg(discountOn ? 'xshare.discountOn' : 'xshare.discountOff')}
              on={discountOn}
              onPress={() => {
                if (discountOn) set({ discount: '' });
                setDiscountOn(!discountOn);
              }}
            />
          </ChoiceRow>
          {discountOn ? (
            <>
              <TextField testID="share-discount" label={msg('xshare.discount')} keyboardType="decimal-pad" value={draft.discount} onChangeText={(v) => set({ discount: v })} placeholder="0.00" helper={msg('v2m.baht')} error={problems.includes('discount-over') ? msg('xshare.err.discount') : undefined} />
              <AppText testID="share-net" variant="bodySm">{msg('xshare.net', { bill: formatSatang(billSatang), net: formatSatang(net) })}</AppText>
            </>
          ) : null}
        </Card>

        <View style={{ gap: t.space.sm }}>
          <SectionLabel hint={msg('xshare.oneTapper')}>{msg('xshare.tapper')}</SectionLabel>
          <ChoiceRow>
            <ChoiceChip testID="share-worker-none" label={msg('xshare.none')} on={!draft.worker} onPress={() => set({ worker: null })} />
            {tappers.map((p) => (
              <ChoiceChip key={p.id} testID={`share-worker-${p.id}`} label={p.name} on={draft.worker?.id === p.id} onPress={() => set({ worker: p })} />
            ))}
          </ChoiceRow>
        </View>

        {draft.worker ? (
          <>
            <TextField testID="share-pct" label={msg('xshare.pct')} keyboardType="number-pad" value={draft.pct} onChangeText={(v) => set({ pct: v })} helper={msg('xshare.pctHelper')} error={problems.includes('pct-invalid') ? msg('xshare.err.pct') : undefined} />
            <SegmentedControl testID="share-settle" value={draft.settle} onChange={(v) => set({ settle: v })} options={[{ value: 'debt', label: msg('xshare.settle.debt') }, { value: 'paid', label: msg('xshare.settle.paid') }]} />
            <AppText variant="caption">{msg(draft.settle === 'debt' ? 'xshare.settle.debtHint' : 'xshare.settle.paidHint', { name: draft.worker.name })}</AppText>
            {split ? (
              <Card testID="share-preview" style={{ backgroundColor: t.color.surfaceSunk }}>
                <AppText>{msg('xshare.preview', { name: draft.worker.name, worker: formatSatang(split.lines[0].workerSatang), owner: formatSatang(split.lines[0].ownerSatang) })}</AppText>
              </Card>
            ) : null}
          </>
        ) : null}
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
