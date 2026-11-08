import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const API_DIR = path.resolve(__dirname, '../api');
const FRONTEND_DIR = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');

const BANNED_PATTERNS = [
  /\bgetBaseline\w*\b/,
  /\bBASELINE_\w*\b/,
  /\bmock\w*\b/i,
  /\bfallback\b/i,
  /['"]NL-THIT-01['"]/,
  /['"]BG-260921-01['"]/,
  /['"]Trần Văn B['"]/,
  /['"]Nguyễn Văn A['"]/,
  /['"]sup-1['"]/,
  /['"]wh-1['"]/,
];

describe('Rule TA-5: Zero Fake API Data & Anti-Bogus Verification Gate', () => {
  it('strictly forbids any fake baseline generators, mock seeds, or synthetic fixtures in src/api/*.ts', () => {
    const apiFiles = fs
      .readdirSync(API_DIR)
      .filter((file: string) => file.endsWith('.ts') && !file.endsWith('.test.ts') && file !== 'client.ts');

    expect(apiFiles.length).toBeGreaterThanOrEqual(10);

    for (const file of apiFiles) {
      const filePath = path.join(API_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // 1. Check for banned patterns
      for (const pattern of BANNED_PATTERNS) {
        const match = content.match(pattern);
        expect(
          match,
          `File ${file} contains banned fake data pattern: ${pattern}`
        ).toBeNull();
      }

      // 2. Check for catch blocks swallowing errors to return fake data or fake success
      const catchMatches = content.match(/catch\s*(?:\([^)]*\))?\s*\{([^}]*)\}/g) || [];
      for (const catchBlock of catchMatches) {
        expect(
          catchBlock,
          `File ${file} contains a catch block returning fallback dummy data: ${catchBlock}`
        ).not.toMatch(/return\s+(?:\{|\[|getBaseline)/);
      }
    }
  });

  it('strictly ensures every exported API method invokes apiClient', () => {
    const apiFiles = fs
      .readdirSync(API_DIR)
      .filter((file: string) => file.endsWith('.ts') && !file.endsWith('.test.ts') && file !== 'client.ts');

    for (const file of apiFiles) {
      const filePath = path.join(API_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Every exported API object must use the real client; pure helpers may share this folder.
      if (/export\s+const\s+\w+Api\s*=/.test(content)) {
        expect(
          content.includes('apiClient'),
          `File ${file} exports an API object without apiClient network calls!`
        ).toBe(true);
      }
    }
  });

  it('allows explicit test-level fetch handlers for both 200 OK and 500 error responses without triggering unexpected network failure', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { id: 'ok-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, message: 'Server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const res200 = await fetch('/api/explicit-allowed-success', { method: 'GET' });
    expect(res200.status).toBe(200);
    const res500 = await fetch('/api/explicit-allowed-error', { method: 'POST' });
    expect(res500.status).toBe(500);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('fails closed on caught unexpected fetch and keeps fail-closed boundary across restoreAllMocks and unstubAllGlobals', () => {
    const tmpDir = fs.mkdtempSync(path.join(FRONTEND_DIR, '.vitest-t5-canary-'));
    const fixtureTestPath = path.join(tmpDir, 'unexpected-network-canary.test.ts');
    const fixtureConfigPath = path.join(tmpDir, 'vitest.canary.config.ts');
    const setupFilePath = path.resolve(FRONTEND_DIR, 'src/test/setup.ts').replace(/\\/g, '/');
    const srcAliasPath = path.resolve(FRONTEND_DIR, 'src').replace(/\\/g, '/');
    const normalizedFixtureTest = path.relative(FRONTEND_DIR, fixtureTestPath).replace(/\\/g, '/');

    try {
      fs.writeFileSync(
        fixtureTestPath,
        `import { describe, it, vi } from 'vitest';

describe('T5 fail-closed network canary', () => {
  it('swallows unexpected fetch rejection but still fails the test at teardown', async () => {
    try {
      await fetch('http://invalid.ipc.test/api/unexpected-caught-canary', { method: 'POST' });
    } catch {
      // Intentionally swallowed by caller
    }
  });

  it('cannot uncover native fetch via restoreAllMocks or unstubAllGlobals', async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    try {
      await fetch('http://invalid.ipc.test/api/post-restore-canary', { method: 'DELETE' });
    } catch {
      // Intentionally swallowed by caller
    }
  });
});
`,
        'utf-8',
      );

      fs.writeFileSync(
        fixtureConfigPath,
        `import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '${FRONTEND_DIR.replace(/\\/g, '/')}',
  resolve: {
    alias: {
      '@': '${srcAliasPath}',
    },
  },
  test: {
    environment: 'jsdom',
    maxWorkers: 1,
    setupFiles: ['${setupFilePath}'],
    include: ['${normalizedFixtureTest}'],
  },
});
`,
        'utf-8',
      );

      const vitestCli = path.resolve(REPO_ROOT, 'node_modules/vitest/vitest.mjs');
      const result = spawnSync(
        process.execPath,
        [vitestCli, 'run', '--config', fixtureConfigPath, '--no-file-parallelism', '--pool=vmThreads', '--reporter=verbose'],
        {
          cwd: FRONTEND_DIR,
          encoding: 'utf-8',
          timeout: 15000,
          env: {
            ...process.env,
            CI: 'true',
          },
        },
      );

      const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(combinedOutput).toContain('POST http://invalid.ipc.test/api/unexpected-caught-canary');
      expect(combinedOutput).toContain('DELETE http://invalid.ipc.test/api/post-restore-canary');
    } finally {
      try {
        for (const entry of fs.readdirSync(tmpDir)) {
          fs.unlinkSync(path.join(tmpDir, entry));
        }
        fs.rmdirSync(tmpDir);
      } catch {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    }
  });
});
