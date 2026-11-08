export const SUPPORTED_DESKTOP_VIEWPORTS = [
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
] as const;

export const SUPPORTED_WINDOWS_VERSIONS = ['windows-10', 'windows-11'] as const;
export const SUPPORTED_BROWSER_VERSION_BANDS = ['current', 'previous'] as const;

export const SUPPORTED_BROWSER_CHANNELS = [
  { id: 'chrome', channel: 'chrome' },
  { id: 'edge', channel: 'msedge' },
] as const;

export const SUPPORTED_MOTION_PREFERENCES = ['no-preference', 'reduce'] as const;
export const SUPPORTED_ZOOM_PERCENTAGES = [100, 200] as const;

export const CRITICAL_BROWSER_WORKFLOWS = [
  'login-session-expiry',
  'weekly-menu-editing',
  'import-preview-validation',
  'approval-decision',
  'warehouse-receipt-issue',
  'reports-filters-tables',
  'reconciliation-comparison-detail',
] as const;

export const browserEvidenceCellKey = (input: {
  os: string;
  browser: string;
  versionBand: string;
  viewport: string;
  motion: string;
  zoom: number;
  workflow: string;
}) => [input.os, input.browser, input.versionBand, input.viewport, input.motion, `${input.zoom}%`, input.workflow].join('|');

export const EXPECTED_BROWSER_EVIDENCE_CELL_COUNT =
  SUPPORTED_WINDOWS_VERSIONS.length
  * SUPPORTED_BROWSER_CHANNELS.length
  * SUPPORTED_BROWSER_VERSION_BANDS.length
  * SUPPORTED_DESKTOP_VIEWPORTS.length
  * SUPPORTED_MOTION_PREFERENCES.length
  * SUPPORTED_ZOOM_PERCENTAGES.length
  * CRITICAL_BROWSER_WORKFLOWS.length;
