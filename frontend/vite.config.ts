import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    manifest: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:5262',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:5262',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    // Phase 27.1 validators pin immutable historical Git/artifact topology rather than current
    // product behavior. Keep them out of the normal unit signal and run them explicitly with
    // `npm run test:historical-evidence` in the sealed workspace that owns that evidence.
    // Campaign inventories under tests/evidence pin reviewed ledgers/geometry rather than
    // current product behavior. Run them explicitly with `npm run test:campaign-evidence`.
    exclude: [
      ...(process.env.npm_lifecycle_event === 'test:campaign-evidence' ? [] : [
        'tests/evidence/**/*.test.{ts,tsx}',
      ]),
      ...(process.env.npm_lifecycle_event === 'test:historical-evidence' ? [] : [
        'tests/validatePhase271Reseal.test.ts',
        'tests/validateVisualReconciliation.test.ts',
      ]),
      ...(process.env.CI ? [
      'tests/uiAuditBaselineReconciliation.emit.test.ts',
      'tests/uiAuditBaselineReconciliation.test.ts',
      'tests/uiAuditBlindReviewValidator.test.ts',
      'tests/uiAuditRemediationReconciliation.test.ts',
      'tests/uiAuditRemediationReconciliation.emit.test.ts',
      'tests/uiAuditRouteOwnerRegression.test.tsx',
      'tests/validatePhase271PlanResult.test.ts',
      'src/features/purchasing/pages/PurchasingPage.state.test.tsx',
    ] : []),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/assets/**',
      ],
    },
  },
})
