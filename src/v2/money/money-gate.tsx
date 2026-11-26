/**
 * The minimum-version gate on the money screens (E01-S28 round 1, S28-AC12 ก).
 *
 * A build below the group's minimum (`app_min` in the finance scope, see
 * `core/finance-scope.ts`) shows "อัปเดตแอปก่อนใช้หน้าเงิน" instead of the
 * screen, so it shows no money it may count the wrong way. The screen itself
 * is not mounted until the check has passed, so it reads and writes nothing
 * before then. With no minimum in the store (round 1) every screen opens.
 */

import type { Href } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';

import { appBelowMin, FINANCE_SCOPE } from '../../core/finance-scope';
import { useT } from '../../i18n';
import { store } from '../../store/store';
import { AppText } from '../../ui';
import { FarmScreen } from '../farm/pieces';

/** null while reading; a store that cannot be read gates nothing (the check is a guard, not a lock). */
export function useAppBelowMin(): boolean | null {
  const [below, setBelow] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    store.load(FINANCE_SCOPE).then(
      (events) => live && setBelow(appBelowMin(events)),
      (err) => {
        console.error('The app minimum could not be read.', err);
        if (live) setBelow(false);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return below;
}

function UpdateAppScreen() {
  const msg = useT();
  return (
    <FarmScreen title={msg('moneyGate.title')} fallback={'/v2' as Href} testID="money-update-app">
      <AppText variant="body">{msg('moneyGate.body')}</AppText>
    </FarmScreen>
  );
}

/** A money route: the screen, behind the minimum-version gate. */
export function moneyGated<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  function Gated(props: P) {
    const below = useAppBelowMin();
    if (below === null) return null;
    return below ? <UpdateAppScreen /> : <Screen {...props} />;
  }
  Gated.displayName = `MoneyGated(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return Gated;
}
