import { describe, expect, it } from 'vitest';

import { buildScene, SHAPE_BUDGET } from './cover-scene';
import { SCENE_W } from './cover-sky';

const numbersIn = (s: string) => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('buildScene (CS-1)', () => {
  it('draws the same picture every time', () => {
    expect(buildScene(180)).toEqual(buildScene(180));
  });

  it('has rubber trees with a tapping cut and cup, a stream with flowing lanes, three clouds and stars', () => {
    const s = buildScene(180);
    expect(s.trees.length).toBeGreaterThanOrEqual(4);
    expect(s.trees.filter((t) => t.tap).length).toBeGreaterThanOrEqual(4);
    expect(s.stream.lanes.length).toBeGreaterThanOrEqual(3);
    expect(s.clouds).toHaveLength(3);
    expect(s.stars.length).toBeGreaterThan(10);
  });

  it('gives fluffy crowns: a bumpy rim, mid puffs and lit puffs', () => {
    for (const t of buildScene(180).trees) {
      expect(t.crown.dark.length).toBeGreaterThanOrEqual(8);
      expect(t.crown.mid.length).toBeGreaterThan(4);
      expect(t.crown.light.length).toBeGreaterThan(3);
    }
  });

  it('only has finite coordinates', () => {
    const s = buildScene(180);
    const all = [
      s.hills, s.ground, s.stream.bank, s.stream.water, ...s.stream.lanes.map((l) => l.d),
      ...s.trees.flatMap((t) => [t.trunk, t.highlight, ...t.branches]),
    ].flatMap(numbersIn);
    expect(all.length).toBeGreaterThan(100);
    expect(all.every(Number.isFinite)).toBe(true);
  });

  it('keeps the ground at the bottom whatever the height', () => {
    expect(buildScene(148).groundShift).toBe(0);
    expect(buildScene(180).groundShift).toBe(32);
    for (const st of buildScene(180).stars) {
      expect(st.x).toBeGreaterThanOrEqual(0);
      expect(st.x).toBeLessThanOrEqual(SCENE_W);
    }
  });

  it('stays within the shape budget so a cheap phone can draw it (CS-5)', () => {
    expect(buildScene(180).shapeCount).toBeLessThanOrEqual(SHAPE_BUDGET);
  });
});
