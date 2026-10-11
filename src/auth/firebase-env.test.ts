import { describe, expect, it } from 'vitest';

import { firebaseSettings } from './firebase-env';

const emulators = { authEmulatorHost: '127.0.0.1:9099', firestoreEmulatorHost: '127.0.0.1:8085' };

describe('firebaseSettings', () => {
  it('a build with no config at all talks to nothing', () => {
    expect(firebaseSettings({})).toMatchObject({ projectId: 'demo-mon-farm', authAvailable: false, syncAvailable: false });
  });

  it('a demo project with the emulators set uses them', () => {
    expect(firebaseSettings({ projectId: 'demo-mon-farm', ...emulators })).toMatchObject({
      ...emulators,
      authAvailable: true,
      syncAvailable: true,
    });
  });

  it('a REAL project ignores the emulator variables: it never connects to an emulator', () => {
    const s = firebaseSettings({ projectId: 'mon-farmmate', ...emulators });
    expect(s.authEmulatorHost).toBeUndefined();
    expect(s.firestoreEmulatorHost).toBeUndefined();
    expect(s).toMatchObject({ authAvailable: true, syncAvailable: true });
  });

  it('the database id is one value, (default) unless set', () => {
    expect(firebaseSettings({ projectId: 'mon-farmmate' }).databaseId).toBe('(default)');
    expect(firebaseSettings({ projectId: 'mon-farmmate', databaseId: 'other' }).databaseId).toBe('other');
    expect(firebaseSettings({ projectId: 'mon-farmmate', databaseId: '' }).databaseId).toBe('(default)');
  });

  it('only one emulator set: only that one is available', () => {
    expect(firebaseSettings({ projectId: 'demo-x', authEmulatorHost: '127.0.0.1:9099' })).toMatchObject({ authAvailable: true, syncAvailable: false });
  });
});
