/**
 * The media queue (E01-S12; architecture §สื่อ).
 *
 * A photo is kept on the phone first, always: the `media.add` event goes out
 * through the outbox like any other, and the file follows separately to
 * `groups/{gid}/media/{mediaId}`. The local copy is released only after the
 * upload is confirmed; an object already there with the same hash counts as
 * uploaded, so a force-close between upload and release is harmless (NFR-2).
 *
 * Both sides are ports: the device's file store (IndexedDB Blob on web, the
 * file system on native — a dependency decision still to make) and Cloud
 * Storage (no bucket until the plan upgrade, D-48). Tests use the fakes here.
 */

import { RemoteError, type RemoteErrorCode } from './remote';

export interface MediaItem {
  readonly mediaId: string;
  readonly groupId: string;
  readonly contentType: string;
  /** Content hash as the storage reports it (Cloud Storage: md5Hash). */
  readonly hash: string;
}

export interface MediaQueue {
  enqueue(item: MediaItem, bytes: Uint8Array): Promise<void>;
  /** Items whose file is not yet confirmed uploaded, oldest first. */
  pending(): Promise<MediaItem[]>;
  read(mediaId: string): Promise<Uint8Array | null>;
  /** Drops the local copy — only after the upload was confirmed. */
  release(mediaId: string): Promise<void>;
}

export interface RemoteMedia {
  /** The stored object's hash, or null when there is none. */
  hashAt(path: string): Promise<string | null>;
  put(path: string, bytes: Uint8Array, item: MediaItem): Promise<void>;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function mediaPath(item: MediaItem): string {
  if (!SAFE_ID.test(item.groupId) || !SAFE_ID.test(item.mediaId)) {
    throw new RemoteError('invalid-argument', `unsafe media path ${item.groupId}/${item.mediaId}`);
  }
  return `groups/${item.groupId}/media/${item.mediaId}`;
}

/** Uploads every queued file, one at a time. Throws `RemoteError` for the engine's backoff. */
export async function uploadMedia(queue: MediaQueue, remote: RemoteMedia): Promise<void> {
  for (const item of await queue.pending()) {
    const path = mediaPath(item);
    const there = await remote.hashAt(path);
    if (there === null) {
      const bytes = await queue.read(item.mediaId);
      if (!bytes) throw new RemoteError('internal', `media ${item.mediaId} lost its local file`);
      await remote.put(path, bytes, item);
    } else if (there !== item.hash) {
      throw new RemoteError('invalid-argument', `media ${item.mediaId} differs on the server`);
    }
    await queue.release(item.mediaId);
  }
}

export class MemoryMediaQueue implements MediaQueue {
  private items = new Map<string, { item: MediaItem; bytes: Uint8Array }>();

  async enqueue(item: MediaItem, bytes: Uint8Array) {
    if (!this.items.has(item.mediaId)) this.items.set(item.mediaId, { item, bytes });
  }
  async pending() {
    return [...this.items.values()].map((x) => x.item);
  }
  async read(mediaId: string) {
    return this.items.get(mediaId)?.bytes ?? null;
  }
  async release(mediaId: string) {
    this.items.delete(mediaId);
  }
}

/** Cloud Storage stand-in for tests. */
export class FakeStorage implements RemoteMedia {
  readonly objects = new Map<string, { hash: string; bytes: Uint8Array }>();
  puts = 0;
  private failures: RemoteErrorCode[] = [];

  failNext(...codes: RemoteErrorCode[]) {
    this.failures.push(...codes);
  }
  private gate() {
    const code = this.failures.shift();
    if (code) throw new RemoteError(code);
  }
  async hashAt(path: string) {
    this.gate();
    return this.objects.get(path)?.hash ?? null;
  }
  async put(path: string, bytes: Uint8Array, item: MediaItem) {
    this.gate();
    this.puts += 1;
    this.objects.set(path, { hash: item.hash, bytes });
  }
}
