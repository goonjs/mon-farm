/**
 * Receiving accounts (E05-S07, D-38, D-80): the owner's bank/PromptPay
 * accounts, one default, and which account a sale's owner transfer went to.
 * Group data in the finance log, so every device sees the same list; two
 * devices editing the same number disagree loudly (D-30).
 */

import { foldRecordPublic, headOf, type FieldConflict } from './ledger';
import { checkAccount, isPromptPayId } from './promptpay';
import type { AccountFields, FinanceEvent, SaleAccountChoice } from './types';

export type AccountProblem = 'bank-or-promptpay' | 'account-number' | 'promptpay-id';

/** Bank details or PromptPay — at least one, each well-formed if given. */
export function checkAccountFields(f: AccountFields): AccountProblem[] {
  const hasBank = !!f.bankCode || f.accountNo.trim() !== '';
  const out: AccountProblem[] = [];
  if (!hasBank && !f.promptPay) out.push('bank-or-promptpay');
  if (hasBank && !checkAccount(f.bankCode ?? '', f.accountNo)) out.push('account-number');
  if (f.promptPay && !isPromptPayId(f.promptPay)) out.push('promptpay-id');
  return out;
}

export interface Account extends AccountFields {
  readonly id: string;
  readonly deleted: boolean;
  readonly headEventId: string;
  readonly conflicts: readonly FieldConflict[];
}

export interface AccountsState {
  /** In creation order. Includes deleted ones (restorable). */
  readonly accounts: readonly Account[];
  /** Null when none is set or the default was deleted. */
  readonly defaultId: string | null;
  readonly defaultHead: string | null;
  /** The sale's own choice, else the default account, else null. */
  choiceFor(saleId: string): SaleAccountChoice | null;
  saleChoiceHead(saleId: string): string | null;
}

export function projectAccounts(events: readonly FinanceEvent[]): AccountsState {
  const byTarget = new Map<string, FinanceEvent[]>();
  for (const e of events) {
    const t = e.payload.t;
    if (t !== 'account_added' && t !== 'account_changed' && t !== 'account_default_set' && t !== 'sale_account_set') continue;
    const list = byTarget.get(e.targetId) ?? [];
    list.push(e);
    byTarget.set(e.targetId, list);
  }

  const found: { account: Account; firstEventId: string }[] = [];
  let defaultChoice: string | null = null;
  let defaultHead: string | null = null;
  const sales = new Map<string, { choice: SaleAccountChoice | null; head: string }>();

  for (const [id, evs] of byTarget) {
    const kind = evs[0].payload.t;
    if (kind === 'account_added' || kind === 'account_changed') {
      const f = foldRecordPublic(evs, (c) => ({ ...(c.payload as { fields: AccountFields }).fields, deleted: false }), ['accountNo', 'bankCode', 'promptPay']);
      if (f) {
        found.push({
          account: { ...f.state, id, headEventId: f.head, conflicts: f.conflicts },
          firstEventId: evs.find((e) => e.baseEventId === null)?.id ?? '',
        });
      }
    } else {
      const head = headOf(evs);
      const p = evs.find((e) => e.id === head)?.payload;
      if (p?.t === 'account_default_set') {
        defaultChoice = p.accountId;
        defaultHead = head;
      } else if (p?.t === 'sale_account_set' && head) sales.set(p.saleId, { choice: p.choice, head });
    }
  }

  // Creation order by the creating event's id (UUIDv7) — display only, never a money decision.
  const accounts = found.sort((a, b) => (a.firstEventId < b.firstEventId ? -1 : 1)).map((x) => x.account);
  const live = new Set(accounts.filter((a) => !a.deleted).map((a) => a.id));
  const defaultId = defaultChoice && live.has(defaultChoice) ? defaultChoice : null;

  return {
    accounts,
    defaultId,
    defaultHead,
    choiceFor(saleId) {
      const own = sales.get(saleId);
      if (own) return own.choice;
      return defaultId ? { kind: 'account', accountId: defaultId } : null;
    },
    saleChoiceHead: (saleId) => sales.get(saleId)?.head ?? null,
  };
}
