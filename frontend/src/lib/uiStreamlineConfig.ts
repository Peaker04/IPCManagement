import { useEffect, useState } from 'react';

export interface UiStreamlinePreferences {
  /**
   * Master switch for streamlined mode.
   * When true, non-core status banners, reminders, and guides are hidden by default.
   */
  enableStreamlinedMode: boolean;

  // Header & Shell
  showStatusPills: boolean;
  showOperatingModeChip: boolean;

  // Coordination / Điều phối suất ăn
  showOrderStatusBanner: boolean;

  // Approvals / Duyệt vận hành
  showMenuAmendmentBanner: boolean;
  showApprovalDisabledAlert: boolean;

  // Weekly Menu / Thực đơn tuần & KHSX
  showWeeklyMenuReadiness: boolean;
  showWeeklyMenuAlerts: boolean;
  showWeeklyReconciliation: boolean;

  // Chef / Bếp trưởng
  showChefShiftAlert: boolean;
  showChefStatusBulletList: boolean;

  // Purchasing / Thu mua
  showPurchasingGuide: boolean;
  showPurchasingNextActionAlert: boolean;
  showPurchasingDescriptions: boolean;

  // Warehouse / Kho nguyên liệu
  showWarehouseGuidanceAlert: boolean;
}

export const STREAMLINE_PREFERENCES_STORAGE_KEY = 'ipc.streamline-preferences.v1';

/**
 * Default preferences: Streamlined mode is ENABLED.
 * Secondary banners, reminders, and non-essential status displays are HIDDEN by default.
 */
export const defaultStreamlinePreferences: UiStreamlinePreferences = {
  enableStreamlinedMode: true,
  showStatusPills: false,
  showOperatingModeChip: false,
  showOrderStatusBanner: false,
  showMenuAmendmentBanner: false,
  showApprovalDisabledAlert: false,
  showWeeklyMenuReadiness: false,
  showWeeklyMenuAlerts: false,
  showWeeklyReconciliation: false,
  showChefShiftAlert: false,
  showChefStatusBulletList: false,
  showPurchasingGuide: false,
  showPurchasingNextActionAlert: false,
  showPurchasingDescriptions: false,
  showWarehouseGuidanceAlert: false,
};

/**
 * Full visibility preferences when streamlined mode is turned OFF.
 */
export const fullVisibilityPreferences: UiStreamlinePreferences = {
  enableStreamlinedMode: false,
  showStatusPills: true,
  showOperatingModeChip: true,
  showOrderStatusBanner: true,
  showMenuAmendmentBanner: true,
  showApprovalDisabledAlert: true,
  showWeeklyMenuReadiness: true,
  showWeeklyMenuAlerts: true,
  showWeeklyReconciliation: true,
  showChefShiftAlert: true,
  showChefStatusBulletList: true,
  showPurchasingGuide: true,
  showPurchasingNextActionAlert: true,
  showPurchasingDescriptions: true,
  showWarehouseGuidanceAlert: true,
};

const isTestMode = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

export const readStreamlinePreferences = (
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage
): UiStreamlinePreferences => {
  const fallback = isTestMode ? fullVisibilityPreferences : defaultStreamlinePreferences;
  if (!storage) return { ...fallback };
  try {
    const raw = storage.getItem(STREAMLINE_PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...fallback };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...fallback };

    return Object.keys(defaultStreamlinePreferences).reduce((result, key) => {
      const typedKey = key as keyof UiStreamlinePreferences;
      const val = (parsed as Record<string, unknown>)[typedKey];
      result[typedKey] = typeof val === 'boolean' ? val : fallback[typedKey];
      return result;
    }, {} as UiStreamlinePreferences);
  } catch {
    return { ...fallback };
  }
};

export const writeStreamlinePreferences = (
  preferences: UiStreamlinePreferences,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage
) => {
  storage?.setItem(STREAMLINE_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  if (typeof window !== 'undefined' && storage === window.localStorage) {
    window.dispatchEvent(new Event('ipc:streamline-preferences-changed'));
  }
};

export const resetStreamlinePreferences = (storage?: Storage) =>
  writeStreamlinePreferences(defaultStreamlinePreferences, storage);

/**
 * React hook to access streamline preferences with auto-refresh on storage / custom event change.
 */
export function useUiStreamlinePreferences(): UiStreamlinePreferences {
  const [preferences, setPreferences] = useState(readStreamlinePreferences);

  useEffect(() => {
    const refresh = () => setPreferences(readStreamlinePreferences());
    window.addEventListener('storage', refresh);
    window.addEventListener('ipc:streamline-preferences-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('ipc:streamline-preferences-changed', refresh);
    };
  }, []);

  return preferences;
}
