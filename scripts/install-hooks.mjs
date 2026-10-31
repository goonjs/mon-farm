/**
 * `npm run prepare` (runs on npm ci / npm install): point git at the tracked
 * .githooks/ directory. Never fails the install: no git, not a checkout (EAS,
 * Docker), or a read-only config just means no local hooks; CI is the authority.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

try {
  if (existsSync('.githooks')) {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  }
} catch {
  // see header
}
