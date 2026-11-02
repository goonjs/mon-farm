/**
 * E03-S09: the home cover's drawing as plain data — rubber trees, a stream,
 * clouds, stars — so the React layer only maps shapes to SVG elements and
 * this file can be tested in Vitest. Deterministic: a seeded generator, so
 * every render (and every device) draws the same picture.
 *
 * Ported from the owner-approved mockup `docs/ux/mockups/home-cover-scene.html`.
 * Units are scene units (`SCENE_W` wide); ground shapes are drawn for the
 * 148-tall picture and shifted down by `groundShift` for a taller one.
 */

import { BASE_H, SCENE_W } from './cover-sky';

export interface Oval {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}
/** A three-leaf sprig (rubber leaves are trifoliate), drawn at x,y turned by `rot` degrees. */
export interface Sprig {
  x: number;
  y: number;
  rot: number;
  len: number;
}
export interface Crown {
  dark: Oval[];
  mid: Oval[];
  light: Oval[];
  sprigs: Sprig[];
}
export interface Tree {
  x: number;
  shadow: Oval;
  trunk: string;
  trunkWidth: number;
  highlight: string;
  branches: string[];
  /** The tapping cut, the fresh bark under it, the spout and the cup (big trees only). */
  tap: { cut: string; fresh: string; spout: string; cup: string } | null;
  crown: Crown;
}
export interface Row {
  trunks: { x: number; y: number; h: number }[];
  dark: Oval[];
  light: Oval[];
}
export interface Lane {
  d: string;
  width: number;
  dash: [number, number];
  /** Seconds for the dashes to travel one 40-unit cycle. */
  period: number;
  /** Phase offset 0..1. */
  phase: number;
  opacity: number;
}
export interface Cloud {
  puffs: Oval[];
  /** Seconds to cross the picture. */
  duration: number;
  phase: number;
}
export interface Scene {
  height: number;
  groundShift: number;
  stars: { x: number; y: number; r: number }[];
  clouds: Cloud[];
  hills: string;
  ground: string;
  rows: Row[];
  stream: { bank: string; water: string; lanes: Lane[]; glints: Oval[]; stones: Oval[] };
  trees: Tree[];
  grass: string;
  shapeCount: number;
}

/** Most primitives the cover may draw (CS-5: cheap phones). */
export const SHAPE_BUDGET = 900;
/** Dash cycle every lane's pattern divides, so the flow loops seamlessly. */
export const FLOW_CYCLE = 40;
/** How far a cloud travels: from just off the left edge to past the right. */
export const CLOUD_FROM = -120;
export const CLOUD_TRAVEL = 600;

