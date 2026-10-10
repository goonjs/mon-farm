/**
 * The v2 home (D-82): v1.1.0 farm mockup screen 9 — the card home under a
 * ScreenHeader whose ☰ opens the app menu (screen 1). Cards only link to
 * placeholders for now; no figures are shown until the real screens exist,
 * so nothing here is invented data.
 */

import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { farmSection, sectionHref, SALE_STEPS, type V2Section } from './routes';
import { useT } from '../i18n';
import { useSyncStatus } from '../sync/use-sync-status';
import { useTheme } from '../theme';
import { Drawer, MenuItem, MenuSection, ScreenHeader } from '../ui';

export function V2Home() {
  const t = useTheme();
  const msg = useT();
  const sync = useSyncStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  const item = (s: V2Section, onPress?: () => void, testID = `nav-${s.slug}`) => (
    <MenuItem key={testID} testID={testID} label={msg(s.titleId)} href={sectionHref(s)} onPress={onPress} />
  );
  const startSale = SALE_STEPS[0];

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('v2.home')} menu={{ onPress: () => setMenuOpen(true) }} sync={sync} />
      <ScrollView testID="v2-home" contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg }}>
        <MenuSection title={msg('v2.prepare')}>
          {item(startSale, undefined, 'home-sale-start')}
          <MenuItem testID="home-record-expense" label={msg('v2.recordExpense')} href={sectionHref(farmSection('expenses'))} />
          {item(farmSection('sales'))}
        </MenuSection>
        <MenuSection title={msg('v2.toKnow')}>
          <MenuItem testID="home-owed" label={msg('v2.owed')} href={sectionHref(farmSection('debts'))} />
          {item(farmSection('expenses'))}
          <MenuItem testID="home-workers" label={msg('v2.workers')} href={sectionHref(farmSection('people'))} />
        </MenuSection>
      </ScrollView>

      <Drawer open={menuOpen} onClose={close}>
        <MenuSection title={msg('v2.prepare')}>
          {item(startSale, close, 'menu-sale-start')}
          {item(farmSection('sales'), close)}
        </MenuSection>
        <MenuSection title={msg('menu.shared')}>
          {['farm', 'farms', 'points', 'people', 'buyers', 'accounts', 'shares', 'expenses', 'debts'].map((slug) =>
            item(farmSection(slug), close),
          )}
        </MenuSection>
        <MenuSection title={msg('menu.device')}>
          {item(farmSection('device'), close)}
          {item(farmSection('sync'), close)}
        </MenuSection>
      </Drawer>
    </View>
  );
}
