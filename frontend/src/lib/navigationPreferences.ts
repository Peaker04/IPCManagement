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

export const pageTabGroups = [
  { id: 'weekly-menu', label: 'Thực đơn tuần', description: 'Kế hoạch, nhu cầu, sản xuất và chi phí', tabs: [['schedule', 'Kế hoạch tuần'], ['demand', 'Nhu cầu'], ['production-plan', 'Kế hoạch sản xuất'], ['purchase-summary', 'Tổng hợp mua'], ['cost', 'Giá vốn'], ['dish-materials', 'Nguyên liệu món']] },
  { id: 'warehouse', label: 'Kho nguyên liệu', description: 'Luân chuyển, nhu cầu xuất và ngoại lệ', tabs: [['movement', 'Luân chuyển'], ['demand', 'Nhu cầu xuất'], ['exceptions', 'Ngoại lệ']] },
  { id: 'approvals', label: 'Duyệt vận hành', description: 'Hàng chờ, vai trò và lịch sử', tabs: [['queue', 'Cần duyệt'], ['role', 'Theo vai trò'], ['history', 'Lịch sử']] },
  { id: 'purchasing', label: 'Thu mua', description: 'Quy trình mua, mua bổ sung và báo giá', tabs: [['workflow', 'Xử lý thu mua'], ['supplemental', 'Mua bổ sung'], ['quotations', 'Báo giá nhà cung cấp']] },
  { id: 'chef', label: 'Bếp trưởng', description: 'Ca sản xuất và chứng từ bếp', tabs: [['production', 'Ca sản xuất'], ['documents', 'Chứng từ bếp']] },
  { id: 'reports', label: 'Báo cáo vận hành', description: 'Các nhóm báo cáo chính', tabs: [['price', 'Biến động giá'], ['demand', 'Nhu cầu nguyên liệu'], ['purchase', 'Kế hoạch thu mua'], ['stock', 'Tồn kho'], ['movement', 'Nhập/xuất kho'], ['kitchen', 'Xuất bếp'], ['usage', 'Sử dụng thực tế'], ['audit', 'Nhật ký thay đổi'], ['data-quality', 'Chất lượng dữ liệu']] },
  { id: 'reports-price', label: 'Biến động giá', description: 'Góc nhìn chi tiết trong báo cáo giá', tabs: [['lines', 'Theo dòng nhập'], ['supplier', 'Theo nhà cung cấp'], ['period', 'Theo thời gian'], ['dishGroup', 'Theo nhóm món']] },
  { id: 'admin-data', label: 'Quản trị dữ liệu', description: 'Dữ liệu nền và nhật ký quản trị', tabs: [['bom-import', 'BOM theo đơn giá'], ['contracts', 'Hợp đồng'], ['cleanup', 'Dữ liệu lỗi'], ['inventory', 'Tồn kho'], ['statistics', 'Thống kê'], ['audit', 'Nhật ký thay đổi'], ['employees', 'Nhân viên']] },
  { id: 'admin-bom', label: 'BOM theo đơn giá', description: 'Dữ liệu đang dùng và bản kiểm tra', tabs: [['current', 'Dữ liệu đang dùng'], ['preview', 'Bản kiểm tra']] },
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

export const writePageTabPreferences = (preferences: PageTabPreferences, storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage) => {
  storage?.setItem(PAGE_TAB_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  if (typeof window !== 'undefined' && storage === window.localStorage) window.dispatchEvent(new Event('ipc:page-tab-preferences-changed'));
};

export const visibleTabIds = (groupId: PageTabGroupId, preferences = readPageTabPreferences()) => {
  const group = pageTabGroups.find((candidate) => candidate.id === groupId);
  return group?.tabs.filter(([id]) => preferences[groupId]?.[id] !== false).map(([id]) => id) ?? [];
};
