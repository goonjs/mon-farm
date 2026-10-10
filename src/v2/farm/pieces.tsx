/**
 * What the v2 farm-settings screens share (v1.1.0 farm mockup, sections 1–6,
 * 10), built from src/ui and theme tokens only (D-82):
 *
 * - useMaster: the folded farm master data, reloaded when a screen regains
 *   focus so a list shows what a form just saved.
 * - FarmScreen: ScreenHeader (back + sync pill) over a scroll body, with an
 *   optional pinned call to action and a sheet on top.
 * - RowCard: one card of rows split by hairlines (mockup `.card.tight`).
 * - DeletedLink / DeletedList: "ที่ลบแล้ว (n)" as a small link, each row a
 *   large "ลบแล้ว" label with a small restore link (D-74 F13).
 * - HelpNote: the grey "?" note under a list.
 * - ToggleChip: a pill that toggles; selected = thick edge plus a check.
 * - ConfirmSheet: the delete confirmation (mockup 7, 12).
 * - HeaderButton: the round outlined "แก้" at the top right.
 * - Stepper: [−] value [+] (mockup 3, 13).
 * - useWrite / SaveFailed: one write at a time, and a failed one is said
 *   out loud while the form keeps what was typed.
 */

import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Children, Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { formatThaiDate, type MasterState } from '../../core/master';
import { useI18n, useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import {
  AppText,
  BottomSheet,
  Button,
  cardStyle,
  Check,
  CTA,
  FieldError,
  Minus,
  PinnedActions,
  Plus,
  ScreenHeader,
  TrashIcon,
  Undo,
  type TileTone,
} from '../../ui';

/** The master data folded from the log; `null` until the first read. */
export function useMaster(): { state: MasterState | null; reload: () => void } {
  const [state, setState] = useState<MasterState | null>(null);
  const reload = useCallback(() => {
    peopleStore.state().then(setState, (err) => {
      console.error('Farm data could not be read.', err);
    });
  }, []);
  useEffect(reload, [reload]);
  useFocusEffect(reload);
  return { state, reload };
}

/**
 * False while hydrating a static page, true otherwise. A dynamic route's static page
 * is rendered once, at export, for the pattern (`/v2/person/[id]`), so the
 * first client render must match that neutral shell before it reads the real
 * id — otherwise React fails to hydrate (minified error 418).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
const noSubscribe = () => () => undefined;

/**
 * One write at a time, and never a silent failure. `run` resolves true when
 * the write landed. When it throws (storage quota, IndexedDB errors) the
 * error is logged, `failed` turns on so the screen can say so, and `run`
 * resolves false so the caller keeps the form as typed.
 */
export function useWrite(): { run: (fn: () => Promise<unknown>) => Promise<boolean>; failed: boolean } {
  const busy = useRef(false);
  const [failed, setFailed] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    if (busy.current) return false;
    busy.current = true;
    setFailed(false);
    try {
      await fn();
      return true;
    } catch (err) {
      console.error('Farm data could not be saved.', err);
      setFailed(true);
      return false;
    } finally {
      busy.current = false;
    }
  }, []);
  return { run, failed };
}

/** "บันทึกไม่สำเร็จ ลองอีกครั้ง" — the last write did not land. */
export function SaveFailed({ show }: { show: boolean }) {
  const msg = useT();
  return show ? <FieldError testID="save-failed">{msg('v2f.saveFailed')}</FieldError> : null;
}

/** Pop to where the user came from; a cold open (deep link) lands on `fallback`. */
export function useBack(fallback: Href): () => void {
  const router = useRouter();
  return useCallback(() => (router.canGoBack() ? router.back() : router.replace(fallback)), [router, fallback]);
}

/** An ISO day as the app shows dates: พ.ศ. unless switched (D-74 F14). */
export function useDay(): (iso: string) => string {
  const { era } = useI18n();
  return useCallback((iso: string) => formatThaiDate(Date.parse(`${iso}T12:00:00+07:00`), era), [era]);
}

