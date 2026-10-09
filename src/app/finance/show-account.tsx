/**
 * Full-screen account for the rubber buyer to read and pay (E05-S07, D-80).
 *
 * Large and plain: PromptPay first when the account has it, bank details
 * otherwise, switchable both ways, with the transfer amount. The PromptPay
 * payload is built on the device (EMVCo, `promptpay.ts`), so this works
 * offline; drawing it as a QR image needs a QR renderer, which is a new
 * dependency awaiting approval — until then the screen says so instead of
 * showing a picture. Keep-awake (?B2) is the same: it needs expo-keep-awake.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '../../components/chrome';
import { Chip, ChipRow, Note } from '../../components/finance/parts';
import { projectAccounts } from '../../core/finance/accounts';
import { formatSatang } from '../../core/finance/money';
import { BANKS, promptPayPayload } from '../../core/finance/promptpay';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

export default function ShowAccountScreen() {
  const { accountId, amount } = useLocalSearchParams<{ accountId: string; amount: string }>();
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const account = useMemo(() => projectAccounts(fin.events ?? []).accounts.find((a) => a.id === accountId), [fin.events, accountId]);
  const satang = Number(amount);
  // Only a positive whole number of satang may reach the buyer or a QR (review #1).
  const amountOk = Number.isSafeInteger(satang) && satang > 0;
  const [view, setView] = useState<'pp' | 'bank' | null>(null);
  const shown = view ?? (account?.promptPay ? 'pp' : 'bank');

  const big = { fontFamily: t.font.family.mono, fontSize: t.font.size.figure, fontWeight: t.font.weight.black, color: t.color.ink } as const;
  const label = { fontFamily: t.font.family.sans, fontSize: t.font.size.lead, color: t.color.inkSoft } as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScrollView contentContainerStyle={{ padding: t.space.xl, gap: t.space.lg }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.title, fontWeight: t.font.weight.black, color: t.color.ink }}>
          {msg('acct.show.title')}
        </Text>
        <View style={{ gap: t.space.xs }}>
          <Text style={label}>{msg('acct.show.amount')}</Text>
          {amountOk ? (
            <Text testID="show-amount" style={big}>{`${formatSatang(satang)} ฿`}</Text>
          ) : (
            <Note tone="reject" testID="show-amount-bad">{msg('acct.show.badAmount')}</Note>
          )}
        </View>

        {account?.promptPay && account.bankCode ? (
          <ChipRow>
            <Chip testID="show-pp" on={shown === 'pp'} onPress={() => setView('pp')}>{msg('acct.show.pp')}</Chip>
            <Chip testID="show-bank" on={shown === 'bank'} onPress={() => setView('bank')}>{msg('acct.show.bank')}</Chip>
          </ChipRow>
        ) : null}

        {account && shown === 'pp' && account.promptPay ? (
          <View testID="show-pp-details" style={{ gap: t.space.sm }}>
            <Text style={label}>{msg('acct.show.pp')}</Text>
            <Text testID="show-pp-id" style={big}>{account.promptPay.id}</Text>
            <View
              testID="show-qr-pending"
              accessibilityLabel={amountOk ? promptPayPayload(account.promptPay, satang) : undefined}
              style={{ padding: t.space.lg, borderRadius: t.radius.lg, borderWidth: t.border.thick, borderStyle: 'dashed', borderColor: t.color.ruleStrong }}
            >
              <Note>{msg('acct.show.qrPending')}</Note>
            </View>
          </View>
        ) : null}

        {account && shown === 'bank' && account.bankCode ? (
          <View testID="show-bank-details" style={{ gap: t.space.sm }}>
            <Text style={label}>{BANKS.find((b) => b.code === account.bankCode)?.name ?? account.bankCode}</Text>
            <Text testID="show-account-no" style={big}>{account.accountNo}</Text>
            <Text style={{ ...label, color: t.color.ink, fontWeight: t.font.weight.bold }}>{account.accountName}</Text>
          </View>
        ) : null}

        <Button testID="show-close" onPress={() => router.back()}>{msg('acct.show.close')}</Button>
      </ScrollView>
    </View>
  );
}
