/**
 * "รับยอดโอนเข้า" on the settlement screen (E05-S07, D-38, D-80).
 *
 * Where the owner transfer goes: the default account, another account, cash,
 * a free note, or nothing — all optional, recorded against the sale in the
 * finance log. The amount is the owner share plus any debt repayments the
 * buyer transfers with it (D-71 route 3). "Show the buyer" opens the large
 * full-screen view, available once the rounding question is answered (?B1)
 * so the amount shown is final.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { projectAccounts } from '../../core/finance/accounts';
import { projectDebts } from '../../core/finance/debts';
import { formatSatang } from '../../core/finance/money';
import { BANKS } from '../../core/finance/promptpay';
import type { SaleAccountChoice } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useSaleCounts } from '../../finance/use-live-sales';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Button } from '../chrome';
import { CardTitle, Chip, ChipRow, Input, Note } from './parts';

export function SaleAccountCard({ saleId, ownerSatang, ready = true }: { saleId: string; ownerSatang: number; ready?: boolean }) {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const inFlight = useInFlight();
  const counts = useSaleCounts();
  const accounts = useMemo(() => projectAccounts(fin.events ?? []), [fin.events]);
  const choice = accounts.choiceFor(saleId);
  const [note, setNote] = useState<string | null>(null);

  const transferIn = useMemo(() => {
    let sum = 0;
    for (const a of projectDebts(fin.events ?? [], counts).values()) {
      for (const p of a.payments) if (p.saleId === saleId && !p.deleted && p.method === 'transfer-with-owner') sum += p.amountSatang;
    }
    return sum;
  }, [fin.events, saleId, counts]);
  const amount = ownerSatang + transferIn;

  const set = (c: SaleAccountChoice | null) =>
    inFlight.run(async () => {
      await fin.write(`sale-account-${saleId}`, accounts.saleChoiceHead(saleId), { t: 'sale_account_set', saleId, choice: c });
    });

  const live = accounts.accounts.filter((a) => !a.deleted);
  const name = (id: string) => {
    const a = live.find((x) => x.id === id);
    return a?.label || BANKS.find((b) => b.code === a?.bankCode)?.name || msg('acct.show.pp');
  };
  const chosenAccount = choice?.kind === 'account' ? live.find((a) => a.id === choice.accountId) : undefined;

  return (
    <View testID="sale-account" style={{ gap: t.space.xs }}>
      <CardTitle>{msg('acct.sale.title')}</CardTitle>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
        <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.ink }}>{msg('acct.sale.toAccount')}</Text>
        <Text testID="sale-account-amount" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingXl, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {formatSatang(amount)}
        </Text>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('fin.baht')}</Text>
      </View>
      <ChipRow>
        {live.map((a) => (
          <Chip key={a.id} testID={`sale-account-${a.id}`} on={choice?.kind === 'account' && choice.accountId === a.id} onPress={() => void set({ kind: 'account', accountId: a.id })}>
            {`${name(a.id)}${a.id === accounts.defaultId ? ` ✓` : ''}`}
          </Chip>
        ))}
        <Chip testID="sale-account-cash" on={choice?.kind === 'cash'} onPress={() => void set({ kind: 'cash' })}>{msg('acct.sale.cash')}</Chip>
        <Chip testID="sale-account-note" on={choice?.kind === 'note' || note !== null} onPress={() => setNote(choice?.kind === 'note' ? choice.note : '')}>{msg('acct.sale.note')}</Chip>
        <Chip testID="sale-account-none" on={choice === null} onPress={() => void set(null)}>{msg('acct.sale.none')}</Chip>
      </ChipRow>
      {note !== null ? (
        <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Input testID="sale-account-note-text" value={note} onChangeText={setNote} placeholder={msg('acct.sale.notePlaceholder')} />
          </View>
          <Button testID="sale-account-note-save" variant="primary" onPress={() => void set({ kind: 'note', note: note.trim() }).then(() => setNote(null))}>
            {msg('common.save')}
          </Button>
        </View>
      ) : choice?.kind === 'note' ? (
        <Note>{choice.note}</Note>
      ) : null}
      {/* ?B1: only once the rounding question is answered, so the amount is final. */}
      {choice && !accounts.recordedFor(saleId) ? <Note testID="sale-account-unrecorded">{msg('acct.sale.unrecorded')}</Note> : null}
      {chosenAccount && ready && amount > 0 ? (
        <Button
          testID="show-account"
          variant="primary"
          onPress={() =>
            void inFlight.run(async () => {
              // Showing the buyer an account settles which account this sale used (review #3).
              if (!accounts.recordedFor(saleId)) {
                await fin.write(`sale-account-${saleId}`, null, { t: 'sale_account_set', saleId, choice: { kind: 'account', accountId: chosenAccount.id } });
              }
              router.push({ pathname: '/finance/show-account', params: { accountId: chosenAccount.id, amount: String(amount) } });
            })
          }
        >
          {msg('acct.show')}
        </Button>
      ) : null}
    </View>
  );
}
