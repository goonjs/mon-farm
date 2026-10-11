/**
 * Web Google sign-in through the Firebase Auth JS SDK (popup).
 *
 * There is no Firebase project yet (E01-S07), so the only working target is
 * the Auth emulator: a build with `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`
 * set (e.g. `127.0.0.1:9099`) signs in against it with the `demo-` project
 * id. A build with neither a real config nor the emulator refuses to try
 * rather than talk to anything real (NFR-5, E01-S07's "no real backend from
 * dev/preview" rule).
 *
 * `process.env.EXPO_PUBLIC_*` must be read with dot access: Expo inlines them
 * at build time only in that form.
 */

import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';

import { userFromSignIn } from '../core/user';
import { failureFromCode, SignInError } from './errors';
import type { GoogleSignIn } from './google';

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-mon-farm';
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  projectId,
};
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

let auth: Auth | null = null;

function authOnce(): Auth {
  if (auth) return auth;
  if (!emulatorHost && config.projectId.startsWith('demo-')) {
    throw new Error('Firebase is not configured (E01-S07) and no Auth emulator is set.');
  }
  const app = getApps()[0] ?? initializeApp(config);
  // The SDK keeps its own refresh token for the sync that comes later
  // (E01-S09); the app's own record of who signed in is the account store.
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  if (emulatorHost) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  return auth;
}

export const googleSignIn: GoogleSignIn = {
  async signIn() {
    // Known offline: say so at once rather than open a popup that cannot load.
    if (globalThis.navigator?.onLine === false) throw new SignInError('offline');
    try {
      const { user } = await signInWithPopup(authOnce(), new GoogleAuthProvider());
      const google = user.providerData.find((p) => p.providerId === GoogleAuthProvider.PROVIDER_ID);
      return userFromSignIn(user.uid, user.displayName, { provider: 'google', subject: google?.uid ?? user.uid });
    } catch (err) {
      const code = (err as { code?: unknown })?.code;
      if (typeof code !== 'string') console.error('Sign-in failed.', err);
      throw new SignInError(failureFromCode(typeof code === 'string' ? code : undefined), { cause: err });
    }
  },
};
