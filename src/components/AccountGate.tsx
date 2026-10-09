/**
 * The front door: nothing in the app renders until the device knows who is
 * signed in (E02-S01, ACC-6, D-23) and which farm group is open (E02-S02,
 * D-24).
 *
 * Reads the signed-in user from the device's account store — never from the
 * network — so reopening offline after the first sign-in goes straight in,
 * however stale the auth token is (AC5, AC7). Before the read finishes it
 * renders nothing: the flow's "splash until we know where to go" (§1).
 *
 * There is no sign-out (D-23): once a user is stored, this never shows the
 * login screen again.
 *
 * Which group opens is decided from the memberships kept on the device
 * (`decideEntry`): none → create/join, one → straight in. Two or more is the
 * picker of E02-S04; nothing in this build can produce a second group
 * (joining is E02-S03), so until then the first one opens.
 */

import { useEffect, useState, type ReactNode } from 'react';

import { googleSignIn as defaultGoogle, type GoogleSignIn } from '../auth/google';
import { decideEntry, newGroup, type Membership } from '../core/group';
import type { GroupId } from '../core/types';
import type { User } from '../core/user';
import { uuidv7 } from '../lib/id';
import { accountStore, type AccountStore } from '../store/account';
import { setSessionGroup, setSessionUser } from '../store/session';
import { GroupStartScreen } from './GroupStartScreen';
import { LoginScreen } from './LoginScreen';

type Phase =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'no-group'; user: User }
  | { kind: 'in-group'; user: User; groupId: GroupId };

/** The group to open, or null when there is none (E02-S04 replaces the `pick` case). */
function groupToOpen(memberships: readonly Membership[]): GroupId | null {
  const entry = decideEntry(memberships);
  if (entry.kind === 'enter') return entry.groupId;
  if (entry.kind === 'pick') return memberships[0].groupId;
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
    const groupId = groupToOpen(memberships);
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

  if (phase.kind === 'loading') return null;
  if (phase.kind === 'signed-out') return <LoginScreen onSignIn={signIn} />;
  if (phase.kind === 'no-group') {
    const { user } = phase;
    return <GroupStartScreen displayName={user.displayName} onCreate={(name) => createGroup(user, name)} />;
  }
  return <>{children}</>;
}
