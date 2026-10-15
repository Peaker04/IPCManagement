import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const API_DIR = path.resolve(__dirname, '../api');

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

      // Every exported api object must use apiClient
      expect(
        content.includes('apiClient'),
        `File ${file} does not use apiClient for real network calls!`
      ).toBe(true);
    }
  });
});
