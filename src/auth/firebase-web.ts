/**
 * The one Firebase app and Auth instance of the web build, shared by Google
 * sign-in (`google.web.ts`) and the sync client (`../sync/client.web.ts`).
 *
 * The public web config comes from `EXPO_PUBLIC_FIREBASE_*` (set by the dev and
 * prod deploy builds; the values are not secrets). Without it a build has
 * `demo-` defaults and may only talk to emulators: a build with neither a real
 * config nor an emulator refuses to try rather than talk to anything real
 * (NFR-5, E01-S07's "no real backend from dev/preview" rule).
 *
 * `process.env.EXPO_PUBLIC_*` must be read with dot access: Expo inlines them
 * at build time only in that form.
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

import { firebaseSettings } from './firebase-env';

// What this build may talk to, decided in one tested place (`firebase-env.ts`): the
// emulator variables count only for a `demo-` project, never for a real one.
const settings = firebaseSettings({
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  authEmulatorHost: process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
  firestoreEmulatorHost: process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST,
  databaseId: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID,
});
const { projectId } = settings;
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  projectId,
};

export const { authEmulatorHost, firestoreEmulatorHost, authAvailable, syncAvailable } = settings;
/**
 * Which Firestore database this build uses: one config value, `(default)`
 * unless told otherwise (owner decision 2026-10-11), so a separate database or
 * project can be swapped in later without touching code.
 */
export const firestoreDatabaseId = settings.databaseId;

export function firebaseApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(config);
}

let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (auth) return auth;
  if (!authAvailable) throw new Error('Firebase is not configured (E01-S07) and no Auth emulator is set.');
  // The SDK keeps its own refresh token (and restores it on the next launch);
  // the app's own record of who signed in is the account store.
  auth = initializeAuth(firebaseApp(), {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  if (authEmulatorHost) connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
  return auth;
}
