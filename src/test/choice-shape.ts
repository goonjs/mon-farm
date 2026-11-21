/**
 * E01-S25 CT-11: the shape every caller's choices must have now that the
 * owner banned near-round pills as choices. One helper, so each caller's test
 * checks the same thing (lesson of PR 227: a shared component change reached
 * screens nobody meant to touch).
 */

import { tokens } from '../../design/tokens';

const flat = (style: unknown): Record<string, unknown> => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

type Node = { props: { style?: unknown; accessibilityRole?: string; accessibilityState?: Record<string, unknown> } };

/** A, I or F tile: radius md (never a pill), a 2 edge, ≥ 48 tall; the role that kind has. */
export function expectChoiceTile(el: Node, kind: 'fill' | 'mark' | 'check' | 'checkbox' | 'add') {
  const s = flat(el.props.style);
  expect(s.borderRadius).toBe(tokens.radius.md);
  expect(s.borderWidth).toBe(tokens.border.thick);
  expect(s.minHeight).toBeGreaterThanOrEqual(tokens.target.min);
  const role = kind === 'add' ? 'button' : kind === 'checkbox' ? 'checkbox' : 'radio';
  expect(el.props.accessibilityRole).toBe(role);
  if (kind === 'mark' || kind === 'check' || kind === 'checkbox') expect(s.justifyContent).toBe('flex-start');
  if (kind === 'add') expect(s.borderStyle).toBe('dashed');
}

/** Style B segment (CT-5): radius sm inside a track of radius md, never a pill. */
export function expectSegment(el: Node) {
  expect(flat(el.props.style).borderRadius).toBe(tokens.radius.sm);
}

/** Style C (RadioCard): a full-width row with a ring, radius lg — never a pill. */
export function expectRadioRow(el: Node) {
  const s = flat(el.props.style);
  expect(el.props.accessibilityRole).toBe('radio');
  expect(s.borderRadius).toBe(tokens.radius.lg);
  expect(s.minHeight ?? tokens.target.min).toBeGreaterThanOrEqual(tokens.target.min);
}
