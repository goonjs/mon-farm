/**
 * E03-S09: the home cover scene — a rubber plantation by a stream that follows
 * the device clock (docs/stories/e03-s09-home-cover-scene.md).
 *
 * Shapes come from `core/cover-scene` (pure, built once); colours, sun and moon
 * from `core/cover-sky`. The picture is a stack of separate <Svg> layers (sky,
 * clouds, land, water, trees, tint): on Android each <Svg> is one bitmap, so a
 * frame only repaints the two small moving layers, never the ~680 tree shapes.
 * Static layers are memoised on the hour and wrap element arrays built once.
 * Only the water lanes and the clouds move, about ten times a second, and only
 * while the home is focused, the app is in front and the device does not ask
 * for reduced motion (CS-5).
 */

import { useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { COVER_FIXED } from '../../../design/cover-scene';
import { buildScene, CLOUD_FROM, CLOUD_TRAVEL, FLOW_CYCLE, type Oval, type Scene, type Sprig } from '../../core/cover-scene';
import { fractionOfHour, hhmm, hourAtFraction, hourOfDay, moonAt, paletteAt, playHour, SCENE_W, sunAt } from '../../core/cover-sky';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

export const COVER_HEIGHT = 148;
const FRAME_MS = 100;
const CLOCK_MS = 60_000;
/** Finger travel before a touch counts as a drag rather than a tap. */
const SLOP = 10;

type Mode = { kind: 'clock' } | { kind: 'manual'; hour: number } | { kind: 'play'; from: number; elapsed: number };

/** Whether the device asks for reduced motion (and when that changes). */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => live && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

/** Whether the app is in front. */
function useAppActive(): boolean {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub?.remove();
  }, []);
  return active;
}

const ovals = (list: Oval[], key: string) => list.map((o, i) => <Ellipse key={`${key}${i}`} cx={o.cx} cy={o.cy} rx={o.rx} ry={o.ry} />);
const sprigs = (list: Sprig[], key: string) =>
  list.map((s, i) => (
    <G key={`${key}${i}`} transform={`translate(${s.x},${s.y}) rotate(${s.rot})`}>
      <Ellipse cy={-s.len} rx={s.len * 0.42} ry={s.len} />
      <Ellipse cy={-s.len} rx={s.len * 0.4} ry={s.len * 0.9} transform="rotate(-48)" />
      <Ellipse cy={-s.len} rx={s.len * 0.4} ry={s.len * 0.9} transform="rotate(48)" />
    </G>
  ));

/** Shapes without colours, built once per scene. */
function useShapes(scene: Scene) {
  return useMemo(() => {
    const rows = scene.rows.map((r, i) => ({
      trunks: r.trunks.map((t, k) => <Rect key={`t${i}${k}`} x={t.x - 0.6} y={t.y} width={1.3} height={t.h} />),
      dark: ovals(r.dark, `rd${i}`),
      light: ovals(r.light, `rl${i}`),
    }));
    const trees = scene.trees.map((t, i) => ({
      trunk: <Path d={t.trunk} />,
      highlight: <Path d={t.highlight} strokeWidth={t.trunkWidth * 0.22} fill="none" opacity={0.75} />,
      branches: t.branches.map((d, k) => <Path key={`b${i}${k}`} d={d} strokeWidth={t.trunkWidth * 0.32} fill="none" strokeLinecap="round" />),
      tap: t.tap ? (
        <G>
          <Path d={t.tap.cut} stroke={COVER_FIXED.barkCut} strokeWidth={1.1} opacity={0.8} />
          <Path d={t.tap.fresh} stroke={COVER_FIXED.freshBark} strokeWidth={0.8} opacity={0.7} />
          <Path d={t.tap.spout} stroke={COVER_FIXED.barkCut} strokeWidth={0.7} />
          <Path d={t.tap.cup} fill={COVER_FIXED.cup} stroke={COVER_FIXED.cupRim} strokeWidth={0.5} />
        </G>
      ) : null,
      dark: ovals(t.crown.dark, `cd${i}`),
      mid: ovals(t.crown.mid, `cm${i}`),
      light: ovals(t.crown.light, `cl${i}`),
      sprigs: sprigs(t.crown.sprigs, `cs${i}`),
    }));
    const stars = scene.stars.map((s, i) => <Circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} />);
    const clouds = scene.clouds.map((c, i) => ovals(c.puffs, `c${i}`));
    const glints = ovals(scene.stream.glints, 'g');
    const stones = scene.stream.stones.map((o, i) => <Ellipse key={`st${i}`} cx={o.cx} cy={o.cy} rx={o.rx} ry={o.ry} fill={i % 2 ? COVER_FIXED.stoneLight : COVER_FIXED.stone} />);
    return { rows, trees, stars, clouds, glints, stones };
  }, [scene]);
}

