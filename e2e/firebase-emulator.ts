import { expect, type APIRequestContext } from '@playwright/test';

import { E2E_USER } from './session';

/**
 * What the sync specs share for talking to the Firebase emulators (see
 * `sync-emulator.spec.ts`): the emulator addresses, a Firebase Auth session for
 * the e2e user, and the way to hand that session to a page.
 */

const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8085';
const PROJECT = 'demo-mon-farm';
const API_KEY = 'demo-api-key';
const DATABASE = process.env.E2E_FIRESTORE_DATABASE ?? '(default)';
export const documents = `${FIRESTORE}/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;
/** The emulator's admin token: skips the rules, for looking at what the app wrote. */
export const admin = { Authorization: 'Bearer owner' };

const emailOf = (userId: string) => `${userId}@example.com`;

/** Signs the test user up on the Auth emulator under the uid the app's session already has. */
export async function emulatorSession(request: APIRequestContext, user: { userId: string } = E2E_USER) {
  const res = await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    headers: admin, // the emulator lets an admin choose the uid
    data: { localId: user.userId, email: emailOf(user.userId), password: 'secret-pass', returnSecureToken: true },
  });
  // A second spec signing the same user up again finds it there already: fine.
  expect(res.ok() || res.status() === 400).toBe(true);
  return signInToEmulator(request, user);
}

/** A fresh Firebase session (tokens) for the e2e user, as a second device would get at sign-in. */
export async function signInToEmulator(request: APIRequestContext, user: { userId: string } = E2E_USER) {
  // An admin-made account comes back without tokens: sign in to get them.
  const signedIn = await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    data: { email: emailOf(user.userId), password: 'secret-pass', returnSecureToken: true },
  });
  expect(signedIn.ok()).toBe(true);
  return (await signedIn.json()) as { idToken: string; refreshToken: string; localId: string };
}

/** What the Firebase Auth SDK persists, so it restores this user on load. */
export function persistedUser(s: { idToken: string; refreshToken: string; localId: string }) {
  const now = String(Date.now());
  return {
    fbase_key: `firebase:authUser:${API_KEY}:[DEFAULT]`,
    value: {
      uid: s.localId,
      email: emailOf(s.localId),
      emailVerified: false,
      isAnonymous: false,
      providerData: [],
      stsTokenManager: { refreshToken: s.refreshToken, accessToken: s.idToken, expirationTime: Date.now() + 3_600_000 },
      createdAt: now,
      lastLoginAt: now,
      apiKey: API_KEY,
      appName: '[DEFAULT]',
    },
  };
}

/** Runs in the page: puts the persisted Firebase user where the Auth SDK looks for it. */
export function writeFirebaseSession(record: ReturnType<typeof persistedUser>): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('firebaseLocalStorageDb', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put(record);
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}
