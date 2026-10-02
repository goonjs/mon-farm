/**
 * Conventional Commits rules, shared by the commit lint in CI and by the
 * Deploy Prod workflow (version bump + changelog). One definition, so the
 * rule that is enforced is the same rule the release is computed from.
 *
 * No dependencies on purpose: this is ~100 lines of string handling and a
 * package for it would be a supply-chain surface bigger than the code.
 */

export const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
export const MAX_SUBJECT = 50;

const SUBJECT = new RegExp(`^(${TYPES.join('|')})(?:\\(([a-z0-9-]+)\\))?(!)?: (.+)$`);

export const isMerge = (subject) => /^Merge /.test(subject);

export function parseSubject(subject) {
  const m = SUBJECT.exec(subject);
  if (!m) return null;
  return { type: m[1], scope: m[2] ?? null, breaking: m[3] === '!', description: m[4] };
}

const hasBreakingFooter = (body) => /^BREAKING[ -]CHANGE: /m.test(body ?? '');

export function lintCommit({ subject, body }) {
  if (isMerge(subject)) return [];
  const p = parseSubject(subject);
  if (!p) return [`not a conventional commit (type(scope)?: description): "${subject}"`];
  const errors = [];
  if (subject.length > MAX_SUBJECT) errors.push(`subject is ${subject.length} chars, max ${MAX_SUBJECT}: "${subject}"`);
  if (/^[A-Z]/.test(p.description)) errors.push(`description starts lowercase: "${subject}"`);
  return errors;
}

export function bumpFor(commits) {
  const real = commits.filter((c) => !isMerge(c.subject));
  if (real.length === 0) return null;
  let bump = 'patch';
  for (const c of real) {
    const p = parseSubject(c.subject);
    if (p?.breaking || hasBreakingFooter(c.body)) return 'major';
    if (p?.type === 'feat') bump = 'minor';
  }
  return bump;
}

export function nextVersion(version, bump) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['docs', 'Docs'],
  ['test', 'Tests'],
  ['build', 'Build'],
  ['ci', 'CI'],
  ['style', 'Style'],
  ['chore', 'Chores'],
  ['revert', 'Reverts'],
];

const line = (p) => `- ${p.scope ? `**${p.scope}:** ` : ''}${p.description}`;

export function changelog(version, date, commits) {
  const parsed = commits.filter((c) => !isMerge(c.subject)).map((c) => ({ ...c, p: parseSubject(c.subject) })).filter((c) => c.p);
  const out = [`## ${version} (${date})`, ''];
  const breaking = parsed.filter((c) => c.p.breaking || hasBreakingFooter(c.body));
  if (breaking.length) out.push('### Breaking changes', ...breaking.map((c) => line(c.p)), '');
  for (const [type, title] of SECTIONS) {
    const items = parsed.filter((c) => c.p.type === type);
    if (items.length) out.push(`### ${title}`, ...items.map((c) => line(c.p)), '');
  }
  return out.join('\n');
}
