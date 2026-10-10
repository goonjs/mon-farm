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
import { useT } from '../i18n';
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
  /**
   * Recorder mode (E04-S05, D-40): the stage shows only this text — the
   * basket number lives on the card above it, never in the hold area.
   */
  label?: string;
}

export function HoldStage({
  count,
  onCount,
  onReject,
  caption,
  enabled = true,
  holdMs,
  testID = 'stage',
  label,
}: HoldStageProps) {
  const t = useTheme();
  const msg = useT();
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
  /**
   * The one pointer (finger) a hold belongs to (F-9.7, real-device field
   * report). Every window-level listener below used to react to ANY
   * pointer's up/move, with no identity check — confirmed live, with real
   * CDP-level touch input (not just simulated mouse events), that a second,
   * completely unrelated finger touching down and lifting mid-hold —
   * exactly what an attempted pinch-to-zoom looks like — fires a genuine
   * `pointerup` that cancelled the FIRST finger's still-in-progress hold,
   * even though that finger never moved or lifted. `null` between holds.
   */
  const activePointerId = useRef<number | null>(null);

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
    activePointerId.current = null;
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
      setFeedback({ tone: 'reject', text: msg('hold.movedOff') });
      onReject(held);
      setTimeout(() => setFeedback(null), 1400);
      return;
    }
    setPct(1);
    onCount();
    setFeedback({ tone: 'accept', text: msg('hold.counted') });
    setTimeout(() => setPct(0), 260);
    setTimeout(() => setFeedback(null), 900);
  }, [msg, onCount, onReject, pointerIsOnStage, stop]);

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
      text: msg('hold.releasedEarly', { seconds: (held / 1000).toFixed(1) }),
    });
    onReject(held);
    setTimeout(() => setFeedback(null), 1400);
  }, [msg, onReject, stop]);

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

    // A pointerId mismatch means this event belongs to a DIFFERENT finger
    // than the one holding — ignore it entirely. `null` (no hold owns a
    // pointer right now) never filters anything, which matters for the very
    // first pointerdown of a new hold: that event reaches this
    // capture-phase window listener before the Pressable's own
    // `onPointerDown` below has had a chance to claim `activePointerId`.
    const belongsToActivePointer = (e: PointerEvent) =>
      activePointerId.current === null || e.pointerId === activePointerId.current;

    const onEnd = (e: PointerEvent) => {
      if (!belongsToActivePointer(e)) return;
      cancelRef.current();
    };
    /**
     * S32, field report: a real two-finger pinch is not always a clean
     * `pointerup`. When the browser claims the gesture as its own native
     * pinch-zoom (the Artifact-preview build used for phone testing does not
     * carry `+html.tsx`'s `user-scalable=no`, unlike the real packaged app),
     * the touches involved end as `pointercancel`, never `pointerup` — so the
     * anchor finger's hold kept running to completion, uninterrupted, even
     * though both fingers had already left the screen. Confirmed with real
     * CDP touch input (`Input.dispatchTouchEvent` type `touchCancel`) before
     * this listener was added: without it, the count wrongly incremented.
     */
    const onCancel = onEnd;
    const onHide = () => {
      if (document.hidden) cancelRef.current();
    };
    // Window-level, because a release or a move outside the stage never reaches
    // the stage itself. Recording the position is what lets completion check
    // where the pointer is rather than trusting a boundary event to arrive.
    const onMove = (e: PointerEvent) => {
      if (!belongsToActivePointer(e)) return;
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };
    // E04-S04: any OTHER pointer touching down while a hold runs — a
    // second finger anywhere on screen, a palm — cancels the hold at once.
    const onDown = (e: PointerEvent) => {
      if (holding.current && activePointerId.current !== null && e.pointerId !== activePointerId.current) {
        cancelRef.current();
        return;
      }
      onMove(e);
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onCancel);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onCancel);
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
   * The advance width of one rendered digit, in ems — read back off the glyph
   * the device actually drew, so the width cap below is true for whatever face
   * the system stack resolved to rather than for the one it was calibrated on.
   *
   * Converges in a single extra paint and then holds: the ratio is
   * scale-invariant, so a numeral redrawn at the corrected size reproduces the
   * same ratio, and re-applying it changes nothing.
   *
   * The two directions get different thresholds, because they are not the same
   * kind of error. Overflow is corrected against the box in pixels and to the
   * pixel — the numeral spilling off screen is the defect, and a proportional
   * tolerance here is exactly what left a tablet 1.8px over. Growing back is
   * only ever a lost-millimetres optimisation, so it takes a proportional
   * epsilon, which is what stops sub-pixel jitter in a reported width from
   * re-rendering forever.
   */
  const [advanceEm, setAdvanceEm] = useState<number>(t.publicNumeral.digitWidthEm);
  const onCountLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (!width || !fontSize) return;
    const measured = width / fontSize / Math.max(1, digits);
    if (measured <= 0) return;
    const overflowsStage = box.width > 0 && width > box.width + 0.5;
    const underusesStage = measured < advanceEm * 0.995;
    if (overflowsStage || underusesStage) setAdvanceEm(measured);
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
   *
   * The width half of that needs the digit's advance in ems, and `advanceEm`
   * below is measured rather than assumed. `t.font.family.sans` is a system
   * stack: the face that renders the numeral is whatever the device happens to
   * have, and its digits are not the token's estimated width on every one of
   * them. Guessing low overflows the viewport (CI's Linux face measures 0.6558
   * against the token's 0.62, which put a portrait numeral 22px past a 390px
   * screen); guessing high gives back millimetres F-9.7 says the count cannot
   * spare. So the token is the first paint's estimate, and every paint after
   * it uses the ratio the glyph actually achieved.
   */
  const digits = String(count).length;
  const byHeight = box.height * t.publicNumeral.stageHeightRatio;
  const byWidth = box.width / (advanceEm * Math.max(1, digits));
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
      accessibilityLabel={msg('hold.label')}
      onLayout={onLayout}
      onPressIn={begin}
      /**
       * Claims the pointer for this hold, guarded on `!holding.current` so a
       * SECOND finger touching down mid-hold can never steal ownership away
       * from the one already counting — RNW's own responder system already
       * no-ops `begin()` for that second touch, but this ref is read by the
       * window listeners below independently of that, so it needs its own
       * guard. Raw native event, same as `onPointerMove` below — RNW's
       * `onPressIn` does not reliably carry a `pointerId`.
       */
      onPointerDown={(e) => {
        if (holding.current) return;
        const n = e.nativeEvent as unknown as { pointerId?: number };
        if (typeof n.pointerId === 'number') activePointerId.current = n.pointerId;
      }}
      /**
       * E04-S04 (owner 2026-10-03, SALE-8): a second finger or a palm
       * touching down DURING a hold cancels it at once — it is a pinch or a
       * mis-grip, never a basket. Native reports it as a touch count; the web
       * path is the window-level second-pointer check below.
       */
      onTouchStart={(e) => {
        const touches = (e.nativeEvent as unknown as { touches?: readonly unknown[] }).touches;
        if (holding.current && (touches?.length ?? 0) > 1) cancel();
      }}
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

      {!clearsLegibilityFloor && label === undefined ? (
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
            {msg('hold.rotate')}
          </Text>
        </View>
      ) : null}

      {label !== undefined ? (
        <Text
          testID="hold-label"
          style={{
            fontFamily: t.font.family.sans,
            fontWeight: t.font.weight.bold,
            fontSize: t.font.size.headingXl,
            color: t.color.ink,
            textAlign: 'center',
            paddingHorizontal: t.space.lg,
          }}
        >
          {label}
        </Text>
      ) : (
        <Text
          testID="count"
          accessibilityLiveRegion="polite"
          onLayout={onCountLayout}
          style={{
            fontFamily: t.font.family.sans,
            fontWeight: t.font.weight.black,
            fontVariant: ['tabular-nums'],
            letterSpacing: fontSize * t.font.tracking.tight,
            lineHeight: fontSize,
            fontSize,
            color: t.color.numeral,
          }}
        >
          {count}
        </Text>
      )}

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
