import { describe, expect, it } from 'vitest';

import {
  hourAtFraction,
  hourOfDay,
  fractionOfHour,
  moonAt,
  paletteAt,
  playHour,
  PLAY_DAY_MS,
  SCENE_W,
  sunAt,
  SUNRISE,
  SUNSET,
} from './cover-sky';

const H = 180;

describe('paletteAt (CS-2)', () => {
  it('gives morning, mid-morning, noon, afternoon and evening different skies', () => {
    const skies = [7, 10, 12, 15, 17.5].map((h) => paletteAt(h).skyTop);
    expect(new Set(skies).size).toBe(5);
  });

  it('is the same night sky from late evening to before dawn', () => {
    expect(paletteAt(21).skyTop).toBe(paletteAt(2).skyTop);
    expect(paletteAt(21).star).toBe(1);
    expect(paletteAt(12).star).toBe(0);
  });

  it('wraps around midnight and blends between keyframes', () => {
    expect(paletteAt(24)).toEqual(paletteAt(0));
    expect(paletteAt(-1)).toEqual(paletteAt(23));
    const mid = paletteAt(11);
    expect(mid.skyTop).not.toBe(paletteAt(10).skyTop);
    expect(mid.skyTop).not.toBe(paletteAt(12).skyTop);
    expect(mid.skyTop).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('sunAt (CS-2)', () => {
  it('rises on the left, is highest at the middle of the day and sets on the right', () => {
    const rise = sunAt(SUNRISE, H), noon = sunAt((SUNRISE + SUNSET) / 2, H), set = sunAt(SUNSET, H);
    expect(rise.x).toBeLessThan(noon.x);
    expect(noon.x).toBeLessThan(set.x);
    expect(noon.y).toBeLessThan(sunAt(9, H).y);
    expect(noon.y).toBeLessThan(sunAt(16, H).y);
    expect(rise.y).toBeCloseTo(set.y, 5);
  });

  it('keeps the noon sun inside the picture', () => {
    const noon = sunAt(12.25, H);
    expect(noon.y).toBeGreaterThan(10);
    expect(noon.x).toBeGreaterThan(0);
    expect(noon.x).toBeLessThan(SCENE_W);
  });

  it('is below the horizon at night', () => {
    expect(sunAt(22, H).up).toBe(false);
    expect(sunAt(3, H).up).toBe(false);
    expect(sunAt(12, H).up).toBe(true);
    expect(sunAt(22, H).y).toBeGreaterThan(sunAt(SUNRISE, H).y);
  });
});

describe('moonAt (CS-2)', () => {
  it('is up at night and gone at noon', () => {
    expect(moonAt(22, H).up).toBe(true);
    expect(moonAt(3, H).up).toBe(true);
    expect(moonAt(12, H).up).toBe(false);
  });

  it('clears the trees just after dark (20:00 sits above the plantation rows)', () => {
    const m = moonAt(20, H);
    expect(m.y).toBeLessThan(88 + (H - 148) - 25);
    expect(m.x).toBeGreaterThan(120);
  });
});

describe('finger position ↔ hour (CS-3)', () => {
  it('puts the sun under the finger', () => {
    for (const h of [7, 10, 12, 15, 17.5]) {
      expect(fractionOfHour(h) * SCENE_W).toBeCloseTo(sunAt(h, H).x, 5);
      expect(hourAtFraction(fractionOfHour(h))).toBeCloseTo(h, 5);
    }
  });

  it('runs from midnight at the left edge to midnight at the right', () => {
    expect(hourAtFraction(0)).toBe(0);
    expect(hourAtFraction(0.05)).toBe(0);
    expect(hourAtFraction(1)).toBe(24);
  });

  it('clamps past the edges', () => {
    expect(hourAtFraction(-0.5)).toBe(0);
    expect(hourAtFraction(1.5)).toBe(24);
    expect(fractionOfHour(0)).toBeGreaterThan(0);
    expect(fractionOfHour(24)).toBeLessThan(1);
    expect(fractionOfHour(-3)).toBe(fractionOfHour(0));
  });
});

describe('playHour (CS-4)', () => {
  it('runs a whole day in 30 seconds and loops', () => {
    expect(PLAY_DAY_MS).toBe(30_000);
    expect(playHour(7, 0)).toBe(7);
    expect(playHour(7, 15_000)).toBeCloseTo(19, 5);
    expect(playHour(7, 30_000)).toBeCloseTo(7, 5);
    expect(playHour(20, 7_500)).toBeCloseTo(2, 5);
  });
});

describe('hourOfDay', () => {
  it('reads the device clock as fractional hours', () => {
    expect(hourOfDay(new Date(2026, 10, 2, 17, 45))).toBe(17.75);
  });
});
