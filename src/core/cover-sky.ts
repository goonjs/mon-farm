/**
 * E03-S09: the home cover's clock. Colours, the sun and the moon for any hour
 * of the day, and the mapping between a finger on the picture and an hour.
 * Pure: no React, no device clock (callers pass the hour in).
 *
 * Scene units: the picture is drawn in a box `SCENE_W` wide and `height` tall
 * (148 was the old cover, 180 the new one); the ground sits on the bottom edge,
 * so a taller picture only adds sky.
 */

import { COVER_FRAMES } from '../../design/cover-scene';

export const SCENE_W = 358;
export const BASE_H = 148;
export const SUNRISE = 6;
export const SUNSET = 18.5;
/** A whole day when the picture is played (CS-4). */
export const PLAY_DAY_MS = 30_000;

const SUN_X0 = 110;
const SUN_SPAN = 152;

export interface Palette {
  skyTop: string;
  skyBot: string;
  sun: string;
  cloud: string;
  hill: string;
  farD: string;
  farL: string;
  g1: string;
  g2: string;
  bank: string;
  water1: string;
  water2: string;
  flow: string;
  leafD: string;
  leafM: string;
  leafL: string;
  trunk: string;
  trunkHi: string;
  tint: string;
  /** Sun halo strength 0..1. */
  glow: number;
  cloudOp: number;
  tintOp: number;
  /** Moon and stars 0..1. */
  star: number;
  shadow: number;
}

type Colours = Omit<Palette, 'glow' | 'cloudOp' | 'tintOp' | 'star' | 'shadow'>;
const COLOUR_KEYS = ['skyTop', 'skyBot', 'sun', 'cloud', 'hill', 'farD', 'farL', 'g1', 'g2', 'bank', 'water1', 'water2', 'flow', 'leafD', 'leafM', 'leafL', 'trunk', 'trunkHi', 'tint'] as const;
const NUMBER_KEYS = ['glow', 'cloudOp', 'tintOp', 'star', 'shadow'] as const;

const FRAMES = COVER_FRAMES as readonly (readonly [number, Palette])[];

const wrap = (h: number) => ((h % 24) + 24) % 24;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function mix(a: string, b: string, t: number): string {
  let out = '#';
  for (let i = 1; i < 7; i += 2) {
    const x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16);
    out += Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  }
  return out;
}

/** The colours at `hour` (any number; wraps at 24), blended between keyframes. */
export function paletteAt(hour: number): Palette {
  const h = wrap(hour);
  let i = 0;
  while (FRAMES[i + 1][0] < h) i++;
  const [h0, a] = FRAMES[i], [h1, b] = FRAMES[i + 1];
  const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
  const p = {} as Palette;
  for (const k of COLOUR_KEYS) (p as unknown as Colours)[k] = mix(a[k], b[k], t);
  for (const k of NUMBER_KEYS) p[k] = a[k] + (b[k] - a[k]) * t;
  return p;
}

export interface SkyBody {
  x: number;
  y: number;
  up: boolean;
}

const horizonOf = (height: number) => 88 + (height - BASE_H);

/** The sun: an arc from left (sunrise) to right (sunset); dropped below the hills at night. */
export function sunAt(hour: number, height: number): SkyBody {
  const t = (wrap(hour) - SUNRISE) / (SUNSET - SUNRISE);
  const up = t >= 0 && t <= 1;
  const lift = 66 + (height - BASE_H) * 0.6;
  return {
    x: SUN_X0 + t * SUN_SPAN,
    y: horizonOf(height) - Math.sin(Math.PI * clamp(t, 0, 1)) * lift + (up ? 0 : 30),
    up,
  };
}

/** The moon: up from 19:30 to 05:30, crossing the sky the same way. */
export function moonAt(hour: number, height: number): SkyBody {
  const n = wrap(hour - 19.5) / 10;
  const up = n <= 1;
  return {
    x: 140 + n * 150,
    y: horizonOf(height) - 30 - Math.sin(Math.PI * Math.min(n, 1)) * (36 + (height - BASE_H) * 0.5),
    up,
  };
}

/** The hour under a finger at `fraction` (0 left edge .. 1 right edge): the sun sits under the finger. */
export function hourAtFraction(fraction: number): number {
  const x = clamp(fraction, 0, 1) * SCENE_W;
  return clamp(SUNRISE + ((x - SUN_X0) / SUN_SPAN) * (SUNSET - SUNRISE), 0, 24);
}

/** Where `hour` sits across the picture (inverse of `hourAtFraction`). */
export function fractionOfHour(hour: number): number {
  const h = clamp(hour, 0, 24);
  return (SUN_X0 + ((h - SUNRISE) / (SUNSET - SUNRISE)) * SUN_SPAN) / SCENE_W;
}

/** The hour shown `elapsedMs` into a whole-day play that started at `startHour`. */
export function playHour(startHour: number, elapsedMs: number): number {
  return wrap(startHour + (elapsedMs / PLAY_DAY_MS) * 24);
}

/** The device clock as a fractional hour. */
export function hourOfDay(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

/** An hour as HH:MM (the cover's spoken value). */
export function hhmm(hour: number): string {
  const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60 + 1e-6);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
