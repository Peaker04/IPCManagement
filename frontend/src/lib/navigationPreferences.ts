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

export const readReconciliationSelection = (storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage): ReconciliationSelectionPreferences => {
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

export const readPageTabPreferences = (storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage): PageTabPreferences => {
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
