/**
 * E03-S08 TS-5: every font size follows the device text size, so a screen
 * takes its sizes from the theme (`t.font.size.*`, or a number × `t.textScale`)
 * — never a fixed `fontSize: 36`. The public counting numeral is the one
 * exception (sized from the screen, TS-4).
 *
 * Read from the syntax tree, not line by line (2026-11-07: the line regex let
 * through `a ? 40 : 28 * t.textScale`, `Math.max(x, 36)`, `fontSize: WORD`, a
 * value on the next line, and every `lineHeight`). A value is fixed when it
 * holds a pixel number (≥ 6, so `size * 0.55` and `size * 1.1` ratios pass)
 * that is not multiplied by `textScale`, or any number added to a font size (a
 * line height may add a few pixels of leading, < 6) — and a name is followed to
 * the const it stands for in the same file. A size that comes in as a prop or
 * argument is the caller's (not followed). A number that is meant to stay fixed
 * says so on its line or the line above: `// text-size: fixed — <why>`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

const SRC = join(__dirname, '..');
const EXEMPT = new Set(['v2/sale/public-screen.tsx']);
const KEYS = new Set(['fontSize', 'lineHeight']);
const PIXELS = 6;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

/** A number that is meant to stay fixed says so on its own line or the line above, with a reason. */
const ESCAPE = /text-size: fixed — \S/;
/** Every escape in src, so a new one shows up in review (file → how many). */
const ALLOWED_ESCAPES: Record<string, number> = {
  // FitAmount only shrinks a theme size to fit the width; 8 px is its floor.
  'v2/sale/closeout/buyer-view-screen.tsx': 1,
  // WarnMark is a drawn ⚠ whose "!" is sized from the triangle, like an icon.
  'v2/sale/closeout/summary-parts.tsx': 1,
};

export function findFixed(text: string, name = 'x.tsx'): { found: string[]; escapes: number } {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = text.split('\n');
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line;
  const escaped = new Set<number>();
  const isEscaped = (n: ts.Node) => {
    const l = lineOf(n);
    const at = [l, l - 1].find((i) => i >= 0 && ESCAPE.test(lines[i]));
    if (at === undefined) return false;
    escaped.add(at);
    return true;
  };
  // Names a size can stand for in this file: consts, and default values of parameters and destructured props.
  const known = new Map<string, ts.Expression>();
  const collect = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isVariableDeclarationList(n.parent) && n.parent.flags & ts.NodeFlags.Const) known.set(n.name.text, n.initializer);
    if ((ts.isParameter(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name) && n.initializer) known.set(n.name.text, n.initializer);
    ts.forEachChild(n, collect);
  };
  collect(sf);

  const pixels = (raw: string, at: ts.Node) => (Number(raw) >= PIXELS && !isEscaped(at) ? [raw] : []);
  const fixedNumbers = (expr: ts.Expression, key: string, seen: Set<string>): string[] => {
    const walk = (e: ts.Expression) => fixedNumbers(e, key, seen);
    if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr)) return walk(expr.expression);
    if (ts.isNumericLiteral(expr)) return pixels(expr.text, expr);
    // On web a size can be a string ("12", "36px") or a template; any pixel number in it counts.
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return (expr.text.match(/\d+(\.\d+)?/g) ?? []).flatMap((d) => pixels(d, expr));
    if (ts.isTemplateExpression(expr)) return [...(expr.head.text + expr.templateSpans.map((x) => x.literal.text).join(' ')).match(/\d+(\.\d+)?/g) ?? []].flatMap((d) => pixels(d, expr)).concat(expr.templateSpans.flatMap((x) => walk(x.expression)));
    if (ts.isIdentifier(expr)) {
      const init = known.get(expr.text);
      if (!init || seen.has(expr.text)) return [];
      seen.add(expr.text);
      return walk(init).map((n) => `${expr.text}=${n}`);
    }
    if (ts.isConditionalExpression(expr)) return [...walk(expr.whenTrue), ...walk(expr.whenFalse)];
    if (ts.isCallExpression(expr)) return expr.arguments.flatMap((a) => walk(a));
    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if (op === ts.SyntaxKind.AsteriskToken) {
        if (/\btextScale\b/.test(expr.left.getText()) || /\btextScale\b/.test(expr.right.getText())) return [];
        return [...walk(expr.left), ...walk(expr.right)];
      }
      if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.MinusToken) {
        // A number added to a font size does not scale: any number counts; a line height may add a little leading.
        const lit = (x: ts.Expression) => (ts.isNumericLiteral(x) ? (key === 'fontSize' ? (isEscaped(x) ? [] : [x.text]) : pixels(x.text, x)) : walk(x));
        return [...lit(expr.left), ...lit(expr.right)];
      }
      return [...walk(expr.left), ...walk(expr.right)];
    }
    return [];
  };

  const found: string[] = [];
  const report = (key: string, value: ts.Expression, at: ts.Node) => {
    const nums = fixedNumbers(value, key, new Set());
    if (nums.length) found.push(`${name}:${lineOf(at) + 1} ${key} ${nums.join(',')}`);
  };
  const visit = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && KEYS.has(n.name.text)) report(n.name.text, n.initializer, n);
    if (ts.isShorthandPropertyAssignment(n) && KEYS.has(n.name.text)) report(n.name.text, n.name, n);
    if (ts.isJsxAttribute(n) && KEYS.has(n.name.getText()) && n.initializer) {
      const v = ts.isJsxExpression(n.initializer) ? n.initializer.expression : n.initializer;
      if (v) report(n.name.getText(), v as ts.Expression, n);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { found, escapes: escaped.size };
}

