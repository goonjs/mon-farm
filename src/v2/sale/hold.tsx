/**
 * The hold-to-count stage (E04-S04, mockup `.stage`): press and hold for this
 * device's hold time (D-7, D-79) to record one basket; a progress line runs
 * along the bottom edge while held. Letting go early records nothing but the
 * attempt (`onEarly`, F-7). A screen reader's activate action, an AT click
 * on web and Enter/Space count once too, as a keyboard-style hold.
 *
 * The same hold backs the undo button (`HoldButton`, E04-S15).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, Text, View, type GestureResponderEvent } from 'react-native';

import { readCountMode, readHoldMs } from '../../store/hold-preference';
import { useTheme } from '../../theme';

/**
 * The hold itself, shared by the count stage and the undo button (E04-S15):
 * the same hold time, the same progress line, the same early-release and
 * screen-reader/keyboard rules.
 */
export function useHold({ onHold, onEarly, disabled, tap }: { onHold: (input: 'hold' | 'hold-kbd') => void; onEarly?: (heldMs: number) => void; disabled?: boolean; tap?: boolean }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [width] = useState(() => progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(0);
  const [held, setHeld] = useState(false);
  // The timer fires up to a second after the press: it must act on the latest render, and not at all once disabled.
  const latest = useRef({ onHold, disabled });
  useEffect(() => {
    latest.current = { onHold, disabled };
  });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    progress.stopAnimation();
    progress.setValue(0);
    setHeld(false);
  };
  /** A key press (Enter/Space on web) is a click, not a hold: counted once on press, never as an early release (review #8). */
  const isKey = (e?: GestureResponderEvent) => !!e && typeof (e.nativeEvent as { key?: unknown }).key === 'string';
  const pressIn = (e?: GestureResponderEvent) => {
    if (disabled || tap || isKey(e)) return;
    const ms = readHoldMs();
    started.current = Date.now();
    setHeld(true);
    Animated.timing(progress, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: false }).start();
    timer.current = setTimeout(() => {
      timer.current = null;
      stop();
      if (!latest.current.disabled) latest.current.onHold('hold');
    }, ms);
  };
  const pressOut = (e?: GestureResponderEvent) => {
    if (isKey(e) || !timer.current) return;
    const heldMs = Date.now() - started.current;
    stop();
    onEarly?.(heldMs);
  };

  // A click with no pointer behind it — a screen reader's activate or a key on
  // web (`detail` 0) — counts as a keyboard-style hold. A mouse or touch click
  // (`detail` ≥ 1) after a hold is already handled by the timer.
  const press = (e?: GestureResponderEvent) => {
    if (disabled) return;
    // This device counts by one tap (E04-S17): any click counts, a key or screen reader as a keyboard-style one.
    if (tap) return onHold(isKey(e) || (e?.nativeEvent as { detail?: unknown } | undefined)?.detail === 0 ? 'hold-kbd' : 'hold');
    const detail = (e?.nativeEvent as { detail?: unknown } | undefined)?.detail;
    if (detail === 0 || isKey(e)) onHold('hold-kbd');
  };

  return {
    held,
    width,
    pressableProps: {
      accessibilityActions: [{ name: 'activate' }],
      onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => {
        if (!disabled && e.nativeEvent.actionName === 'activate') onHold('hold-kbd');
      },
      onPressIn: pressIn,
      onPressOut: pressOut,
      onPress: press,
    },
  };
}

/** The progress line along the bottom edge, filling over the hold time. */
function HoldLine({ width, testID, height = 6 }: { width: ReturnType<typeof useHold>['width']; testID: string; height?: number }) {
  const t = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}>
      <Animated.View testID={testID} style={{ height, backgroundColor: t.color.action, width }} />
    </View>
  );
}

/** The message for the count stage: hold or tap, by this device's choice (E04-S17). */
export const countKey = () => (readCountMode() === 'tap' ? 'rec.tap' : 'rec.hold');

export function HoldStage({
  onHold,
  onEarly,
  disabled,
  children,
  label,
  testID = 'hold',
  minHeight = 120,
  fill,
}: {
  onHold: (input: 'hold' | 'hold-kbd') => void;
  onEarly?: (heldMs: number) => void;
  disabled?: boolean;
  children: ReactNode;
  /** The accessible name: what holding does. */
  label: string;
  testID?: string;
  minHeight?: number;
  /** Fill the space (public mode). */
  fill?: boolean;
}) {
  const t = useTheme();
  const { held, width, pressableProps } = useHold({ onHold, onEarly, disabled, tap: readCountMode() === 'tap' });

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...pressableProps}
      style={{
        flex: fill ? 1 : undefined,
        minHeight,
        borderRadius: fill ? 0 : t.radius.lg,
        borderWidth: fill ? 0 : t.border.thick,
        borderColor: held ? t.color.action : t.color.ruleStrong,
        backgroundColor: fill ? t.color.stage : t.color.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.space.xs,
        padding: t.space.md,
        overflow: 'hidden',
      }}
    >
      {children}
      <HoldLine width={width} testID={`${testID}-progress`} />
    </Pressable>
  );
}

/**
 * A tool button that works only on a full hold (the undo button, E04-S15).
 * A tap or an early release does nothing; the progress line is the stage's.
 */
export function HoldButton({
  onHold,
  disabled,
  label,
  a11yLabel,
  hint,
  icon,
  testID,
}: {
  /** `hold-kbd` = a key or screen-reader activate, with no hold behind it: the caller may ask first. */
  onHold: (input: 'hold' | 'hold-kbd') => void;
  disabled?: boolean;
  label: string;
  /** The accessible name when it should say more than the label ("undo basket 22, hold"). */
  a11yLabel?: string;
  /** What to do under the label ("กดค้าง · เข่ง 22"). */
  hint: string;
  icon: (color: string) => ReactNode;
  testID: string;
}) {
  const t = useTheme();
  const { held, width, pressableProps } = useHold({ onHold, disabled });
  const ink = disabled ? t.color.disabledInk : t.color.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...pressableProps}
      style={{
        flex: 1,
        // Three lines (icon, name, "hold") — the row stretches the other tools to match.
        minHeight: 72,
        paddingVertical: t.space.xs,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderRadius: t.radius.md,
        borderWidth: t.border.hair,
        borderColor: held ? t.color.action : t.color.ruleStrong,
        borderStyle: disabled ? 'dashed' : 'solid',
        backgroundColor: t.color.surfaceRaised,
        overflow: 'hidden',
      }}
    >
      {icon(ink)}
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.semibold, color: ink }}>{label}</Text>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, color: disabled ? t.color.disabledInk : t.color.inkSoft }}>{hint}</Text>
      <HoldLine width={width} testID={`${testID}-progress`} height={4} />
    </Pressable>
  );
}
