import { describe, expect, it } from 'vitest';

import { checkAccountFields, projectAccounts } from './accounts';
import type { AccountFields, FinanceEvent, FinancePayload } from './types';

let n = 0;
function ev(targetId: string, payload: FinancePayload, base: string | null = null): FinanceEvent {
  n += 1;
  return { id: `a${String(n).padStart(4, '0')}`, groupId: 'group-1', deviceSeq: n, ts: n, actor: { userId: 'u', deviceId: 'd' }, source: 'app', targetId, baseEventId: base, payload };
}

const BANK: AccountFields = { label: 'บัญชีหลัก', bankCode: 'KBANK', accountNo: '1234567890', accountName: 'สมชาย', promptPay: null };
const PP: AccountFields = { label: 'พร้อมเพย์', bankCode: null, accountNo: '', accountName: '', promptPay: { type: 'mobile', id: '0812345678' } };

describe('checkAccountFields (E05-S07)', () => {
  it('needs bank details or PromptPay, at least one', () => {
    expect(checkAccountFields(BANK)).toEqual([]);
    expect(checkAccountFields(PP)).toEqual([]);
    expect(checkAccountFields({ ...PP, promptPay: null })).toEqual(['bank-or-promptpay']);
  });
  it('checks number formats', () => {
    expect(checkAccountFields({ ...BANK, accountNo: '123' })).toEqual(['account-number']);
    expect(checkAccountFields({ ...PP, promptPay: { type: 'nationalId', id: '1101700207031' } })).toEqual(['promptpay-id']);
  });
});

describe('projectAccounts', () => {
  it('lists accounts, a default, and a soft-deleted default leaves no default', () => {
    const a = ev('acc-1', { t: 'account_added', fields: BANK });
    const b = ev('acc-2', { t: 'account_added', fields: PP });
    const d = ev('default-account', { t: 'account_default_set', accountId: 'acc-1' });
    let s = projectAccounts([a, b, d]);
    expect(s.accounts.map((x) => x.id)).toEqual(['acc-1', 'acc-2']);
    expect(s.defaultId).toBe('acc-1');

    const d2 = ev('default-account', { t: 'account_default_set', accountId: 'acc-2' }, d.id);
    expect(projectAccounts([a, b, d, d2]).defaultId).toBe('acc-2');

    const del = ev('acc-1', { t: 'account_changed', patch: { deleted: true } }, a.id);
    s = projectAccounts([a, b, d, del]);
    expect(s.defaultId).toBeNull();
    expect(s.accounts.find((x) => x.id === 'acc-1')?.deleted).toBe(true);
  });

  it('review #3: a sale not yet recorded is told apart from one that recorded the default', () => {
    const a = ev('acc-1', { t: 'account_added', fields: BANK });
    const d = ev('default-account', { t: 'account_default_set', accountId: 'acc-1' });
    expect(projectAccounts([a, d]).recordedFor('s1')).toBe(false);
    const c = ev('sale-account-s1', { t: 'sale_account_set', saleId: 's1', choice: { kind: 'account', accountId: 'acc-1' } });
    const b = ev('acc-2', { t: 'account_added', fields: PP });
    const d2 = ev('default-account', { t: 'account_default_set', accountId: 'acc-2' }, d.id);
    const s = projectAccounts([a, d, c, b, d2]);
    expect(s.recordedFor('s1')).toBe(true);
    expect(s.choiceFor('s1')).toEqual({ kind: 'account', accountId: 'acc-1' });
  });

  it('a sale records its choice; with none it falls back to the default', () => {
    const a = ev('acc-1', { t: 'account_added', fields: BANK });
    const d = ev('default-account', { t: 'account_default_set', accountId: 'acc-1' });
    expect(projectAccounts([a, d]).choiceFor('s1')).toEqual({ kind: 'account', accountId: 'acc-1' });
    const c = ev('sale-account-s1', { t: 'sale_account_set', saleId: 's1', choice: { kind: 'cash' } });
    expect(projectAccounts([a, d, c]).choiceFor('s1')).toEqual({ kind: 'cash' });
    expect(projectAccounts([]).choiceFor('s1')).toBeNull();
  });

  it('concurrent edits to the PromptPay id from two devices → conflict', () => {
    const a = ev('acc-1', { t: 'account_added', fields: PP });
    const x = ev('acc-1', { t: 'account_changed', patch: { promptPay: { type: 'mobile', id: '0899999999' } } }, a.id);
    const y = ev('acc-1', { t: 'account_changed', patch: { promptPay: { type: 'mobile', id: '0811111111' } } }, a.id);
    const acc = projectAccounts([a, x, y]).accounts[0];
    expect(acc.conflicts.map((c) => c.field)).toEqual(['promptPay']);
    expect(acc.promptPay?.id).toBe('0812345678');
  });
});