type Shapes = ReturnType<typeof useShapes>;

/** One layer of the picture: its own <Svg>, the same viewBox, stacked over the others. */
function Layer({ children }: { children: ReactNode }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${SCENE_W} ${COVER_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
      {children}
    </Svg>
  );
}

/** Sky, stars and moon, sun and halo. */
const Sky = memo(function Sky({ hour, shapes, gid }: { hour: number; shapes: Shapes; gid: string }) {
  const p = paletteAt(hour);
  const sun = sunAt(hour, COVER_HEIGHT);
  const moon = moonAt(hour, COVER_HEIGHT);
  return (
    <Layer>
      <Defs>
        <LinearGradient id={`${gid}sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.skyTop} />
          <Stop offset="1" stopColor={p.skyBot} />
        </LinearGradient>
        <RadialGradient id={`${gid}glow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.sun} stopOpacity={0.9} />
          <Stop offset="0.35" stopColor={p.sun} stopOpacity={0.35} />
          <Stop offset="1" stopColor={p.sun} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={SCENE_W} height={COVER_HEIGHT} fill={`url(#${gid}sky)`} />
      {p.star > 0.01 ? (
        <G opacity={p.star}>
          <G fill={COVER_FIXED.star}>{shapes.stars}</G>
          {moon.up ? (
            <Path
              d={`M${moon.x},${moon.y - 7.5} A7.5,7.5 0 1,0 ${moon.x},${moon.y + 7.5} A3.5,7.5 0 1,1 ${moon.x},${moon.y - 7.5}Z`}
              fill={COVER_FIXED.moon}
            />
          ) : null}
        </G>
      ) : null}
      {sun.up || p.glow > 0.01 ? (
        <G>
          <Circle testID="cover-sun" cx={sun.x} cy={sun.y} r={42} fill={`url(#${gid}glow)`} opacity={p.glow} />
          <Circle cx={sun.x} cy={sun.y} r={10.5} fill={p.sun} />
        </G>
      ) : null}
    </Layer>
  );
});

/** Thin clouds drifting left to right, a few minutes each (moving layer). */
function Clouds({ hour, scene, shapes, seconds }: { hour: number; scene: Scene; shapes: Shapes; seconds: number }) {
  const p = paletteAt(hour);
  return (
    <Layer>
      <G fill={p.cloud} opacity={p.cloudOp}>
        {scene.clouds.map((c, i) => (
          <G key={i} transform={`translate(${CLOUD_FROM + ((seconds / c.duration + c.phase) % 1) * CLOUD_TRAVEL},0)`}>
            {shapes.clouds[i]}
          </G>
        ))}
      </G>
    </Layer>
  );
}

