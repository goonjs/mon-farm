/**
 * Web Google sign-in through the Firebase Auth JS SDK (popup).
 *
 * The app and Auth instance are shared with the sync client
 * (`firebase-web.ts`), where the config rules live: a build with neither a
 * real project nor the Auth emulator refuses to try.
 */

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

import { userFromSignIn } from '../core/user';
import { failureFromCode, SignInError } from './errors';
import { firebaseAuth } from './firebase-web';
import type { GoogleSignIn } from './google';

export const googleSignIn: GoogleSignIn = {
  async signIn() {
    // Known offline: say so at once rather than open a popup that cannot load.
    if (globalThis.navigator?.onLine === false) throw new SignInError('offline');
    try {
      const { user } = await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      const google = user.providerData.find((p) => p.providerId === GoogleAuthProvider.PROVIDER_ID);
      return userFromSignIn(user.uid, user.displayName, { provider: 'google', subject: google?.uid ?? user.uid });
    } catch (err) {
      const code = (err as { code?: unknown })?.code;
      if (typeof code !== 'string') console.error('Sign-in failed.', err);
      throw new SignInError(failureFromCode(typeof code === 'string' ? code : undefined), { cause: err });
    }
  },
};
