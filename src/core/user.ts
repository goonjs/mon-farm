/**
 * The logical user (E02-S01, ACC-1).
 *
 * `userId` is the Firebase Auth uid: one account, one id, on every device it
 * signs in on — which is what lets two phones' events name the same person.
 * The ways of signing in are a separate list, so adding LINE later (a custom
 * token minted for the same uid) links a second identity to this user
 * instead of creating a new one. Mirrors `users/{uid}` in Firestore
 * (architecture §โครง Firestore).
 */

import type { UserId } from './types';

/** `line` is not built yet (deferred by the owner 2026-10-03); the slot is what ACC-1 asks for. */
export type IdentityProvider = 'google' | 'line';

/** One way in: the provider and that provider's own id for the person. */
export interface Identity {
  readonly provider: IdentityProvider;
  readonly subject: string;
}

export interface User {
  readonly userId: UserId;
  readonly displayName: string | null;
  readonly identities: readonly Identity[];
}

export function userFromSignIn(userId: UserId, displayName: string | null, identity: Identity): User {
  return { userId, displayName, identities: [identity] };
}

const same = (a: Identity, b: Identity) => a.provider === b.provider && a.subject === b.subject;

/** Adds an identity to the same user. Already linked → the user unchanged. */
export function linkIdentity(user: User, identity: Identity): User {
  if (user.identities.some((i) => same(i, identity))) return user;
  return { ...user, identities: [...user.identities, identity] };
}
