import { describe, expect, it } from 'vitest';

import { newGroup } from '../core/group';
import { userFromSignIn } from '../core/user';
import { FakeRemote, FakeServer } from './fake-remote';

const somchai = userFromSignIn('uid-1', 'สมชาย', { provider: 'google', subject: 'g-1' });

describe('FakeRemote.myGroups (the member lookup of E02-S05)', () => {
  it('finds the groups this user created, in any client of the same server', async () => {
    const server = new FakeServer();
    const first = new FakeRemote(server, 'uid-1');
    await first.createGroup(newGroup('g-1', 'สวนบ้านนา', somchai, 1).op);
    // A second device of the same account: a different client, the same server.
    expect(await new FakeRemote(server, 'uid-1').myGroups()).toEqual([{ groupId: 'g-1', name: 'สวนบ้านนา' }]);
  });

  it("never lists another user's group", async () => {
    const server = new FakeServer();
    server.addMember('uid-2', 'g-2', 'สวนคนอื่น');
    expect(await new FakeRemote(server, 'uid-1').myGroups()).toEqual([]);
  });

  it('fails like the real one when offline or when it is made to fail', async () => {
    const remote = new FakeRemote(new FakeServer(), 'uid-1');
    remote.offline = true;
    await expect(remote.myGroups()).rejects.toMatchObject({ code: 'unavailable' });
    remote.offline = false;
    remote.failNext('permission-denied');
    await expect(remote.myGroups()).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await remote.myGroups()).toEqual([]);
  });
});
