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
    // These validators consume immutable local browser-recovery evidence that is intentionally
    // excluded from Git. CI verifies source/unit contracts; operators run evidence validators
    // only in the sealed workspace that owns those artifacts.
    exclude: process.env.CI ? [
      'tests/uiAuditBaselineDelta.test.ts',
      'tests/uiAuditBaselineReconciliation.emit.test.ts',
      'tests/uiAuditBaselineReconciliation.test.ts',
      'tests/uiAuditBlindReviewValidator.test.ts',
      'tests/uiAuditRemediationAttribution.test.ts',
      'tests/uiAuditRemediationReconciliation.test.ts',
      'tests/uiAuditRemediationReconciliation.emit.test.ts',
      'tests/uiAuditRouteOwnerRegression.test.tsx',
      'tests/validatePhase271PlanResult.test.ts',
      'tests/validatePhase271Reseal.test.ts',
      'tests/validateVisualReconciliation.test.ts',
      'src/features/purchasing/pages/PurchasingPage.state.test.tsx',
    ] : [],
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
