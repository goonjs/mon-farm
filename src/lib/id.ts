/**
 * Local, dependency-free id generation.
 *
 * Not a UUID library — this app is single-device, so ids only need to be
 * unique within one device's storage, not globally. Timestamp plus a random
 * suffix is enough for that and adds nothing to the bundle. Reach for a real
 * UUID library only if ids ever need to be globally unique (e.g. once sync
 * exists and two devices can create records independently).
 */
export function newId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}
