#!/usr/bin/env node

/**
 * Enterprise Pre-Commit Cross-Layer Integration & Quality Gate (Rule GATE_6_PRECOMMIT_FINAL)
 * Sequentially executes 5 physical and behavioral verification gates:
 * - Gate A: Physical Module & Export Audit (35 modules + 4 barrel exports)
 * - Gate B: Forbidden Pattern Scan (Zero window.alert / window.confirm)
 * - Gate C: Architecture Growth Limits (Zero FE files > 600 lines, Zero Test files > 1500 lines)
 * - Gate D: Production Typecheck & Build (tsc -b && vite build)
 * - Gate E: Full Automated Test Suite (All 21 Vitest test files)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const FRONTEND_SRC = path.join(ROOT_DIR, 'frontend', 'src');

console.log('========================================================================');
console.log('   ENTERPRISE PRE-COMMIT CROSS-LAYER VERIFICATION & QUALITY GATE        ');
console.log('========================================================================\n');

function step(title) {
  console.log(`\n>>> [${title}]`);
}

function pass(msg) {
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ FAIL: ${msg}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// GATE A: Physical Module & Export Audit
// -----------------------------------------------------------------------------
step('GATE A: PHYSICAL MODULE & EXPORT AUDIT');

const REQUIRED_MODULES = [
  // Layer 1: Design Tokens & Base Primitives
  'styles/index.css',
  'components/ui/badge.tsx',
  'components/ui/checkbox.tsx',
  'components/ui/input.tsx',
  'components/ui/select.tsx',
  'components/ui/button.tsx',
  'components/ui/inline-banner.tsx',
  'components/ui/num.tsx',
  'components/ui/identifier-text.tsx',
  'components/ui/vietnamese-date-input.tsx',
  'components/ui/modal.tsx',
  'components/ui/tabs.tsx',
  'components/ui/action-guard.tsx',
  // Layer 2: Core Workbench Composites
  'components/workbench/AppShell.tsx',
  'components/workbench/WorkspaceHeader.tsx',
  'components/workbench/TelemetrySubbar.tsx',
  'components/workbench/DataGrid.tsx',
  'components/workbench/SplitView.tsx',
  'components/workbench/StateBoundary.tsx',
  'components/workbench/WorkbenchSkeleton.tsx',
  'components/workbench/DirtyNavigation.tsx',
  'components/workbench/ReconciliationLifecycleStrip.tsx',
  'components/workbench/NetworkConnectivityBanner.tsx',
  'components/workbench/SessionExpiredModal.tsx',
  // Layer 3 & 4: State Management & Canonical Hooks
  'store/workspaceUiState.ts',
  'store/workspaceSessionStore.ts',
  'store/serverStateCache.ts',
  'store/useAuth.ts',
  'store/authContext.tsx',
  'hooks/useUrlWorkbenchState.ts',
  'hooks/useClientDraftPersistence.ts',
  'hooks/useWorkbenchQuery.ts',
  'hooks/useDeferredSkeleton.ts',
  // Barrels
  'components/ui/index.ts',
  'components/workbench/index.ts',
  'hooks/index.ts',
  'store/index.ts',
];

for (const relPath of REQUIRED_MODULES) {
  const fullPath = path.join(FRONTEND_SRC, relPath);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing required physical module: ${relPath}`);
  }
}
pass(`All ${REQUIRED_MODULES.length} physical modules & barrel exports verified on disk.`);

// -----------------------------------------------------------------------------
// GATE B: Forbidden Pattern Scan (window.alert / window.confirm)
// -----------------------------------------------------------------------------
step('GATE B: FORBIDDEN PATTERN SCAN (Zero window.alert / window.confirm)');

function scanForbiddenInDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test' || entry.name === 'node_modules') {
        continue;
      }
      scanForbiddenInDir(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.match(/\b(window\.(alert|confirm)|alert\(|confirm\()/g);
      if (matches) {
        fail(`Forbidden pattern found in ${path.relative(ROOT_DIR, full)}: ${matches.join(', ')}`);
      }
    }
  }
}

scanForbiddenInDir(FRONTEND_SRC);
pass('Zero occurrences of window.alert, window.confirm, alert(, confirm( in frontend/src.');

// -----------------------------------------------------------------------------
// GATE C: Architecture Growth Limits
// -----------------------------------------------------------------------------
step('GATE C: ARCHITECTURE GROWTH LIMITS');

try {
  const archOutput = execSync('node scripts/check-architecture-growth.mjs', { encoding: 'utf8' });
  const lines = archOutput.split('\n');
  for (const line of lines) {
    // Only match actual finding lines, not the thresholds header
    if ((line.startsWith('[PLAN_REQUIRED]') || line.startsWith('[WARNING]')) && (line.includes('FE') || line.includes('test:'))) {
      fail(`Architecture growth violation: ${line}`);
    }
  }
  pass('Strict architecture growth gate passed (0 FE files > 600 lines, 0 test files > 1500 lines).');
} catch (err) {
  fail(`Architecture growth check failed: ${err.message}`);
}

// -----------------------------------------------------------------------------
// GATE D: Production Typecheck & Build
// -----------------------------------------------------------------------------
step('GATE D: PRODUCTION TYPECHECK & BUILD');

try {
  execSync('npm --prefix frontend run build', { stdio: 'inherit' });
  pass('Production typecheck & Vite build passed cleanly (0 errors).');
} catch (err) {
  fail(`Production build failed: ${err.message}`);
}

// -----------------------------------------------------------------------------
// GATE E: Full Automated Test Suite
// -----------------------------------------------------------------------------
step('GATE E: FULL AUTOMATED TEST SUITE');

try {
  execSync('npm run test:fe:unit', { stdio: 'inherit' });
  pass('Full Vitest unit & cross-layer integration test suite passed (100% PASS).');
} catch (err) {
  fail(`Test suite execution failed: ${err.message}`);
}

console.log('\n========================================================================');
console.log('   ✓ ALL 5 PRE-COMMIT VERIFICATION GATES PASSED SUCCESSFULLY!          ');
console.log('   Ready for git commit and merge.                                      ');
console.log('========================================================================\n');
