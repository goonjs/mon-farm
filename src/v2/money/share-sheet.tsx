/**
 * แชร์กับคนกรีดยาง — simple design E2 (owner 2026-10-23; E11-S10 B). A
 * general category's expense shared with one tapper, on one screen:
 * discount first (a switch, off until wanted), then the tapper, their % (the
 * category's, a pad card to change), whether their part is a debt or already
 * paid, and the result on one line; ตกลง at the bottom. The split itself is
 * `splitShare` — this sheet only collects and previews.
 *
 * E01-S20 rows 4–6: discount (optional) and % are typed on the app's number
 * pad; the draft keeps the text the old fields held (`satangToInput`, the
 * whole %), so `shareOf` and the saved share are unchanged.
 */

import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatSatang, parseBahtToSatang, satangToInput } from '../../core/finance/money';
import { checkShare, splitShare } from '../../core/finance/share';
import type { ExpenseShare, Payer, ShareSettle, Stage } from '../../core/finance/types';
import { filterPeople } from '../../core/master';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, CTA, MoneyField, QuantityField, SegmentedControl } from '../../ui';
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
  const set = (p: Partial<ShareDraft>) => onChange({ ...draft, ...p });
  const share = shareOf(draft, billSatang);
  const problems = share ? checkShare(share) : [];
  const split = share && !problems.length ? splitShare(share) : null;
  const net = Math.max(0, billSatang - (discountOn && draft.discount.trim() ? (parseBahtToSatang(draft.discount) ?? 0) : 0));
  const pctBad = problems.includes('pct-invalid');

  // Discount and % are pad cards; the split result is one line, so ตกลง stays on a 390×844 screen (E01-S20 D7).
  const discountSatang = draft.discount.trim() ? parseBahtToSatang(draft.discount) : null;
  const discountOver = problems.includes('discount-over') || (discountSatang !== null && discountSatang > billSatang);
  const pctValue = /^\d+$/.test(draft.pct.trim()) ? Number(draft.pct.trim()) : null;
  const bold = { fontWeight: t.font.weight.bold, color: t.color.ink, fontVariant: ['tabular-nums' as const] };
  return (
    <BottomSheet open={open} onClose={onClose} title={msg('xshare.title')} testID="share-sheet">
      <View style={{ gap: t.space.md }}>
        <AppText variant="bodySm">{msg('xshare.subtitle', { category: title, bill: formatSatang(billSatang) })}</AppText>

        <SwitchRow
          testID="share-discount-switch"
          title={msg('fert.discountTitle')}
          hint={discountOn ? undefined : msg('xshare.discountHint')}
          on={discountOn}
          onToggle={() => {
            if (discountOn) set({ discount: '' });
            setDiscountOn(!discountOn);
          }}
        />
        {discountOn ? (
          <View style={{ gap: t.space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space.md }}>
              <View style={{ flex: 1 }}>
                <MoneyField
                  testID="share-discount"
                  label={msg('xshare.discount')}
                  unit={msg('v2m.baht')}
                  satang={discountSatang}
                  words={false}
                  validate={(s) => (s > billSatang ? msg('xshare.err.discount') : undefined)}
                  clear={{ label: msg('numpad.clearNone'), onClear: () => set({ discount: '' }) }}
                  onChange={(s) => set({ discount: satangToInput(s) })}
                />
              </View>
              <View testID="share-net" style={{ paddingBottom: t.space.sm, alignItems: 'flex-end' }}>
                <AppText variant="caption">{msg('fert.netTitle')}</AppText>
                <AppText style={bold}>{formatSatang(net)}</AppText>
              </View>
            </View>
            {discountOver ? <AppText testID="share-discount-error" variant="bodySm" style={{ color: t.color.reject }}>{msg('xshare.err.discount')}</AppText> : null}
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
            <View style={{ gap: t.space.xs }}>
              <QuantityField testID="share-pct" label={msg('xshare.pct')} unit="%" value={pctValue} min={0} max={100} maxDigits={3} onChange={(n) => set({ pct: String(n) })} />
              <AppText variant="caption">{msg('xshare.pctHelper')}</AppText>
              {pctBad ? <AppText testID="share-pct-error" variant="bodySm" style={{ color: t.color.reject }}>{msg('xshare.err.pct')}</AppText> : null}
            </View>
            <SegmentedControl testID="share-settle" value={draft.settle} onChange={(v) => set({ settle: v })} options={[{ value: 'debt', label: msg('xshare.settle.debt') }, { value: 'paid', label: msg('xshare.settle.paid') }]} />
            {split ? (
              <AppText testID="share-preview" variant="bodySm">
                {`${draft.worker.name} ${msg(draft.settle === 'paid' ? 'xshare.paidShort' : stage === 'actual' ? 'xshare.debtShort' : 'xshare.debtLaterShort')} `}
                <Text style={bold}>{formatSatang(split.lines[0].workerSatang)}</Text>
                {` · ${msg('xshare.ownerPays')} `}
                <Text style={bold}>{formatSatang(split.lines[0].ownerSatang)}</Text>
              </AppText>
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
            <QuantityField testID="cat-share-pct" label={msg('xshare.pct')} unit="%" value={valid ? n : null} min={0} max={100} maxDigits={3} onChange={(v) => setValue(String(v))} />
            {valid ? <AppText variant="bodySm">{msg('xshare.catSplit', { worker: String(n), owner: String(100 - n) })}</AppText> : null}
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
