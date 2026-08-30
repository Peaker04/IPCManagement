import { describe, it, expect, beforeEach } from 'vitest';
import {
  readStreamlinePreferences,
  writeStreamlinePreferences,
  resetStreamlinePreferences,
  defaultStreamlinePreferences,
  fullVisibilityPreferences,
  STREAMLINE_PREFERENCES_STORAGE_KEY,
} from './uiStreamlineConfig';

describe('uiStreamlineConfig', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads full visibility fallback in test environment when storage is empty', () => {
    const prefs = readStreamlinePreferences();
    expect(prefs.enableStreamlinedMode).toBe(false);
    expect(prefs.showOrderStatusBanner).toBe(true);
    expect(prefs.showMenuAmendmentBanner).toBe(true);
  });

  it('writes and reads streamline preferences correctly', () => {
    writeStreamlinePreferences(defaultStreamlinePreferences);
    const prefs = readStreamlinePreferences();
    expect(prefs.enableStreamlinedMode).toBe(true);
    expect(prefs.showOrderStatusBanner).toBe(false);
    expect(prefs.showMenuAmendmentBanner).toBe(false);
  });

  it('handles partial stored preferences gracefully', () => {
    window.localStorage.setItem(
      STREAMLINE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ showOrderStatusBanner: false, enableStreamlinedMode: true })
    );
    const prefs = readStreamlinePreferences();
    expect(prefs.enableStreamlinedMode).toBe(true);
    expect(prefs.showOrderStatusBanner).toBe(false);
  });

  it('resets streamline preferences back to default', () => {
    writeStreamlinePreferences(fullVisibilityPreferences);
    resetStreamlinePreferences();
    const prefs = readStreamlinePreferences();
    expect(prefs.enableStreamlinedMode).toBe(true);
    expect(prefs.showOrderStatusBanner).toBe(false);
  });
});