export function FarmScreen({
  title,
  subtitle,
  fallback,
  right,
  children,
  footer,
  overlay,
  failed,
  testID,
}: {
  title: string;
  subtitle?: string;
  /** Where Back lands when there is nothing to pop. */
  fallback: Href;
  right?: ReactNode;
  children?: ReactNode;
  /** Pinned call to action(s) under the scroll body. */
  footer?: ReactNode;
  /** A sheet over the screen. */
  overlay?: ReactNode;
  /** The last write failed: said just above the pinned actions. */
  failed?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const back = useBack(fallback);
  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={title} subtitle={subtitle} back={{ label: msg('v2.back'), onPress: back, testID: 'v2-back' }} sync={sync} right={right} />
      <ScrollView testID={testID} contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.xl }}>
        {children}
      </ScrollView>
      {failed ? (
        <View style={{ paddingHorizontal: t.layout.screenPaddingX, paddingTop: t.space.sm }}>
          <SaveFailed show />
        </View>
      ) : null}
      {footer ? <PinnedActions>{footer}</PinnedActions> : null}
      {overlay}
    </View>
  );
}

/** One card of rows, split by hairlines. */
export function RowCard({ children, testID, title }: { children: ReactNode; testID?: string; title?: string }) {
  const t = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View testID={testID} style={{ ...cardStyle(t), paddingHorizontal: t.space.md, paddingVertical: title ? t.space.sm : 0 }}>
      {title ? <AppText variant="label">{title}</AppText> : null}
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={{ height: t.border.hair, backgroundColor: t.color.ruleFaint }} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** A small underlined link with a bin: "ที่ลบแล้ว (n)". */
export function DeletedLink({ n, onPress }: { n: number; onPress: () => void }) {
  const t = useTheme();
  const msg = useT();
  if (n === 0) return null;
  return (
    <Pressable
      testID="show-deleted"
      accessibilityRole="button"
      onPress={onPress}
      style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.xs, alignSelf: 'flex-start' }}
    >
      <TrashIcon color={t.color.ink} size={14} />
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: t.color.ink, textDecorationLine: 'underline' }}>
        {msg('peopleList.deletedLink', { n })}
      </Text>
    </Pressable>
  );
}

/** Deleted records: the name, a large "ลบแล้ว" label and a small restore link (D-74 F13). */
export function DeletedList({
  rows,
  onRestore,
}: {
  rows: readonly { id: string; name: string; facts?: readonly string[] }[];
  onRestore: (id: string) => void;
}) {
  const t = useTheme();
  const msg = useT();
  return (
    <RowCard testID="deleted-list">
      {rows.map((r) => (
        <View key={r.id} testID={`deleted-${r.id}`} style={{ paddingVertical: t.space.sm, gap: t.space.xs }}>
          <AppText style={{ fontWeight: t.font.weight.semibold }}>{r.name}</AppText>
          {r.facts?.map((f) => (
            <AppText key={f} variant="bodySm">
              {f}
            </AppText>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space.xs,
                backgroundColor: t.color.rejectSunk,
                borderRadius: t.radius.sm,
                paddingHorizontal: t.space.sm,
                paddingVertical: t.space.xs,
              }}
            >
              <TrashIcon color={t.color.reject} size={16} />
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.reject }}>
                {msg('peopleList.deletedBadge')}
              </Text>
            </View>
            <Pressable
              testID={`restore-${r.id}`}
              accessibilityRole="button"
              onPress={() => onRestore(r.id)}
              style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}
            >
              <Undo color={t.color.action} size={12} />
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, color: t.color.action, textDecorationLine: 'underline' }}>
                {msg('peopleList.restore')}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </RowCard>
  );
}

