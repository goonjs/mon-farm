/**
 * DatePickerSheet (E11-S11 FO-8) — a bottom sheet with quick picks (วันนี้ / เมื่อวาน / 2 วันก่อน) and a month
 * calendar in the user's era (พ.ศ. by default). No dependency. Selecting only changes the sheet's draft; the CTA
 * commits it, closing any other way cancels. "Today" comes from `todayIso()` so tests can control the clock.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from './bottom-sheet';
import { CTA } from './button';
import { Check, ChevronLeft, ChevronRight } from './icons';
import { useI18n, type MessageId } from '../i18n';
import { isIsoDate, todayIso } from '../core/finance/money';
import { useTheme } from '../theme';

export interface DatePickerSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** ISO "YYYY-MM-DD". */
  readonly value: string;
  readonly onChange: (iso: string) => void;
  readonly title?: string;
  /** Days after this ISO date are disabled (e.g. today, for a bought order). Absent = no limit. */
  readonly max?: string;
  readonly testID?: string;
}

const p2 = (n: number) => String(n).padStart(2, '0');
export const toIso = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`;

/** Days in month `m` (1–12) of year `y`; leap years right. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, for day `d` of month `m`. */
export function weekdayOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Month shifted by `delta` (rolls over the year). */
export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Weeks of the month, Sunday-first; `null` pads the leading/trailing blanks. */
export function monthGrid(y: number, m: number): (number | null)[][] {
  const cells: (number | null)[] = Array.from({ length: weekdayOf(y, m, 1) }, () => null);
  for (let d = 1; d <= daysInMonth(y, m); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const MONTH_KEYS = Array.from({ length: 12 }, (_, i) => `datepick.monthName${i + 1}` as MessageId);
const SHORT_MONTH_KEYS = Array.from({ length: 12 }, (_, i) => `date.month${i + 1}` as MessageId);
const WEEKDAY_KEYS = ['datepick.wd0', 'datepick.wd1', 'datepick.wd2', 'datepick.wd3', 'datepick.wd4', 'datepick.wd5', 'datepick.wd6'] as const;

function Body({ onClose, value, onChange, max, testID: tid }: Omit<DatePickerSheetProps, 'open' | 'title' | 'testID'> & { testID: string }) {
  const t = useTheme();
  const { t: msg, era } = useI18n();
  const today = todayIso();
  const start = isIsoDate(value) ? value : today;
  const [draft, setDraft] = useState(start);
  const [view, setView] = useState(() => {
    const [y, m] = start.split('-').map(Number);
    return { y, m };
  });
  const yearOf = (y: number) => (era === 'be' ? y + 543 : y);
  const beyond = (iso: string) => max !== undefined && iso > max;

  const pick = (iso: string) => {
    if (beyond(iso)) return;
    setDraft(iso);
    const [y, m] = iso.split('-').map(Number);
    setView({ y, m });
  };

  const [dy, dm, dd] = draft.split('-').map(Number);
  const dayLabel = (y: number, m: number, d: number) => ({
    weekday: msg(WEEKDAY_KEYS[weekdayOf(y, m, d)]),
    day: d,
    month: msg(SHORT_MONTH_KEYS[m - 1]),
    year: yearOf(y),
  });
  const done = dayLabel(dy, dm, dd);

  const quick = [
    { id: 'today', iso: today, label: msg('datepick.today') },
    { id: 'yesterday', iso: addDays(today, -1), label: msg('datepick.yesterday') },
    { id: 'twodays', iso: addDays(today, -2), label: msg('datepick.twoDaysAgo') },
  ];

  const nav = (id: 'prev' | 'next', delta: number) => (
    <Pressable
      testID={`${tid}-${id}`}
      accessibilityRole="button"
      accessibilityLabel={msg(id === 'prev' ? 'datepick.prev' : 'datepick.next')}
      onPress={() => setView((v) => shiftMonth(v.y, v.m, delta))}
      style={{
        width: t.target.min,
        height: t.target.min,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.surfaceSunk,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {id === 'prev' ? <ChevronLeft color={t.color.ink} size={16} /> : <ChevronRight color={t.color.ink} size={16} />}
    </Pressable>
  );

  const text = { fontFamily: t.font.family.sans, fontVariant: ['tabular-nums' as const] };

  return (
    <>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        {quick.map((q) => {
          const sel = draft === q.iso;
          const off = beyond(q.iso);
          return (
            <Pressable
              key={q.id}
              testID={`${tid}-${q.id === 'twodays' ? 'twodays' : q.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: sel, disabled: off }}
              disabled={off}
              onPress={() => pick(q.iso)}
              style={{
                minHeight: t.target.min,
                paddingHorizontal: t.space.md,
                borderRadius: t.radius.pill,
                borderWidth: t.border.thick,
                borderColor: off ? t.color.rule : sel ? t.color.action : t.color.ruleStrong,
                backgroundColor: sel ? t.color.action : t.color.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  ...text,
                  fontSize: t.font.size.bodyMd,
                  fontWeight: t.font.weight.bold,
                  color: off ? t.color.inkFaint : sel ? t.color.inkInverse : t.color.ink,
                }}
              >
                {q.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          borderWidth: t.border.hair,
          borderColor: t.color.rule,
          borderRadius: t.radius.lg,
          backgroundColor: t.color.surface,
          padding: t.space.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {nav('prev', -1)}
          <Text
            testID={`${tid}-month`}
            accessibilityRole="header"
            style={{ ...text, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}
          >
            {msg(MONTH_KEYS[view.m - 1])} {yearOf(view.y)}
          </Text>
          {nav('next', 1)}
        </View>
        <View style={{ flexDirection: 'row', marginTop: t.space.xs }} aria-hidden>
          {WEEKDAY_KEYS.map((k) => (
            <Text
              key={k}
              style={{ ...text, flex: 1, textAlign: 'center', fontSize: t.font.size.bodySm, color: t.color.inkSoft }}
            >
              {msg(k)}
            </Text>
          ))}
        </View>
        {monthGrid(view.y, view.m).map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((d, di) => {
              if (d === null) return <View key={di} style={{ flex: 1, height: 48 }} />;
              const iso = toIso(view.y, view.m, d);
              const sel = iso === draft;
              const off = beyond(iso);
              const isToday = iso === today;
              return (
                <View key={di} style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable
                    testID={`${tid}-day-${iso}`}
                    accessibilityRole="button"
                    accessibilityLabel={msg('datepick.dayA11y', dayLabel(view.y, view.m, d))}
                    accessibilityState={{ selected: sel, disabled: off }}
                    disabled={off}
                    onPress={() => pick(iso)}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: t.radius.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: sel ? t.color.action : 'transparent',
                      borderWidth: isToday && !sel ? t.border.thick : 0,
                      borderColor: t.color.action,
                    }}
                  >
                    <Text
                      style={{
                        ...text,
                        fontSize: t.font.size.bodyLg,
                        fontWeight: sel || isToday ? t.font.weight.bold : t.font.weight.semibold,
                        color: sel ? t.color.inkInverse : off ? t.color.inkFaint : t.color.ink,
                      }}
                    >
                      {d}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <CTA
        testID={`${tid}-done`}
        icon={(c) => <Check color={c} />}
        onPress={() => {
          onChange(draft);
          onClose();
        }}
      >
        {msg('datepick.done', { ...done, weekday: `${done.weekday}.` })}
      </CTA>
    </>
  );
}

export function DatePickerSheet({ open, onClose, value, onChange, title, max, testID = 'date-picker' }: DatePickerSheetProps) {
  const { t: msg } = useI18n();
  return (
    <BottomSheet open={open} onClose={onClose} title={title ?? msg('datepick.title')} testID={testID}>
      <Body testID={testID} onClose={onClose} value={value} onChange={onChange} max={max} />
    </BottomSheet>
  );
}
