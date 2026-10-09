import { describe, expect, it } from 'vitest';
import { MARKER, commentBody, previewUrl } from './preview-comment.mjs';

// What `firebase hosting:channel:deploy` prints on success.
const log = `
=== Deploying to 'mon-farmmate'...
✔  hosting:channel: Channel URL (mon-farm-dev): https://mon-farm-dev--pr-12-a1b2c3d4.web.app [expires 2026-10-16 18:00:00]
`;

describe('previewUrl', () => {
  it('finds the channel URL in the deploy log', () => {
    expect(previewUrl(log)).toBe('https://mon-farm-dev--pr-12-a1b2c3d4.web.app');
  });

  it('returns null when there is no URL', () => {
    expect(previewUrl('Error: something')).toBeNull();
  });

  it('ignores URLs on other hosts', () => {
    expect(previewUrl('see https://firebase.google.com/docs')).toBeNull();
  });
});

describe('commentBody', () => {
  const body = commentBody({ url: 'https://mon-farm-dev--pr-12-a1b2.web.app', sha: 'abcdef1234567', expires: '2026-10-16' });

  // The marker is how the workflow finds and edits its own comment instead of
  // posting a new one on every push.
  it('starts with the marker', () => {
    expect(body.startsWith(MARKER)).toBe(true);
  });

  it('links the preview, names the commit and the expiry', () => {
    expect(body).toContain('https://mon-farm-dev--pr-12-a1b2.web.app');
    expect(body).toContain('abcdef1');
    expect(body).not.toContain('abcdef1234567');
    expect(body).toContain('2026-10-16');
  });

  it('says the preview uses dev data, never production', () => {
    expect(body).toMatch(/dev/);
  });
});
