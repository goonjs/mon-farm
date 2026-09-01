import { describe, expect, it, vi } from 'vitest';

import { announceCount } from './announcer';
import type { Speaker } from './speaker';

function fakeSpeaker(behavior: 'ok' | 'fail' | 'throw'): Speaker {
  return {
    speak: async () => {
      if (behavior === 'throw') throw new Error('speech engine unavailable');
      return behavior === 'ok';
    },
  };
}

describe('announceCount', () => {
  it('speaks the Thai spelling and logs ok:true on success', async () => {
    const append = vi.fn();
    announceCount(21, fakeSpeaker('ok'), append);
    await vi.waitFor(() => expect(append).toHaveBeenCalledTimes(1));
    expect(append).toHaveBeenCalledWith({
      kind: 'sys',
      payload: { t: 'announced', thai: 'ยี่สิบเอ็ด', ok: true },
    });
  });

  it('logs ok:false when the speaker reports failure, without throwing', async () => {
    const append = vi.fn();
    expect(() => announceCount(5, fakeSpeaker('fail'), append)).not.toThrow();
    await vi.waitFor(() => expect(append).toHaveBeenCalledTimes(1));
    expect(append).toHaveBeenCalledWith({
      kind: 'sys',
      payload: { t: 'announced', thai: 'ห้า', ok: false },
    });
  });

  it('logs ok:false when the speaker rejects, without throwing back to the caller', async () => {
    const append = vi.fn();
    // FR-11.10: audio failure must never block or corrupt the count. The
    // caller (the counter's onCount) must never see this throw.
    expect(() => announceCount(3, fakeSpeaker('throw'), append)).not.toThrow();
    await vi.waitFor(() => expect(append).toHaveBeenCalledTimes(1));
    expect(append).toHaveBeenCalledWith({
      kind: 'sys',
      payload: { t: 'announced', thai: 'สาม', ok: false },
    });
  });

  it('is fire-and-forget — returns before the speaker settles', () => {
    let resolved = false;
    const slowSpeaker: Speaker = {
      speak: () => new Promise((resolve) => setTimeout(() => { resolved = true; resolve(true); }, 50)),
    };
    announceCount(1, slowSpeaker, vi.fn());
    // The call above already returned (this line executed), and the promise
    // has not settled yet — proving announceCount does not await it.
    expect(resolved).toBe(false);
  });
});
