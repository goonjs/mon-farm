import { describe, expect, it } from 'vitest';

import { firstPullDone } from './first-pull';

describe('firstPullDone (points wizard gate)', () => {
  it('a build that does not sync never waits', () => {
    expect(firstPullDone('off', 0)).toBe(true);
  });

  it('while the connection is still being set up, waits', () => {
    expect(firstPullDone('connecting', 0)).toBe(false);
    expect(firstPullDone('connecting', 5)).toBe(false);
  });

  it('with sync running, waits for the first completed pull and then never again', () => {
    expect(firstPullDone('on', 0)).toBe(false);
    expect(firstPullDone('on', 1)).toBe(true);
    expect(firstPullDone('on', 1_790_000_000_000)).toBe(true);
  });
});
