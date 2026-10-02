/**
 * Store errors on their own, unsuffixed file.
 *
 * `store.web.ts` and `store.native.ts` both need these at runtime (not just as
 * types), but importing them from `./store` triggers Metro's platform-suffix
 * resolution on the specifier itself — regardless of which file is doing the
 * importing. From inside `store.web.ts` while bundling for web, `./store`
 * resolves to `store.web.ts` (itself) before it resolves to the base
 * `store.ts`, producing a genuine self-referential require cycle: the class
 * is read from the module's own, still-executing exports. Giving the error
 * classes a file with no platform sibling removes the ambiguity entirely.
 */

/**
 * An append that would rewrite history: an id already stored with different
 * content, or a device sequence number this device already used. The log is
 * append-only, so this is refused rather than resolved by overwriting.
 */
export class IntegrityError extends Error {
  constructor(message: string) {
    super(`${message} The log is append-only.`);
    this.name = 'IntegrityError';
  }
}
