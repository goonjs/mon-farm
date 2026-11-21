/**
 * Choice tiles (E01-S25, mockup docs/ux/mockups/flow-choice-tiles.html §1).
 * The owner banned near-round pills as choices (AGENTS.md, widened
 * 2026-11-18), so every pick in the app is one of these:
 *
 * - A `fill`  — equal rounded tile; picked = navy fill, white text.
 * - I `mark`  — like A, content on the left, a radio ring that is always
 *               there; picked = ring filled with ✓ in the `tone` colour.
 * - F `check` — a tick box on the left; picked = box filled with ✓.
 *               `multi` makes it a checkbox, otherwise it picks one.
 * - E `ValueBox` — a small heading, the value in bold and ▾; the caller
 *               opens a sheet or a page.
 * - `QuickLinks` — several text links on one line (date quick picks,
 *               owner 2026-11-21).
 *
 * The edge is 2 in every state and the mark is always drawn, so a tile never
 * changes size when it is picked. Picking another switches at once; tapping
 * the picked one keeps it. Colour is never the only cue (✓ + selected).
 */

import { Children, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CHIP_MIN_WIDTH } from './chip-width';
import { Check, ChevronRight } from './icons';
import { useTheme, type Theme } from '../theme';

export type ChoiceTone = 'action' | 'accept' | 'warn' | 'reject';
export type ChoiceKind = 'fill' | 'mark' | 'check';

const MARK = 22;

function toneColours(t: Theme, tone: ChoiceTone) {
  const c = t.color;
  switch (tone) {
    case 'accept':
      return { tone: c.accept, sunk: c.acceptSunk };
    case 'warn':
      return { tone: c.warn, sunk: c.warnSunk };
    case 'reject':
      return { tone: c.reject, sunk: c.rejectSunk };
    default:
      return { tone: c.action, sunk: c.actionSunk };
  }
}