/** Hills, plantation rows, meadow and the stream bed: everything behind the moving water. */
const Land = memo(function Land({ hour, scene, shapes, gid }: { hour: number; scene: Scene; shapes: Shapes; gid: string }) {
  const p = paletteAt(hour);
  return (
    <Layer>
      <Defs>
        <LinearGradient id={`${gid}water`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.water1} />
          <Stop offset="1" stopColor={p.water2} />
        </LinearGradient>
        <LinearGradient id={`${gid}ground`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.g1} />
          <Stop offset="1" stopColor={p.g2} />
        </LinearGradient>
      </Defs>
      <G transform={`translate(0,${scene.groundShift})`}>
        <Path d={scene.hills} fill={p.hill} />
        {shapes.rows.map((r, i) => (
          <G key={i}>
            {i === 1 ? <Path d={scene.ground} fill={`url(#${gid}ground)`} /> : null}
            <G fill={p.trunk} opacity={0.75}>{r.trunks}</G>
            <G fill={p.farD}>{r.dark}</G>
            <G fill={p.farL} opacity={0.9}>{r.light}</G>
          </G>
        ))}
        <Path d={scene.stream.bank} fill={p.bank} />
        <Path d={scene.stream.water} fill={`url(#${gid}water)`} />
      </G>
    </Layer>
  );
});

/** The moving water: dashes travel down each lane toward the viewer (moving layer). */
function Flow({ hour, scene, seconds }: { hour: number; scene: Scene; seconds: number }) {
  const p = paletteAt(hour);
  return (
    <Layer>
      <G transform={`translate(0,${scene.groundShift})`} stroke={p.flow} fill="none" strokeLinecap="round">
        {scene.stream.lanes.map((l, i) => (
          <Path
            key={i}
            testID={`cover-flow-${i}`}
            d={l.d}
            strokeWidth={l.width}
            strokeDasharray={l.dash}
            strokeDashoffset={-((seconds / l.period + l.phase) % 1) * FLOW_CYCLE}
            opacity={l.opacity}
          />
        ))}
      </G>
    </Layer>
  );
}

/** Glints, stones, trees, grass and the light of the hour over everything. */
const Trees = memo(function Trees({ hour, scene, shapes }: { hour: number; scene: Scene; shapes: Shapes }) {
  const p = paletteAt(hour);
  const shadowShift = Math.max(-1, Math.min(1, (180 - sunAt(hour, COVER_HEIGHT).x) / 120)) * 14;
  return (
    <Layer>
      <G transform={`translate(0,${scene.groundShift})`}>
        <G fill={p.flow} opacity={0.6}>{shapes.glints}</G>
        {shapes.stones}
        {scene.trees.map((t, i) => {
          const s = shapes.trees[i];
          return (
            <G key={i}>
              <Ellipse cx={t.shadow.cx + shadowShift} cy={t.shadow.cy} rx={t.shadow.rx} ry={t.shadow.ry} fill={COVER_FIXED.shadow} opacity={p.shadow} />
              <G fill={p.trunk}>{s.trunk}</G>
              <G stroke={p.trunkHi}>{s.highlight}</G>
              {s.tap}
              <G stroke={p.trunk}>{s.branches}</G>
              <G fill={p.leafD}>{s.dark}</G>
              <G fill={p.leafM}>{s.mid}</G>
              <G fill={p.leafL}>{s.light}</G>
              <G fill={p.leafM}>{s.sprigs}</G>
            </G>
          );
        })}
        <Path d={scene.grass} stroke={p.leafM} strokeWidth={1} strokeLinecap="round" fill="none" />
      </G>
      <Rect width={SCENE_W} height={COVER_HEIGHT} fill={p.tint} opacity={p.tintOp} />
    </Layer>
  );
});

