/**
 * What the v2 sale screens share (sale mockup v1.1.0), built from src/ui and
 * theme tokens only (D-82):
 *
 * - useSaleView: the sale log (SaleProvider) with farm master data, the sale
 *   day, its numbering mode and the header's "การขาย <date>".
 * - Kv: one label / value line (mockup `.kv`), with total, minus, plus, muted
 *   and warn tones.
 * - Banner: the info / warn / bad note with its icon and lines.
 * - Crumbs: "✓ สวน › ✓ คนกรีดยาง › จุดชั่ง", drawn (no glyphs).
 * - PointBar: the recorder's point row — farm · point, its skew, the tapper
 *   and "เปลี่ยนจุด" (mockup `.prow`).
 * - Choice: a sheet option with a tile, a bold title and lines.
 * - tones for farms and tappers, and kg / baht text.
 */

import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { filterPeople, formatThaiDate, saleSettings, type MasterState } from '../../core/master';
import { saleDay } from '../../core/sale-list';
import { saleNumbering } from '../../core/sale-points';
import { statusCountsAsClosed } from '../../core/sale-status';
import { useI18n, useT } from '../../i18n';
import { useSale } from '../../store/SaleProvider';
import { useTheme } from '../../theme';
import { AlertIcon, AppText, Check, ChevronRight, IconTile, PinIcon, SwapIcon, TapperIcon, toneColours, type IconRender, type TileTone } from '../../ui';
import { categoryTone, useMaster } from '../farm/pieces';

/** Grams as the app shows kg: "1,520", "37.5". */
export function kgText(g: number): string {
  return (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/** Satang as baht: "34,860" when whole, else "17,823.75". */
export function bahtText(satang: number): string {
  const full = formatSatang(satang);
  return satang % 100 === 0 ? full.slice(0, -3) : full;
}

/** A farm's tile tone: its place among the shown farms (mockup t-cat1, t-cat2 …). */
export function farmTone(master: MasterState, farmId: string): TileTone {
  return categoryTone(Math.max(0, master.properties.filter((p) => !p.deleted).findIndex((p) => p.id === farmId)));
}

/** A tapper's tone, as the farm screens give it (after the farm colours). */
export function tapperTone(master: MasterState, tapperId: string | null): TileTone {
  if (!tapperId) return 'neutral';
  return categoryTone(4 + Math.max(0, filterPeople(master.people, 'tapper').findIndex((p) => p.id === tapperId)));
}

/** The sale in context plus everything the sale screens read beside it. */
export function useSaleView() {
  const sale = useSale();
  const { state: master, reload } = useMaster();
  const { era } = useI18n();
  const msg = useT();
  const [now] = useState(() => Date.now());
  const day = saleDay(sale.state.startedTs, now);
  const settings = master ? saleSettings(master) : null;
  const mode = useMemo(() => saleNumbering(sale.events, settings?.numbering ?? 'per-tapper'), [sale.events, settings?.numbering]);
  const nameOf = useCallback((id: string | null) => (id ? (master?.people.find((p) => p.id === id)?.name ?? '') : ''), [master]);
  return {
    ...sale,
    master,
    reloadMaster: reload,
    ready: sale.ready && master !== null,
    /** Completed (or the older sale_closed): every write screen is read-only (review #2, D-16). */
    closed: sale.ready && statusCountsAsClosed(sale.state),
    day,
    mode,
    settings,
    nameOf,
    // Empty until the log is read, so a static page's first render matches its export (React 418).
    saleTitle: sale.ready ? msg('rec.saleOf', { date: formatThaiDate(sale.state.startedTs ?? now, era) }) : '',
  };
}

/** A write screen of a closed sale goes to its payment page, read-only (review #2). */
export function useLeaveIfClosed(view: { ready: boolean; closed: boolean; saleId: string }) {
  const router = useRouter();
  const { ready, closed, saleId } = view;
  useEffect(() => {
    if (ready && closed) router.replace(`/v2/sale/${saleId}/payment` as Href);
  }, [ready, closed, saleId, router]);
}

export type KvTone = 'plain' | 'total' | 'minus' | 'plus' | 'muted' | 'warn';

/** One label / value line. `total` sits under a rule, bold. */
export function Kv({ label, value, tone = 'plain', testID, indent }: { label: ReactNode; value: ReactNode; tone?: KvTone; testID?: string; indent?: boolean }) {
  const t = useTheme();
  const colour = tone === 'muted' ? t.color.inkSoft : tone === 'warn' ? t.color.warn : tone === 'plus' ? t.color.accept : t.color.ink;
  const total = tone === 'total';
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: t.space.sm,
        paddingVertical: t.space.xxs,
        paddingLeft: indent ? t.space.md : 0,
        ...(total ? { marginTop: t.space.xs, paddingTop: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint } : {}),
      }}
    >
      <Text style={{ flexShrink: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: total ? t.font.weight.bold : t.font.weight.regular, color: tone === 'plain' || total ? t.color.inkSoft : colour }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: tone === 'muted' ? t.font.size.bodyMd : t.font.size.bodyLg,
          fontWeight: tone === 'muted' ? t.font.weight.regular : t.font.weight.bold,
          fontVariant: ['tabular-nums'],
          color: colour,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/** A note band: `info` grey with "?", `warn` amber, `bad` red. */
export function Banner({
  tone = 'info',
  icon,
  title,
  lines = [],
  children,
  testID,
}: {
  tone?: 'info' | 'warn' | 'bad';
  icon?: IconRender;
  title?: string;
  lines?: readonly ReactNode[];
  children?: ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  const bg = tone === 'warn' ? t.color.warnSunk : tone === 'bad' ? t.color.rejectSunk : t.color.surfaceSunk;
  const fg = tone === 'warn' ? t.color.warn : tone === 'bad' ? t.color.reject : t.color.inkSoft;
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: t.space.sm, backgroundColor: bg, borderRadius: t.radius.md, padding: t.space.md }}>
      <View aria-hidden style={{ width: 16, alignItems: 'center', paddingTop: 2 }}>
        {icon ? icon(fg) : <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: fg }}>?</Text>}
      </View>
      <View style={{ flex: 1, gap: t.space.xxs }}>
        {title ? <AppText style={{ fontWeight: t.font.weight.bold, color: tone === 'info' ? t.color.ink : fg }}>{title}</AppText> : null}
        {lines.map((l, i) => (
          <AppText key={i} variant="bodySm" style={{ color: tone === 'info' ? t.color.inkSoft : t.color.ink }}>
            {l}
          </AppText>
        ))}
        {children}
      </View>
    </View>
  );
}

