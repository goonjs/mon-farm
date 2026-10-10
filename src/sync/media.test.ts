import { describe, expect, it } from 'vitest';

import { FakeStorage, MemoryMediaQueue, mediaPath, uploadMedia, type MediaItem } from './media';
import { RemoteError } from './remote';

const item = (id: string): MediaItem => ({ mediaId: id, groupId: 'g1', contentType: 'image/jpeg', hash: `h-${id}` });
const bytes = (s: string) => new TextEncoder().encode(s);

describe('media queue (E01-S12)', () => {
  it('keeps the file locally the moment it is added, before any network', async () => {
    const q = new MemoryMediaQueue();
    await q.enqueue(item('m1'), bytes('jpeg'));
    expect((await q.pending()).map((i) => i.mediaId)).toEqual(['m1']);
    expect(await q.read('m1')).toEqual(bytes('jpeg'));
  });

  it('uploads to groups/{gid}/media/{mediaId} and only then lets the local file go', async () => {
    const q = new MemoryMediaQueue();
    const s = new FakeStorage();
    await q.enqueue(item('m1'), bytes('jpeg'));
    await uploadMedia(q, s);
    expect(s.objects.get('groups/g1/media/m1')?.hash).toBe('h-m1');
    expect(await q.pending()).toEqual([]);
    expect(await q.read('m1')).toBeNull();
  });

  it('a failed upload keeps the file and the queue entry, and rethrows for the engine to back off', async () => {
    const q = new MemoryMediaQueue();
    const s = new FakeStorage();
    await q.enqueue(item('m1'), bytes('jpeg'));
    s.failNext('unavailable');
    await expect(uploadMedia(q, s)).rejects.toBeInstanceOf(RemoteError);
    expect(await q.read('m1')).toEqual(bytes('jpeg'));
    await uploadMedia(q, s);
    expect(await q.pending()).toEqual([]);
  });

  it('force-closed after the upload but before the local release: the retry sees the same hash and succeeds', async () => {
    const q = new MemoryMediaQueue();
    const s = new FakeStorage();
    await q.enqueue(item('m1'), bytes('jpeg'));
    const release = q.release.bind(q);
    q.release = async () => {
      throw new Error('killed');
    };
    await expect(uploadMedia(q, s)).rejects.toThrow('killed');
    q.release = release;
    await uploadMedia(q, s);
    expect(s.puts).toBe(1);
    expect(await q.pending()).toEqual([]);
  });

  it('an object already there with a different hash is an integrity error; the local file stays', async () => {
    const q = new MemoryMediaQueue();
    const s = new FakeStorage();
    s.objects.set('groups/g1/media/m1', { hash: 'other', bytes: bytes('x') });
    await q.enqueue(item('m1'), bytes('jpeg'));
    await expect(uploadMedia(q, s)).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(await q.read('m1')).toEqual(bytes('jpeg'));
  });

  it('paths come only from ids, so they cannot escape the group folder', () => {
    expect(mediaPath(item('m1'))).toBe('groups/g1/media/m1');
    expect(() => mediaPath({ ...item('../x'), mediaId: '../x' })).toThrow();
  });
});
