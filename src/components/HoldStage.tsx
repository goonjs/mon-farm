/**
 * The Public register: the count, the bezel, and nothing else.
 *
 * ── Two clocks, on purpose ──────────────────────────────────────────────────
 *
 * Completion is driven by setTimeout. The animation is driven by
 * requestAnimationFrame. They are deliberately separate.
 *
 * rAF is throttled in background tabs and stops entirely on screen lock. If the
 * hold's completion rode on the frame loop, a hold in progress when the screen
 * slept would behave unpredictably — and "unpredictably" here means a basket
 * that may or may not have been counted, which is the one outcome this product
 * cannot have. The timer decides; the frames only paint.
 *
 * ── Cancellation ────────────────────────────────────────────────────────────
 *
 * Bound to every way a hold can end, not just release. react-native-web does
 * not reliably fire onPressOut when the pointer leaves the element while held,
 * so a drag off the stage would otherwise leave the hold armed — and it would
 * complete, producing a phantom count nobody performed (finding F-6/F-7).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { Bezel } from './Bezel';
import { useTheme } from '../theme';

export interface HoldStageProps {
  count: number;
  /** Fired once, when a hold completes. */
  onCount: () => void;
  /** Fired when a hold ends early, with how long it lasted. */
  onReject: (heldMs: number) => void;
  /** Shown under the numeral — the operator register's expected reading. */
  caption: string;
  /** When false, the stage does not accept holds (pile not ready, sale closed). */
  enabled?: boolean;
  holdMs?: number;
  testID?: string;
}

