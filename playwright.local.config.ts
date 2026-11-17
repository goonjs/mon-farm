import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({ ...base, projects: base.projects?.map((p) => ({ ...p, use: { ...p.use, deviceScaleFactor: 2, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } } })) });
