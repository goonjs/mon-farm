/**
 * The front door (E02-S01): nothing in the app renders until the device
 * knows who is signed in (ACC-6, D-23).
 *
 * Reads the signed-in user from the device's account store — never from the
 * network — so reopening offline after the first sign-in goes straight in,
 * however stale the auth token is (AC5, AC7). Before the read finishes it
 * renders nothing: the flow's "splash until we know where to go" (§1).
 *
 * There is no sign-out (D-23): once a user is stored, this never shows the
 * login screen again.
 */

import { useEffect, useState, type ReactNode } from 'react';

import { googleSignIn as defaultGoogle, type GoogleSignIn } from '../auth/google';
import type { User } from '../core/user';
import { accountStore, type AccountStore } from '../store/account';
import { setSessionUser } from '../store/session';
import { LoginScreen } from './LoginScreen';

type Phase = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'signed-in'; user: User };

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

  const enter = (user: User) => {
    setSessionUser(user.userId);
    setPhase({ kind: 'signed-in', user });
  };

  useEffect(() => {
    let live = true;
    accounts
      .user()
      .then((user) => {
        if (!live) return;
        if (user) enter(user);
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
    enter(user);
  };

  if (phase.kind === 'loading') return null;
  if (phase.kind === 'signed-out') return <LoginScreen onSignIn={signIn} />;
  return <>{children}</>;
}
