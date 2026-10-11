/**
 * E06-S07 (D-58, D-65): the old S29 per-sale deduction events are no longer
 * understood, but a log that still holds them must load, fold and settle to the
 * same figures as the same log without them. The events stay in the log
 * (append-only); the reader just skips what it does not know.
 *
 * The payloads are written by hand: the code that used to build them is gone.
 */
import { describe, expect, it } from 'vitest';

import { LogBuilder, workedExampleLog } from './fixtures';
import { MASTER_SCOPE, projectMaster } from './master';
import { settlePoints } from './point-settle';
import { projectSale } from './project';
import { isMoneyChange } from './sale-status';
import { settle } from './settle';
import type { MasterPayload, SaleEvent, SysPayload } from './types';

const old = (p: object) => p as unknown as SysPayload;

/** Appends the three old events: a deduction, one for someone with no contract, and a void. */
function addOldEvents<T extends LogBuilder>(b: T): T {
  b.sys(old({ t: 'deduction_added', deductionId: 'ded-1', personId: 'person-prayuth', personName: 'ประยุทธ', satang: 5_000, reason: 'ค่าปุ๋ย', agreedBy: 'สมชาย' }));
  b.sys(old({ t: 'deduction_added', deductionId: 'ded-2', personId: 'person-outsider', personName: 'คนนอกโซน', satang: 3_000, reason: 'ค่าปรับ', agreedBy: 'สมชาย' }));
  b.sys(old({ t: 'deduction_voided', deductionId: 'ded-1', reason: 'จ่ายผิด' }));
  return b;
}

describe('a log still holding deduction_added / deduction_voided (E06-S07)', () => {
  it('pile sale: folds without throwing and settles to the same figures', () => {
    const plain = workedExampleLog().build();
    const withOld = addOldEvents(workedExampleLog()).build();
    expect(withOld.length).toBe(plain.length + 3); // never dropped from the log
    expect(() => projectSale(withOld)).not.toThrow();
    expect(settle(withOld, projectSale(withOld))).toEqual(settle(plain, projectSale(plain)));
  });

  it('point sale: settlePoints gives the same figures, per tapper', () => {
    const payloads: MasterPayload[] = [
      { t: 'person_added', personId: 'red', name: 'แดง', roles: ['tapper'], otherRoles: [] },
      { t: 'property_added', propertyId: 'fA', name: 'จันทเขลม', crop: 'rubber' },
      { t: 'point_added', pointId: 'p1', propertyId: 'fA', name: 'p1' },
      { t: 'tapper_assigned', assignmentId: 'a-p1', pointId: 'p1', tapperId: 'red' },
    ];
    const master = projectMaster(
      payloads.map(
        (payload, i): SaleEvent => ({
          id: `m${i}`,
          groupId: 'group-1',
          saleId: MASTER_SCOPE,
          seq: i + 1,
          deviceSeq: i + 1,
          ts: 0,
          mono: 0,
          actor: { userId: 'u', deviceId: 'd' },
          source: 'app',
          kind: 'master',
          payload,
        }),
      ),
    );
    const build = () => new LogBuilder('sale-1').sys({ t: 'price_set', satangPerKg: 4850, indexRef: '' }).acceptAt('p1', 1).acceptAt('p1', 2);
    const plain = build().build();
    const withOld = addOldEvents(build()).build();
    const a = settlePoints(withOld, projectSale(withOld, 'sale-1'), master, '2026-10-03');
    const z = settlePoints(plain, projectSale(plain, 'sale-1'), master, '2026-10-03');
    expect(a).toEqual(z);
    expect(a.perWorker.map((w) => w.personId)).toEqual(['red']); // no row for the old "outsider"
  });

  it('the rest of the projection is unchanged', () => {
    const plain = workedExampleLog().build();
    const withOld = addOldEvents(workedExampleLog()).build();
    expect(projectSale(withOld)).toEqual(projectSale(plain));
  });

  it('an old deduction event is not a money change', () => {
    expect(isMoneyChange({ kind: 'sys', payload: { t: 'deduction_added' } })).toBe(false);
  });
});
