/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// These mirror the light-theme --color-canvas / --color-accent tokens
// (src/presentation/design/tokens.css). The design-token module is the
// source of truth for visual values; these are duplicated only because a
// web app manifest cannot read CSS custom properties. Keep them in sync by
// hand, or generate them from the tokens in a later phase.
const MANIFEST_BACKGROUND = '#f3f4f6';
const MANIFEST_THEME = '#2f5bff';

// GitHub Pages serves a project repo (not a <user>.github.io repo) from
// https://<owner>.github.io/<repo>/ — every asset URL and the PWA
// manifest's start_url/icons must be rooted there, not at "/". The
// deploy workflow (.github/workflows/deploy.yml) sets GITHUB_PAGES=true;
// every other context (dev server, preview, CI's own test:e2e build)
// stays at root "/".
const BASE = process.env.GITHUB_PAGES === 'true' ? '/gym-log-app/' : '/';

export default defineConfig({
  base: BASE,
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    rollupOptions: {
      // A second HTML entry point alongside the app shell: a minimal page
      // Playwright loads to drive the shared storage-adapter contract
      // suite against a real IndexedDbStorageAdapter/FileSystemStorageAdapter
      // in-browser (spec 003 research.md §3) — jsdom has neither API, so
      // this cannot run under Vitest. Not linked from the app shell; only
      // `test/e2e/*.contract.spec.ts` navigates to it.
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        storageHarness: new URL(
          './test/e2e/fixtures/storage-harness.html',
          import.meta.url,
        ).pathname,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // Spec 009: 'prompt', not 'autoUpdate' — a new version is downloaded
      // and held until PwaLifecycleAdapter's onNeedRefresh callback lets
      // the app decide when to apply it (never silently, never mid-set,
      // Principle II). See src/infrastructure/pwa-lifecycle-adapter.ts.
      registerType: 'prompt',
      // Phase 0: precache the app shell so it is usable offline after first
      // load (ADR-0002). No runtime caching rules yet — there are no data
      // requests to cache.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      manifest: {
        name: 'gym-log',
        short_name: 'gym-log',
        description: 'A personal training diary.',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        background_color: MANIFEST_BACKGROUND,
        theme_color: MANIFEST_THEME,
        // Flat placeholder icons (public/) — Phase 0 scope; a real icon is
        // a docs/design.md concern for a later pass. Chromium requires at
        // least a 192px and a 512px icon, plus a maskable icon, for the
        // shell to be treated as installable (PR #3 review).
        icons: [
          {
            src: `${BASE}icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${BASE}icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${BASE}icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/support/setup.ts'],
    include: [
      'test/unit/**/*.test.{ts,tsx}',
      'test/integration/**/*.test.{ts,tsx}',
      'test/boundaries/**/*.test.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
  },
});
