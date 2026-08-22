export const WAREHOUSE_CONTRACT_VERSION = 'warehouse-data-workspace/v1' as const;
export const WAREHOUSE_ROUTE = '/warehouse' as const;
export const WAREHOUSE_ACTIVE_TAB = 'Luân chuyển' as const;
export const WAREHOUSE_VIEWPORTS = [
  { id: '1920x1080', width: 1920, height: 1080 },
  { id: '1440x900', width: 1440, height: 900 },
  { id: '1366x768', width: 1366, height: 768 },
  { id: '1365x900', width: 1365, height: 900 },
  { id: '1280x900', width: 1280, height: 900 },
] as const;

export const warehouseDataWorkspaceContract = {
  archetype: 'Data Workspace',
  workObject: 'Warehouse stock snapshot',
  grain: 'one warehouse × ingredient current-stock snapshot row',
  tabs: ['Luân chuyển', 'Nhu cầu xuất', 'Ngoại lệ'],
  tabContract: ['semantics', 'accessible-name', 'keyboard-focus', 'preserve-visited', 'geometry', 'overflow', 'clipping'],
  regions: [
    { id: 'warehouse-current-stock', name: 'Tồn kho hiện tại', role: 'primary-dataset', owner: 'WarehouseMovementPanel/SectionPanel/TableViewport/PaginationBar' },
    { id: 'warehouse-movement-history', name: 'Luân chuyển kho', role: 'supporting-history', owner: 'WarehouseMovementPanel/SectionPanel/StockMovementTable' },
    { id: 'warehouse-document-rail', name: 'Phiếu kho', role: 'tab-document-rail', owner: 'SplitWorkbench/DocumentRail' },
  ],
  domAndFocusOrder: ['warehouse-current-stock', 'warehouse-movement-history', 'warehouse-document-rail'],
  responsiveRelations: ['side-by-side', 'stacked'] as const,
  spacing: { primaryToHistory: 16, workspaceToRail: 16, stackedRail: 16, regionPaddingBase: 16, regionPaddingSm: 20, tolerance: 0.5 },
  primaryActionCount: 0,
} as const;

export type WarehouseVerdict = 'PASS' | 'FAIL' | 'NEEDS_EVIDENCE' | 'UNRESOLVED';
export type WarehouseFindingVerdict = Exclude<WarehouseVerdict, 'PASS'>;
export type WarehouseOwnerLevel = 'token' | 'primitive' | 'shared-component' | 'layout' | 'route';
export type WarehouseBox = { x: number; y: number; width: number; height: number };
export type WarehouseCapture = {
  schemaVersion: 2;
  identity: string;
  contractVersion: typeof WAREHOUSE_CONTRACT_VERSION;
  fixtureVersion: string;
  route: typeof WAREHOUSE_ROUTE;
  activeTab: typeof WAREHOUSE_ACTIVE_TAB;
  actor: 'warehouse-keeper';
  state: 'ready';
  viewport: { id: '1920x1080'; width: 1920; height: 1080 };
  fixtureRecordIds: string[];
  screenshotPath: string;
  ariaSnapshot: string;
  ariaSnapshotOptions: { mode: 'ai'; boxes: true };
  geometry: Record<string, WarehouseBox>;
  computedStyles: Record<string, { display: string; overflowX: string; paddingLeft: string; paddingRight: string }>;
  domOrder: string[];
  focusOrder: string[];
  activeElement: string;
  consoleErrors: string[];
  pageErrors: string[];
  nonGetRequests: string[];
  owners: Record<string, string>;
};

export type WarehouseAiFinding = {
  id: string;
  verdict: WarehouseFindingVerdict;
  evidence: string[];
  expected: string;
  actual: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  owner: { level: WarehouseOwnerLevel; source?: string };
  confidence: number;
};

export function validateWarehouseCapture(value: unknown): asserts value is WarehouseCapture {
  const record = value as Partial<WarehouseCapture>;
  const requiredObjects = record.geometry && Object.keys(record.geometry).length === 3 && record.computedStyles && Object.keys(record.computedStyles).length === 3;
  if (record.schemaVersion !== 2 || record.contractVersion !== WAREHOUSE_CONTRACT_VERSION || record.fixtureVersion == null ||
      record.route !== WAREHOUSE_ROUTE || record.activeTab !== WAREHOUSE_ACTIVE_TAB || record.actor !== 'warehouse-keeper' ||
      record.state !== 'ready' || record.viewport?.id !== '1920x1080' || !record.screenshotPath || !record.ariaSnapshot ||
      record.ariaSnapshotOptions?.mode !== 'ai' || record.ariaSnapshotOptions.boxes !== true || !requiredObjects ||
      !record.fixtureRecordIds?.length || record.domOrder?.length !== 3 || !record.focusOrder?.length || !record.activeElement ||
      !Array.isArray(record.consoleErrors) || !Array.isArray(record.pageErrors) || !Array.isArray(record.nonGetRequests) ||
      !record.owners || Object.keys(record.owners).length !== 3) throw new Error('Invalid Warehouse capture');
}

export function validateWarehouseAiFinding(value: unknown): asserts value is WarehouseAiFinding {
  const finding = value as Partial<WarehouseAiFinding>;
  if (!finding.id || finding.verdict === 'PASS' as WarehouseFindingVerdict || !['FAIL', 'NEEDS_EVIDENCE', 'UNRESOLVED'].includes(finding.verdict ?? '') ||
      !finding.evidence?.length || !finding.expected || !finding.actual || !finding.severity || !finding.owner?.level ||
      typeof finding.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 1 ||
      finding.verdict === 'FAIL' && finding.confidence < 0.8) throw new Error('Invalid Warehouse AI finding');
}
