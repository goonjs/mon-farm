/**
 * Native Google sign-in is not built yet (E02-S01 Dev notes): it needs the
 * Android dev client (E01-S06), an OAuth client with the app's SHA-1 (owner),
 * and a native sign-in dependency through the CLAUDE.md gate. Until then the
 * login screen shows its generic failure rather than pretending.
 */

import { SignInError } from './errors';
import type { GoogleSignIn } from './google';

export const googleSignIn: GoogleSignIn = {
  async signIn() {
    console.warn('Google sign-in is not available on this platform yet (E01-S06).');
    throw new SignInError('failed');
  },
};
