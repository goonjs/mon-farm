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
 * the device (`decideEntry`): one → straight in, with no network (ACC-6). Two or
 * more is the picker of E02-S04; until then the first one opens.
 *
 * A user with none on the device (a first sign-in on a new device, E02-S05)
 * is not yet "a user with no group": the server is asked first, bounded to
 * `LOOKUP_TIMEOUT_MS`, and create-group shows only when it answered "none". If
 * it cannot be asked the person sees a retry, not create-group — a second
 * group would split the farm's data (flow §1.1).
 *
 * The session user and group (`store/session.ts`) are set before the app
 * renders: every write path stamps `actor.userId` and `groupId` from there.
 *
 * Once a user is in a group, sync runs for them (E01-S09) beside the app, never
 * in front of it: it starts in the background and stops with the session.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { googleSignIn as defaultGoogle, type GoogleSignIn } from '../../auth/google';
import { decideEntry, membershipsOf, newGroup, type Membership } from '../../core/group';
import type { GroupId, UserId } from '../../core/types';
import type { User } from '../../core/user';
import { useT } from '../../i18n';
import { uuidv7 } from '../../lib/id';
import { accountStore, type AccountStore } from '../../store/account';
import { setSessionGroup, setSessionUser } from '../../store/session';
import { connectMemberships, connectRemote, type SyncRemote } from '../../sync/client';
import type { RemoteMemberships } from '../../sync/remote';
import { useSync } from '../../sync/use-sync';
import { useTheme } from '../../theme';
import { BrandMark } from '../brand-mark';
import { GroupCheckScreen } from './group-check-screen';
import { GroupStartScreen } from './group-start-screen';
import { SignInScreen } from './sign-in-screen';

type Phase =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  /** Asking the server which groups this user has (E02-S05); `failed` once it could not be asked. */
  | { kind: 'checking'; user: User; failed: boolean }
  | { kind: 'no-group'; user: User }
  | { kind: 'in-group'; user: User; groupId: GroupId };

/** How long to wait for the server's list of groups before saying it could not be asked. */
export const LOOKUP_TIMEOUT_MS = 10_000;

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
  connect = connectRemote,
  lookup = connectMemberships,
}: {
  children: ReactNode;
  /** Injected by tests; the app uses the platform adapters. */
  accounts?: AccountStore;
  google?: GoogleSignIn;
  connect?: (userId: UserId, groupId: GroupId) => Promise<SyncRemote | null>;
  /** The server's list of this user's groups; resolves null when this build has no backend to ask. */
  lookup?: (userId: UserId) => Promise<RemoteMemberships | null>;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  /** Which server check is current: an older one (retried, or the gate unmounted) must not change the screen. */
  const latestCheck = useRef(0);
  useEffect(
    () => () => {
      latestCheck.current = -1;
    },
    [],
  );

  const enter = (user: User, memberships: readonly Membership[]) => {
    setSessionUser(user.userId);
    const groupId = groupToOpen(memberships, user.userId);
    setSessionGroup(groupId);
    setPhase(groupId ? { kind: 'in-group', user, groupId } : { kind: 'no-group', user });
  };

  /** Straight in when the device knows a group of this user; otherwise the server decides. */
  const resolve = (user: User, memberships: readonly Membership[]) => {
    if (groupToOpen(memberships, user.userId)) enter(user, memberships);
    else void checkServer(user);
  };

  const checkServer = async (user: User) => {
    const id = ++latestCheck.current;
    const current = () => latestCheck.current === id;
    setPhase({ kind: 'checking', user, failed: false });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let over = false;
    try {
      const restored = await Promise.race([
        askServer(user, () => !over && current()),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            over = true;
            reject(new Error("The server did not answer in time."));
          }, LOOKUP_TIMEOUT_MS);
        }),
      ]);
      if (current()) enter(user, restored);
    } catch (err) {
      console.warn("The user's farm groups could not be fetched from the server.", err);
      if (current()) setPhase({ kind: 'checking', user, failed: true });
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * The user's groups from the server, kept on the device before they are used.
   * `[]` means the server said none, or this build has no backend (nothing to
   * split); anything that stops it answering throws.
   */
  const askServer = async (user: User, alive: () => boolean): Promise<Membership[]> => {
    const remote = await lookup(user.userId);
    if (!remote) return [];
    const groups = [...(await remote.myGroups())].sort((a, b) => (a.groupId < b.groupId ? -1 : a.groupId > b.groupId ? 1 : 0));
    const memberships = groups.map((g): Membership => ({ groupId: g.groupId, userId: user.userId, name: g.name, role: g.role }));
    // An answer that came too late, or for a check since retried, is dropped, not kept behind the screen's back.
    if (memberships.length > 0 && alive()) await accounts.saveMemberships(memberships);
    return memberships;
  };

  const signIn = async () => {
    const user = await google.signIn();
    await accounts.saveUser(user);
    resolve(user, await accounts.memberships());
  };

  useEffect(() => {
    let live = true;
    Promise.all([accounts.user(), accounts.memberships()])
      .then(([user, memberships]) => {
        if (!live) return;
        if (user) resolve(user, memberships);
        else setPhase({ kind: 'signed-out' });
      })
      .catch((err) => {
        console.error('Stored account could not be read.', err);
        if (live) setPhase({ kind: 'signed-out' });
      });
    return () => {
      live = false;
    };
    // Once per account store: this reads what is stored at start-up. `resolve` is a fresh closure every
    // render, so listing it would re-run the read (and a server check) on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  const createGroup = async (user: User, name: string) => {
    const { membership, op } = newGroup(uuidv7(), name, user, Date.now());
    await accounts.createGroup(membership, op);
    // Not re-read: once written, a failed read must not look like a failed create
    // (a retry would make a second group). One group only, until E02-S04.
    enter(user, [membership]);
  };

  if (phase.kind === 'loading') return <Opening />;
  if (phase.kind === 'signed-out') return <SignInScreen onSignIn={signIn} />;
  if (phase.kind === 'checking') {
    const { user } = phase;
    return (
      <GroupCheckScreen
        failed={phase.failed}
        onRetry={() => void checkServer(user)}
        // The Firebase session may be gone for good (the person has no sign-out, D-23): signing in again mends it.
        onSignInAgain={() => void signIn().catch((err) => console.warn('Signing in again did not complete.', err))}
      />
    );
  }
  if (phase.kind === 'no-group') {
    const { user } = phase;
    return <GroupStartScreen displayName={user.displayName} onCreate={(name) => createGroup(user, name)} />;
  }
  return (
    <>
      <SyncRunner userId={phase.user.userId} groupId={phase.groupId} accounts={accounts} connect={connect} />
      {children}
    </>
  );
}

/** Keeps the sync engine running for the open session; renders nothing. */
function SyncRunner(props: {
  userId: UserId;
  groupId: GroupId;
  accounts: AccountStore;
  connect: (userId: UserId, groupId: GroupId) => Promise<SyncRemote | null>;
}) {
  useSync(props.userId, props.groupId, props.accounts, props.connect);
  return null;
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