/** "✓ สวน › ✓ คนกรีดยาง › จุดชั่ง" — done steps with a check, the current one bold. */
export function Crumbs({ done, now }: { done: readonly string[]; now: string }) {
  const t = useTheme();
  const step = (label: string, isDone: boolean) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xxs }}>
      {isDone ? <Check color={t.color.accept} size={10} /> : null}
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: isDone ? t.color.accept : t.color.ink }}>{label}</Text>
    </View>
  );
  return (
    <View testID="crumbs" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.space.xs }}>
      {done.map((d) => (
        <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
          {step(d, true)}
          <ChevronRight color={t.color.inkFaint} size={6} />
        </View>
      ))}
      {step(now, false)}
    </View>
  );
}

/** A small warn-toned "ค่าเบี้ยว +2 กก." tag. */
export function SkewTag({ label, testID }: { label: string; testID?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, alignSelf: 'flex-start', backgroundColor: t.color.warnSunk, borderRadius: t.radius.sm, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs }}>
      <AlertIcon color={t.color.warn} size={12} />
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.warn }}>{label}</Text>
    </View>
  );
}

/** The recorder's point row: farm · point (and skew), then the tapper and "เปลี่ยนจุด". */
export function PointBar({
  place,
  farmToneName,
  tapper,
  tapperToneName,
  skew,
  onSwitch,
}: {
  place: string;
  farmToneName: TileTone;
  tapper: string;
  tapperToneName: TileTone;
  skew?: string | null;
  onSwitch?: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const ink = (tone: TileTone) => toneColours(t, tone).fg;
  return (
    <View testID="point-bar" style={{ backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.lg, borderWidth: t.border.hair, borderColor: t.color.ruleFaint, paddingHorizontal: t.space.lg, paddingVertical: t.space.md, gap: t.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <PinIcon color={ink(farmToneName)} size={18} />
        <Text testID="point-place" style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {place}
        </Text>
        {skew ? <SkewTag label={skew} testID="skew-tag" /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <TapperIcon color={ink(tapperToneName)} size={16} />
        <Text testID="point-tapper" style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.ink }}>
          {tapper}
        </Text>
        {onSwitch ? (
          <Pressable
            testID="switch-point"
            accessibilityRole="button"
            onPress={onSwitch}
            style={{
              minHeight: t.target.min,
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.space.sm,
              paddingHorizontal: t.space.lg,
              borderRadius: t.radius.pill,
              borderWidth: t.border.thick,
              borderColor: t.color.action,
              backgroundColor: t.color.surfaceRaised,
            }}
          >
            <SwapIcon color={t.color.action} size={16} />
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.action }}>{msg('rec.switch')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A sheet option: a tile, a bold title and its lines (mockup `.choice`). `primary` = the suggested one. */
export function Choice({
  icon,
  title,
  lines,
  onPress,
  primary,
  testID,
}: {
  icon: IconRender;
  title: string;
  lines: readonly ReactNode[];
  onPress: () => void;
  primary?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: t.space.md,
        padding: t.space.md,
        borderRadius: t.radius.lg,
        borderWidth: primary ? t.border.thick : t.border.hair,
        borderColor: primary ? t.color.action : t.color.ruleStrong,
        backgroundColor: primary ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      <IconTile tone="action" icon={icon} />
      <View style={{ flex: 1, gap: t.space.xxs }}>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{title}</AppText>
        {lines.map((l, i) => (
          <AppText key={i} variant="bodySm" style={{ color: t.color.ink }}>
            {l}
          </AppText>
        ))}
      </View>
    </Pressable>
  );
}

/** A rounded number chip inside a sentence: "52 กก." (mockup `.nchip`). */
export function NumChip({ children, tone = 'plain', testID }: { children: ReactNode; tone?: 'plain' | 'warn' | 'scale'; testID?: string }) {
  const t = useTheme();
  const fg = tone === 'warn' ? t.color.warn : t.color.ink;
  return (
    <Text
      testID={testID}
      style={{
        fontFamily: t.font.family.sans,
        fontWeight: t.font.weight.bold,
        fontVariant: ['tabular-nums'],
        color: fg,
        borderWidth: tone === 'scale' ? t.border.thick : t.border.hair,
        borderColor: tone === 'warn' ? t.color.warn : t.color.ink,
        borderRadius: t.radius.sm,
        paddingHorizontal: t.space.xs,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * The mockup's segmented choice with a small line under each label (`.seg`
 * with `<small>`): the selected one is filled navy; a disabled one is dashed
 * and cannot be picked. `vertical` stacks them (mockup `.seg.stack.col`).
 */
export function SegOptions<T extends string>({
  options,
  value,
  onChange,
  vertical,
  testID,
}: {
  options: readonly { value: T; label: string; detail?: string; disabled?: boolean; icon?: IconRender }[];
  value: T | null;
  onChange: (v: T) => void;
  vertical?: boolean;
  testID: string;
}) {
  const t = useTheme();
  return (
    <View testID={testID} accessibilityRole="radiogroup" style={{ flexDirection: vertical ? 'column' : 'row', backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.lg, padding: t.space.xs, gap: t.space.xs }}>
      {options.map((o) => {
        const on = o.value === value;
        const fg = o.disabled ? t.color.disabledInk : on ? t.color.inkInverse : t.color.inkSoft;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!o.disabled }}
            aria-checked={on}
            aria-disabled={!!o.disabled}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            style={{
              flex: vertical ? undefined : 1,
              minHeight: t.target.min,
              borderRadius: t.radius.md,
              backgroundColor: on ? t.color.action : 'transparent',
              borderWidth: o.disabled ? t.border.hair : 0,
              borderStyle: 'dashed',
              borderColor: t.color.ruleStrong,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: t.space.sm,
              paddingVertical: t.space.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs, flexWrap: 'wrap', justifyContent: 'center' }}>
              {o.icon ? <View aria-hidden style={{ alignSelf: 'center' }}>{o.icon(fg)}</View> : null}
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: fg, textAlign: 'center' }}>{o.label}</Text>
              {!vertical && o.detail && !o.disabled ? (
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: fg }}>{o.detail}</Text>
              ) : null}
            </View>
            {o.detail && (vertical || o.disabled) ? (
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: fg, textAlign: 'center' }}>{o.detail}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A form row: small tile, a soft label over a bold value, soft lines, and a trailing mark (mockup `.frow`). */
export function FieldRow({
  icon,
  label,
  value,
  lines = [],
  trailing,
  onPress,
  testID,
}: {
  icon: IconRender;
  label: string;
  value?: ReactNode;
  lines?: readonly string[];
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', gap: t.space.md, paddingVertical: t.space.md, alignItems: 'flex-start' }}>
      <IconTile tone="action" icon={icon} />
      <View style={{ flex: 1, gap: t.space.xxs }}>
        <AppText variant="bodySm" style={{ color: t.color.inkSoft }}>
          {label}
        </AppText>
        {typeof value === 'string' ? (
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{value}</Text>
        ) : (
          value
        )}
        {lines.map((l) => (
          <AppText key={l} variant="bodySm">
            {l}
          </AppText>
        ))}
      </View>
      {trailing ? <View style={{ alignSelf: 'center' }}>{trailing}</View> : null}
    </View>
  );
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    <View testID={testID}>{body}</View>
  );
}

/** "ไม่ได้บันทึก" — a soft grey pill for a field left empty (Unknown, SYNC-12). */
export function EmptyPill({ label }: { label: string }) {
  const t = useTheme();
  return (
    <Text style={{ alignSelf: 'flex-start', fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: t.color.inkSoft, backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.pill, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs }}>
      {label}
    </Text>
  );
}

/** A line with a small leading icon in soft ink (mockup `.mi`). */
export function IconLine({ icon, children, testID, strong }: { icon?: IconRender; children: ReactNode; testID?: string; strong?: boolean }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
      {icon ? <View aria-hidden style={{ width: 16, alignItems: 'center' }}>{icon(t.color.inkSoft)}</View> : null}
      <Text style={{ flexShrink: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: strong ? t.font.weight.bold : t.font.weight.regular, color: strong ? t.color.ink : t.color.inkSoft }}>
        {children}
      </Text>
    </View>
  );
}