/** The grey "?" note: an optional bold first line, then plain lines. */
export function HelpNote({ title, lines, testID }: { title?: string; lines: readonly string[]; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{ flexDirection: 'row', gap: t.space.md, backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.md, padding: t.space.md }}
    >
      <Text aria-hidden style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: t.color.inkSoft }}>
        ?
      </Text>
      <View style={{ flex: 1, gap: t.space.xxs }}>
        {title ? <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.bodyMd }}>{title}</AppText> : null}
        {lines.map((l) => (
          <AppText key={l} variant="bodySm">
            {l}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/** A pill that toggles (filters, roles); selected = thick action edge, and a check when `check`. */
export function ToggleChip({
  label,
  on,
  onPress,
  testID,
  check,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  testID?: string;
  check?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      aria-pressed={on}
      onPress={onPress}
      style={{
        minHeight: t.target.min,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs,
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.pill,
        borderWidth: on ? t.border.thick : t.border.hair,
        borderColor: on ? t.color.action : t.color.ruleStrong,
        backgroundColor: on && check ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      {on && check ? <Check color={t.color.action} size={12} /> : null}
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: on ? t.font.weight.bold : t.font.weight.semibold, color: t.color.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Pills fill the row before wrapping (D-74 F4). */
export function ChipWrap({ children, testID }: { children: ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
      {children}
    </View>
  );
}

/** The round outlined action at the header's right ("แก้", "แก้ชื่อ"). */
export function HeaderButton({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <Button testID={testID} onPress={onPress}>
      {label}
    </Button>
  );
}

/**
 * A delete confirmation (mockup 7, 12): title, an optional red warning box,
 * soft lines with the last one bold, then cancel / the red action.
 */
export function ConfirmSheet({
  open,
  title,
  warning,
  lines,
  confirmLabel,
  onConfirm,
  onClose,
  failed,
  testID = 'delete-confirm',
}: {
  open: boolean;
  title: string;
  warning?: { title: string; lines: readonly string[] } | null;
  lines: readonly string[];
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  /** The delete did not land: say so, and stay open. */
  failed?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  return (
    <BottomSheet open={open} onClose={onClose} title={title} testID={testID}>
      {warning ? (
        <View testID="delete-warning" style={{ flexDirection: 'row', gap: t.space.sm, backgroundColor: t.color.rejectSunk, borderRadius: t.radius.md, padding: t.space.md }}>
          <View aria-hidden style={{ width: 10, height: 10, marginTop: 6, backgroundColor: t.color.reject, transform: [{ rotate: '45deg' }] }} />
          <View style={{ flex: 1, gap: t.space.xxs }}>
            <AppText style={{ color: t.color.reject, fontWeight: t.font.weight.bold }}>{warning.title}</AppText>
            {warning.lines.map((l) => (
              <AppText key={l} style={{ color: t.color.reject }}>
                {l}
              </AppText>
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ gap: t.space.xxs }}>
        {lines.map((l, i) => (
          <AppText key={l} variant={i === lines.length - 1 ? 'body' : 'bodySm'} style={i === lines.length - 1 ? { fontWeight: t.font.weight.bold } : undefined}>
            {l}
          </AppText>
        ))}
      </View>
      <SaveFailed show={!!failed} />
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button testID={`${testID}-no`} onPress={onClose}>
            {msg('common.cancel')}
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button testID={`${testID}-yes`} variant="destructive" icon={(c) => <TrashIcon color={c} size={16} />} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

/** [−] value [+] — the mockup's stepper; the value box reads like an input. */
export function Stepper({
  value,
  unit,
  onLess,
  onMore,
  testID,
  label,
}: {
  value: string;
  unit?: string;
  onLess: () => void;
  onMore: () => void;
  testID: string;
  /** Names the two buttons for screen readers. */
  label: string;
}) {
  const t = useTheme();
  const msg = useT();
  const round = {
    width: t.target.min,
    height: t.target.min,
    borderRadius: t.radius.pill,
    borderWidth: t.border.hair,
    borderColor: t.color.ruleStrong,
    backgroundColor: t.color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
      <Pressable testID={`${testID}-less`} accessibilityRole="button" accessibilityLabel={`${msg('saleSettings.less')} ${label}`} onPress={onLess} style={round}>
        <Minus color={t.color.ink} size={16} />
      </Pressable>
      <View
        style={{
          flex: 1,
          minHeight: t.target.min,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: t.space.xs,
          paddingTop: t.space.sm,
          borderRadius: t.radius.md,
          borderWidth: t.border.hair,
          borderColor: t.color.ruleStrong,
          backgroundColor: t.color.surfaceRaised,
        }}
      >
        <Text testID={`${testID}-value`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
          {value}
        </Text>
        {unit ? <AppText variant="bodySm">{unit}</AppText> : null}
      </View>
      <Pressable testID={`${testID}-more`} accessibilityRole="button" accessibilityLabel={`${msg('saleSettings.more')} ${label}`} onPress={onMore} style={round}>
        <Plus color={t.color.ink} size={16} />
      </Pressable>
    </View>
  );
}

/** A big pinned "+ label" call to action. */
export function AddCTA({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <CTA testID={testID} icon={(c) => <Plus color={c} size={16} />} onPress={onPress}>
      {label}
    </CTA>
  );
}

/** Tile tones the mockup gives farms and tappers in turn (`t-cat1` …). */
const CATEGORIES: readonly TileTone[] = ['category1', 'category2', 'category5', 'category6', 'category3', 'category4'];

export function categoryTone(i: number): TileTone {
  return CATEGORIES[i % CATEGORIES.length];
}