describe('the guard itself', () => {
  it.each([
    ['fontSize: 36', 1],
    ['fontSize: typing ? 40 : 28 * t.textScale', 1],
    ['fontSize: Math.max(t.font.size.body, 36)', 1],
    ['const WORD = 38;\nconst s = { fontSize: WORD };', 1],
    ['const s = {\n  fontSize:\n    36,\n};', 1],
    ['lineHeight: 20', 1],
    ['lineHeight: Math.round(WORD * 1.1)', 0],
    ['const WORD = 38; const s = { lineHeight: Math.round(WORD * 1.1) };', 1],
    ['fontSize: size + 2', 1],
    ['fontSize: t.font.size.body', 0],
    ['fontSize: 36 * t.textScale', 0],
    ['fontSize: Math.round((typing ? 40 : 28) * t.textScale)', 0],
    ['fontSize: Math.round(size * 0.55)', 0],
    ['lineHeight: size * t.font.lineHeight.body', 0],
    ['<Text fontSize={12} />', 1],
    ['lineHeight: lh(t.font.size.bodySm) + 2', 0],
    ['// text-size: fixed — a floor\nconst s = { fontSize: Math.max(8, x) };', 0],
    ['const s = { fontSize: Math.max(\n  // text-size: fixed — a floor\n  8, x) };', 0],
    ['const s = { fontSize: Math.max(8, x) };', 1],
    ['function A({ size = 36 }) { return { fontSize: size }; }', 1],
    ['function A({ size = 14 }) { return { fontSize: Math.round(size * 0.62) }; }', 1],
    ['<Text fontSize="12" />', 1],
    ["fontSize: '36px'", 1],
    ["label: 'text-size: fixed', fontSize: 36", 1],
    ['// text-size: fixed\nconst s = { fontSize: 36 };', 1],
  ])('%s → %i finding(s)', (code, n) => {
    const src = code.includes('<') || code.includes('const') || code.includes('function') ? code : `const s = { ${code} };`;
    expect(findFixed(src).found).toHaveLength(n as number);
  });
});

it('no fixed fontSize or lineHeight outside the public numeral, and only the listed escapes', () => {
  const found: string[] = [];
  const escapes: Record<string, number> = {};
  for (const p of files(SRC)) {
    const rel = relative(SRC, p).split('\\').join('/');
    if (rel.startsWith('__tests__/') || EXEMPT.has(rel)) continue;
    const r = findFixed(readFileSync(p, 'utf8'), rel);
    found.push(...r.found);
    if (r.escapes) escapes[rel] = r.escapes;
  }
  expect(found).toEqual([]);
  expect(escapes).toEqual(ALLOWED_ESCAPES);
});
