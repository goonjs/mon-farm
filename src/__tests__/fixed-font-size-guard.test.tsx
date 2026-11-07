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

/** The fixed numbers in a size expression ([] = follows the text size). */
export function fixedNumbers(expr: ts.Expression, consts: Map<string, ts.Expression>, key = 'fontSize', seen = new Set<string>()): string[] {
  const walk = (e: ts.Expression): string[] => fixedNumbers(e, consts, key, seen);
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr)) return walk((expr as ts.ParenthesizedExpression).expression);
  if (ts.isNumericLiteral(expr)) return Number(expr.text) >= PIXELS ? [expr.text] : [];
  if (ts.isIdentifier(expr)) {
    const init = consts.get(expr.text);
    if (!init || seen.has(expr.text)) return [];
    seen.add(expr.text);
    return fixedNumbers(init, consts, key, seen).map((n) => `${expr.text}=${n}`);
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
      const lit = (x: ts.Expression) => (ts.isNumericLiteral(x) ? (key === 'fontSize' || Number(x.text) >= PIXELS ? [x.text] : []) : walk(x));
      return [...lit(expr.left), ...lit(expr.right)];
    }
    return [...walk(expr.left), ...walk(expr.right)];
  }
  return [];
}

function consts(sf: ts.SourceFile): Map<string, ts.Expression> {
  const out = new Map<string, ts.Expression>();
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isVariableDeclarationList(n.parent) && n.parent.flags & ts.NodeFlags.Const) out.set(n.name.text, n.initializer);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

export function findFixed(text: string, name = 'x.tsx'): string[] {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const known = consts(sf);
  const out: string[] = [];
  const lines = text.split('\n');
  const report = (key: string, value: ts.Expression, at: ts.Node) => {
    const line = sf.getLineAndCharacterOfPosition(at.getStart()).line;
    if ([lines[line], lines[line - 1] ?? ''].some((l) => /text-size: fixed/.test(l))) return;
    const nums = fixedNumbers(value, known, key);
    if (nums.length) out.push(`${name}:${sf.getLineAndCharacterOfPosition(at.getStart()).line + 1} ${key} ${nums.join(',')}`);
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
  return out;
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
    ['const s = { fontSize: Math.max(8, x) };', 1],
  ])('%s → %i finding(s)', (code, n) => {
    expect(findFixed(code.includes('<') || code.includes('const') ? code : `const s = { ${code} };`)).toHaveLength(n as number);
  });
});

it('no fixed fontSize or lineHeight outside the public numeral', () => {
  const found = files(SRC).flatMap((p) => {
    const rel = relative(SRC, p).split('\\').join('/');
    if (rel.startsWith('__tests__/') || EXEMPT.has(rel)) return [];
    return findFixed(readFileSync(p, 'utf8'), rel);
  });
  expect(found).toEqual([]);
});
