/**
 * String resolution — pure, and deliberately separate from the React binding.
 *
 * Nothing here imports react, react-native or expo, for the same reason
 * `src/core` doesn't: it means the catalogue's guarantees (fallback,
 * interpolation, never rendering an id) are provable in the fast Vitest tier
 * with no tree to mount. `src/i18n/index.tsx` is the thin React layer over
 * this, and has almost nothing left to prove.
 */

import { messages, type Locale, type MessageId } from './messages';

/**
 * Substitutes `{name}` placeholders.
 *
 * A missing param yields an empty string rather than leaving `{n}` on screen.
 * Same principle as never rendering a message id: a placeholder that reaches
 * the glass is not a word in either language, and on this app's screens it
 * would be sitting next to a number two people are agreeing money against.
 */
export function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] === undefined ? '' : String(params[key]),
  );
}

/**
 * The Thai string is the source, so `th` always resolves and `en` falls back
 * to it. English will lag — it is the second locale for a farm that works in
 * Thai — and a lagging translation must degrade to the other language, not to
 * an identifier.
 */
export function resolve(
  locale: Locale,
  id: MessageId,
  params?: Record<string, string | number>,
): string {
  const raw = (locale === 'en' ? messages.en[id] : undefined) ?? messages.th[id];
  return params ? interpolate(raw, params) : raw;
}
