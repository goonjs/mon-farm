/**
 * Receiving accounts settings (E05-S07, D-38, D-80).
 *
 * Several accounts, one default. Each has bank details or PromptPay (at
 * least one), checked as typed. Changing the default needs no confirmation
 * but shows at once (the badge moves, the default sorts first); deleting the
 * default asks first and leaves no default. Deleting is restorable.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, TopBar } from '../../components/chrome';
import { Chip, ChipRow, Input, Label, Note } from '../../components/finance/parts';
import { checkAccountFields, projectAccounts, type Account } from '../../core/finance/accounts';
import { BANKS } from '../../core/finance/promptpay';
import type { AccountFields } from '../../core/finance/types';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { newId } from '../../lib/id';
import { useTheme } from '../../theme';

const EMPTY: AccountFields = { label: '', bankCode: null, accountNo: '', accountName: '', promptPay: null };

export default function AccountsScreen() {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const state = useMemo(() => projectAccounts(fin.events ?? []), [fin.events]);
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // The default first, then the rest — so a change of default is visible at once.
  const sorted = [...state.accounts].sort((a, b) => Number(b.id === state.defaultId) - Number(a.id === state.defaultId));

  const setDefault = (id: string) => fin.write('default-account', state.defaultHead, { t: 'account_default_set', accountId: id });
  const setDeleted = async (a: Account, deleted: boolean) => {
    await fin.write(a.id, a.headEventId, { t: 'account_changed', patch: { deleted } });
    setConfirming(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={msg('acct.title')} right={<Button testID="accounts-back" onPress={() => router.back()}>{msg('common.back')}</Button>} />
      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        {editing ? (
          <AccountForm
            key={editing === 'new' ? 'new' : editing.headEventId}
            initial={editing === 'new' ? EMPTY : editing}
            onCancel={() => setEditing(null)}
            onSave={async (fields) => {
              if (editing === 'new') {
                const id = newId('acct-');
                await fin.write(id, null, { t: 'account_added', fields });
                if (!state.defaultId) await fin.write('default-account', state.defaultHead, { t: 'account_default_set', accountId: id });
              } else {
                const patch: Record<string, unknown> = {};
                for (const k of Object.keys(fields) as (keyof AccountFields)[]) {
                  if (JSON.stringify(fields[k]) !== JSON.stringify(editing[k])) patch[k] = fields[k];
                }
                if (Object.keys(patch).length) await fin.write(editing.id, editing.headEventId, { t: 'account_changed', patch });
              }
              setEditing(null);
            }}
          />
        ) : (
          <Button testID="account-add" variant="primary" onPress={() => setEditing('new')}>{msg('acct.add')}</Button>
        )}

        {sorted.length === 0 ? <Note testID="accounts-empty">{msg('acct.empty')}</Note> : null}
        {sorted.map((a) => {
          const isDefault = a.id === state.defaultId;
          return (
            <View
              key={a.id}
              testID={`account-${a.id}`}
              style={{
                gap: t.space.xs,
                padding: t.space.md,
                borderRadius: t.radius.lg,
                borderWidth: isDefault ? t.border.thick : t.border.hair,
                borderColor: isDefault ? t.color.action : t.color.rule,
                opacity: a.deleted ? t.opacity.muted : 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                  {a.label || BANKS.find((b) => b.code === a.bankCode)?.name || msg('acct.show.pp')}
                </Text>
                {isDefault ? (
                  <Text testID={`account-default-${a.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, fontWeight: t.font.weight.bold, color: t.color.action }}>
                    {`✓ ${msg('acct.default')}`}
                  </Text>
                ) : null}
                {a.deleted ? <Note>{msg('acct.deleted')}</Note> : null}
              </View>
              {a.bankCode ? <Note>{`${BANKS.find((b) => b.code === a.bankCode)?.name ?? a.bankCode} · ${a.accountNo} · ${a.accountName}`}</Note> : null}
              {a.promptPay ? <Note>{`${msg('acct.show.pp')} · ${a.promptPay.id}`}</Note> : null}
              {a.conflicts.length ? <Note tone="reject">{msg('acct.conflict')}</Note> : null}
              {a.deleted ? (
                <Button testID={`account-restore-${a.id}`} onPress={() => void setDeleted(a, false)}>{msg('acct.restore')}</Button>
              ) : confirming === a.id ? (
                <View style={{ gap: t.space.xs }}>
                  {isDefault ? <Note tone="warn">{msg('acct.deleteDefault')}</Note> : null}
                  <View style={{ flexDirection: 'row', gap: t.space.sm }}>
                    <Button onPress={() => setConfirming(null)}>{msg('common.cancel')}</Button>
                    <Button testID={`account-delete-confirm-${a.id}`} variant="destructive" onPress={() => void setDeleted(a, true)}>{msg('acct.deleteConfirm')}</Button>
                  </View>
                </View>
              ) : (
                <ChipRow>
                  {!isDefault ? <Chip testID={`account-make-default-${a.id}`} onPress={() => void setDefault(a.id)}>{msg('acct.makeDefault')}</Chip> : null}
                  <Chip testID={`account-edit-${a.id}`} onPress={() => setEditing(a)}>{msg('acct.edit')}</Chip>
                  {/* Deleting the default asks first; any other account is restorable, so the same two-step stays for consistency. */}
                  <Chip testID={`account-delete-${a.id}`} onPress={() => setConfirming(a.id)}>{msg('acct.delete')}</Chip>
                </ChipRow>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function AccountForm({ initial, onSave, onCancel }: { initial: AccountFields; onSave: (f: AccountFields) => Promise<void>; onCancel: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [f, setF] = useState<AccountFields>(initial);
  const [tried, setTried] = useState(false);
  const problems = checkAccountFields(f);
  const digits = BANKS.find((b) => b.code === f.bankCode)?.digits ?? 10;
  const set = (patch: Partial<AccountFields>) => setF((x) => ({ ...x, ...patch }));

  return (
    <View testID="account-form" style={{ gap: t.space.md, padding: t.space.md, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk }}>
      <View style={{ gap: t.space.xs }}>
        <Label>{msg('acct.label')}</Label>
        <Input testID="account-label" value={f.label} onChangeText={(label) => set({ label })} placeholder={msg('acct.labelPlaceholder')} />
      </View>
      <View style={{ gap: t.space.xs }}>
        <Label>{msg('acct.bank')}</Label>
        <ChipRow>
          <Chip testID="account-bank-none" on={!f.bankCode} onPress={() => set({ bankCode: null, accountNo: '', accountName: '' })}>{msg('acct.noBank')}</Chip>
          {BANKS.map((b) => (
            <Chip key={b.code} testID={`account-bank-${b.code}`} on={f.bankCode === b.code} onPress={() => set({ bankCode: b.code })}>{b.name}</Chip>
          ))}
        </ChipRow>
        {f.bankCode ? (
          <>
            <Input testID="account-number" numeric value={f.accountNo} onChangeText={(accountNo) => set({ accountNo: accountNo.replace(/\D/g, '') })} placeholder={msg('acct.number')} />
            <Input testID="account-name" value={f.accountName} onChangeText={(accountName) => set({ accountName })} placeholder={msg('acct.name')} />
          </>
        ) : null}
      </View>
      <View style={{ gap: t.space.xs }}>
        <Label>{msg('acct.pp')}</Label>
        <ChipRow>
          <Chip testID="account-pp-none" on={!f.promptPay} onPress={() => set({ promptPay: null })}>{msg('acct.ppNone')}</Chip>
          <Chip testID="account-pp-mobile" on={f.promptPay?.type === 'mobile'} onPress={() => set({ promptPay: { type: 'mobile', id: f.promptPay?.id ?? '' } })}>{msg('acct.ppMobile')}</Chip>
          <Chip testID="account-pp-id" on={f.promptPay?.type === 'nationalId'} onPress={() => set({ promptPay: { type: 'nationalId', id: f.promptPay?.id ?? '' } })}>{msg('acct.ppId')}</Chip>
        </ChipRow>
        {f.promptPay ? (
          <Input
            testID="account-pp-number"
            numeric
            value={f.promptPay.id}
            onChangeText={(id) => set({ promptPay: { type: f.promptPay!.type, id: id.replace(/\D/g, '') } })}
            placeholder={msg('acct.ppNumber')}
          />
        ) : null}
      </View>
      {tried
        ? problems.map((p) => (
            <Note key={p} tone="reject" testID={`account-err-${p}`}>
              {msg(`acct.err.${p}`, { digits })}
            </Note>
          ))
        : null}
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <Button onPress={onCancel}>{msg('common.cancel')}</Button>
        <Button
          testID="account-save"
          variant="primary"
          onPress={() => {
            setTried(true);
            if (!problems.length) void onSave({ ...f, label: f.label.trim(), accountName: f.accountName.trim() });
          }}
        >
          {msg('common.save')}
        </Button>
      </View>
    </View>
  );
}
