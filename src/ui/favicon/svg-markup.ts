/**
 * Writes a react-native-svg element tree as plain SVG text (E03-S10), so a
 * FarmMate icon can become a favicon without rendering it anywhere and
 * without a new dependency. Only what the icon registry uses is known:
 * Svg, G, Path, Rect, Circle, Ellipse, fragments, arrays and plain function
 * components (the registry's shared shapes — they use no hooks). Anything
 * else throws, so an icon that grows a new primitive fails the test of every
 * favicon choice rather than drawing wrong.
 */

import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Circle, Ellipse, G, Path, Rect, Svg } from 'react-native-svg';

const TAGS = new Map<unknown, string>([
  [Svg, 'svg'],
  [G, 'g'],
  [Path, 'path'],
  [Rect, 'rect'],
  [Circle, 'circle'],
  [Ellipse, 'ellipse'],
]);

// SVG attributes that keep their camelCase; every other camelCase prop is kebab-cased.
const KEEP_CASE = new Set(['viewBox']);

const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attrName = (prop: string) => (KEEP_CASE.has(prop) ? prop : prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

function attrs(props: Record<string, unknown>): string {
  let out = '';
  for (const [k, v] of Object.entries(props)) {
    if (k === 'children' || v === undefined || v === null || v === false) continue;
    if (typeof v !== 'string' && typeof v !== 'number') throw new Error(`svg-markup: unsupported value for ${k}`);
    out += ` ${attrName(k)}="${escape(String(v))}"`;
  }
  return out;
}

function write(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(write).join('');
  if (!isValidElement(node)) throw new Error(`svg-markup: unsupported child ${String(node)}`);
  const el = node as ReactElement<Record<string, unknown>>;
  const { type, props } = el;
  if (type === Fragment) return write(props.children as ReactNode);
  const tag = TAGS.get(type);
  if (tag) {
    const head = tag === 'svg' ? ' xmlns="http://www.w3.org/2000/svg"' : '';
    const inner = write(props.children as ReactNode);
    return inner ? `<${tag}${head}${attrs(props)}>${inner}</${tag}>` : tag === 'svg' ? `<svg${head}${attrs(props)}></svg>` : `<${tag}${attrs(props)}/>`;
  }
  if (typeof type === 'function' && !(type.prototype && 'render' in type.prototype)) {
    return write((type as (p: object) => ReactNode)(props));
  }
  throw new Error(`svg-markup: unsupported element ${typeof type === 'string' ? type : (type as { name?: string }).name ?? 'unknown'}`);
}

export function toSvgMarkup(element: ReactElement): string {
  return write(element);
}
