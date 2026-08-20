export type TableDensity = 'compact' | 'standard' | 'comfortable';

export type TablePreferenceColumn = {
  id: string;
  label: string;
  locked?: boolean;
};

export type TablePreferenceConfig = {
  tableId: string;
  columns: readonly TablePreferenceColumn[];
};

export type TablePreferenceState = {
  columnIds: string[];
  hiddenColumnIds: string[];
  density: TableDensity;
};

export type TablePreferenceOwner = {
  id: string;
  disposition: 'customizable' | 'exception';
  reason?: 'transient-preview' | 'nested-detail' | 'structural-matrix' | 'essential-workflow';
};

const storagePrefix = 'ipc.table-preferences.v1';
const densities: TableDensity[] = ['compact', 'standard', 'comfortable'];

const defaultState = (config: TablePreferenceConfig): TablePreferenceState => ({
  columnIds: config.columns.map((column) => column.id),
  hiddenColumnIds: [],
  density: 'standard',
});

const storageKey = (accountId: string, tableId: string) => `${storagePrefix}:${accountId}:${tableId}`;

const isValidState = (value: unknown, config: TablePreferenceConfig): value is TablePreferenceState & { version: 1 } => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const declaredIds = config.columns.map((column) => column.id);
  const lockedId = config.columns.find((column) => column.locked)?.id;
  if (record.version !== 1 || !Array.isArray(record.columnIds) || !Array.isArray(record.hiddenColumnIds) || !densities.includes(record.density as TableDensity)) return false;
  const columnIds = record.columnIds as unknown[];
  const hiddenColumnIds = record.hiddenColumnIds as unknown[];
  if (!columnIds.every((id) => typeof id === 'string') || !hiddenColumnIds.every((id) => typeof id === 'string')) return false;
  if (columnIds.length !== declaredIds.length || new Set(columnIds).size !== columnIds.length || !declaredIds.every((id) => columnIds.includes(id))) return false;
  if (new Set(hiddenColumnIds).size !== hiddenColumnIds.length || !hiddenColumnIds.every((id) => declaredIds.includes(id))) return false;
  return !lockedId || (columnIds[0] === lockedId && !hiddenColumnIds.includes(lockedId));
};

export const readTablePreferences = (accountId: string | undefined, config: TablePreferenceConfig): TablePreferenceState => {
  if (!accountId || typeof window === 'undefined') return defaultState(config);
  try {
    const stored = window.localStorage.getItem(storageKey(accountId, config.tableId));
    if (!stored) return defaultState(config);
    const parsed: unknown = JSON.parse(stored);
    return isValidState(parsed, config)
      ? { columnIds: [...parsed.columnIds], hiddenColumnIds: [...parsed.hiddenColumnIds], density: parsed.density }
      : defaultState(config);
  } catch {
    return defaultState(config);
  }
};

export const writeTablePreferences = (accountId: string | undefined, config: TablePreferenceConfig, state: TablePreferenceState) => {
  if (!accountId || typeof window === 'undefined' || !isValidState({ version: 1, ...state }, config)) return;
  window.localStorage.setItem(storageKey(accountId, config.tableId), JSON.stringify({ version: 1, ...state }));
};

export const resetTablePreferences = (accountId: string | undefined, config: TablePreferenceConfig) => {
  if (!accountId || typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(accountId, config.tableId));
};

export const resolveTablePreferenceColumns = (config: TablePreferenceConfig, state: TablePreferenceState) =>
  state.columnIds
    .filter((id) => !state.hiddenColumnIds.includes(id))
    .map((id) => config.columns.find((column) => column.id === id))
    .filter((column): column is TablePreferenceColumn => Boolean(column));

export const tablePreferenceOwnerRegistry: readonly TablePreferenceOwner[] = [
  { id: 'admin-audit', disposition: 'customizable' },
  { id: 'service-run-report', disposition: 'customizable' },
  { id: 'admin-statistics', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'admin-cleanup', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'admin-contracts', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'admin-employees', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'chef-checklist', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'chef-production', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'coordination-order', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'demand-summary', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'purchase-line-groups', disposition: 'exception', reason: 'nested-detail' },
  { id: 'purchase-service-date', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'purchase-summary', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'reports-page', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'reports-data-quality', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'reports-price', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'role-inbox', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'stock-movement', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'swimlane-progress', disposition: 'exception', reason: 'structural-matrix' },
  { id: 'supplemental-purchasing', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'supplier-quotation', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'warehouse-exceptions', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'warehouse-page', disposition: 'exception', reason: 'nested-detail' },
  { id: 'warehouse-receipt-lifecycle', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'weekly-import-history', disposition: 'exception', reason: 'transient-preview' },
  { id: 'weekly-import-jobs', disposition: 'exception', reason: 'transient-preview' },
  { id: 'weekly-layout-matrix', disposition: 'exception', reason: 'structural-matrix' },
  { id: 'weekly-menu-cost', disposition: 'exception', reason: 'nested-detail' },
  { id: 'weekly-menu-demand', disposition: 'exception', reason: 'essential-workflow' },
  { id: 'weekly-menu-dish-materials', disposition: 'exception', reason: 'nested-detail' },
  { id: 'weekly-menu-production-plan', disposition: 'exception', reason: 'essential-workflow' },
];
