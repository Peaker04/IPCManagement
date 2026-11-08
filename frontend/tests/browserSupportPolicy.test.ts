import { describe, expect, it } from 'vitest';
import config from '../playwright.browser-support.config';
import {
  CRITICAL_BROWSER_WORKFLOWS,
  EXPECTED_BROWSER_EVIDENCE_CELL_COUNT,
  SUPPORTED_BROWSER_CHANNELS,
  SUPPORTED_BROWSER_VERSION_BANDS,
  SUPPORTED_DESKTOP_VIEWPORTS,
  SUPPORTED_MOTION_PREFERENCES,
  SUPPORTED_WINDOWS_VERSIONS,
  SUPPORTED_ZOOM_PERCENTAGES,
  browserEvidenceCellKey,
} from './browserSupportPolicy';

describe('D06 browser support harness contract', () => {
  it('locks browsers, desktop viewports, motion, zoom and critical workflow denominator', () => {
    expect(SUPPORTED_WINDOWS_VERSIONS).toEqual(['windows-10', 'windows-11']);
    expect(SUPPORTED_BROWSER_VERSION_BANDS).toEqual(['current', 'previous']);
    expect(SUPPORTED_BROWSER_CHANNELS).toEqual([
      { id: 'chrome', channel: 'chrome' },
      { id: 'edge', channel: 'msedge' },
    ]);
    expect(SUPPORTED_DESKTOP_VIEWPORTS.map(({ width, height }) => `${width}x${height}`)).toEqual([
      '1366x768', '1440x900', '1920x1080',
    ]);
    expect(SUPPORTED_MOTION_PREFERENCES).toEqual(['no-preference', 'reduce']);
    expect(SUPPORTED_ZOOM_PERCENTAGES).toEqual([100, 200]);
    expect(CRITICAL_BROWSER_WORKFLOWS).toHaveLength(7);
    expect(EXPECTED_BROWSER_EVIDENCE_CELL_COUNT).toBe(672);
    expect(browserEvidenceCellKey({
      os: 'windows-11', browser: 'edge', versionBand: 'previous', viewport: 'desktop-1440x900',
      motion: 'reduce', zoom: 200, workflow: 'approval-decision',
    })).toBe('windows-11|edge|previous|desktop-1440x900|reduce|200%|approval-decision');
  });

  it('creates Chrome and Edge projects for both motion preferences without starting a dev server', () => {
    expect(config.projects?.map((project) => project.name)).toEqual([
      'chrome-no-preference', 'chrome-reduce', 'edge-no-preference', 'edge-reduce',
    ]);
    expect(config.webServer).toBeUndefined();
    expect(config.use?.baseURL).toBeUndefined();
    expect(config.projects?.every((project) => project.use?.userAgent === undefined)).toBe(true);
  });
});
