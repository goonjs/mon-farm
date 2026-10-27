/**
 * NumberPad (E11-S11 UI-2): the on-screen number keys of QuantityField and
 * MoneyField — no OS keyboard, no steppers. `int`: 3x4 grid with ⌫ and a ✓
 * key. `money`: four columns (1 2 3 ⌫ / 4 5 6 . / 7 8 9 00 / 0 000) and no ✓,
 * the caller shows a "ตกลง" button. Keys are ≥ 56 tall with tabular numerals.
 * On web the hardware keyboard works too while the pad is mounted.
 */

import { useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Check } from './icons';
import type { EntryKey } from '../core/number-entry';
import { useT, type MessageId } from '../i18n';
import { useTheme } from '../theme';

export type PadVariant = 'int' | 'money';

type Cell = { id: EntryKey | 'done'; glyph: string; span?: number; quiet?: boolean };

const d = (n: number): Cell => ({ id: String(n) as EntryKey, glyph: String(n) });

const INT_ROWS: Cell[][] = [
  [d(1), d(2), d(3)],
  [d(4), d(5), d(6)],
  [d(7), d(8), d(9)],
  [{ id: 'back', glyph: '⌫', quiet: true }, d(0), { id: 'done', glyph: '✓' }],
];

const MONEY_ROWS: Cell[][] = [
  [d(1), d(2), d(3), { id: 'back', glyph: '⌫', quiet: true }],
  [d(4), d(5), d(6), { id: '.', glyph: '.', quiet: true }],
  [d(7), d(8), d(9), { id: '00', glyph: '00', quiet: true }],
  [{ ...d(0), span: 3 }, { id: '000', glyph: '000', quiet: true }],
];

const LABEL: Partial<Record<Cell['id'], MessageId>> = {
  back: 'numpad.keyBack',
  '.': 'numpad.keyDot',
  '00': 'numpad.key00',
  '000': 'numpad.key000',
  done: 'numpad.keyDone',
};

/** Web hardware keyboard → pad key; null for anything else (shortcuts stay the browser's). */
export function keyFromKeyboard(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): EntryKey | 'done' | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (/^[0-9]$/.test(e.key)) return e.key as EntryKey;
  if (e.key === '.') return '.';
  if (e.key === 'Backspace') return 'back';
  if (e.key === 'Enter') return 'done';
  return null;
}

export function NumberPad({
  variant,
  onKey,
  onDone,
  doneDisabled,
  testID = 'numpad',
}: {
  variant: PadVariant;
  onKey: (k: EntryKey) => void;
  onDone: () => void;
  doneDisabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const msg = useT();
  const rows = variant === 'int' ? INT_ROWS : MONEY_ROWS;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onDown = (e: KeyboardEvent) => {
      const k = keyFromKeyboard(e);
      if (!k) return;
      if (k === '.' && variant === 'int') return;
      if (k === 'done') {
        if (!doneDisabled) onDone();
        return;
      }
      onKey(k);
    };
    document.addEventListener('keydown', onDown);
    return () => document.removeEventListener('keydown', onDown);
  }, [variant, onKey, onDone, doneDisabled]);

  return (
    <View testID={testID} style={{ gap: t.space.sm }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: t.space.sm }}>
          {row.map((c) => {
            const isDone = c.id === 'done';
            const disabled = isDone && !!doneDisabled;
            const fg = isDone ? t.color.inkInverse : c.quiet ? t.color.inkSoft : t.color.ink;
            const bg = disabled
              ? t.color.disabledFill
              : isDone
                ? t.color.action
                : c.quiet
                  ? t.color.surfaceSunk
                  : t.color.surfaceRaised;
            const labelId = LABEL[c.id];
            return (
              <Pressable
                key={c.id}
                testID={`${testID}-key-${c.id}`}
                accessibilityRole="button"
                accessibilityLabel={labelId ? msg(labelId) : c.glyph}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => (isDone ? onDone() : onKey(c.id as EntryKey))}
                style={{
                  flex: c.span ?? 1,
                  minHeight: t.target.comfortable,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: t.radius.lg,
                  borderWidth: t.border.hair,
                  borderColor: t.color.ruleFaint,
                  backgroundColor: bg,
                }}
              >
                {isDone ? (
                  <Check color={disabled ? t.color.disabledInk : fg} size={20} />
                ) : (
                  <Text
                    style={{
                      fontFamily: t.font.family.sans,
                      fontSize: c.quiet ? t.font.size.headingLg : t.font.size.title,
                      fontWeight: t.font.weight.bold,
                      fontVariant: ['tabular-nums'],
                      color: fg,
                    }}
                  >
                    {c.glyph}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
