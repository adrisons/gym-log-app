/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The `theme-color` / manifest colours here are provisional placeholders for
// Phase 0. The design-token module (src/presentation/design/) is the source
// of truth for visual values; these are duplicated only because a web app
// manifest cannot read CSS custom properties. Keep them in sync by hand, or
// generate them from the tokens in a later phase.
const MANIFEST_BACKGROUND = '#ffffff';
const MANIFEST_THEME = '#1a1a1a';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        start_url: '/',
        background_color: MANIFEST_BACKGROUND,
        theme_color: MANIFEST_THEME,
        icons: [],
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
