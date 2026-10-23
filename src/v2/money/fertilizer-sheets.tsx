/**
 * The sheets of the fertilizer purchase flow (E11-S10, simple design
 * approved 2026-10-23): what the main steps keep off the screen so each
 * step fits one phone. ปุ๋ยใหม่ (F1b), สาเหตุใหม่, เพิ่มรายละเอียด (F4b),
 * a tapper's %, picking a tapper, and ใส่โซนไหน (F6b).
 */

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { formatDate, todayIso } from '../../core/finance/money';
import type { FertOption } from '../../core/finance/ledger';
import type { FertilizerType, Payer, Stage } from '../../core/finance/types';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Button, Card, Check, CTA, Minus, Plus, RadioCard, SegmentedControl, TextField } from '../../ui';
import { ChoiceChip, ChoiceRow, NotRecordedPill, SectionLabel } from './pieces';

export const FERT_TYPES: readonly FertilizerType[] = ['chemical', 'manure', 'other'];
const STAGES: readonly Stage[] = ['actual', 'committed', 'planned'];
const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

/** A tick row: "จำไว้ใช้ครั้งหน้า" — on by default; off means this time only. */
export function RememberTick({ on, onPress, testID, hint }: { on: boolean; onPress: () => void; testID: string; hint: string }) {
  const t = useTheme();
  const msg = useT();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: on ? t.color.accept : t.color.ruleStrong, backgroundColor: on ? t.color.acceptSunk : t.color.surfaceRaised }}
    >
      <View aria-hidden style={{ width: 26, height: 26, borderRadius: t.radius.sm, borderWidth: t.border.thick, borderColor: on ? t.color.accept : t.color.ruleStrong, backgroundColor: on ? t.color.accept : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Check color={t.color.inkInverse} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fert.rememberAll')}</AppText>
        <AppText variant="caption">{hint}</AppText>
      </View>
    </Pressable>
  );
}

/** − n + with the number big in the middle; the field takes typing too. */
export function BigStepper({ testID, bumpID, value, onChange, onBump, caption, size = 'large' }: { testID: string; bumpID: string; value: string; onChange: (v: string) => void; onBump: (by: number) => void; caption: string; size?: 'large' | 'small' }) {
  const t = useTheme();
  const msg = useT();
  const d = size === 'large' ? t.target.comfortable : t.target.min;
  // A fixed width: on the web a TextInput otherwise takes the browser's default width and pushes − / + off screen.
  const w = size === 'large' ? 120 : 56;
  const round = { width: d, height: d, borderRadius: t.radius.pill, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, backgroundColor: t.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, flexShrink: 0 }}>
      <Pressable testID={`${bumpID}-less`} accessibilityRole="button" accessibilityLabel={msg('fert.less')} onPress={() => onBump(-1)} style={round}>
        <Minus color={t.color.ink} size={size === 'large' ? 18 : 14} />
      </Pressable>
      <View style={{ alignItems: 'center', width: w }}>
        <TextInput
          testID={testID}
          accessibilityLabel={caption}
          keyboardType="number-pad"
          value={value}
          onChangeText={onChange}
          style={{ width: w, textAlign: 'center', padding: 0, fontFamily: t.font.family.sans, fontSize: size === 'large' ? t.font.size.figure : t.font.size.headingXl, fontWeight: t.font.weight.bold, color: t.color.ink, fontVariant: ['tabular-nums'] }}
        />
        <AppText variant="caption">{caption}</AppText>
      </View>
      <Pressable testID={`${bumpID}-more`} accessibilityRole="button" accessibilityLabel={msg('fert.more')} onPress={() => onBump(1)} style={round}>
        <Plus color={t.color.ink} size={size === 'large' ? 18 : 14} />
      </Pressable>
    </View>
  );
}

export interface ProductDraft {
  readonly type: FertilizerType;
  readonly formula: string;
  readonly brand: string;
  readonly sackKg: string;
}

