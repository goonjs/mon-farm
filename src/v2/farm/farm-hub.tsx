/**
 * /v2/farm — ข้อมูลฟาร์ม (farm mockup 2): the group's five kinds of master
 * data, each a row with one fact per line (D-70), then the note that all of
 * it is shared by the group and editable offline. The sync pill in the
 * header is the only sync signal; rows carry none (D-65).
 */

import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { activePoints, filterPeople } from '../../core/master';
import { projectAccounts } from '../../core/finance/accounts';
import { useT } from '../../i18n';
import { financeStore } from '../../store/finance';
import { BankIcon, FactRow, FarmIcon, GearIcon, IconTile, MenuItem, MoneyInIcon, PersonIcon, PinIcon, ScaleIcon, Check, ReceiptIcon } from '../../ui';
import { V2_HOME } from '../routes';
import { FarmScreen, HelpNote, RowCard, useMaster } from './pieces';

export function FarmHubScreen() {
  const msg = useT();
  const router = useRouter();
  const { state } = useMaster();
  const accounts = useAccountCount();
  const go = (href: string) => () => router.push(href as Href);

  const farms = state?.properties.filter((p) => !p.deleted).length ?? 0;
  const points = state ? activePoints(state).length : 0;
  const people = state ? filterPeople(state.people, 'all').length : 0;
  const buyers = state?.buyers.filter((b) => !b.deleted).length ?? 0;

  return (
    <FarmScreen title={msg('farmData.title')} fallback={V2_HOME} testID="farm-hub">
      <RowCard>
        <MenuItem testID="hub-farms" label={msg('properties.title')} onPress={go('/v2/farms')} leading={<IconTile tone="accept" icon={(c) => <FarmIcon color={c} size={22} />} />}>
          <FactRow icon={(c) => <FarmIcon color={c} size={12} />}>{msg('farmData.propertiesCount', { n: farms })}</FactRow>
          <FactRow icon={(c) => <PinIcon color={c} size={12} />}>{msg('v2f.pointsCount', { n: points })}</FactRow>
        </MenuItem>
        <MenuItem testID="hub-people" label={msg('farmData.people')} onPress={go('/v2/people')} leading={<IconTile tone="action" icon={(c) => <PersonIcon color={c} size={22} />} />}>
          <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{msg('farmData.peopleCount', { n: people })}</FactRow>
        </MenuItem>
        <MenuItem testID="hub-buyers" label={msg('farmData.buyers')} onPress={go('/v2/buyers')} leading={<IconTile tone="cream" icon={(c) => <MoneyInIcon color={c} size={22} />} />}>
          <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{msg('farmData.buyersCount', { n: buyers })}</FactRow>
        </MenuItem>
        <MenuItem testID="hub-accounts" label={msg('v2.accounts')} onPress={go('/v2/accounts')} leading={<IconTile tone="action" icon={(c) => <BankIcon color={c} size={22} />} />}>
          <FactRow icon={(c) => <BankIcon color={c} size={12} />}>{msg('v2f.accountsCount', { n: accounts })}</FactRow>
        </MenuItem>
        <MenuItem testID="hub-sale-settings" label={msg('farmData.saleSettings')} onPress={go('/v2/sale-settings')} leading={<IconTile tone="neutral" icon={(c) => <GearIcon color={c} size={22} />} />}>
          <FactRow icon={(c) => <ReceiptIcon color={c} size={12} />}>{msg('saleSettings.net')}</FactRow>
          <FactRow icon={(c) => <ReceiptIcon color={c} size={12} />}>{msg('saleSettings.basket')}</FactRow>
          <FactRow icon={(c) => <ScaleIcon color={c} size={12} />}>{msg('v2f.scale')}</FactRow>
          <FactRow icon={(c) => <Check color={c} size={12} />}>{msg('v2f.zero')}</FactRow>
          <FactRow icon={(c) => <ReceiptIcon color={c} size={12} />}>{msg('v2f.numbering')}</FactRow>
        </MenuItem>
      </RowCard>
      <HelpNote title={msg('v2f.offlineTitle')} lines={[msg('v2f.offlineBody')]} />
    </FarmScreen>
  );
}

/** Receiving accounts are MONEY's (E05-S07); the hub only counts the live ones. */
function useAccountCount(): number {
  const [n, setN] = useState(0);
  const load = useCallback(() => {
    let live = true;
    financeStore.load().then(
      (events) => live && setN(projectAccounts(events).accounts.filter((a) => !a.deleted).length),
      () => live && setN(0),
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(load, [load]);
  useFocusEffect(load);
  return n;
}
