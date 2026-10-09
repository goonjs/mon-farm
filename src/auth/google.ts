/**
 * The Google sign-in port (E02-S01, ACC-1).
 *
 *   google.web.ts    — Firebase Auth JS SDK, popup; against the Auth emulator
 *                      until the Firebase project exists (E01-S07)
 *   google.native.ts — not built: needs the Android dev client (E01-S06) and
 *                      an approved native Google sign-in dependency
 *
 * Signing in is the ONLY step that needs the network. What it returns is
 * stored on the device (`src/store/account.ts`), and that stored user — not
 * the auth SDK's state — is what lets the app open offline afterwards.
 */

import type { User } from '../core/user';

export interface GoogleSignIn {
  /** Resolves with the signed-in user; rejects with `SignInError`. */
  signIn(): Promise<User>;
}

/** Ambient declaration only — see the matching note in `src/store/store.ts`. */
export declare const googleSignIn: GoogleSignIn;
