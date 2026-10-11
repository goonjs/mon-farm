import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AccountGate } from './account-gate';
import { SignInError } from '../../auth/errors';
import type { GoogleSignIn } from '../../auth/google';
import { userFromSignIn } from '../../core/user';
import { MemoryAccountStore } from '../../store/account-memory';
import { NotSignedInError, sessionGroupId, sessionUserId, setSessionGroup, setSessionUser } from '../../store/session';
import { wrap } from '../../test/render';

/**
 * E02-S01 + E02-S02 on the v2 shell: the gate in front of the whole app. The
 * global jest setup signs a test user in; these tests are about the door
 * itself, so each starts from a device nobody has signed in on.
 */

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

const somchai = userFromSignIn('uid-1', 'สมชาย', { provider: 'google', subject: 'g-1' });
const home = <Text testID="app-inside">inside</Text>;

beforeEach(() => {
  setSessionUser(null);
  setSessionGroup(null);
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function open(accounts = new MemoryAccountStore(), google: GoogleSignIn = { signIn: async () => somchai }) {
  const view = wrap(
    <AccountGate accounts={accounts} google={google}>
      {home}
    </AccountGate>,
  );
  await flush();
  await flush();
  return { accounts, google, ...view };
}

const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
  await flush();
};

describe('signed out (ACC-6)', () => {
  it('shows only the sign-in screen: nothing of the app, and nobody to record as', async () => {
    await open();
    expect(screen.getByTestId('signin')).toBeTruthy();
    expect(screen.getByText('เข้าสู่ระบบด้วย Google')).toBeTruthy();
    expect(screen.getByText('ครั้งแรกต้องต่ออินเทอร์เน็ต')).toBeTruthy();
    expect(screen.queryByTestId('app-inside')).toBeNull();
    expect(() => sessionUserId()).toThrow(NotSignedInError);
  });

  it('shows nothing of the app while the stored account is still being read', async () => {
    wrap(
      <AccountGate accounts={new MemoryAccountStore()} google={{ signIn: async () => somchai }}>
        {home}
      </AccountGate>,
    );
    expect(screen.queryByTestId('app-inside')).toBeNull();
    expect(screen.queryByTestId('signin')).toBeNull();
    await flush();
  });

  it('has no sign-out anywhere (D-23)', async () => {
    await open();
    expect(screen.queryByText(/ออกจากระบบ/)).toBeNull();
  });
});

describe('signing in', () => {
  it('keeps the user on the device, then asks for a farm group', async () => {
    const { accounts } = await open();
    await press('signin-google');
    expect(await accounts.user()).toEqual(somchai);
    expect(sessionUserId()).toBe('uid-1');
    expect(screen.getByTestId('group-start')).toBeTruthy();
    expect(screen.queryByTestId('app-inside')).toBeNull();
  });

  it('says the first sign-in needs internet when it is offline', async () => {
    await open(new MemoryAccountStore(), {
      signIn: async () => {
        throw new SignInError('offline');
      },
    });
    await press('signin-google');
    expect(screen.getByText('ต้องต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบครั้งแรก — ต่อเน็ตแล้วกดอีกครั้ง')).toBeTruthy();
    expect(screen.getByTestId('signin')).toBeTruthy();
  });

  it('says so when the browser blocks the sign-in window', async () => {
    await open(new MemoryAccountStore(), {
      signIn: async () => {
        throw new SignInError('popup-blocked');
      },
    });
    await press('signin-google');
    expect(screen.getByText(/บล็อกหน้าต่างเข้าสู่ระบบ/)).toBeTruthy();
  });

  it('says nothing when the person closes the Google window', async () => {
    await open(new MemoryAccountStore(), {
      signIn: async () => {
        throw new SignInError('cancelled');
      },
    });
    await press('signin-google');
    expect(screen.queryByTestId('signin-problem')).toBeNull();
    expect(screen.getByText('เข้าสู่ระบบด้วย Google')).toBeTruthy();
  });

  it('offers to try again after any other failure', async () => {
    let fail = true;
    await open(new MemoryAccountStore(), {
      signIn: async () => {
        if (fail) throw new Error('boom');
        return somchai;
      },
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await press('signin-google');
    expect(screen.getByText('เข้าสู่ระบบไม่สำเร็จ — ลองอีกครั้ง')).toBeTruthy();
    expect(screen.getByText('ลองอีกครั้ง')).toBeTruthy();
    fail = false;
    await press('signin-google');
    expect(screen.getByTestId('group-start')).toBeTruthy();
  });

  it('a second press while signing in does not start a second sign-in', async () => {
    let calls = 0;
    let finish: (u: typeof somchai) => void = () => undefined;
    await open(new MemoryAccountStore(), {
      signIn: () => {
        calls += 1;
        return new Promise((resolve) => (finish = resolve));
      },
    });
    fireEvent.press(screen.getByTestId('signin-google'));
    fireEvent.press(screen.getByTestId('signin-google'));
    await flush();
    expect(calls).toBe(1);
    expect(screen.getByText('กำลังเข้าสู่ระบบ…')).toBeTruthy();
    await act(async () => finish(somchai));
    await flush();
  });
});

describe('a device that already signed in (ACC-6: offline works)', () => {
  it('goes straight in with no sign-in, never touching the network', async () => {
    const accounts = new MemoryAccountStore();
    await accounts.saveUser(somchai);
    await accounts.createGroup(
      { groupId: 'g-farm', userId: 'uid-1', name: 'สวนสมชาย', role: 'owner' },
      { op: 'create_group', groupId: 'g-farm', name: 'สวนสมชาย', createdBy: 'uid-1', displayName: 'สมชาย', createdAt: 1 },
    );
    const signIn = jest.fn();
    await open(accounts, { signIn });
    expect(screen.getByTestId('app-inside')).toBeTruthy();
    expect(screen.queryByTestId('signin')).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
    expect(sessionUserId()).toBe('uid-1');
    expect(sessionGroupId()).toBe('g-farm');
  });

  it('a signed-in user with no group sees only the group start', async () => {
    const accounts = new MemoryAccountStore();
    await accounts.saveUser(somchai);
    await open(accounts);
    expect(screen.getByTestId('group-start')).toBeTruthy();
    expect(screen.queryByTestId('app-inside')).toBeNull();
  });

  it("another account's group on this device is not opened", async () => {
    const accounts = new MemoryAccountStore();
    await accounts.saveUser(somchai);
    await accounts.createGroup(
      { groupId: 'g-other', userId: 'uid-2', name: 'สวนคนอื่น', role: 'owner' },
      { op: 'create_group', groupId: 'g-other', name: 'สวนคนอื่น', createdBy: 'uid-2', displayName: null, createdAt: 1 },
    );
    await open(accounts);
    expect(screen.getByTestId('group-start')).toBeTruthy();
  });

  it('a stored account that cannot be read falls back to the sign-in screen', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const accounts = new MemoryAccountStore();
    accounts.user = async () => {
      throw new Error('unreadable');
    };
    await open(accounts);
    expect(screen.getByTestId('signin')).toBeTruthy();
  });
});

describe('group start (E02-S02)', () => {
  async function signedInNoGroup() {
    const accounts = new MemoryAccountStore();
    await accounts.saveUser(somchai);
    await open(accounts);
    return accounts;
  }

  it('offers create, and a join that is shown but disabled (E02-S03)', async () => {
    await signedInNoGroup();
    expect(screen.getByText('ยินดีต้อนรับ สมชาย')).toBeTruthy();
    expect(screen.getByTestId('group-create')).toBeTruthy();
    expect(screen.getByTestId('group-join').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('refuses an empty name and keeps nothing', async () => {
    const accounts = await signedInNoGroup();
    fireEvent.changeText(screen.getByTestId('group-name'), '   ');
    await press('group-create');
    expect(screen.getByText('ใส่ชื่อกลุ่มฟาร์ม')).toBeTruthy();
    expect(await accounts.memberships()).toEqual([]);
    expect(screen.queryByTestId('app-inside')).toBeNull();
  });

  it('creates the group on the device with an owner membership and a queued op, then goes in', async () => {
    const accounts = await signedInNoGroup();
    fireEvent.changeText(screen.getByTestId('group-name'), '  สวนใหม่ ');
    await press('group-create');

    const [membership] = await accounts.memberships();
    expect(membership).toMatchObject({ userId: 'uid-1', name: 'สวนใหม่', role: 'owner' });
    const [op] = await accounts.pendingOps();
    expect(op).toMatchObject({ op: 'create_group', groupId: membership.groupId, createdBy: 'uid-1', name: 'สวนใหม่' });
    expect(screen.getByTestId('app-inside')).toBeTruthy();
    expect(sessionGroupId()).toBe(membership.groupId);
  });

  it('a name that is typed again after the error clears the error', async () => {
    await signedInNoGroup();
    await press('group-create');
    expect(screen.getByText('ใส่ชื่อกลุ่มฟาร์ม')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('group-name'), 'ส');
    expect(screen.queryByText('ใส่ชื่อกลุ่มฟาร์ม')).toBeNull();
  });

  it('when the group cannot be kept it says so and does not go in', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const accounts = await signedInNoGroup();
    accounts.createGroup = async () => {
      throw new Error('quota');
    };
    fireEvent.changeText(screen.getByTestId('group-name'), 'สวนใหม่');
    await press('group-create');
    expect(screen.getByText('สร้างกลุ่มไม่สำเร็จ — ลองอีกครั้ง')).toBeTruthy();
    expect(screen.queryByTestId('app-inside')).toBeNull();
    expect(() => sessionGroupId()).toThrow();
  });

  it('two presses in one frame create one group', async () => {
    const accounts = await signedInNoGroup();
    fireEvent.changeText(screen.getByTestId('group-name'), 'สวนใหม่');
    fireEvent.press(screen.getByTestId('group-create'));
    fireEvent.press(screen.getByTestId('group-create'));
    await flush();
    await flush();
    expect(await accounts.memberships()).toHaveLength(1);
  });
});
