export type NavigationPreferenceKey =
  | 'dashboard'
  | 'weekly-menu'
  | 'meal-orders'
  | 'approvals'
  | 'purchasing'
  | 'warehouse'
  | 'chef-dashboard'
  | 'reports'
  | 'admin-data'
  | 'approval-rules';

export type NavigationPreferences = Record<NavigationPreferenceKey, boolean>;

export const NAVIGATION_PREFERENCES_STORAGE_KEY = 'ipc.navigation-preferences.v1';

export const defaultNavigationPreferences: NavigationPreferences = {
  dashboard: true,
  'weekly-menu': true,
  'meal-orders': true,
  approvals: true,
  purchasing: true,
  warehouse: true,
  'chef-dashboard': true,
  reports: true,
  'admin-data': true,
  'approval-rules': true,
};

export const readNavigationPreferences = (storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage): NavigationPreferences => {
  if (!storage) return { ...defaultNavigationPreferences };
  try {
    const parsed: unknown = JSON.parse(storage.getItem(NAVIGATION_PREFERENCES_STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return { ...defaultNavigationPreferences };
    return Object.keys(defaultNavigationPreferences).reduce((result, key) => {
      const value = (parsed as Record<string, unknown>)[key];
      result[key as NavigationPreferenceKey] = typeof value === 'boolean' ? value : defaultNavigationPreferences[key as NavigationPreferenceKey];
      return result;
    }, {} as NavigationPreferences);
  } catch {
    return { ...defaultNavigationPreferences };
  }
};

export const writeNavigationPreferences = (preferences: NavigationPreferences, storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage) => {
  storage?.setItem(NAVIGATION_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  if (typeof window !== 'undefined' && storage === window.localStorage) window.dispatchEvent(new Event('ipc:navigation-preferences-changed'));
};

export const resetNavigationPreferences = (storage?: Storage) => writeNavigationPreferences(defaultNavigationPreferences, storage);

export type AdminTabPreferenceKey = 'bom-import' | 'contracts' | 'cleanup' | 'inventory' | 'statistics' | 'audit' | 'employees';
export const ADMIN_TAB_PREFERENCES_STORAGE_KEY = 'ipc.admin-tab-preferences.v1';
export const defaultAdminTabPreferences: Record<AdminTabPreferenceKey, boolean> = {
  'bom-import': true, contracts: true, cleanup: true, inventory: true, statistics: true, audit: true, employees: true,
};
export const readAdminTabPreferences = (storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage) => {
  if (!storage) return { ...defaultAdminTabPreferences };
  try {
    const parsed: unknown = JSON.parse(storage.getItem(ADMIN_TAB_PREFERENCES_STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return { ...defaultAdminTabPreferences };
    return Object.keys(defaultAdminTabPreferences).reduce((result, key) => {
      const value = (parsed as Record<string, unknown>)[key];
      result[key as AdminTabPreferenceKey] = typeof value === 'boolean' ? value : defaultAdminTabPreferences[key as AdminTabPreferenceKey];
      return result;
    }, {} as Record<AdminTabPreferenceKey, boolean>);
  } catch { return { ...defaultAdminTabPreferences }; }
};
export const writeAdminTabPreferences = (preferences: Record<AdminTabPreferenceKey, boolean>, storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage) => {
  storage?.setItem(ADMIN_TAB_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  if (typeof window !== 'undefined' && storage === window.localStorage) window.dispatchEvent(new Event('ipc:admin-tab-preferences-changed'));
};
