/**
 * The hold-to-count stage (E04-S04, mockup `.stage`): press and hold for this
 * device's hold time (D-7, D-79) to record one basket; a progress line runs
 * along the bottom edge while held. Letting go early records nothing but the
 * attempt (`onEarly`, F-7). A screen reader's activate action, an AT click
 * on web and Enter/Space count once too, as a keyboard-style hold.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View, type GestureResponderEvent } from 'react-native';

import { readHoldMs } from '../../store/hold-preference';
import { useTheme } from '../../theme';

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
  const [progress] = useState(() => new Animated.Value(0));
  const [width] = useState(() => progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(0);
  const [held, setHeld] = useState(false);

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
    if (disabled || isKey(e)) return;
    const ms = readHoldMs();
    started.current = Date.now();
    setHeld(true);
    Animated.timing(progress, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: false }).start();
    timer.current = setTimeout(() => {
      timer.current = null;
      stop();
      onHold('hold');
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
    const detail = (e?.nativeEvent as { detail?: unknown } | undefined)?.detail;
    if (detail === 0 || isKey(e)) onHold('hold-kbd');
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => {
        if (!disabled && e.nativeEvent.actionName === 'activate') onHold('hold-kbd');
      }}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={press}
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
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 }}>
        <Animated.View
          testID={`${testID}-progress`}
          style={{ height: 6, backgroundColor: t.color.action, width }}
        />
      </View>
    </Pressable>
  );
}
