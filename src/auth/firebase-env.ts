/**
 * What a build may talk to, decided from its `EXPO_PUBLIC_FIREBASE_*` values.
 * Pure, so the rule is tested without the Firebase SDK (`firebase-web.ts` feeds
 * it the real environment).
 *
 * The emulator hosts are honoured only for a `demo-` project. A build with a
 * real project id never reaches an emulator, even if an emulator variable is
 * set by accident (a shell that still exports it, a cached bundle): it would
 * silently send a farmer's data nowhere, or sign them in against a fake.
 */

export interface FirebaseEnv {
  readonly projectId?: string;
  readonly authEmulatorHost?: string;
  readonly firestoreEmulatorHost?: string;
  readonly databaseId?: string;
}

export interface FirebaseSettings {
  readonly projectId: string;
  /** Set only for a `demo-` project. */
  readonly authEmulatorHost?: string;
  readonly firestoreEmulatorHost?: string;
  /** One config value, `(default)` unless told otherwise (D-84). */
  readonly databaseId: string;
  /** Sign-in can run: a real project, or the Auth emulator. */
  readonly authAvailable: boolean;
  /** Sync can run: a real project, or the Firestore emulator. */
  readonly syncAvailable: boolean;
}

export function firebaseSettings(env: FirebaseEnv): FirebaseSettings {
  const projectId = env.projectId || 'demo-mon-farm';
  const isReal = !projectId.startsWith('demo-');
  const authEmulatorHost = isReal ? undefined : env.authEmulatorHost || undefined;
  const firestoreEmulatorHost = isReal ? undefined : env.firestoreEmulatorHost || undefined;
  return {
    projectId,
    authEmulatorHost,
    firestoreEmulatorHost,
    databaseId: env.databaseId || '(default)',
    authAvailable: isReal || !!authEmulatorHost,
    syncAvailable: isReal || !!firestoreEmulatorHost,
  };
}
