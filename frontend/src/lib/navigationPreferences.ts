export type NavigationPreferenceKey =
  | 'dashboard'
  | 'weekly-menu'
  | 'meal-orders'
  | 'approvals'
  | 'purchasing'
  | 'warehouse'
  | 'reconciliation'
  | 'chef-dashboard'
  | 'reports'
  | 'admin-data'
  | 'approval-rules';

export type NavigationPreferences = Record<NavigationPreferenceKey, boolean>;

export const NAVIGATION_PREFERENCES_STORAGE_KEY = 'ipc.navigation-preferences.v1';

const browserStorage = () => {
  if (typeof window === 'undefined') return undefined;
  try { return window.localStorage; } catch { return undefined; }
};

export const defaultNavigationPreferences: NavigationPreferences = {
  dashboard: true,
  'weekly-menu': true,
  'meal-orders': true,
  approvals: true,
  purchasing: true,
  warehouse: true,
  reconciliation: true,
  'chef-dashboard': true,
  reports: true,
  'admin-data': true,
  'approval-rules': true,
};

export const readNavigationPreferences = (storage: Storage | undefined = browserStorage()): NavigationPreferences => {
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

const writeStorage = (storage: Storage | undefined, key: string, value: string) => {
  if (!storage) return false;
  try { storage.setItem(key, value); return true; } catch { return false; }
};

const removeStorage = (storage: Storage | undefined, key: string) => {
  if (!storage) return false;
  try { storage.removeItem(key); return true; } catch { return false; }
};

export const writeNavigationPreferences = (preferences: NavigationPreferences, storage: Storage | undefined = browserStorage()) => {
  const written = writeStorage(storage, NAVIGATION_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  if (written && storage === browserStorage()) window.dispatchEvent(new Event('ipc:navigation-preferences-changed'));
};

export const resetNavigationPreferences = (storage?: Storage) => writeNavigationPreferences(defaultNavigationPreferences, storage);

export const RECONCILIATION_SELECTION_STORAGE_KEY = 'ipc.reconciliation-selection.v1';
export type ReconciliationWarehouseView = 'demand' | 'movement';
export interface ReconciliationSelectionPreferences {
  batchId?: string;
  warehouseView?: ReconciliationWarehouseView;
  customerId?: string;
  weekStartDate?: string;
  weekEndDate?: string;
}

export const readReconciliationSelection = (storage: Storage | undefined = browserStorage()): ReconciliationSelectionPreferences => {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(RECONCILIATION_SELECTION_STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const batchId = typeof (parsed as Record<string, unknown>).batchId === 'string'
      ? (parsed as Record<string, string>).batchId.trim()
      : '';
    const customerId = typeof (parsed as Record<string, unknown>).customerId === 'string'
      ? (parsed as Record<string, string>).customerId.trim()
      : '';
    const weekStartDate = typeof (parsed as Record<string, unknown>).weekStartDate === 'string'
      ? (parsed as Record<string, string>).weekStartDate.trim()
      : '';
    const weekEndDate = typeof (parsed as Record<string, unknown>).weekEndDate === 'string'
      ? (parsed as Record<string, string>).weekEndDate.trim()
      : '';
    const warehouseView = (parsed as Record<string, unknown>).warehouseView;
    return {
      ...(batchId ? { batchId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(weekStartDate ? { weekStartDate } : {}),
      ...(weekEndDate ? { weekEndDate } : {}),
      ...(warehouseView === 'demand' || warehouseView === 'movement' ? { warehouseView } : {}),
    };
  } catch {
    return {};
  }
};

export const writeReconciliationSelection = (selection: ReconciliationSelectionPreferences, storage: Storage | undefined = browserStorage()) => {
  if (!storage) return;
  const next: ReconciliationSelectionPreferences = {
    ...(selection.batchId?.trim() ? { batchId: selection.batchId.trim() } : {}),
    ...(selection.customerId?.trim() ? { customerId: selection.customerId.trim() } : {}),
    ...(selection.weekStartDate?.trim() ? { weekStartDate: selection.weekStartDate.trim() } : {}),
    ...(selection.weekEndDate?.trim() ? { weekEndDate: selection.weekEndDate.trim() } : {}),
    ...(selection.warehouseView ? { warehouseView: selection.warehouseView } : {}),
  };
  if (Object.keys(next).length === 0) {
    removeStorage(storage, RECONCILIATION_SELECTION_STORAGE_KEY);
    return;
  }
  const written = writeStorage(storage, RECONCILIATION_SELECTION_STORAGE_KEY, JSON.stringify(next));
  if (written && storage === browserStorage()) window.dispatchEvent(new Event('ipc:reconciliation-selection-changed'));
};

export const clearReconciliationSelection = (storage: Storage | undefined = browserStorage()) => {
  removeStorage(storage, RECONCILIATION_SELECTION_STORAGE_KEY);
};

export type AdminTabPreferenceKey = 'bom-import' | 'contracts' | 'cleanup' | 'inventory' | 'statistics' | 'audit' | 'employees';
export const ADMIN_TAB_PREFERENCES_STORAGE_KEY = 'ipc.admin-tab-preferences.v1';
export const defaultAdminTabPreferences: Record<AdminTabPreferenceKey, boolean> = {
  'bom-import': true, contracts: true, cleanup: true, inventory: true, statistics: true, audit: true, employees: true,
};
export const readAdminTabPreferences = (storage: Storage | undefined = browserStorage()) => {
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
export const writeAdminTabPreferences = (preferences: Record<AdminTabPreferenceKey, boolean>, storage: Storage | undefined = browserStorage()) => {
  const written = writeStorage(storage, ADMIN_TAB_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  if (written && storage === browserStorage()) window.dispatchEvent(new Event('ipc:admin-tab-preferences-changed'));
};

export const pageTabGroups = [
  { id: 'weekly-menu', label: 'Thực đơn tuần', description: 'Kế hoạch, nhu cầu và sản xuất', tabs: [['schedule', 'Kế hoạch tuần'], ['demand', 'Nhu cầu'], ['production-plan', 'Kế hoạch sản xuất']] },
  { id: 'warehouse', label: 'Kho nguyên liệu', description: 'Nhập hàng, xuất hàng, ngoại lệ và tra cứu', tabs: [['receiving', 'Nhập hàng'], ['demand', 'Xuất hàng'], ['exceptions', 'Ngoại lệ'], ['movement', 'Tra cứu']] },
  { id: 'approvals', label: 'Duyệt vận hành', description: 'Hàng chờ và lịch sử phê duyệt', tabs: [['queue', 'Cần duyệt'], ['history', 'Lịch sử']] },
  { id: 'purchasing', label: 'Thu mua', description: 'Quy trình mua, mua bổ sung và báo giá', tabs: [['workflow', 'Xử lý thu mua'], ['supplemental', 'Mua bổ sung'], ['quotations', 'Báo giá nhà cung cấp']] },
  { id: 'chef', label: 'Bếp trưởng', description: 'Ca sản xuất và chứng từ bếp', tabs: [['production', 'Ca sản xuất'], ['documents', 'Chứng từ bếp']] },
  { id: 'reports', label: 'Báo cáo vận hành', description: 'Các nhóm báo cáo chính', tabs: [['price', 'Biến động giá'], ['demand', 'Nhu cầu nguyên liệu'], ['purchase', 'Kế hoạch thu mua'], ['stock', 'Tồn kho'], ['movement', 'Nhập/xuất kho'], ['kitchen', 'Xuất bếp'], ['usage', 'Sử dụng thực tế'], ['audit', 'Nhật ký thay đổi'], ['data-quality', 'Chất lượng dữ liệu']] },
  { id: 'admin-data', label: 'Quản trị dữ liệu', description: 'Dữ liệu nền và nhật ký quản trị', tabs: [['bom-import', 'BOM theo đơn giá'], ['contracts', 'Hợp đồng'], ['cleanup', 'Dữ liệu lỗi'], ['inventory', 'Tồn kho'], ['statistics', 'Thống kê'], ['audit', 'Nhật ký thay đổi'], ['employees', 'Nhân viên']] },
] as const;

export type PageTabGroupId = typeof pageTabGroups[number]['id'];
export type PageTabPreferences = Record<string, Record<string, boolean>>;
export const PAGE_TAB_PREFERENCES_STORAGE_KEY = 'ipc.page-tab-preferences.v1';
export const defaultPageTabPreferences: PageTabPreferences = Object.fromEntries(pageTabGroups.map((group) => [group.id, Object.fromEntries(group.tabs.map(([id]) => [id, true]))]));

export const readPageTabPreferences = (storage: Storage | undefined = browserStorage()): PageTabPreferences => {
  if (!storage) return structuredClone(defaultPageTabPreferences);
  let parsed: unknown = {};
  try { parsed = JSON.parse(storage.getItem(PAGE_TAB_PREFERENCES_STORAGE_KEY) ?? '{}'); } catch { parsed = {}; }
  const legacyAdmin = readAdminTabPreferences(storage);
  return Object.fromEntries(pageTabGroups.map((group) => [group.id, Object.fromEntries(group.tabs.map(([id]) => {
    const saved = parsed && typeof parsed === 'object' ? (parsed as Record<string, Record<string, unknown>>)[group.id]?.[id] : undefined;
    const legacy = group.id === 'admin-data' ? legacyAdmin[id as AdminTabPreferenceKey] : undefined;
    return [id, typeof saved === 'boolean' ? saved : typeof legacy === 'boolean' ? legacy : true];
  }))]));
};

export const writePageTabPreferences = (preferences: PageTabPreferences, storage: Storage | undefined = browserStorage()) => {
  const written = writeStorage(storage, PAGE_TAB_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  if (written && storage === browserStorage()) window.dispatchEvent(new Event('ipc:page-tab-preferences-changed'));
};

export const resolveVisibleTabId = <T extends string>(requested: string | null, visible: T[], fallback: T): T =>
  requested && visible.includes(requested as T) ? requested as T : (visible[0] ?? fallback);

export const visibleTabIds = (groupId: PageTabGroupId, preferences = readPageTabPreferences()) => {
  const group = pageTabGroups.find((candidate) => candidate.id === groupId);
  return group?.tabs.filter(([id]) => preferences[groupId]?.[id] !== false).map(([id]) => id) ?? [];
};

/* ------------------------------------------------------------------ *
 * v2 (G4 batch B): flat leaf keys for nested sidebar.
 *
 *   - Primary: same as v1 ('dashboard', 'weekly-menu', ...).
 *   - Leaf:    '${groupId}.${tabId}' (e.g. 'warehouse.receiving').
 *
 * Flat+prefixed avoids collisions when multiple groups expose a tab
 * with the same local id ('demand' in weekly-menu, warehouse, reports).
 *
 * The v2 reader is the only thing that should look at localStorage in
 * future code; legacy v1 and `pageTabGroups` callers keep their own
 * v1 keys until batch E retires them.
 * ------------------------------------------------------------------ */

export const NAVIGATION_PREFERENCES_V2_STORAGE_KEY = 'ipc.navigation-preferences.v2';

export type LeafPreferenceKey = NavigationPreferenceKey | `${PageTabGroupId}.${string}`;

export type NavigationPreferencesV2 = Record<string, boolean>;

const flattenTabId = (groupId: PageTabGroupId, tabId: string): LeafPreferenceKey =>
  `${groupId}.${tabId}` as LeafPreferenceKey;

export const defaultNavigationPreferencesV2: NavigationPreferencesV2 = (() => {
  const defaults: NavigationPreferencesV2 = { ...defaultNavigationPreferences };
  for (const group of pageTabGroups) {
    for (const [tabId] of group.tabs) {
      defaults[flattenTabId(group.id, tabId)] = true;
    }
  }
  return defaults;
})();

const readJsonObject = (raw: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const parseV2Stored = (raw: string | null): NavigationPreferencesV2 => {
  const parsed = readJsonObject(raw);
  const result: NavigationPreferencesV2 = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'boolean') result[key] = value;
  }
  return result;
};

/**
 * Idempotent: copies any v1 primary + v1 page-tab visibility into v2
 * using flat leaf keys. Keeps v1 keys in place (audit trail + rollback).
 * No-op when v2 already exists.
 */
const migrateV1ToV2 = (storage: Storage | undefined): void => {
  if (!storage) return;
  const v2Raw = storage.getItem(NAVIGATION_PREFERENCES_V2_STORAGE_KEY);
  if (v2Raw !== null) return;

  const v1Primary = readJsonObject(storage.getItem(NAVIGATION_PREFERENCES_STORAGE_KEY));
  const v1Tabs = readJsonObject(storage.getItem(PAGE_TAB_PREFERENCES_STORAGE_KEY));
  if (Object.keys(v1Primary).length === 0 && Object.keys(v1Tabs).length === 0) return;

  const merged: NavigationPreferencesV2 = { ...defaultNavigationPreferencesV2 };
  for (const [key, value] of Object.entries(v1Primary)) {
    if (typeof value === 'boolean') merged[key] = value;
  }
  for (const [groupIdRaw, tabs] of Object.entries(v1Tabs)) {
    if (!tabs || typeof tabs !== 'object') continue;
    const groupId = groupIdRaw as PageTabGroupId;
    if (!pageTabGroups.some((g) => g.id === groupId)) continue;
    for (const [tabId, value] of Object.entries(tabs as Record<string, unknown>)) {
      if (typeof value === 'boolean') merged[flattenTabId(groupId, tabId)] = value;
    }
  }
  writeStorage(storage, NAVIGATION_PREFERENCES_V2_STORAGE_KEY, JSON.stringify(merged));
};

export const readNavigationPreferencesV2 = (
  storage: Storage | undefined = browserStorage(),
): NavigationPreferencesV2 => {
  if (!storage) return { ...defaultNavigationPreferencesV2 };
  migrateV1ToV2(storage);
  const stored = parseV2Stored(storage.getItem(NAVIGATION_PREFERENCES_V2_STORAGE_KEY));
  const result: NavigationPreferencesV2 = { ...defaultNavigationPreferencesV2 };
  for (const [key, value] of Object.entries(stored)) {
    if (key in defaultNavigationPreferencesV2 && typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
};

export const writeNavigationPreferencesV2 = (
  preferences: NavigationPreferencesV2,
  storage: Storage | undefined = browserStorage(),
) => {
  const written = writeStorage(
    storage,
    NAVIGATION_PREFERENCES_V2_STORAGE_KEY,
    JSON.stringify(preferences),
  );
  if (written && storage === browserStorage()) {
    window.dispatchEvent(new Event('ipc:navigation-preferences-v2-changed'));
  }
};

export const resetNavigationPreferencesV2 = (storage?: Storage) =>
  writeNavigationPreferencesV2({ ...defaultNavigationPreferencesV2 }, storage);
