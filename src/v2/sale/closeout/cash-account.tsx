/**
 * D-80 · "เข้าบัญชีไหน" for this sale (E05-S07), on the cash step under
 * "โอนเข้าบัญชีสวน" — the story keeps the old behaviour (no new mockup):
 * the chosen account (bank ••1234, the group default marked), cash from the
 * buyer, or a free note; "เลือก/เปลี่ยน" opens a sheet with the live
 * accounts, cash, a note and the link to /v2/accounts. A choice writes the
 * existing `sale_account_set` at `sale-account-<saleId>` on its head; a
 * closed sale shows the choice read-only. The buyer view shows the account.
 */

import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { projectAccounts, type Account } from '../../../core/finance/accounts';
import { BANKS } from '../../../core/finance/promptpay';
import type { SaleAccountChoice } from '../../../core/finance/types';
import { useInFlight } from '../../../finance/use-in-flight';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, BankIcon, BottomSheet, Button, Check, ChevronRight, RadioCard, TextField } from '../../../ui';
import type { Closeout } from './use-closeout';

const bankName = (a: Account) => BANKS.find((b) => b.code === a.bankCode)?.name ?? a.label;

export function AccountRow({ co }: { co: Closeout }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const flight = useInFlight();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const events = co.fin.events;
  if (!events) return null;
  const accounts = projectAccounts(events);
  const choice = accounts.choiceFor(co.saleId);
  const account = choice?.kind === 'account' ? (accounts.accounts.find((a) => a.id === choice.accountId && !a.deleted) ?? null) : null;
  const choose = (c: SaleAccountChoice | null) =>
    flight.run(async () => {
      if (co.closed) return;
      await co.fin.write(`sale-account-${co.saleId}`, accounts.saleChoiceHead(co.saleId), { t: 'sale_account_set', saleId: co.saleId, choice: c });
      setOpen(false);
    });
  const small = { color: t.color.inkSoft, lineHeight: Math.round(t.font.size.bodySm * 1.4) } as const;

  return (
    <>
      <View testID="cop-account" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <BankIcon color={t.color.inkSoft} size={14} />
        <View style={{ flex: 1 }}>
          {account ? (
            <>
              <AppText variant="bodySm" style={{ ...small, color: t.color.ink, fontWeight: t.font.weight.bold }}>{`${bankName(account)} ••${account.accountNo.slice(-4)}`}</AppText>
              {accounts.defaultId === account.id ? <AppText variant="bodySm" style={small}>{msg('v2s.defaultAccount')}</AppText> : null}
            </>
          ) : (
            <AppText variant="bodySm" style={{ ...small, ...(choice ? { color: t.color.ink, fontWeight: t.font.weight.bold } : {}) }}>
              {choice?.kind === 'cash' ? msg('v2s.cashFromBuyer') : choice?.kind === 'note' ? choice.note : msg('v2s.noneChosen')}
            </AppText>
          )}
        </View>
        {co.closed ? null : (
          <Pressable testID="cop-account-change" accessibilityRole="button" accessibilityLabel={msg('v2s.intoAccount')} onPress={() => setOpen(true)} style={{ minHeight: t.target.min, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xxs, backgroundColor: t.color.actionSunk, borderRadius: t.radius.pill, paddingHorizontal: t.space.md, paddingVertical: t.space.xs }}>
              <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.action }}>{msg(choice ? 'v2s.change' : 'v2s.choose')}</AppText>
              <ChevronRight color={t.color.action} size={7} />
            </View>
          </Pressable>
        )}
      </View>
      {open ? (
        <BottomSheet open onClose={() => setOpen(false)} title={msg('v2s.intoAccount')} testID="cop-account-sheet" closeLabel={msg('cop.close')}>
          {accounts.accounts
            .filter((a) => !a.deleted)
            .map((a) => (
              <RadioCard
                key={a.id}
                testID={`acct-${a.id}`}
                selected={account?.id === a.id}
                title={`${bankName(a)} ••${a.accountNo.slice(-4)}`}
                detail={[a.accountName, msg(a.promptPay ? 'v2s.hasPromptPay' : 'v2s.noPromptPay'), ...(accounts.defaultId === a.id ? [msg('v2s.defaultAccount')] : [])].join('\n')}
                onPress={() => void choose({ kind: 'account', accountId: a.id })}
              />
            ))}
          <RadioCard testID="acct-cash" selected={choice?.kind === 'cash'} title={msg('v2s.cashFromBuyer')} detail={msg('v2s.cashFromBuyerHint')} onPress={() => void choose({ kind: 'cash' })} />
          <TextField testID="acct-note" label={msg('v2s.noteWhich')} value={note} onChangeText={setNote} />
          <Button testID="acct-note-save" disabled={!note.trim()} icon={(c) => <Check color={c} size={12} />} onPress={() => void choose({ kind: 'note', note: note.trim() })}>
            {msg('common.save')}
          </Button>
          <Pressable testID="acct-settings" accessibilityRole="link" onPress={() => router.push('/v2/accounts' as Href)} style={{ minHeight: t.target.min, flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <AppText style={{ flex: 1, fontWeight: t.font.weight.bold, color: t.color.action }}>{msg('v2s.accountSettings')}</AppText>
            <ChevronRight color={t.color.action} size={9} />
          </Pressable>
          <AppText variant="caption">{msg('v2s.accountNote')}</AppText>
        </BottomSheet>
      ) : null}
    </>
  );
}
