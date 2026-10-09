import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SignInError } from '../auth/errors';
import type { GoogleSignIn } from '../auth/google';
import { AccountGate } from '../components/AccountGate';
import { newGroup } from '../core/group';
import { NoGroupError } from '../core/scope';
import { userFromSignIn, type User } from '../core/user';
import { MemoryAccountStore } from '../store/account-memory';
import { setDeleted } from '../store/record';
import { NotSignedInError, sessionGroupId, sessionUserId, setSessionGroup, setSessionUser } from '../store/session';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';

jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});

const somchai = userFromSignIn('uid-somchai', 'สมชาย', { provider: 'google', subject: 'g-1' });

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function google(result: () => Promise<User>): GoogleSignIn & { calls: number } {
  const g = {
    calls: 0,
    signIn: () => {
      g.calls += 1;
      return result();
    },
  };
  return g;
}

async function renderGate(accounts: MemoryAccountStore, g: GoogleSignIn) {
  wrap(
    <AccountGate accounts={accounts} google={g}>
      <Text testID="app">app</Text>
    </AccountGate>,
  );
  await flush();
}

/** A device that already belongs to one group (E02-S02). */
async function withGroup(accounts: MemoryAccountStore, name = 'สวนบ้านนา') {
  const { membership, op } = newGroup(`g-${name}`, name, somchai, 1);
  await accounts.createGroup(membership, op);
  return membership;
}

beforeEach(() => {
  setSessionUser(null);
  setSessionGroup(null);
});

describe('AccountGate — E02-S01 Google login', () => {
  it('first launch, not signed in: only the login screen, nothing behind it (AC2)', async () => {
    await renderGate(new MemoryAccountStore(), google(() => Promise.reject(new Error('unused'))));
    expect(screen.getByTestId('login-screen')).toBeTruthy();
    expect(screen.getByText('เข้าสู่ระบบด้วย Google')).toBeTruthy();
    expect(screen.getByText('ครั้งแรกต้องต่ออินเทอร์เน็ต หลังจากนั้นใช้ได้แม้ไม่มีเน็ต')).toBeTruthy();
    expect(screen.queryByTestId('app')).toBeNull();
  });

  it('signing in stores the user, opens the app, and names them as the writer (AC1, AC6)', async () => {
    const accounts = new MemoryAccountStore();
    await withGroup(accounts);
    await renderGate(accounts, google(() => Promise.resolve(somchai)));
    fireEvent.press(screen.getByTestId('login-google'));
    await flush();

    expect(await accounts.user()).toEqual(somchai);
    expect(screen.getByTestId('app')).toBeTruthy();
    expect(sessionUserId()).toBe('uid-somchai');
  });

  it('while signing in, the button says so and cannot be pressed again', async () => {
    let finish: (u: User) => void = () => undefined;
    const g = google(() => new Promise<User>((r) => (finish = r)));
    await renderGate(new MemoryAccountStore(), g);
    fireEvent.press(screen.getByTestId('login-google'));
    await flush();

    expect(screen.getByText('กำลังเข้าสู่ระบบ…')).toBeTruthy();
    fireEvent.press(screen.getByTestId('login-google'));
    expect(g.calls).toBe(1);

    await act(async () => finish(somchai));
    await flush();
    expect(screen.queryByTestId('login-screen')).toBeNull();
  });

  it('first launch offline: a Thai message that the first sign-in needs the internet (AC3)', async () => {
    await renderGate(new MemoryAccountStore(), google(() => Promise.reject(new SignInError('offline'))));
    fireEvent.press(screen.getByTestId('login-google'));
    await flush();

    expect(screen.getByText('ต้องต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบครั้งแรก — ต่อเน็ตแล้วกดอีกครั้ง')).toBeTruthy();
    expect(screen.queryByTestId('app')).toBeNull();
    // The button stays pressable for when the network is back.
    expect(screen.getByText('เข้าสู่ระบบด้วย Google')).toBeTruthy();
  });

  it('closing the Google window is not an error', async () => {
    await renderGate(new MemoryAccountStore(), google(() => Promise.reject(new SignInError('cancelled'))));
    fireEvent.press(screen.getByTestId('login-google'));
    await flush();
    expect(screen.queryByTestId('login-message')).toBeNull();
    expect(screen.getByText('เข้าสู่ระบบด้วย Google')).toBeTruthy();
  });

  it('a blocked popup and any other failure each get their own Thai message', async () => {
    await renderGate(new MemoryAccountStore(), google(() => Promise.reject(new SignInError('popup-blocked'))));
    fireEvent.press(screen.getByTestId('login-google'));
    await flush();
    expect(screen.getByText('เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ — อนุญาตป๊อปอัปแล้วลองอีกครั้ง')).toBeTruthy();
  });

  it('an unexpected failure says try again, and trying again can succeed', async () => {
    let attempt = 0;
    await renderGate(
      new MemoryAccountStore(),
      google(() => (++attempt === 1 ? Promise.reject(new Error('boom')) : Promise.resolve(somchai))),
    );
    fireEvent.press(screen.getByTestId('login-google'));
    await flush();
    expect(screen.getByText('เข้าสู่ระบบไม่สำเร็จ — ลองอีกครั้ง')).toBeTruthy();

    fireEvent.press(screen.getByText('ลองอีกครั้ง'));
    await flush();
    expect(screen.queryByTestId('login-screen')).toBeNull();
  });

  it('reopening after a sign-in goes straight in, without the network (AC5)', async () => {
    const accounts = new MemoryAccountStore();
    await accounts.saveUser(somchai);
    await withGroup(accounts);
    const g = google(() => Promise.reject(new SignInError('offline')));
    await renderGate(accounts, g);

    expect(screen.getByTestId('app')).toBeTruthy();
    expect(screen.queryByTestId('login-screen')).toBeNull();
    expect(g.calls).toBe(0);
    expect(sessionUserId()).toBe('uid-somchai');
  });

  it('there is no sign-out anywhere once signed in (AC8, D-23)', async () => {
    const accounts = new MemoryAccountStore();
    await accounts.saveUser(somchai);
    await withGroup(accounts);
    await renderGate(accounts, google(() => Promise.resolve(somchai)));
    expect(screen.getByTestId('app')).toBeTruthy();
    expect(screen.queryByText(/ออกจากระบบ/)).toBeNull();
  });
});