/** F1b ปุ๋ยใหม่: the four fields and ONE tick that remembers formula, brand and size together. */
export function NewProductSheet({ options, initial, onClose, onDone }: { options: readonly FertOption[]; initial: ProductDraft; onClose: () => void; onDone: (v: ProductDraft, remember: boolean) => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [v, setV] = useState<ProductDraft>(initial);
  const [remember, setRemember] = useState(true);
  const sizes = [...new Set(['25', '50', ...options.filter((o) => o.kind === 'sackKg' && !o.hidden).map((o) => o.name)])];
  const [otherKg, setOtherKg] = useState(initial.sackKg !== '' && !sizes.includes(initial.sackKg));
  const brands = options.filter((o) => o.kind === 'brand' && !o.hidden && (!v.brand.trim() || o.name.toLowerCase().includes(v.brand.trim().toLowerCase()))).slice(0, 4);
  const kg = v.sackKg.trim();
  const ok = v.formula.trim() !== '' && (!kg || Number(kg) > 0);
  const set = (p: Partial<ProductDraft>) => setV((x) => ({ ...x, ...p }));
  return (
    <BottomSheet open onClose={onClose} testID="fert-new-sheet" title={msg('fert.newProduct')}>
      <View style={{ gap: t.space.md }}>
        <SegmentedControl testID="fert-new-type" value={v.type} onChange={(type) => set({ type })} options={FERT_TYPES.map((k) => ({ value: k, label: msg(`fert.type.${k}`) }))} />
        <TextField testID="fert-formula" label={msg('fert.formula')} required value={v.formula} onChangeText={(formula) => set({ formula })} />
        <View style={{ gap: t.space.xs }}>
          <TextField testID="fert-brand" label={msg('fert.brand')} hint={msg('fert.brandHint')} value={v.brand} onChangeText={(brand) => set({ brand })} />
          {brands.length ? (
            <ChoiceRow>
              {brands.map((o) => <ChoiceChip key={o.id} testID={`fert-brand-opt-${o.name}`} label={o.name} on={sameName(o.name, v.brand)} onPress={() => set({ brand: o.name })} />)}
            </ChoiceRow>
          ) : null}
        </View>
        <View style={{ gap: t.space.xs }}>
          <SectionLabel>{msg('fert.sackKg')}</SectionLabel>
          <ChoiceRow>
            {sizes.map((s) => (
              <ChoiceChip
                key={s}
                testID={`fert-kg-${s}`}
                label={msg('fert.kg', { kg: s })}
                on={!otherKg && kg === s}
                onPress={() => {
                  setOtherKg(false);
                  set({ sackKg: s });
                }}
              />
            ))}
            <ChoiceChip testID="fert-kg-other" dashed label={msg('fert.kgOther')} on={otherKg} onPress={() => setOtherKg(true)} />
            <ChoiceChip
              testID="fert-kg-unknown"
              label={msg('fert.kgUnknown')}
              on={!otherKg && kg === ''}
              onPress={() => {
                setOtherKg(false);
                set({ sackKg: '' });
              }}
            />
          </ChoiceRow>
          {otherKg ? <TextField testID="fert-sackKg" label={msg('fert.sackKg')} keyboardType="decimal-pad" value={v.sackKg} onChangeText={(sackKg) => set({ sackKg })} error={kg && !(Number(kg) > 0) ? msg('fert.err.sackKg') : undefined} /> : null}
        </View>
        <RememberTick testID="fert-remember" on={remember} onPress={() => setRemember((r) => !r)} hint={msg('fert.rememberAllHint')} />
        <CTA testID="fert-new-done" disabled={!ok} icon={(c) => <Check color={c} />} onPress={() => void onDone({ type: v.type, formula: v.formula.trim(), brand: v.brand.trim(), sackKg: kg }, remember)}>
          {msg('fert.useThis')}
        </CTA>
      </View>
    </BottomSheet>
  );
}

/** สาเหตุใหม่: name, optional description, remembered unless the tick is taken off. */
export function ReasonSheet({ initialName, onClose, onAdd }: { initialName: string; onClose: () => void; onAdd: (name: string, description: string, remember: boolean) => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState('');
  const [remember, setRemember] = useState(true);
  return (
    <BottomSheet open onClose={onClose} testID="fert-reason-sheet" title={msg('fert.reasonSheet')}>
      <View style={{ gap: t.space.md }}>
        <TextField testID="fert-reason-name" label={msg('fert.reasonName')} required value={name} onChangeText={setName} />
        <TextField testID="fert-reason-desc" label={msg('fert.reasonDesc')} hint={msg('v2m.optional')} value={desc} onChangeText={setDesc} />
        <RememberTick testID="fert-remember-reason" on={remember} onPress={() => setRemember((r) => !r)} hint={msg('fert.rememberReasonHint')} />
        <CTA testID="fert-reason-add" disabled={!name.trim()} onPress={() => void onAdd(name.trim(), desc.trim(), remember)}>{msg('fert.addReason')}</CTA>
      </View>
    </BottomSheet>
  );
}

/** F4b เพิ่มรายละเอียด: date (today), stage in plain words, shop, who ordered, receipt (coming soon). */
export function DetailsSheet({
  date,
  stage,
  shop,
  orderedBy,
  shops,
  people,
  onChange,
  onClose,
  dateError,
}: {
  date: string;
  stage: Stage;
  shop: string;
  orderedBy: string;
  shops: readonly string[];
  people: readonly string[];
  onChange: (p: { date?: string; stage?: Stage; shop?: string; orderedBy?: string }) => void;
  onClose: () => void;
  dateError?: string;
}) {
  const t = useTheme();
  const msg = useT();
  return (
    <BottomSheet open onClose={onClose} testID="fert-details-sheet" title={msg('fert.details')}>
      <View style={{ gap: t.space.md }}>
        <AppText variant="caption">{msg('fert.detailsHint')}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space.sm }}>
          <View style={{ flex: 1 }}>
            <TextField testID="fert-date" label={msg('fert.buyDate')} value={date} onChangeText={(v) => onChange({ date: v })} helper={msg('v2m.dateShown', { shown: formatDate(date) })} error={dateError} />
          </View>
          <ChoiceChip testID="fert-today" label={msg('fert.today')} on={date === todayIso()} onPress={() => onChange({ date: todayIso() })} />
        </View>
        <View style={{ gap: t.space.xs }}>
          <SectionLabel>{msg('fert.boughtYet')}</SectionLabel>
          <SegmentedControl testID="fert-stage" value={stage} onChange={(v) => onChange({ stage: v })} options={STAGES.map((s) => ({ value: s, label: msg(`fert.stage.${s}`) }))} />
        </View>
        <PickOrType testID="fert-shop" label={msg('fert.shop')} value={shop} choices={shops} onChange={(v) => onChange({ shop: v })} />
        <PickOrType testID="fert-ordered" label={msg('fert.orderedBy')} value={orderedBy} choices={people} onChange={(v) => onChange({ orderedBy: v })} />
        <View testID="fert-receipt" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          <AppText variant="label" style={{ flex: 1 }}>{msg('fert.receipt')}</AppText>
          <NotRecordedPill />
          <AppText variant="caption">{msg('fert.receiptSoon')}</AppText>
        </View>
        <CTA testID="fert-details-done" onPress={onClose}>{msg('fert.done')}</CTA>
      </View>
    </BottomSheet>
  );
}