type Pt = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth path through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: Pt[], move = true): string {
  let d = `${move ? 'M' : 'L'}${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)},${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)},${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return d;
}

const oval = (cx: number, cy: number, rx: number, ry = rx): Oval => ({ cx: r1(cx), cy: r1(cy), rx: r1(rx), ry: r1(ry) });

/** A fluffy rubber-tree crown: a bumpy dark rim, rounder mid puffs, lit puffs on top, a few leaf sprigs. */
function crown(cx: number, cy: number, rx: number, ry: number, seed: number): Crown {
  const r = rng(seed);
  const k = Math.max(8, Math.round(rx / 3.2));
  const dark = [oval(cx, cy + ry * 0.05, rx * 0.8, ry * 0.74)];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + r() * 0.3;
    dark.push(oval(cx + Math.cos(a) * rx * 0.7, cy + Math.sin(a) * ry * 0.62, rx * (0.3 + r() * 0.1)));
  }
  const mid: Oval[] = [];
  for (let i = 0; i < Math.round(k * 0.8); i++) {
    const a = r() * Math.PI * 2, q = Math.sqrt(r()) * 0.6;
    mid.push(oval(cx + Math.cos(a) * rx * q - rx * 0.05, cy + Math.sin(a) * ry * q - ry * 0.14, rx * (0.22 + r() * 0.1)));
  }
  const light: Oval[] = [];
  for (let i = 0; i < Math.round(k * 0.9); i++) {
    const a = -Math.PI / 2 - 1.1 + r() * 1.9, q = 0.3 + r() * 0.45;
    light.push(oval(cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q, rx * (0.1 + r() * 0.06)));
  }
  const sprigs: Sprig[] = [];
  for (let i = 0; i < Math.round(rx * 0.5); i++) {
    const a = -Math.PI / 2 - 1.3 + r() * 2.6, q = 0.8 + r() * 0.2;
    sprigs.push({
      x: r1(cx + Math.cos(a) * rx * q),
      y: r1(cy + Math.sin(a) * ry * q),
      rot: r1((a + Math.PI / 2) * 57.3 + (r() - 0.5) * 40),
      len: r1(2.6 + r() * 1.6),
    });
  }
  return { dark, mid, light, sprigs };
}

/** A rubber tree: slim pale trunk, forks into a fluffy crown, a tapping cut with a cup on the big ones. */
function tree(x: number, base: number, height: number, lean: number, w: number, rx: number, ry: number, seed: number): Tree {
  const top = base - height, tx = x + lean, cy = top + ry * 0.28;
  const trunk = `M${r1(x - w / 2)},${base} C${r1(x - w / 2)},${r1(base - height * 0.4)} ${r1(tx - w * 0.32)},${r1(top + height * 0.3)} ${r1(tx - w * 0.28)},${r1(top + 6)} L${r1(tx + w * 0.28)},${r1(top + 6)} C${r1(tx + w * 0.32)},${r1(top + height * 0.3)} ${r1(x + w / 2)},${r1(base - height * 0.4)} ${r1(x + w / 2)},${base}Z`;
  const highlight = `M${r1(x - w * 0.2)},${base} C${r1(x - w * 0.2)},${r1(base - height * 0.4)} ${r1(tx - w * 0.12)},${r1(top + height * 0.3)} ${r1(tx - w * 0.1)},${r1(top + 8)}`;
  const branches = ([[-1, 0.78], [1, 0.74], [-0.3, 0.9]] as const).map(([dx, k]) => {
    const sx = x + lean * k, sy = base - height * k;
    return `M${r1(sx)},${r1(sy)} Q${r1(sx + dx * rx * 0.25)},${r1(sy - ry * 0.3)} ${r1(sx + dx * rx * 0.5)},${r1(cy - ry * 0.1)}`;
  });
  const cutY = base - Math.min(30, height * 0.28);
  const tap = height >= 40
    ? {
        cut: `M${r1(x - w / 2)},${r1(cutY)} L${r1(x + w / 2)},${r1(cutY - w * 0.9)}`,
        fresh: `M${r1(x - w / 2)},${r1(cutY + 3)} L${r1(x + w / 2)},${r1(cutY - w * 0.9 + 3)}`,
        spout: `M${r1(x - w / 2 - 0.2)},${r1(cutY + 1)} l-1.6,2`,
        cup: `M${r1(x - w / 2 - 4.4)},${r1(cutY + 3.4)} h4.6 a2.3,2.4 0 0 1 -4.6,0z`,
      }
    : null;
  return {
    x,
    shadow: oval(x, base - 1, rx * 0.8, 3.2),
    trunk,
    trunkWidth: w,
    highlight,
    branches,
    tap,
    crown: crown(tx, cy, rx, ry, seed),
  };
}

/** A far plantation row: small overlapping crowns in a line, the way rubber is planted. */
function row(y: number, x0: number, x1: number, step: number, h: number, rad: number, gap: (x: number) => boolean, seed: number): Row {
  const g = rng(seed);
  const out: Row = { trunks: [], dark: [], light: [] };
  for (let x = x0; x <= x1; x += step * (0.8 + g() * 0.4)) {
    if (gap(x)) continue;
    const rr = rad * (0.8 + g() * 0.45), hh = h * (0.85 + g() * 0.3);
    out.trunks.push({ x: r1(x), y: r1(y - hh), h: r1(hh) });
    out.dark.push(oval(x, y - hh, rr * 1.25, rr * 0.95), oval(x + rr * 0.6, y - hh + rr * 0.2, rr * 0.8, rr * 0.6));
    out.light.push(oval(x - rr * 0.35, y - hh - rr * 0.35, rr * 0.7, rr * 0.45));
  }
  return out;
}

/** Stream centre line (x, y, width), from the far bank toward the viewer. */
const STREAM: [number, number, number][] = [[192, 85, 3], [183, 93, 7], [199, 102, 13], [178, 114, 22], [205, 128, 36], [168, 142, 58], [186, 160, 92]];
const side = (k: number): Pt[] => STREAM.map(([x, y, w]) => [x + (k * w) / 2, y]);
const lane = (k: number, from: number, to: number): Pt[] => STREAM.slice(from, to).map(([x, y, w]) => [x + (k * w) / 2, y]);
const ribbon = (k: number) => `${smooth(side(-k))}${smooth(side(k).reverse(), false)}Z`;

function cloud(cx: number, cy: number, len: number, seed: number, duration: number, phase: number): Cloud {
  const r = rng(seed);
  const puffs: Oval[] = [];
  for (let i = 0; i < 4; i++) puffs.push(oval(cx + (r() - 0.5) * len * 0.6, cy + (r() - 0.5) * 2, len * (0.25 + r() * 0.2), 2 + r() * 2.2));
  return { puffs, duration, phase };
}

/** The whole picture for a cover `height` scene units tall. */
export function buildScene(height: number): Scene {
  const dy = height - BASE_H;
  const sg = rng(7);
  const stars = Array.from({ length: 26 }, () => ({ x: r1(sg() * SCENE_W), y: r1(sg() * (60 + dy)), r: r1(0.4 + sg() * 0.7) }));
  const clouds = [
    cloud(40, 26 + dy * 0.4, 70, 3, 210, 40 / 210),
    cloud(20, 44 + dy * 0.6, 52, 11, 260, 150 / 260),
    cloud(60, 15 + dy * 0.3, 44, 23, 180, 120 / 180),
  ];
  const rows = [
    row(85, 92, 306, 8, 8, 4.4, (x) => Math.abs(x - 192) < 5, 5),
    row(98, 100, 290, 14, 14, 7.5, (x) => Math.abs(x - 186) < 13, 9),
  ];
  // Back to front: two small trees beside the stream, then the big ones at the edges.
  const trees = [
    tree(150, 120, 46, 2, 3, 15, 13, 51),
    tree(230, 122, 50, -2, 3.4, 16, 14, 57),
    tree(84, 141, 84, 3, 5, 24, 21, 41),
    tree(30, 152, 112, -4, 7, 34, 30, 17),
    tree(346, 143, 92, -2, 5.5, 26, 22, 63),
    tree(300, 154, 118, 5, 8, 38, 32, 29),
  ];
  const gg = rng(77);
  let grass = '';
  let tufts = 0;
  for (let i = 0; i < 34; i++) {
    const x = gg() * SCENE_W, y = 120 + gg() * 30;
    if (Math.abs(x - 188) < 52) continue;
    tufts++;
    grass += `M${r1(x)},${r1(y)} l-1.2,-3.5 M${r1(x)},${r1(y)} l.2,-4.4 M${r1(x)},${r1(y)} l1.5,-3.2 `;
  }
  const stream = {
    bank: ribbon(1.35),
    water: ribbon(1),
    lanes: [
      { d: smooth(lane(0, 0, 4)), width: 0.7, dash: [2, 6] as [number, number], period: 4.2, phase: 0, opacity: 0.7 },
      { d: smooth(lane(-0.35, 2, 7)), width: 1, dash: [5, 15] as [number, number], period: 3.4, phase: 0, opacity: 0.75 },
      { d: smooth(lane(0.1, 2, 7)), width: 1.3, dash: [8, 12] as [number, number], period: 2.8, phase: 0.4, opacity: 0.85 },
      { d: smooth(lane(0.5, 3, 7)), width: 1.1, dash: [6, 14] as [number, number], period: 3.1, phase: 0.2, opacity: 0.7 },
    ],
    glints: [oval(196, 121, 3, 0.7), oval(182, 136, 4, 0.9), oval(200, 146, 5, 1)],
    stones: [oval(160, 141, 4, 2.2), oval(166, 143, 2.6, 1.6), oval(222, 147, 5, 2.4), oval(214, 125, 2.4, 1.3)],
  };
  const crownCount = (c: Crown) => c.dark.length + c.mid.length + c.light.length + c.sprigs.length * 3;
  const shapeCount =
    4 + stars.length + 2 + clouds.reduce((s, c) => s + c.puffs.length, 0) +
    rows.reduce((s, r) => s + r.trunks.length + r.dark.length + r.light.length, 0) +
    2 + stream.lanes.length + stream.glints.length + stream.stones.length + 1 +
    trees.reduce((s, t) => s + 3 + t.branches.length + (t.tap ? 4 : 0) + crownCount(t.crown), 0) + tufts;
  return {
    height,
    groundShift: dy,
    stars,
    clouds,
    hills: `M0,84 C40,74 80,72 120,78 C160,84 200,70 250,72 C300,74 330,80 ${SCENE_W},78 L${SCENE_W},${BASE_H} L0,${BASE_H}Z`,
    ground: `M0,92 C60,86 120,84 180,86 C240,88 300,84 ${SCENE_W},88 L${SCENE_W},${BASE_H + 10} L0,${BASE_H + 10}Z`,
    rows,
    stream,
    trees,
    grass,
    shapeCount,
  };
}