export function HoldStage({
  count,
  onCount,
  onReject,
  caption,
  enabled = true,
  holdMs,
  testID = 'stage',
}: HoldStageProps) {
  const t = useTheme();
  const HOLD = holdMs ?? t.duration.hold;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [pct, setPct] = useState(0);
  /**
   * F-7: a rejection must be as loud as an acceptance and distinguishable from
   * it. A silently dropped hold turns a phantom count into a missed count, and
   * the person counting cannot tell which happened.
   */
  const [feedback, setFeedback] = useState<{ tone: 'accept' | 'reject'; text: string } | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  const holding = useRef(false);
  const stageEl = useRef<HTMLElement | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const rejected = feedback?.tone === 'reject';

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    holding.current = false;
  }, []);

  /**
   * True when the last known pointer position is inside the stage.
   *
   * This is the guard that actually works. Boundary events were tried first and
   * are not dependable here — see the note on the cancellation effect below —
   * so rather than relying on being *told* the pointer left, completion asks
   * where the pointer is.
   *
   * Stated as a rule: a hold counts only if the pointer is still on the stage
   * when the timer fires. That is the requirement in one line, and it holds
   * however the browser chooses to deliver its events.
   */
  const pointerIsOnStage = useCallback(() => {
    const p = lastPointer.current;
    const el = stageEl.current;
    if (!p || !el?.getBoundingClientRect) return true; // no evidence it left
    const r = el.getBoundingClientRect();
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  }, []);

  const complete = useCallback(() => {
    stop();
    if (!pointerIsOnStage()) {
      // The pointer was dragged off while held. Counting here would be a
      // basket nobody performed (F-6), so this is a rejection, loudly.
      setPct(0);
      const held = Date.now() - startedAt.current;
      setFeedback({ tone: 'reject', text: '✗ ไม่นับ · นิ้วเลื่อนออก · moved off the stage' });
      onReject(held);
      setTimeout(() => setFeedback(null), 1400);
      return;
    }
    setPct(1);
    onCount();
    setFeedback({ tone: 'accept', text: '✓ นับแล้ว · counted' });
    setTimeout(() => setPct(0), 260);
    setTimeout(() => setFeedback(null), 900);
  }, [onCount, onReject, pointerIsOnStage, stop]);

  const begin = useCallback(() => {
    if (!enabled || holding.current) return;
    holding.current = true;
    setFeedback(null);
    startedAt.current = Date.now();

    timer.current = setTimeout(complete, HOLD);

    const tick = () => {
      const elapsed = Date.now() - startedAt.current;
      setPct(Math.min(1, elapsed / HOLD));
      if (holding.current) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [HOLD, complete, enabled]);

  const cancel = useCallback(() => {
    if (!holding.current) return;
    const held = Date.now() - startedAt.current;
    stop();
    setPct(0);
    setFeedback({
      tone: 'reject',
      text: `✗ ไม่นับ · released early — ${(held / 1000).toFixed(1)} วิ`,
    });
    onReject(held);
    setTimeout(() => setFeedback(null), 1400);
  }, [onReject, stop]);

  // A hold must not survive unmount or the app going to the background.
  useEffect(() => stop, [stop]);

  /**
   * Cancellation on web, established by instrumenting the live page rather than
   * by assumption. Four approaches were tried; three are wrong in ways that
   * look right, so they are recorded here:
   *
   *   onPressOut      — fires immediately after onPressIn on a rapid re-press,
   *                     so a hold cancels itself. Observed directly: five fast
   *                     holds produced one count and four "released early —
   *                     0.0s" rejections. Removed entirely.
   *   onHoverOut      — does not fire while a button is held down.
   *   onPointerLeave  — the DOM event fires, but RNW's Pressable does not
   *                     forward the prop, so the handler never runs.
   *
   * What works is not asking to be told the pointer left, but asking where the
   * pointer is: `pointerIsOnStage()` at completion. Window-level listeners feed
   * it, because a move or release outside the stage never reaches the stage —
   * measured as pointerup: 0 on the element during a drag-off.
   */
  // Held in a ref so the window listeners below can be attached once and never
  // re-bound, while still calling the latest `cancel`. Updated in an effect
  // rather than during render: a ref written during render can leave the
  // listener holding a stale closure across a re-entrant render.
  const cancelRef = useRef(cancel);
  useEffect(() => {
    cancelRef.current = cancel;
  }, [cancel]);

  useEffect(() => {
    // Capability, not platform: jest-expo defines a `window` global that has no
    // DOM methods on it, so `typeof window !== 'undefined'` is not enough.
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    const onEnd = () => cancelRef.current();
    const onHide = () => {
      if (document.hidden) cancelRef.current();
    };
    // Window-level, because a release or a move outside the stage never reaches
    // the stage itself. Recording the position is what lets completion check
    // where the pointer is rather than trusting a boundary event to arrive.
    const onMove = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerdown', onMove, true);
    window.addEventListener('pointerup', onEnd);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerdown', onMove, true);
      window.removeEventListener('pointerup', onEnd);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  /**
   * Captures the DOM node so `pointerIsOnStage()` can measure it. A callback
   * ref rather than useRef + effect, so it is set the moment the node exists.
   *
   * No listener is bound here. A `pointerleave` listener was tried and fired
   * spuriously ~24ms into a press at the stage centre — react-native-web takes
   * pointer capture and the re-render on state change loses it, which the
   * browser reports as the pointer leaving. Position at completion is the
   * reliable signal; boundary events on this element are not.
   */
  const attachStage = useCallback((el: unknown) => {
    stageEl.current = (el as HTMLElement | null) ?? null;
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  };

  /**
   * Sized against the stage, not the device. See docs/ux/design-system.md §4:
   * the constraint is physical millimetres, so the numeral is a proportion of
   * the space it actually has. Never convert this to a fixed size.
   *
   * Height and width are both constraints, so take whichever binds. Hard-coded
   * per-digit steps were tried first and quietly under-sized three digits to
   * 0.589 of the viewport, below the 0.62 floor — deriving it means the floor
   * holds at any digit count without anyone remembering to add a step.
   */
  const digits = String(count).length;
  const byHeight = box.height * t.publicNumeral.stageHeightRatio;
  const byWidth = box.width / (t.publicNumeral.digitWidthEm * Math.max(1, digits));
  const fontSize = Math.max(24, Math.min(byHeight, byWidth));

  /**
   * The rotate hint (S19), and why it is a MEASUREMENT rather than an
   * orientation check.
   *
   * A phone's physical short edge is the same length whether it's held in
   * landscape or portrait — only which dimension of the viewport it maps to
   * changes. `minHeightRatio` was calibrated against that short edge (see
   * docs/ux/design-system.md §4), so comparing the achieved numeral size
   * against `min(windowWidth, windowHeight)` — not against orientation, not
   * against a hardcoded digit count — is what makes this condition true for
   * "a phone in portrait past two digits" and false for "a tablet in
   * portrait" or "two digits on a phone in portrait", without special-casing
   * any of those as their own rule. It is also honest under resize: rotate
   * the device and the hint appears or disappears based on what actually
   * changed, the physical legibility, not a label that says "portrait" and
   * stops being true the moment the constraint does.
   *
   * Never blocks. Someone mid-sale must not be stopped by a layout opinion —
   * see docs/ux/design-system.md §9 and the plan's rejected alternatives
   * (shrinking the numeral hides the F-14 accuracy problem; rotating the
   * glyph 90° produces a count nobody can agree on at a glance).
   */
  const shortDeviceDim = Math.min(windowWidth, windowHeight);
  /**
   * The ratio floor alone under-calls tablets: it computes ~0.54 for a
   * portrait tablet at three digits, below the 0.62 floor, even though the
   * real geometry there is ~85mm — past the 83mm "comfortable" target. That
   * is a density-class mismatch, not a legibility problem — see the note on
   * `minHeightRatio` in design/tokens.ts. A device past the tablet breakpoint
   * is treated as clearing the floor unconditionally.
   */
  const isTabletClass = shortDeviceDim >= t.publicNumeral.tabletBreakpointPx;
  const clearsLegibilityFloor =
    isTabletClass || fontSize / shortDeviceDim >= t.publicNumeral.minHeightRatio;

  return (
    <Pressable
      ref={attachStage}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="ตัวนับ กดค้างสามวินาทีเพื่อนับหนึ่งเข่ง. Counter, press and hold three seconds to count one basket."
      onLayout={onLayout}
      onPressIn={begin}
      /**
       * The load-bearing one, and it has to be onPointerMove rather than
       * anything simpler.
       *
       * React Native's Pressable cancels a press when the touch leaves its
       * press rect. react-native-web does not, so a pointer dragged off the
       * stage leaves the hold armed and it completes on its timer — a basket
       * counted that nobody performed. The e2e test caught exactly that.
       *
       * Neither `onHoverOut` nor `onPointerLeave` fixes it: RNW takes pointer
       * capture on press, and a captured pointer fires no boundary events at
       * all. So the position is checked directly against the stage box on every
       * move. Coordinates are relative to the target, so "outside" is simply
       * outside 0..width / 0..height.
       */
      onPointerMove={(e) => {
        if (!holding.current) return;
        const n = e.nativeEvent as unknown as Record<string, number | undefined>;
        const x = n.offsetX ?? n.locationX;
        const y = n.offsetY ?? n.locationY;
        if (x === undefined || y === undefined) return;
        if (x < 0 || y < 0 || x > box.width || y > box.height) cancel();
      }}
      disabled={!enabled}
      style={{
        flex: 1,
        backgroundColor: t.color.stage,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Bezel pct={pct} width={box.width} height={box.height} rejected={rejected} />

      {!clearsLegibilityFloor ? (
        <View style={{ position: 'absolute', top: t.space.sm, alignItems: 'center' }} pointerEvents="none">
          <Text
            testID="rotate-hint"
            style={{
              fontFamily: t.font.family.mono,
              fontSize: t.font.size.micro,
              letterSpacing: t.font.tracking.wide,
              color: t.color.warn,
              backgroundColor: t.color.warnSunk,
              paddingHorizontal: t.space.sm,
              paddingVertical: 2,
              borderRadius: t.radius.sm,
            }}
          >
            หมุนจอเพื่อดูตัวเลขชัดขึ้น · turn the phone for a clearer count
          </Text>
        </View>
      ) : null}

      <Text
        testID="count"
        accessibilityLiveRegion="polite"
        style={{
          fontFamily: t.font.family.sans,
          fontWeight: t.font.weight.black,
          fontVariant: ['tabular-nums'],
          letterSpacing: fontSize * t.font.tracking.tight,
          lineHeight: fontSize,
          fontSize,
          color: t.color.ink,
        }}
      >
        {count}
      </Text>

      <View style={{ position: 'absolute', bottom: t.space.sm }}>
        <Text
          testID="caption"
          style={{
            fontFamily: t.font.family.mono,
            fontSize: t.font.size.micro,
            letterSpacing: t.font.tracking.wide,
            color: feedback
              ? feedback.tone === 'reject'
                ? t.color.reject
                : t.color.accept
              : t.color.inkSoft,
            backgroundColor: t.color.stage,
            paddingHorizontal: t.space.sm,
          }}
        >
          {feedback ? feedback.text : caption}
        </Text>
      </View>
    </Pressable>
  );
}
