import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Regression test for a real production incident: the composition root's
// <BrowserRouter> had no `basename`, so on GitHub Pages — served from
// https://<owner>.github.io/gym-log-app/, not the domain root — `Routes`
// tried to match against the raw pathname ("/gym-log-app/..."), none of
// the routes matched, and the whole app rendered nothing: a blank page in
// production, undetected by every other e2e test here because none of
// them build with GITHUB_PAGES=true (vite.config.ts's base stays "/" for
// dev/preview/this suite's own webServer). This spec is the one place
// that builds the actual GITHUB_PAGES=true output and serves it from a
// subpath, the same shape as the real deployment, to catch this class of
// bug again if it recurs (e.g. a future refactor drops the `basename`
// prop). Chromium-only: this is routing/build-configuration behavior, not
// browser-specific rendering, so there's nothing WebKit would catch that
// chromium wouldn't — mirrors spec 003's own chromium-only precedent for
// platform-orthogonal contract coverage.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR_NAME = 'dist-pages-test';
const OUT_DIR = path.join(REPO_ROOT, OUT_DIR_NAME);
const PORT = 4175;
const BASE_PATH = '/gym-log-app';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

let server: Server;

test.beforeAll(async () => {
  execSync(`npx vite build --outDir ${OUT_DIR_NAME}`, {
    cwd: REPO_ROOT,
    env: { ...process.env, GITHUB_PAGES: 'true' },
    stdio: 'inherit',
  });

  server = createServer((req, res) => {
    void (async () => {
      const requestedPath = (req.url ?? '/').split('?')[0]!;
      const relative = requestedPath.startsWith(BASE_PATH)
        ? (requestedPath.slice(BASE_PATH.length) ?? '/')
        : requestedPath;
      const filePath = path.join(
        OUT_DIR,
        relative === '' || relative === '/' ? 'index.html' : relative,
      );
      try {
        const data = await readFile(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(OUT_DIR, { recursive: true, force: true });
});

test('the app renders (not a blank page) when served from a GitHub Pages-style subpath', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'routing/build behavior, not browser-specific',
  );

  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto(`http://localhost:${PORT}${BASE_PATH}/`);

  // "/" redirects to "/diary" (docs/requirements.md FR-1) — the redirect
  // itself is good evidence the router resolved under the subpath basename
  // correctly, which is what this regression test exists to catch.
  await expect(page.getByRole('heading', { name: 'Diary' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
