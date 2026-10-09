import { describe, expect, it } from 'vitest';

import {
  MASTER_SCOPE,
  activeTapperOn,
  dayBefore,
  pointTimeline,
  pointsOf,
  tapperOn,
  activePoints,
  planStarterPoints,
  pointNameTaken,
  showStarterButton,
  ageInYears,
  areaOn,
  parseGps,
  parseRai,
  parseThaiDay,
  validateProperty,
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

describe('properties — E03-S02 (MD-1)', () => {
  const add = { t: 'property_added', propertyId: 'f1', name: 'สวนจันทเขลม', crop: 'rubber' } as const;

  it('creates a property; area, planted year and GPS are optional and read as unknown', () => {
    const f = projectMaster(log().master(add).build()).properties[0];
    expect(f).toMatchObject({ id: 'f1', name: 'สวนจันทเขลม', crop: 'rubber', deleted: false });
    expect(f.plantedYearBe).toBeNull();
    expect(f.gps).toBeNull();
    expect(areaOn(f, '2026-10-01')).toBeNull();
  });

  it('edits only the named fields, and can clear an optional one', () => {
    const f = projectMaster(
      log()
        .master({ ...add, plantedYearBe: 2554, gps: { latE6: 12_500_000, lngE6: 102_100_000 } })
        .master({ t: 'property_edited', propertyId: 'f1', crop: 'durian', cleared: ['gps'] })
        .build(),
    ).properties[0];
    expect(f).toMatchObject({ name: 'สวนจันทเขลม', crop: 'durian', plantedYearBe: 2554, gps: null });
  });

  it('area on a date: before / on / after a change; none yet = unknown', () => {
    const f = projectMaster(
      log()
        .master(add)
        .master({ t: 'area_recorded', propertyId: 'f1', entryId: 'a1', centiRai: 12_000, effective: '2026-01-01' })
        .master({ t: 'area_recorded', propertyId: 'f1', entryId: 'a2', centiRai: 12_500, effective: '2026-10-01' })
        .build(),
    ).properties[0];
    expect(areaOn(f, '2025-12-31')).toBeNull();
    expect(areaOn(f, '2026-01-01')).toBe(12_000);
    expect(areaOn(f, '2026-09-30')).toBe(12_000);
    expect(areaOn(f, '2026-10-01')).toBe(12_500);
    expect(areaOn(f, '2027-01-01')).toBe(12_500);
    expect(f.areaHistory).toHaveLength(2);
  });

  it('two entries on the same effective date: the one recorded last wins, the other stays in history (D-65 Q8)', () => {
    const f = projectMaster(
      log()
        .master(add)
        .master({ t: 'area_recorded', propertyId: 'f1', entryId: 'a1', centiRai: 10_000, effective: '2026-10-01' })
        .master({ t: 'area_recorded', propertyId: 'f1', entryId: 'a2', centiRai: 11_000, effective: '2026-10-01' })
        .build(),
    ).properties[0];
    expect(areaOn(f, '2026-10-01')).toBe(11_000);
    expect(f.areaHistory.map((a) => a.entryId)).toEqual(['a2', 'a1']);
  });

  it('a deleted property is listed as deleted and comes back on restore', () => {
    const b = log().master(add).remove('f1');
    expect(projectMaster(b.build()).properties[0].deleted).toBe(true);
    expect(projectMaster(b.restore('f1').build()).properties[0].deleted).toBe(false);
  });

  it('age from the planted year (พ.ศ.), unknown without one', () => {
    expect(ageInYears(2554, Date.UTC(2569 - 543, 5, 1))).toBe(15);
    expect(ageInYears(null, Date.UTC(2026, 5, 1))).toBeNull();
  });
});

describe('validateProperty / area input (D-65 Q7)', () => {
  it('needs a name and a crop; area may be blank but if given must be a number > 0', () => {
    expect(validateProperty({ name: '', crop: null })).toEqual(['name', 'crop']);
    expect(parseRai('')).toEqual({ ok: true, centiRai: null });
    expect(parseRai('76')).toEqual({ ok: true, centiRai: 7600 });
    expect(parseRai('12.5')).toEqual({ ok: true, centiRai: 1250 });
    expect(parseRai('0')).toEqual({ ok: false });
    expect(parseRai('-3')).toEqual({ ok: false });
    expect(parseRai('abc')).toEqual({ ok: false });
  });

  it('reads a Thai date d/m/yyyy in พ.ศ. (or ค.ศ.) into an ISO day', () => {
    expect(parseThaiDay('1/10/2569')).toBe('2026-10-01');
    expect(parseThaiDay('1/10/2026')).toBe('2026-10-01');
    expect(parseThaiDay('31/2/2569')).toBeNull();
    expect(parseThaiDay('x')).toBeNull();
  });

  it('reads GPS "lat, lng" into microdegrees; blank = none', () => {
    expect(parseGps('12.6113, 102.1035')).toEqual({ ok: true, gps: { latE6: 12_611_300, lngE6: 102_103_500 } });
    expect(parseGps('')).toEqual({ ok: true, gps: null });
    expect(parseGps('200, 1')).toEqual({ ok: false });
  });
});

describe('weighing points — E03-S03 (MD-3)', () => {
  const farm = (id: string, name = id) => ({ t: 'property_added', propertyId: id, name, crop: 'rubber' }) as const;
  const point = (pointId: string, propertyId: string, name: string) => ({ t: 'point_added', pointId, propertyId, name }) as const;

  it('creates, renames, deletes and restores a point; its id is stable', () => {
    const b = log()
      .master(farm('f1'))
      .master(point('p1', 'f1', 'จุด 1'))
      .master({ t: 'point_renamed', pointId: 'p1', name: 'จุดหน้า' });
    expect(projectMaster(b.build()).points[0]).toMatchObject({ id: 'p1', propertyId: 'f1', name: 'จุดหน้า', hidden: false });
    b.remove('p1');
    expect(projectMaster(b.build()).points[0]).toMatchObject({ id: 'p1', deleted: true, hidden: true });
    expect(activePoints(projectMaster(b.build()))).toEqual([]);
    b.restore('p1');
    expect(activePoints(projectMaster(b.build())).map((p) => p.id)).toEqual(['p1']);
  });

  it('deleting a farm hides its points; restoring the farm brings them back (D-65 Q9)', () => {
    const b = log().master(farm('f1')).master(point('p1', 'f1', 'จุด 1')).remove('f1');
    const s = projectMaster(b.build());
    expect(s.points[0]).toMatchObject({ deleted: false, hidden: true });
    expect(activePoints(s)).toEqual([]);
    expect(activePoints(projectMaster(b.restore('f1').build())).map((p) => p.id)).toEqual(['p1']);
  });

  it('a name is taken only within the same farm, and only by a point still shown (D-65 Q10)', () => {
    const s = projectMaster(
      log().master(farm('f1')).master(farm('f2')).master(point('p1', 'f1', 'จุด 1')).master(point('p2', 'f1', 'จุดเก่า')).remove('p2').build(),
    );
    expect(pointNameTaken(s, 'f1', ' จุด 1 ')).toBe(true);
    expect(pointNameTaken(s, 'f2', 'จุด 1')).toBe(false);
    expect(pointNameTaken(s, 'f1', 'จุดเก่า')).toBe(false);
    expect(pointNameTaken(s, 'f1', 'จุด 1', 'p1')).toBe(false); // renaming to its own name
  });

  it('two devices adding the same name offline: both kept and flagged; a rename clears the flag', () => {
    const b = log().master(farm('f1')).master(point('p1', 'f1', 'จุด 1')).master(point('p2', 'f1', 'จุด 1'));
    expect(projectMaster(b.build()).points.map((p) => p.duplicateName)).toEqual([true, true]);
    b.master({ t: 'point_renamed', pointId: 'p2', name: 'จุด 2' });
    expect(projectMaster(b.build()).points.map((p) => p.duplicateName)).toEqual([false, false]);
  });

  it('the starter button shows only with no points at all, after the first pull', () => {
    const empty = projectMaster(log().master(farm('f1')).build());
    const some = projectMaster(log().master(farm('f1')).master(point('p1', 'f1', 'จุด 1')).build());
    expect(showStarterButton(empty, true)).toBe(true);
    expect(showStarterButton(empty, false)).toBe(false);
    expect(showStarterButton(some, true)).toBe(false);
  });
});

describe('planStarterPoints — the generic wizard (D-73)', () => {
  const s = projectMaster(log().master({ t: 'property_added', propertyId: 'f1', name: 'ก', crop: 'rubber' }).build());

  it('one point per name the user typed, per tapper, across farms', () => {
    const plan = planStarterPoints(s, [
      { propertyId: 'f1', tapperId: 't1', names: ['จุด 1', 'จุด 2'] },
      { propertyId: 'f1', tapperId: 't2', names: ['จุด 3'] },
      { propertyId: 'f2', tapperId: 't2', names: ['จุด 1'] },
    ]);
    expect(plan).toEqual({
      ok: true,
      points: [
        { propertyId: 'f1', tapperId: 't1', name: 'จุด 1' },
        { propertyId: 'f1', tapperId: 't1', name: 'จุด 2' },
        { propertyId: 'f1', tapperId: 't2', name: 'จุด 3' },
        { propertyId: 'f2', tapperId: 't2', name: 'จุด 1' },
      ],
    });
  });

  it('every name is required — nothing is made up', () => {
    expect(planStarterPoints(s, [{ propertyId: 'f1', tapperId: 't1', names: ['จุด 1', ' '] }])).toEqual({ ok: false, missing: 1, duplicates: [] });
  });

  it('a name repeated in one farm is refused', () => {
    expect(
      planStarterPoints(s, [
        { propertyId: 'f1', tapperId: 't1', names: ['จุด 1'] },
        { propertyId: 'f1', tapperId: 't2', names: ['จุด 1'] },
      ]),
    ).toEqual({ ok: false, missing: 0, duplicates: ['จุด 1'] });
  });
});

describe('tapper assignments — E03-S05 (MD-4, D-63)', () => {
  const base = () =>
    log()
      .master({ t: 'property_added', propertyId: 'f1', name: 'ก', crop: 'rubber' })
      .master({ t: 'point_added', pointId: 'p1', propertyId: 'f1', name: 'จุด 1' });

  it('no assignment → no tapper', () => {
    expect(tapperOn(projectMaster(base().build()), 'p1', '2026-10-01')).toBeNull();
  });

  it('an assignment with no start date covers all of the past', () => {
    const s = projectMaster(base().master({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' }).build());
    expect(tapperOn(s, 'p1', '2000-01-01')).toBe('red');
    expect(tapperOn(s, 'p1', '2030-01-01')).toBe('red');
  });

  it('a change from 1 Oct: the old tapper ends 30 Sep, inclusive; earlier sales keep the old tapper', () => {
    const s = projectMaster(
      base()
        .master({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' })
        .master({ t: 'tapper_assigned', assignmentId: 'a2', pointId: 'p1', tapperId: 'nat', from: '2026-10-01' })
        .build(),
    );
    expect(tapperOn(s, 'p1', '2026-09-30')).toBe('red');
    expect(tapperOn(s, 'p1', '2026-10-01')).toBe('nat');
    expect(pointTimeline(s, 'p1')).toEqual([
      { assignmentId: 'a1', tapperId: 'red', from: null, to: '2026-09-30' },
      { assignmentId: 'a2', tapperId: 'nat', from: '2026-10-01', to: null },
    ]);
  });

  it('leaving with no replacement: no tapper from the next day', () => {
    const s = projectMaster(
      base()
        .master({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' })
        .master({ t: 'tapper_unassigned', assignmentId: 'a2', pointId: 'p1', from: '2026-11-01' })
        .build(),
    );
    expect(tapperOn(s, 'p1', '2026-10-31')).toBe('red');
    expect(tapperOn(s, 'p1', '2026-11-01')).toBeNull();
    expect(pointTimeline(s, 'p1')[0]).toMatchObject({ tapperId: 'red', to: '2026-10-31' });
  });

  it('a planned change can be cancelled (soft delete) and the old tapper simply carries on', () => {
    const b = base()
      .master({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' })
      .master({ t: 'tapper_assigned', assignmentId: 'a2', pointId: 'p1', tapperId: 'nat', from: '2026-12-01' })
      .remove('a2');
    const s = projectMaster(b.build());
    expect(tapperOn(s, 'p1', '2027-01-01')).toBe('red');
    expect(pointTimeline(s, 'p1')).toEqual([{ assignmentId: 'a1', tapperId: 'red', from: null, to: null }]);
  });

  it('a later assignment back-dated before a sale changes who owns that day (retroactive)', () => {
    const s = projectMaster(base().master({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red', from: '2026-09-01' }).build());
    expect(tapperOn(s, 'p1', '2026-09-15')).toBe('red');
    expect(tapperOn(s, 'p1', '2026-08-31')).toBeNull();
  });

  it('two changes on the same start day: the one later in fold order wins', () => {
    const s = projectMaster(
      base()
        .master({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red', from: '2026-10-01' })
        .master({ t: 'tapper_assigned', assignmentId: 'a2', pointId: 'p1', tapperId: 'nat', from: '2026-10-01' })
        .build(),
    );
    expect(tapperOn(s, 'p1', '2026-10-01')).toBe('nat');
  });

  it("a person's points on a day, for the people screen and the delete warning", () => {
    const s = projectMaster(
      base()
        .master({ t: 'point_added', pointId: 'p2', propertyId: 'f1', name: 'จุด 2' })
        .master({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' })
        .master({ t: 'tapper_assigned', assignmentId: 'a2', pointId: 'p2', tapperId: 'red' })
        .master({ t: 'tapper_assigned', assignmentId: 'a3', pointId: 'p2', tapperId: 'nat', from: '2026-10-01' })
        .build(),
    );
    expect(pointsOf(s, 'red', '2026-09-01').map((p) => p.name)).toEqual(['จุด 1', 'จุด 2']);
    expect(pointsOf(s, 'red', '2026-10-01').map((p) => p.name)).toEqual(['จุด 1']);
  });

  it('dayBefore handles month and year ends', () => {
    expect(dayBefore('2026-10-01')).toBe('2026-09-30');
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
    expect(dayBefore('2024-03-01')).toBe('2024-02-29');
  });
});

describe('activeTapperOn — the point reads "no tapper" once its tapper is gone (E03-S01 AC4)', () => {
  const b = () =>
    log()
      .master({ t: 'property_added', propertyId: 'f1', name: 'ก', crop: 'rubber' })
      .master({ t: 'point_added', pointId: 'p1', propertyId: 'f1', name: 'จุด 1' })
      .master({ t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] })
      .master({ t: 'tapper_assigned', assignmentId: 'a1', pointId: 'p1', tapperId: 'red' });

  it('is the assigned tapper while they exist and hold the role', () => {
    expect(activeTapperOn(projectMaster(b().build()), 'p1', '2026-10-01')?.name).toBe('แดง');
  });
  it('is none once the person is deleted, and back on restore', () => {
    const x = b().remove('red');
    expect(activeTapperOn(projectMaster(x.build()), 'p1', '2026-10-01')).toBeNull();
    expect(activeTapperOn(projectMaster(x.restore('red').build()), 'p1', '2026-10-01')?.name).toBe('แดง');
  });
  it('is none once the tapper role is removed', () => {
    const x = b().master({ t: 'person_edited', personId: 'red', roles: ['worker'] });
    expect(activeTapperOn(projectMaster(x.build()), 'p1', '2026-10-01')).toBeNull();
  });
});
