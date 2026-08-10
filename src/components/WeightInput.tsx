/**
 * The three-way weight input from finding F-22: one value, three simultaneous
 * ways to set it — drag a track, tap ± buttons, or type a number directly.
 * All three stay in sync with the same underlying value; none is "the real"
 * one to the exclusion of the others.
 *
 * No slider package is installed for this — `PanResponder` is core React
 * Native, and a package add is outside what's authorized without a specific
 * ask. The track below is a minimal drag surface built on it.
 *
 * Typed values are NOT snapped to the drag/button step: a operator who knows
 * the scale reads 43.2 kg should be able to type exactly that, even though
 * dragging or nudging moves in 0.5 kg increments.
 */

import { useState } from 'react';
import { PanResponder, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';

import { Button } from './chrome';
import { useTheme } from '../theme';

export interface WeightInputProps {
  testID?: string;
  label: string;
  /** Current value, in grams. */
  valueG: number;
  minG: number;
  maxG: number;
  /** Step for the track and ± buttons, in grams. Typed input ignores this. */
  stepG?: number;
  onChange: (g: number) => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const kg = (g: number) => (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

export function WeightInput({ testID = 'weight-input', label, valueG, minG, maxG, stepG = 500, onChange }: WeightInputProps) {
  const t = useTheme();
  const [text, setText] = useState(kg(valueG));
  const [trackWidth, setTrackWidth] = useState(0);
  const range = Math.max(1, maxG - minG);

  // The text field shows whatever was last set by ANY of the three inputs, but
  // only re-derives from `valueG` when it wasn't the text field itself that
  // just changed — otherwise every keystroke would be immediately overwritten
  // by its own round-trip through the parent.
  //
  // This is React's own sanctioned "adjust state during render" pattern
  // (calling setState conditionally in the render body), not a ref: React
  // Compiler forbids reading or writing a ref's `.current` during render,
  // which the previous version of this component did. `commit()` below keeps
  // `prevValueG` in sync from the event-handler side, so the check here only
  // ever fires for a genuinely external change.
  const [prevValueG, setPrevValueG] = useState(valueG);
  if (valueG !== prevValueG) {
    setPrevValueG(valueG);
    setText(kg(valueG));
  }

  /**
   * `fromText` distinguishes the text field's own edits from every other
   * source (±, drag). Both must update `prevValueG` (so the render-time sync
   * above doesn't fight them), but only non-text sources should reformat
   * `text` — doing it unconditionally would strip a trailing "." the moment
   * someone types "43." mid-number. The reverse bug (±/drag never reaching
   * the text field at all) is exactly what this function existed without
   * catching before the short-basket e2e test caught it: `commit` updated
   * `prevValueG` but never `text`, so only the typed field's own handler
   * happened to keep itself in sync — the other two inputs silently stopped
   * being three-way.
   */
  const commit = (g: number, fromText = false) => {
    const clamped = clamp(g, minG, maxG);
    setPrevValueG(clamped);
    if (!fromText) setText(kg(clamped));
    onChange(clamped);
  };

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  // Recreated every render rather than cached in a ref — PanResponder.create
  // is a plain factory call, not a hook, so there is no rules-of-hooks reason
  // to avoid calling it here, and doing so keeps its handlers closed over the
  // current `trackWidth`/`commit` without any memoisation bookkeeping.
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt) => {
      if (trackWidth <= 0) return;
      const pct = clamp(evt.nativeEvent.locationX / trackWidth, 0, 1);
      const raw = minG + pct * range;
      const stepped = Math.round(raw / stepG) * stepG;
      commit(stepped);
    },
  });

  const pct = clamp((valueG - minG) / range, 0, 1);

  return (
    <View testID={testID} style={{ gap: t.space.sm }}>
      <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, letterSpacing: t.font.tracking.wide, color: t.color.inkSoft }}>
        {label}
      </Text>

      <View
        testID={`${testID}-track`}
        onLayout={onLayout}
        {...panResponder.panHandlers}
        style={{ height: 32, justifyContent: 'center' }}
      >
        <View style={{ height: 6, borderRadius: t.radius.pill, backgroundColor: t.color.surfaceSunk }} />
        <View
          testID={`${testID}-thumb`}
          style={{
            position: 'absolute',
            left: `${pct * 100}%`,
            marginLeft: -10,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: t.color.action,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <Button testID={`${testID}-minus`} onPress={() => commit(valueG - stepG)}>
          −
        </Button>
        <TextInput
          testID={`${testID}-typed`}
          value={text}
          onChangeText={(v) => {
            setText(v);
            const parsed = Number(v);
            if (Number.isFinite(parsed)) commit(Math.round(parsed * 1000), true);
          }}
          keyboardType="decimal-pad"
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.lead,
            fontWeight: t.font.weight.bold,
            minHeight: 40,
            paddingHorizontal: t.space.sm,
            borderWidth: t.border.hair,
            borderColor: t.color.ruleStrong,
            borderRadius: t.radius.sm,
            backgroundColor: t.color.surfaceRaised,
            color: t.color.ink,
          }}
        />
        <Button testID={`${testID}-plus`} onPress={() => commit(valueG + stepG)}>
          +
        </Button>
      </View>
    </View>
  );
}