describe('the write path before sign-in (AC2)', () => {
  it('records nothing: the write is refused and the log is untouched', async () => {
    await expect(setDeleted('sale-1', true)).rejects.toBeInstanceOf(NotSignedInError);
    expect(await mockStore.load('sale-1')).toEqual([]);
  });
});

describe('AccountGate — E02-S02 farm groups', () => {
  async function signedIn() {
    const accounts = new MemoryAccountStore();
    await accounts.saveUser(somchai);
    return accounts;
  }

  it('signed in with no group: only create or join, nothing to record into (AC3)', async () => {
    await renderGate(await signedIn(), google(() => Promise.resolve(somchai)));
    expect(screen.getByTestId('group-start')).toBeTruthy();
    expect(screen.getByText('ยินดีต้อนรับ สมชาย')).toBeTruthy();
    expect(screen.getByText('ต้องมีกลุ่มฟาร์มก่อนจึงจะบันทึกข้อมูลได้')).toBeTruthy();
    expect(screen.getByText('สร้างกลุ่มฟาร์มใหม่')).toBeTruthy();
    expect(screen.getByText('เข้าร่วมด้วยรหัสเชิญ')).toBeTruthy();
    expect(screen.queryByTestId('app')).toBeNull();
    // The write path agrees: no group, no event (D-24).
    await expect(setDeleted('sale-1', true)).rejects.toBeInstanceOf(NoGroupError);
    expect(await mockStore.load('sale-1')).toEqual([]);
  });

  it('creates a group locally with the creator as owner, then goes straight in (AC1, AC4)', async () => {
    const accounts = await signedIn();
    await renderGate(accounts, google(() => Promise.resolve(somchai)));
    fireEvent.press(screen.getByTestId('group-create'));
    expect(screen.getByText('คุณจะเป็นเจ้าของ และเชิญคนอื่นเข้ามาได้ทีหลัง')).toBeTruthy();
    // No permissions UI, no role to pick (ACC-4).
    expect(screen.queryByText(/สิทธิ์|บทบาท/)).toBeNull();

    fireEvent.changeText(screen.getByTestId('group-name'), ' สวนบ้านนา ');
    fireEvent.press(screen.getByTestId('group-submit'));
    await flush();

    const [membership] = await accounts.memberships();
    expect(membership).toMatchObject({ name: 'สวนบ้านนา', role: 'owner' });
    expect(membership.groupId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/); // minted on the device (UUIDv7)
    expect(await accounts.pendingOps()).toEqual([
      expect.objectContaining({ op: 'create_group', groupId: membership.groupId, createdBy: 'uid-somchai' }),
    ]);
    expect(screen.getByTestId('app')).toBeTruthy();
    expect(sessionGroupId()).toBe(membership.groupId);
  });

  it('a blank name is refused with a Thai message and creates nothing', async () => {
    const accounts = await signedIn();
    await renderGate(accounts, google(() => Promise.resolve(somchai)));
    fireEvent.press(screen.getByTestId('group-create'));
    fireEvent.changeText(screen.getByTestId('group-name'), '   ');
    fireEvent.press(screen.getByTestId('group-submit'));
    await flush();
    expect(screen.getByText('ใส่ชื่อกลุ่มฟาร์ม')).toBeTruthy();
    expect(await accounts.memberships()).toEqual([]);
  });

  it('back from the form returns to the start choices', async () => {
    await renderGate(await signedIn(), google(() => Promise.resolve(somchai)));
    fireEvent.press(screen.getByTestId('group-create'));
    fireEvent.press(screen.getByTestId('group-back'));
    expect(screen.getByTestId('group-start')).toBeTruthy();
  });

  it('a group that cannot be kept is not entered', async () => {
    const accounts = await signedIn();
    accounts.createGroup = () => Promise.reject(new Error('quota'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderGate(accounts, google(() => Promise.resolve(somchai)));
    fireEvent.press(screen.getByTestId('group-create'));
    fireEvent.changeText(screen.getByTestId('group-name'), 'สวนบ้านนา');
    fireEvent.press(screen.getByTestId('group-submit'));
    await flush();
    expect(screen.getByText('สร้างกลุ่มไม่สำเร็จ — ลองอีกครั้ง')).toBeTruthy();
    expect(screen.queryByTestId('app')).toBeNull();
  });

  it('one group kept on the device: opens straight into it, offline, no picker (AC2, AC5)', async () => {
    const accounts = await signedIn();
    const membership = await withGroup(accounts);
    const g = google(() => Promise.reject(new SignInError('offline')));
    await renderGate(accounts, g);
    expect(screen.getByTestId('app')).toBeTruthy();
    expect(screen.queryByTestId('group-start')).toBeNull();
    expect(sessionGroupId()).toBe(membership.groupId);
    expect(g.calls).toBe(0);
  });
});
