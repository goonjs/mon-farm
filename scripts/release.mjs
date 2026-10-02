/**
 * CLI around conventional.mjs, used by CI and the Deploy Prod workflow.
 *
 *   node scripts/release.mjs lint <base>..<head>   exit 1 on any bad commit
 *   node scripts/release.mjs plan                  prints next version + bump
 *   node scripts/release.mjs apply                 writes package.json + CHANGELOG.md
 *
 * `plan`/`apply` read commits since the latest v* tag (or all history before
 * the first release). Stdout of `plan` is `KEY=value` lines, so a workflow can
 * append it straight to $GITHUB_OUTPUT.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bumpFor, changelog, lintCommit, nextVersion } from './conventional.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const SEP = '\x1e';
const END = '\x1f';

function commitsIn(range) {
  const raw = git('log', '--no-merges', `--format=%s${SEP}%b${END}`, range);
  return raw
    .split(END)
    .map((r) => r.replace(/^\n/, ''))
    .filter(Boolean)
    .map((r) => {
      const [subject, body = ''] = r.split(SEP);
      return { subject, body: body.trim() };
    });
}

const lastTag = () => {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v*');
  } catch {
    return null;
  }
};

const sinceLastTag = () => {
  const tag = lastTag();
  return { tag, commits: commitsIn(tag ? `${tag}..HEAD` : 'HEAD') };
};

const [cmd, arg] = process.argv.slice(2);

if (cmd === 'lint') {
  const errors = commitsIn(arg).flatMap((c) => lintCommit(c));
  errors.forEach((e) => console.error(`commit lint: ${e}`));
  process.exit(errors.length ? 1 : 0);
}

if (cmd === 'plan' || cmd === 'apply') {
  const { tag, commits } = sinceLastTag();
  const bump = bumpFor(commits);
  if (!bump) {
    console.error('nothing to release: no commits since ' + (tag ?? 'start'));
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const version = nextVersion(pkg.version, bump);
  if (cmd === 'plan') {
    console.log(`bump=${bump}\nversion=${version}\nprevious=${tag ?? ''}`);
  } else {
    pkg.version = version;
    writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    const entry = changelog(version, new Date().toISOString().slice(0, 10), commits);
    writeFileSync('RELEASE_NOTES.md', entry);
    const head = '# Changelog\n\n';
    const prev = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8').replace(head, '') : '';
    writeFileSync('CHANGELOG.md', head + entry + '\n' + prev);
  }
  process.exit(0);
}

console.error('usage: release.mjs lint <range> | plan | apply');
process.exit(2);
