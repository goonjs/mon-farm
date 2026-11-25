import { describe, expect, it } from 'vitest';

import { scopeEvent } from './fixtures';
import { APP_RELEASE, FINANCE_SCOPE, appBelowMin, isSaleScope, minAppOf } from './finance-scope';
import { MASTER_SCOPE } from './master';

describe('isSaleScope — the reserved scopes are not sales (E01-S28 round 1)', () => {
  it('a sale id is a sale; the master and finance scopes are not', () => {
    expect(isSaleScope('sale-1')).toBe(true);
    expect(isSaleScope(MASTER_SCOPE)).toBe(false);
    expect(isSaleScope(FINANCE_SCOPE)).toBe(false);
  });
});

describe('minAppOf / appBelowMin — the minimum-version gate (S28-AC12 ก)', () => {
  it('no app_min event: no minimum, nothing gated (round 1 sends none)', () => {
    expect(minAppOf([])).toBeNull();
    expect(minAppOf([scopeEvent('f1', 'finance', { t: 'category_added', name: 'ค่าไฟ' })])).toBeNull();
    expect(appBelowMin([])).toBe(false);
  });

  it('takes the highest minApp in the store', () => {
    const log = [scopeEvent('m1', 'app_min', { minApp: 3 }), scopeEvent('m2', 'app_min', { minApp: 7 }), scopeEvent('m3', 'app_min', { minApp: 5 })];
    expect(minAppOf(log)).toBe(7);
  });

  it('ignores an app_min whose minApp is not a whole number ≥ 1', () => {
    const log = [
      scopeEvent('m1', 'app_min', { minApp: 'x' }),
      scopeEvent('m2', 'app_min', { minApp: 2.5 }),
      scopeEvent('m3', 'app_min', {}),
      scopeEvent('m4', 'app_min', null),
      scopeEvent('m5', 'app_min', { minApp: 0 }),
    ];
    expect(minAppOf(log)).toBeNull();
  });

  it('gates only when the minimum is above this build', () => {
    expect(appBelowMin([scopeEvent('m1', 'app_min', { minApp: APP_RELEASE })])).toBe(false);
    expect(appBelowMin([scopeEvent('m1', 'app_min', { minApp: APP_RELEASE + 1 })])).toBe(true);
    expect(appBelowMin([scopeEvent('m1', 'app_min', { minApp: 4 })], 4)).toBe(false);
    expect(appBelowMin([scopeEvent('m1', 'app_min', { minApp: 5 })], 4)).toBe(true);
  });
});
