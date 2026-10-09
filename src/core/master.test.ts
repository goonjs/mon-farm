import { describe, expect, it } from 'vitest';

import {
  MASTER_SCOPE,
  defaultBuyer,
  filterPeople,
  formatThaiDate,
  projectMaster,
  validatePerson,
} from './master';
import type { MasterPayload, SaleEvent } from './types';

/** A tiny log builder for master-data events; seq/deviceSeq follow append order. */
function log() {
  const events: SaleEvent[] = [];
  let n = 0;
  const base = (deviceId = 'dev-A') => {
    n += 1;
    return {
      id: `m/${deviceId}/${n}`,
      saleId: MASTER_SCOPE,
      seq: n,
      deviceSeq: n,
      ts: 1_790_000_000_000 + n * 1000,
      mono: n,
      actor: { userId: 'u', deviceId },
      source: 'app' as const,
    };
  };
  const b = {
    master(payload: MasterPayload) {
      events.push({ ...base(), kind: 'master', payload });
      return b;
    },
    remove(targetId: string) {
      events.push({ ...base(), kind: 'delete', targetId });
      return b;
    },
    restore(targetId: string) {
      events.push({ ...base(), kind: 'restore', targetId });
      return b;
    },
    build: () => [...events],
  };
  return b;
}

describe('projectMaster — people (E03-S01, MD-5)', () => {
  it('creates a person with roles, and a rename keeps the id', () => {
    const state = projectMaster(
      log()
        .master({ t: 'person_added', personId: 'p1', name: 'แดง', roles: ['tapper'], otherRoles: [] })
        .master({ t: 'person_edited', personId: 'p1', name: 'แดงใหม่' })
        .build(),
    );
    expect(state.people).toHaveLength(1);
    expect(state.people[0]).toMatchObject({ id: 'p1', name: 'แดงใหม่', roles: ['tapper'], deleted: false });
  });

  it('holds several roles plus a typed-in one, and an edit replaces only the fields it names', () => {
    const state = projectMaster(
      log()
        .master({ t: 'person_added', personId: 'p1', name: 'สมหวัง', roles: ['manager'], otherRoles: [] })
        .master({ t: 'person_edited', personId: 'p1', roles: ['manager', 'payer'], otherRoles: ['ลูกคนงาน'] })
        .build(),
    );
    expect(state.people[0]).toMatchObject({ name: 'สมหวัง', roles: ['manager', 'payer'], otherRoles: ['ลูกคนงาน'] });
  });

  it('soft delete hides from the active list but keeps the record resolvable; restore brings it back', () => {
    const b = log()
      .master({ t: 'person_added', personId: 'p1', name: 'แดง', roles: ['tapper'], otherRoles: [] })
      .remove('p1');
    const deleted = projectMaster(b.build());
    expect(filterPeople(deleted.people, 'all')).toHaveLength(0);
    expect(deleted.people.find((p) => p.id === 'p1')).toMatchObject({ name: 'แดง', deleted: true });

    const back = projectMaster(b.restore('p1').build());
    expect(filterPeople(back.people, 'all').map((p) => p.id)).toEqual(['p1']);
  });

  it('an edit naming a person never added is ignored', () => {
    const state = projectMaster(log().master({ t: 'person_edited', personId: 'ghost', name: 'x' }).build());
    expect(state.people).toHaveLength(0);
  });

  it('result does not depend on the order rows arrived in', () => {
    const events = log()
      .master({ t: 'person_added', personId: 'p1', name: 'แดง', roles: ['tapper'], otherRoles: [] })
      .master({ t: 'person_edited', personId: 'p1', name: 'แดง 2' })
      .master({ t: 'buyer_added', buyerId: 'b1', name: 'ล้ง ก' })
      .remove('b1')
      .build();
    expect(projectMaster([...events].reverse())).toEqual(projectMaster(events));
  });
});

describe('filterPeople (D-74 F12)', () => {
  const state = projectMaster(
    log()
      .master({ t: 'person_added', personId: 'p1', name: 'แดง', roles: ['tapper'], otherRoles: [] })
      .master({ t: 'person_added', personId: 'p2', name: 'กมล', roles: ['manager', 'payer'], otherRoles: [] })
      .master({ t: 'person_added', personId: 'p3', name: 'นัด', roles: ['tapper', 'worker'], otherRoles: [] })
      .build(),
  );

  it('"all" lists active people alphabetically in Thai', () => {
    expect(filterPeople(state.people, 'all').map((p) => p.name)).toEqual(['กมล', 'แดง', 'นัด']);
  });

  it('a role shows only people holding it', () => {
    expect(filterPeople(state.people, 'tapper').map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(filterPeople(state.people, 'payer').map((p) => p.id)).toEqual(['p2']);
  });
});

describe('validatePerson (D-68)', () => {
  it('needs a name and at least one role, built-in or typed', () => {
    expect(validatePerson({ name: ' ', roles: [], otherRoles: [] })).toEqual(['name', 'roles']);
    expect(validatePerson({ name: 'แดง', roles: [], otherRoles: ['ลูกคนงาน'] })).toEqual([]);
    expect(validatePerson({ name: 'แดง', roles: ['tapper'], otherRoles: [] })).toEqual([]);
    expect(validatePerson({ name: 'แดง', roles: [], otherRoles: ['  '] })).toEqual(['roles']);
  });
});

describe('buyers (MD-6, D-65)', () => {
  const b = log()
    .master({ t: 'buyer_added', buyerId: 'b1', name: 'ล้ง ก' })
    .master({ t: 'buyer_added', buyerId: 'b2', name: 'ล้ง ข' })
    .master({ t: 'buyer_edited', buyerId: 'b2', name: 'ล้ง ข ใหม่' });

  it('adds and renames a buyer', () => {
    const state = projectMaster(b.build());
    expect(state.buyers.map((x) => x.name)).toEqual(['ล้ง ก', 'ล้ง ข ใหม่']);
  });

  it('the latest buyer is the default for a new sale', () => {
    expect(defaultBuyer(projectMaster(b.build()), 'b2')?.id).toBe('b2');
  });

  it('no default when there is no previous buyer or it is unknown', () => {
    const state = projectMaster(b.build());
    expect(defaultBuyer(state, null)).toBeNull();
    expect(defaultBuyer(state, 'nope')).toBeNull();
  });

  it('latest buyer deleted → no default; the user picks (not the next newest)', () => {
    const state = projectMaster(log().master({ t: 'buyer_added', buyerId: 'b1', name: 'ล้ง ก' }).master({ t: 'buyer_added', buyerId: 'b2', name: 'ล้ง ข' }).remove('b2').build());
    expect(defaultBuyer(state, 'b2')).toBeNull();
  });
});

describe('formatThaiDate (D-65 Q1)', () => {
  // 1 Oct 2026, noon Bangkok time.
  const ts = Date.UTC(2026, 9, 1, 5, 0, 0);
  it('Buddhist era by default', () => {
    expect(formatThaiDate(ts, 'be')).toBe('1 ต.ค. 2569');
  });
  it('Common era on request', () => {
    expect(formatThaiDate(ts, 'ce')).toBe('1 ต.ค. 2026');
  });
});