export function ChoiceTile({
  label,
  detail,
  selected = false,
  onPress,
  kind = 'fill',
  tone = 'action',
  multi,
  dashed,
  disabled,
  testID,
}: {
  label: string;
  /** A second, smaller line ("2 คน"). */
  detail?: string;
  selected?: boolean;
  onPress: () => void;
  kind?: ChoiceKind;
  /** Style I only: the colour of the picked tile and its ✓. */
  tone?: ChoiceTone;
  /** Style F only: a checkbox that toggles, instead of a pick-one. */
  multi?: boolean;
  /** "+ คนอื่น": an add button drawn as a dashed tile, never a choice. */
  dashed?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const c = t.color;
  const { tone: tc, sunk } = toneColours(t, kind === 'mark' ? tone : 'action');
  const on = selected && !dashed;
  const isCheckbox = kind === 'check' && multi;
  const role = dashed ? 'button' : isCheckbox ? 'checkbox' : 'radio';
  const press = () => {
    if (disabled) return;
    if (on && !isCheckbox) return; // tapping the picked one keeps it
    onPress();
  };
  const left = kind !== 'fill' && !dashed;
  const bg = disabled ? c.surfaceSunk : on ? (kind === 'fill' ? c.action : sunk) : c.surfaceRaised;
  const edge = on ? tc : dashed ? c.action : c.ruleStrong;
  const ink = disabled ? c.inkFaint : on ? (kind === 'fill' ? c.inkInverse : kind === 'mark' ? tc : c.action) : dashed ? c.action : c.ink;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityState={isCheckbox ? { checked: on, disabled: !!disabled } : { selected: on, disabled: !!disabled }}
      // react-native-web reads aria-* only.
      aria-checked={isCheckbox ? on : undefined}
      aria-selected={!isCheckbox && !dashed ? on : undefined}
      accessibilityLabel={detail ? `${label} ${detail}` : label}
      disabled={disabled}
      onPress={press}
      style={{
        flex: 1,
        minHeight: t.target.min,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: left ? 'flex-start' : 'center',
        gap: t.space.sm,
        paddingHorizontal: left ? t.space.sm + 2 : t.space.sm,
        paddingVertical: t.space.xs,
        borderRadius: t.radius.md,
        borderWidth: t.border.thick,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: edge,
        backgroundColor: bg,
      }}
    >
      {left ? (
        <View
          testID={testID ? `${testID}-mark` : undefined}
          aria-hidden
          style={{
            width: MARK,
            height: MARK,
            borderRadius: kind === 'mark' ? t.radius.pill : 6,
            borderWidth: t.border.thick,
            borderColor: on ? tc : c.ruleStrong,
            backgroundColor: on ? tc : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {on ? <TickMark testID={testID ? `${testID}-tick` : undefined} color={c.inkInverse} /> : null}
        </View>
      ) : null}
      <View style={{ flexShrink: 1, alignItems: left ? 'flex-start' : 'center' }}>
        <Text
          style={{
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.bodyMd,
            fontWeight: t.font.weight.bold,
            color: ink,
            textAlign: left ? 'left' : 'center',
          }}
        >
          {label}
        </Text>
        {detail ? (
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: on && kind === 'fill' ? c.inkInverse : c.inkSoft, textAlign: left ? 'left' : 'center' }}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A ✓; its colour also sits on the wrapper (no border drawn) so a test can read it. */
function TickMark({ color, testID }: { color: string; testID?: string }) {
  return (
    <View testID={testID} aria-hidden style={{ borderColor: color, borderWidth: 0 }}>
      <Check color={color} size={14} />
    </View>
  );
}

/**
 * Lays tiles out `columns` to a row, every tile the same width; a short last
 * row is padded with empty cells so its tiles keep that width.
 */
export function TileGrid({ columns = 2, children, testID }: { columns?: number; children: ReactNode; testID?: string }) {
  const t = useTheme();
  const items = Children.toArray(children).filter(Boolean);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View testID={testID} style={{ gap: t.space.sm }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'stretch' }}>
          {row}
          {Array.from({ length: columns - row.length }, (_, k) => (
            <View key={`s${k}`} testID={testID ? `${testID}-spacer` : undefined} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Pick-one tiles from a list of values; each tile is `${testID}-${value}`. */
export function ChoiceTiles<T extends string>({
  options,
  value,
  onChange,
  kind = 'fill',
  tone,
  columns,
  testID,
}: {
  options: readonly { value: T; label: string; detail?: string; disabled?: boolean }[];
  value: T | null;
  onChange: (v: T) => void;
  kind?: ChoiceKind;
  tone?: ChoiceTone;
  /** Default: as many as fit up to 3 (4 for four short options). */
  columns?: number;
  testID: string;
}) {
  const cols = columns ?? (options.length === 4 ? 2 : Math.min(3, Math.max(2, options.length)));
  return (
    <TileGrid columns={cols} testID={testID}>
      {options.map((o) => (
        <ChoiceTile
          key={o.value}
          testID={`${testID}-${o.value}`}
          label={o.label}
          detail={o.detail}
          kind={kind}
          tone={tone}
          disabled={o.disabled}
          selected={value === o.value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </TileGrid>
  );
}

/** Style E: a filter value box that opens a sheet or page (the caller's `onPress`). */
export function ValueBox({ label, value, set, onPress, testID }: { label: string; value: string; set?: boolean; onPress: () => void; testID?: string }) {
  const t = useTheme();
  const c = t.color;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: t.target.min + 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs,
        paddingLeft: t.space.md,
        paddingRight: t.space.sm,
        paddingVertical: t.space.xs,
        borderRadius: t.radius.md,
        borderWidth: t.border.thick,
        borderColor: set ? c.action : c.ruleStrong,
        backgroundColor: set ? c.actionSunk : c.surfaceRaised,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.semibold, color: c.inkSoft }}>{label}</Text>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: c.ink }}>{value}</Text>
      </View>
      <View aria-hidden style={{ transform: [{ rotate: '90deg' }] }}>
        <ChevronRight color={c.action} size={14} />
      </View>
    </Pressable>
  );
}

/**
 * Several picks as text links on one line (owner 2026-11-21: "เลือกวัน
 * ให่ใช้อันที่มีหลายอันในบรรทัดเดียวได้ เช่น text link"). Not picked =
 * underlined action link; picked = ink, bold, ✓ before it, no underline
 * (team detail, mockup p7-after). A link wraps to the next line whole.
 */
export function QuickLinks<K extends string>({
  options,
  value,
  onPick,
  testID,
  groupTestID = testID,
}: {
  options: readonly { id: K; label: string; disabled?: boolean }[];
  value: K | null;
  onPick: (id: K) => void;
  /** Each link is `${testID}-${id}`. */
  testID: string;
  /** The line itself, when `testID` is already the owner's id. */
  groupTestID?: string;
}) {
  const t = useTheme();
  const c = t.color;
  return (
    <View testID={groupTestID} accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: t.space.lg }}>
      {options.map((o) => {
        const on = value === o.id;
        const off = !!o.disabled;
        return (
          <Pressable
            key={o.id}
            testID={`${testID}-${o.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: off }}
            aria-selected={on}
            disabled={off}
            onPress={() => {
              if (!on && !off) onPick(o.id);
            }}
            style={{ minHeight: t.target.min, minWidth: CHIP_MIN_WIDTH, flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}
          >
            {on ? <TickMark testID={`${testID}-${o.id}-tick`} color={c.action} /> : null}
            <Text
              style={{
                fontFamily: t.font.family.sans,
                fontSize: t.font.size.bodyMd,
                fontWeight: on ? t.font.weight.bold : t.font.weight.semibold,
                color: off ? c.inkFaint : on ? c.ink : c.action,
                textDecorationLine: on || off ? 'none' : 'underline',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
