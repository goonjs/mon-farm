/**
 * Canonical JSON — the definition of "same content" for an event, locally
 * and (from E01-S09) against Firestore, which does not preserve map key order.
 *
 * Keys sorted at every level; `undefined` fields omitted, so an absent
 * optional field and an undefined one compare equal. See architecture
 * §Local data layer.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) out[key] = sortKeys(v);
  }
  return out;
}
