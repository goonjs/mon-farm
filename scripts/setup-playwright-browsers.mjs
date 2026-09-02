#!/usr/bin/env node
/**
 * Setup script to configure Playwright to use pre-installed browsers.
 *
 * In remote environments, Chromium browsers are pre-installed at /opt/pw-browsers,
 * but may be under a version number (e.g. 1194) that doesn't match the currently
 * installed Playwright version (e.g. 1.44.0 expects 1117). This script creates
 * a symlink so Playwright can find the browser.
 *
 * This is a one-time setup that should run after npm install.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupPlaywrightBrowsers() {
  const browsersDir = '/opt/pw-browsers';

  // Check if we have pre-installed browsers
  try {
    await fs.access(browsersDir);
  } catch {
    console.log('ℹ️  No pre-installed browsers found at /opt/pw-browsers (expected in remote environments)');
    return;
  }

  // Find what Chromium versions are installed
  const entries = await fs.readdir(browsersDir, { withFileTypes: true });
  const chromiumDirs = entries
    .filter(e => e.isDirectory() && e.name.match(/^chromium-\d+$/))
    .map(e => ({
      name: e.name,
      version: parseInt(e.name.split('-')[1]),
    }))
    .sort((a, b) => b.version - a.version);

  if (chromiumDirs.length === 0) {
    console.log('ℹ️  No pre-installed Chromium browsers found');
    return;
  }

  const latestChromium = chromiumDirs[0];
  console.log(`✓ Found pre-installed Chromium ${latestChromium.version}`);

  // Read package.json to find what Playwright version is installed
  try {
    const pkgPath = path.join(__dirname, '..', 'node_modules', '@playwright', 'test', 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const playwrightVersion = pkg.version;
    console.log(`✓ Playwright ${playwrightVersion} is installed`);

    // Try to read Playwright's browser version expectations from the package
    // This is a best-effort attempt; if Playwright versions are incompatible,
    // we create a symlink to the latest available browser
    const expectedBrowserFile = path.join(__dirname, '..', 'node_modules', '@playwright', 'test', 'browsers.json');

    let expectedVersion = null;
    try {
      const browsers = JSON.parse(await fs.readFile(expectedBrowserFile, 'utf-8'));
      const chromium = browsers.browsers?.find(b => b.name === 'chromium');
      if (chromium) {
        expectedVersion = chromium.browserVersion;
        console.log(`  Playwright expects Chromium ${expectedVersion}`);
      }
    } catch {
      // browsers.json might not exist or have a different structure; that's ok
    }

    // If Playwright expects a different version, create a symlink
    if (expectedVersion && expectedVersion !== latestChromium.version.toString()) {
      const symlinkName = `chromium-${expectedVersion}`;
      const symlinkPath = path.join(browsersDir, symlinkName);

      try {
        await fs.access(symlinkPath);
        console.log(`✓ Symlink ${symlinkName} already exists`);
      } catch {
        // Symlink doesn't exist, create it
        try {
          // Need to run with sudo or in an environment that allows writing to /opt
          console.log(`  Attempting to create symlink ${symlinkName} → ${latestChromium.name}...`);
          await fs.symlink(latestChromium.name, symlinkPath);
          console.log(`✓ Created symlink: ${symlinkName} → ${latestChromium.name}`);
        } catch (err) {
          // If we can't create the symlink (permission issue), just warn
          console.warn(
            `⚠️  Could not create symlink (requires permission to write to /opt/pw-browsers):\n` +
            `   Expected: /opt/pw-browsers/${symlinkName}\n` +
            `   Available: /opt/pw-browsers/${latestChromium.name}\n` +
            `   Error: ${err.message}\n\n` +
            `   If tests fail with "Executable doesn't exist", you may need to run:\n` +
            `   sudo ln -sf ${latestChromium.name} /opt/pw-browsers/${symlinkName}`
          );
        }
      }
    }
  } catch (err) {
    console.error('Error setting up Playwright browsers:', err.message);
    process.exit(1);
  }
}

setupPlaywrightBrowsers().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
