/** The settlement's way into the buyer check (E05-S03), showing where the check stands. */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { buyerCheck, type SaleFigures } from '../../core/finance/buyer-check';
import { useFinance } from '../../finance/use-finance';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Button } from '../chrome';
import { CardTitle, Fact, Note } from './parts';

export function BuyerCheckEntry({ saleId, ours }: { saleId: string; ours: SaleFigures }) {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const check = useMemo(() => buyerCheck(fin.events ?? [], saleId, ours), [fin.events, saleId, ours]);
  const done = check.status !== 'pending';
  // Until the log has loaded the status is not known — show nothing rather than a false "pending".
  if (fin.events === null) return null;
  return (
    <View testID="check-entry" style={{ gap: t.space.xs }}>
      <CardTitle>{msg('chk.title')}</CardTitle>
      <Fact mark={done ? 'check' : 'half'} tone={check.status === 'diff' || !done ? 'warn' : 'accept'} testID="check-entry-status">
        {msg(`chk.status.${check.status}`)}
      </Fact>
      {check.stale ? <Note tone="warn">{msg('chk.stale', { was: msg(`chk.status.${check.recorded!}`) })}</Note> : null}
      {check.conflict ? <Note tone="reject" testID="check-entry-conflict">{msg('chk.conflict')}</Note> : null}
      <Button testID="open-check" onPress={() => router.push({ pathname: '/sale/[id]/check', params: { id: saleId } })}>
        {`${msg('chk.open')} ›`}
      </Button>
    </View>
  );
}