/** A short text field with the values used before as chips under it. */
function PickOrType({ testID, label, value, choices, onChange }: { testID: string; label: string; value: string; choices: readonly string[]; onChange: (v: string) => void }) {
  const t = useTheme();
  const msg = useT();
  return (
    <View style={{ gap: t.space.xs }}>
      <TextField testID={testID} label={label} hint={msg('v2m.optional')} value={value} onChangeText={onChange} />
      {choices.length ? (
        <ChoiceRow>
          {choices.slice(0, 4).map((c) => <ChoiceChip key={c} testID={`${testID}-opt-${c}`} label={c} on={sameName(c, value)} onPress={() => onChange(c)} />)}
        </ChoiceRow>
      ) : null}
    </View>
  );
}

/** A tapper's %: the category default, editable; remove them; or change the default in settings. */
export function PctSheet({ name, pct, catPct, onDone, onRemove, onSettings, onClose }: { name: string; pct: string; catPct: number; onDone: (pct: string) => void; onRemove: () => void; onSettings: () => void; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [v, setV] = useState(pct);
  const ok = /^\d{1,3}$/.test(v.trim()) && Number(v) <= 100;
  return (
    <BottomSheet open onClose={onClose} testID="fert-pct-sheet" title={msg('fert.pctSheet', { name })}>
      <View style={{ gap: t.space.md }}>
        <TextField testID="fert-pct-input" label={msg('fert.pctLabel')} keyboardType="number-pad" value={v} onChangeText={setV} error={ok ? undefined : msg('xshare.err.pct')} />
        <ChoiceRow>
          {[...new Set([catPct, 30, 50, 70])].map((p) => <ChoiceChip key={p} testID={`fert-pct-${p}`} label={msg('fert.pctValue', { pct: p })} on={v.trim() === String(p)} onPress={() => setV(String(p))} />)}
        </ChoiceRow>
        <ChoiceRow>
          <ChoiceChip testID="fert-pct-settings" label={msg('fert.pctSettings', { pct: catPct })} onPress={onSettings} />
          <ChoiceChip testID="fert-line-remove" label={msg('fert.removeTapper')} onPress={onRemove} />
        </ChoiceRow>
        <CTA testID="fert-pct-done" disabled={!ok} onPress={() => onDone(v.trim())}>{msg('xshare.done')}</CTA>
      </View>
    </BottomSheet>
  );
}

/** + เพิ่มคนกรีด: the tappers not picked yet. */
export function TapperSheet({ tappers, onPick, onClose }: { tappers: readonly Payer[]; onPick: (p: Payer) => void; onClose: () => void }) {
  const t = useTheme();
  const msg = useT();
  return (
    <BottomSheet open onClose={onClose} testID="fert-tapper-sheet" title={msg('fert.tapperSheet')}>
      <View style={{ gap: t.space.sm }}>
        {tappers.length === 0 ? <AppText variant="bodySm">{msg('fert.noTappers')}</AppText> : null}
        {tappers.map((p) => <RadioCard key={p.id} testID={`fert-pick-${p.id}`} selected={false} title={p.name} onPress={() => onPick(p)} />)}
      </View>
    </BottomSheet>
  );
}

export interface ZoneDraft {
  readonly farmId: string;
  readonly name: string;
  readonly sacks: string;
  readonly reasons: readonly string[];
  readonly note: string;
}

/** F6b ใส่โซนไหน (optional): a farm, its zones as cards (sacks −/+, reasons from F3, note), add a zone. */
export function ZonesSheet({
  farms,
  farmId,
  onFarm,
  zones,
  drafts,
  onDraft,
  reasons,
  reasonName,
  total,
  given,
  error,
  onZoneSaved,
  onClose,
}: {
  farms: readonly { id: string; name: string }[];
  farmId: string | null;
  onFarm: (id: string) => void;
  zones: readonly { id: string; name: string }[];
  drafts: Record<string, ZoneDraft>;
  onDraft: (id: string, z: ZoneDraft) => void;
  reasons: readonly string[];
  reasonName: (r: string) => string;
  total: number;
  given: number;
  error: string | null;
  onZoneSaved: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [adding, setAdding] = useState<{ zoneId?: string; name: string; effective: string } | null>(null);
  const [addErr, setAddErr] = useState(false);
  const [notes, setNotes] = useState<ReadonlySet<string>>(new Set(Object.entries(drafts).filter(([, d]) => d.note).map(([id]) => id)));
  const draftOf = (z: { id: string; name: string }): ZoneDraft => drafts[z.id] ?? { farmId: farmId ?? '', name: z.name, sacks: '', reasons: [], note: '' };
  const set = (z: { id: string; name: string }, p: Partial<ZoneDraft>) => onDraft(z.id, { ...draftOf(z), name: z.name, farmId: farmId ?? '', ...p });
  const whole = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : 0);

  const saveZone = async () => {
    if (!adding || !farmId) return;
    try {
      if (adding.zoneId) await peopleStore.renameZone(adding.zoneId, adding.name);
      else await peopleStore.addZone(farmId, adding.name, adding.effective);
      setAdding(null);
      setAddErr(false);
      onZoneSaved();
    } catch {
      setAddErr(true);
    }
  };

  return (
    <BottomSheet open onClose={onClose} testID="fert-zone-sheet" title={msg('fert.zonesSheet')}>
      <View style={{ gap: t.space.md }}>
        {farms.length === 0 ? <AppText variant="bodySm">{msg('fert.noFarm')}</AppText> : null}
        {farms.length === 1 ? (
          <AppText testID="fert-zone-farm" style={{ fontWeight: t.font.weight.bold }}>{farms[0].name}</AppText>
        ) : (
          <ChoiceRow>
            {farms.map((f) => <ChoiceChip key={f.id} testID={`fert-farm-${f.id}`} label={f.name} on={farmId === f.id} onPress={() => onFarm(f.id)} />)}
          </ChoiceRow>
        )}
        {farmId ? (
          <>
            <Card testID="fert-zones-sum" style={{ backgroundColor: given === total ? t.color.acceptSunk : t.color.surfaceSunk }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('fert.sacksOf', { n: given, total })}</AppText>
            </Card>
            {zones.length === 0 ? <AppText>{msg('fert.noZones')}</AppText> : null}
            {zones.map((z) => {
              const d = draftOf(z);
              return (
                <Card key={z.id} testID={`fert-zone-${z.id}`} style={{ gap: t.space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                    <Pressable testID={`fert-zone-${z.id}-rename`} accessibilityRole="button" accessibilityHint={msg('fert.renameZone')} onPress={() => setAdding({ zoneId: z.id, name: z.name, effective: '' })} style={{ flex: 1 }}>
                      <AppText style={{ fontWeight: t.font.weight.bold }}>{z.name}</AppText>
                    </Pressable>
                    <BigStepper testID={`fert-zone-${z.id}-sacks`} bumpID={`fert-zone-${z.id}`} size="small" value={d.sacks} caption={msg('fert.sacksUnit')} onChange={(v) => set(z, { sacks: v })} onBump={(by) => set(z, { sacks: String(Math.max(0, whole(d.sacks) + by)) })} />
                  </View>
                  <ChoiceRow>
                    {reasons.map((r) => (
                      <ChoiceChip key={r} testID={`fert-zone-${z.id}-reason-${r}`} label={reasonName(r)} on={d.reasons.includes(r)} onPress={() => set(z, { reasons: d.reasons.includes(r) ? d.reasons.filter((x) => x !== r) : [...d.reasons, r] })} />
                    ))}
                    {!notes.has(z.id) ? <ChoiceChip testID={`fert-zone-${z.id}-add-note`} dashed label={msg('fert.addNote')} onPress={() => setNotes((s) => new Set(s).add(z.id))} /> : null}
                  </ChoiceRow>
                  {notes.has(z.id) || d.note ? <TextField testID={`fert-zone-${z.id}-note`} label={msg('fert.zoneNote')} value={d.note} onChangeText={(v) => set(z, { note: v })} /> : null}
                </Card>
              );
            })}
            {error ? <AppText testID="fert-zones-err" style={{ color: t.color.reject }}>{error}</AppText> : null}
            {adding ? (
              <Card style={{ gap: t.space.sm }}>
                <TextField testID="fert-zone-name" label={msg('fert.zoneName')} value={adding.name} onChangeText={(v) => setAdding((s) => (s ? { ...s, name: v } : s))} error={addErr ? msg('fert.err.zoneName') : undefined} />
                {!adding.zoneId ? (
                  <TextField testID="fert-zone-effective" label={msg('fert.zoneEffective')} value={adding.effective} onChangeText={(v) => setAdding((s) => (s ? { ...s, effective: v } : s))} helper={msg('v2m.dateShown', { shown: formatDate(adding.effective) })} />
                ) : null}
                <Button testID="fert-zone-save" variant="primary" disabled={!adding.name.trim()} onPress={() => void saveZone()}>{msg('common.save')}</Button>
              </Card>
            ) : (
              <ChoiceRow>
                <ChoiceChip testID="fert-zone-add" dashed label={msg('fert.addZone')} onPress={() => setAdding({ name: '', effective: todayIso() })} />
              </ChoiceRow>
            )}
          </>
        ) : null}
        <CTA testID="fert-zone-done" disabled={!!error} onPress={onClose}>{msg('fert.done')}</CTA>
      </View>
    </BottomSheet>
  );
}

