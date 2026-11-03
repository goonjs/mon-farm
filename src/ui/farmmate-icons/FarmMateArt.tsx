/**
 * One traced FarmMate original ("ตัวสวย", design/icons/farmmate/<id>.svg),
 * drawn from the generated design/icons/farmmate-masters.ts (E03-S11, owner
 * 2026-11-03: the whole app uses these, not the simplified redraw in
 * registry.tsx). The colours are the originals' own; they do not follow the
 * theme (dark theme comes later, after every screen uses this set).
 *
 * Decorative like every icon in `ui/icons.tsx` — hidden from screen readers;
 * the control around it carries the accessible name.
 */

import { parse, SvgAst, type JsxAST } from 'react-native-svg';

import { FARMMATE_MASTERS, type FarmMateArtId } from '../../../design/icons/farmmate-masters';

/**
 * Each original parsed once for the life of the app. Not SvgXml: it parses on
 * every mount and passes its `xml` prop through to the <svg>, which on the web
 * put each icon's whole source into the DOM as an attribute (review of PR 145).
 */
const parsed = new Map<string, JsxAST | null>();
function astOf(id: string): JsxAST | null {
  if (!parsed.has(id)) {
    const xml = (FARMMATE_MASTERS as Readonly<Record<string, string>>)[id];
    parsed.set(id, xml ? parse(xml) : null);
  }
  return parsed.get(id) ?? null;
}

export function FarmMateArt({ id, size = 32 }: { id: FarmMateArtId; size?: number }) {
  const ast = astOf(id);
  if (!ast) return null;
  return <SvgAst ast={ast} override={{ 'aria-hidden': true, width: size, height: size }} />;
}

/**
 * Which original a person's tile shows, by role (owner 2026-11-03): a tapper
 * the tapper, a manager the manager, anyone else the plain profile figure.
 */
export function personArt(roles?: readonly string[]): FarmMateArtId {
  if (roles?.includes('tapper')) return 'people.tapper';
  if (roles?.includes('manager')) return 'people.manager';
  return 'nav.profile';
}
