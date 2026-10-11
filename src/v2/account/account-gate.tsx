/**
 * The front door: nothing in the app renders until the device knows who is
 * signed in (E02-S01, ACC-6, D-23) and which farm group is open (E02-S02,
 * D-24).
 *
 * Reads the signed-in user from the device's account store — never from the
 * network — so reopening offline after the first sign-in goes straight in,
 * however stale the auth token is (ACC-6). Until that read finishes it shows
 * only the mark.
 *
 * There is no sign-out (D-23): once a user is stored, this never shows the
 * sign-in screen again.
 *
 * Which group opens is decided from the signed-in user's memberships kept on
 * the device (`decideEntry`): none → create, one → straight in. Two or more is
 * the picker of E02-S04; nothing in this build can produce a second group, so
 * until then the first one opens.
 *
 * The session user and group (`store/session.ts`) are set before the app
 * renders: every write path stamps `actor.userId` and `groupId` from there.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { googleSignIn as defaultGoogle, type GoogleSignIn } from '../../auth/google';
import { decideEntry, membershipsOf, newGroup, type Membership } from '../../core/group';
import type { GroupId, UserId } from '../../core/types';
import type { User } from '../../core/user';
import { useT } from '../../i18n';
import { uuidv7 } from '../../lib/id';
import { accountStore, type AccountStore } from '../../store/account';
import { setSessionGroup, setSessionUser } from '../../store/session';
import { useTheme } from '../../theme';
import { BrandMark } from '../brand-mark';
import { GroupStartScreen } from './group-start-screen';
import { SignInScreen } from './sign-in-screen';

type Phase =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'no-group'; user: User }
  | { kind: 'in-group'; user: User; groupId: GroupId };

/**
 * The signed-in user's group to open, or null when they have none (E02-S04
 * replaces the `pick` case). Another account's groups on this device never
 * count.
 */
function groupToOpen(memberships: readonly Membership[], userId: UserId): GroupId | null {
  const entry = decideEntry(memberships, userId);
  if (entry.kind === 'enter') return entry.groupId;
  if (entry.kind === 'pick') return membershipsOf(memberships, userId)[0].groupId;
  return null;
}

export function AccountGate({
  children,
  accounts = accountStore,
  google = defaultGoogle,
}: {
  children: ReactNode;
  /** Injected by tests; the app uses the platform adapters. */
  accounts?: AccountStore;
  google?: GoogleSignIn;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  const enter = (user: User, memberships: readonly Membership[]) => {
    setSessionUser(user.userId);
    const groupId = groupToOpen(memberships, user.userId);
    setSessionGroup(groupId);
    setPhase(groupId ? { kind: 'in-group', user, groupId } : { kind: 'no-group', user });
  };

  useEffect(() => {
    let live = true;
    Promise.all([accounts.user(), accounts.memberships()])
      .then(([user, memberships]) => {
        if (!live) return;
        if (user) enter(user, memberships);
        else setPhase({ kind: 'signed-out' });
      })
      .catch((err) => {
        console.error('Stored account could not be read.', err);
        if (live) setPhase({ kind: 'signed-out' });
      });
    return () => {
      live = false;
    };
  }, [accounts]);

  const signIn = async () => {
    const user = await google.signIn();
    await accounts.saveUser(user);
    // A first sign-in on a new device should ask the server for this user's
    // groups before offering to create one (flow §1.1) — needs the backend.
    enter(user, await accounts.memberships());
  };

  const createGroup = async (user: User, name: string) => {
    const { membership, op } = newGroup(uuidv7(), name, user, Date.now());
    await accounts.createGroup(membership, op);
    enter(user, await accounts.memberships());
  };

  if (phase.kind === 'loading') return <Opening />;
  if (phase.kind === 'signed-out') return <SignInScreen onSignIn={signIn} />;
  if (phase.kind === 'no-group') {
    const { user } = phase;
    return <GroupStartScreen displayName={user.displayName} onCreate={(name) => createGroup(user, name)} />;
  }
  return <>{children}</>;
}

/** Until the stored account is read: only the mark, so nothing flashes. */
function Opening() {
  const t = useTheme();
  const msg = useT();
  return (
    <View
      testID="account-opening"
      accessibilityLabel={msg('acct.opening')}
      style={{ flex: 1, backgroundColor: t.color.surface, alignItems: 'center', justifyContent: 'center' }}
    >
      <BrandMark size={112} testID="account-opening-mark" />
    </View>
  );
}
