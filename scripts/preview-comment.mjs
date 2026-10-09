/**
 * Builds the PR comment that links a preview channel (E01-S07, D-21).
 *
 *   node scripts/preview-comment.mjs <deploy-log> <sha>   prints the comment body
 *
 * Exits 1 when the log holds no channel URL, so a deploy that "succeeded"
 * without a link fails the job instead of posting an empty comment.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The workflow finds its own earlier comment by this line and edits it, so a
// PR carries one preview comment however many times it is pushed.
export const MARKER = '<!-- mon-farm-preview -->';

export function previewUrl(log) {
  const m = log.match(/https:\/\/[a-z0-9-]+--[a-z0-9-]+\.web\.app/);
  return m ? m[0] : null;
}

export function commentBody({ url, sha, expires }) {
  return [
    MARKER,
    `**Preview:** ${url}`,
    '',
    `Commit \`${sha.slice(0, 7)}\` · expires ${expires} (7 days; every push renews it) · ` +
      'dev site and dev data only, never production. Deleted when this PR closes.',
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [logPath, sha] = process.argv.slice(2);
  const url = previewUrl(readFileSync(logPath, 'utf8'));
  if (!url || !sha) {
    console.error('preview-comment: no preview URL in the deploy log');
    process.exit(1);
  }
  const expires = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  console.log(commentBody({ url, sha, expires }));
}
