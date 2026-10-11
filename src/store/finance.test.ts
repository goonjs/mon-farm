import { describe, expect, it } from 'vitest';

import type { FinanceEvent } from '../core/finance/types';
import { IntegrityError } from './errors';
import { MemoryFinanceStore } from './finance-memory';

const e: FinanceEvent = {
  id: 'e1',
  groupId: 'group-1',
  deviceSeq: 1,
  ts: 1,
  actor: { userId: 'u', deviceId: 'd' },
  source: 'app',
  targetId: 'x1',
  baseEventId: null,
  payload: { t: 'category_added', name: 'ค่าไฟ' },
};

describe('MemoryFinanceStore — append-only', () => {
  it('stores and loads', async () => {
    const s = new MemoryFinanceStore();
    await s.append(e);
    expect(await s.load()).toEqual([e]);
  });

  it('the same event twice is a no-op', async () => {
    const s = new MemoryFinanceStore();
    await s.append(e);
    await s.append({ ...e });
    expect(await s.load()).toHaveLength(1);
  });

  it('the same id with different content is refused', async () => {
    const s = new MemoryFinanceStore();
    await s.append(e);
    await expect(s.append({ ...e, payload: { t: 'category_added', name: 'อื่น' } })).rejects.toBeInstanceOf(IntegrityError);
  });
});
