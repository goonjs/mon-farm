/**
 * `DuplicateSeqError` on its own, unsuffixed file.
 *
 * `store.web.ts` and `store.native.ts` both need this at runtime (not just as
 * a type), but importing it from `./store` triggers Metro's platform-suffix
 * resolution on the specifier itself — regardless of which file is doing the
 * importing. From inside `store.web.ts` while bundling for web, `./store`
 * resolves to `store.web.ts` (itself) before it resolves to the base
 * `store.ts`, producing a genuine self-referential require cycle: the class
 * is read from the module's own, still-executing exports. Giving the error
 * class a name with no platform sibling removes the ambiguity entirely.
 */

export class DuplicateSeqError extends Error {
  constructor(saleId: string, seq: number) {
    super(`Event ${saleId}#${seq} already exists. The log is append-only.`);
  }
}
