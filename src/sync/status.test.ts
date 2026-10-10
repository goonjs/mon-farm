import { describe, expect, it } from 'vitest';

import { syncStatusFrom, syncWordId } from './status';
import { messages } from '../i18n/messages';

describe('sync status for the pill (SYNC-3)', () => {
  it('nothing pending is synced; anything pending says how many', () => {
    expect(syncStatusFrom({ pending: 0 })).toEqual({ state: 'synced', count: 0 });
    expect(syncStatusFrom({ pending: 3 })).toEqual({ state: 'pending', count: 3 });
  });

  it('a conflict outranks pending — it is the one that needs the user (D-3)', () => {
    expect(syncStatusFrom({ pending: 3, conflicts: 1 })).toEqual({ state: 'conflict', count: 1 });
  });

  it('every state has Thai and English words, Thai per the v1.1.0 mockups', () => {
    for (const state of ['synced', 'pending', 'conflict'] as const) {
      expect(messages.th[syncWordId(state)]).toBeTruthy();
      expect(messages.en[syncWordId(state)]).toBeTruthy();
    }
    expect(messages.th['sync.synced']).toBe('ซิงก์แล้ว');
    expect(messages.th['sync.pending']).toBe('รอส่ง {n}');
    expect(messages.th['sync.conflict']).toBe('ขัดกัน {n}');
  });
});