export function CoverScene({ onDragChange }: { onDragChange?: (dragging: boolean) => void }) {
  const t = useTheme();
  const msg = useT();
  const scene = useMemo(() => buildScene(COVER_HEIGHT), []);
  const shapes = useShapes(scene);
  // Gradient ids are document-global on the web: one per mounted cover.
  const gid = `cover${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const [mode, setMode] = useState<Mode>({ kind: 'clock' });
  const [now, setNow] = useState(() => hourOfDay(new Date()));
  const [seconds, setSeconds] = useState(0);
  const [focused, setFocused] = useState(true);
  const active = useAppActive();
  const reduce = useReduceMotion();
  const size = useRef({ width: SCENE_W, height: COVER_HEIGHT });
  const touch = useRef<{ x: number; y: number; hour: number; dragging: boolean } | null>(null);

  // CS-3: coming back to the home shows the time now again.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setNow(hourOfDay(new Date()));
      setMode({ kind: 'clock' });
      return () => setFocused(false);
    }, []),
  );

  // CS-2: follow the clock, once a minute.
  useEffect(() => {
    if (!focused || !active) return;
    // Read the clock again on coming back to the app, then every minute.
    // Read the clock now, then on each minute boundary.
    let timer: ReturnType<typeof setTimeout>;
    const read = () => {
      setNow(hourOfDay(new Date()));
      timer = setTimeout(read, CLOCK_MS - (Date.now() % CLOCK_MS));
    };
    timer = setTimeout(read, 0);
    return () => clearTimeout(timer);
  }, [focused, active]);

  // CS-5: water and clouds (and a playing day) move only while someone can see them.
  const playing = mode.kind === 'play';
  const moving = focused && active && (playing || !reduce);
  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(() => {
      setSeconds((s) => s + FRAME_MS / 1000);
      if (playing) setMode((m) => (m.kind === 'play' ? { ...m, elapsed: m.elapsed + FRAME_MS } : m));
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [moving, playing]);

  const hour = mode.kind === 'manual' ? mode.hour : mode.kind === 'play' ? playHour(mode.from, mode.elapsed) : now;
  const shownSeconds = reduce ? 0 : seconds;
  const sky = paletteAt(hour).skyBot;

  // CS-4: a tap plays the whole day; another tap goes back to now.
  const toggle = () => {
    if (mode.kind === 'play') {
      setNow(hourOfDay(new Date()));
      setMode({ kind: 'clock' });
    } else setMode({ kind: 'play', from: hour, elapsed: 0 });
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) size.current = { width, height };
  };
  const onGrant = (e: GestureResponderEvent) => {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, hour, dragging: false };
  };
  const onMove = (e: GestureResponderEvent) => {
    const s = touch.current;
    if (!s) return;
    const dx = e.nativeEvent.pageX - s.x, dy = e.nativeEvent.pageY - s.y;
    if (!s.dragging && Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
      s.dragging = true;
      onDragChange?.(true);
    }
    if (!s.dragging) return;
    // `slice` scales the scene by the larger of the two ratios: turn view pixels into scene units.
    const scale = Math.max(size.current.width / SCENE_W, size.current.height / COVER_HEIGHT);
    setMode({ kind: 'manual', hour: hourAtFraction(fractionOfHour(s.hour) + dx / scale / SCENE_W) });
  };
  const onRelease = (e: GestureResponderEvent) => {
    const s = touch.current;
    touch.current = null;
    if (s?.dragging) onDragChange?.(false);
    if (!s || s.dragging) return;
    if (Math.abs(e.nativeEvent.pageX - s.x) <= SLOP && Math.abs(e.nativeEvent.pageY - s.y) <= SLOP) toggle();
  };

  return (
    <View
      testID="home-cover"
      accessible
      accessibilityRole="image"
      accessibilityLabel={msg('home.scene')}
      accessibilityHint={msg('home.sceneHint')}
      accessibilityValue={{ text: hhmm(hour) }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && toggle()}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => !touch.current?.dragging}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      onResponderTerminate={() => {
        if (touch.current?.dragging) onDragChange?.(false);
        touch.current = null;
      }}
      style={[{ height: COVER_HEIGHT, borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: sky }, WEB_PAN_Y]}
    >
      <Sky hour={hour} shapes={shapes} gid={gid} />
      <Clouds hour={hour} scene={scene} shapes={shapes} seconds={shownSeconds} />
      <Land hour={hour} scene={scene} shapes={shapes} gid={gid} />
      <Flow hour={hour} scene={scene} seconds={shownSeconds} />
      <Trees hour={hour} scene={scene} shapes={shapes} />
    </View>
  );
}

/** On the web, leave up-down swipes to the page scroll (CS-3). `touchAction` is a web-only style. */
const WEB_PAN_Y = Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as object) : null;

