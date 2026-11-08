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
export const WAREHOUSE_SCENARIOS = ['ready', 'mixed-empty', 'route-forbidden'] as const;
export type WarehouseScenario = typeof WAREHOUSE_SCENARIOS[number];
export type WarehouseViewport = typeof WAREHOUSE_VIEWPORTS[number];

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
  responsiveExpected: { '1920x1080': 'side-by-side', '1440x900': 'side-by-side', '1366x768': 'side-by-side', '1365x900': 'stacked', '1280x900': 'stacked' },
  spacing: { primaryToHistory: 16, workspaceToRail: 16, stackedRail: 16, regionPaddingBase: 16, regionPaddingSm: 20, tolerance: 0.5 },
  primaryActionCount: 0,
} as const;

export type WarehouseVerdict = 'PASS' | 'FAIL' | 'NEEDS_EVIDENCE' | 'UNRESOLVED';
export type WarehouseFindingVerdict = Exclude<WarehouseVerdict, 'PASS'>;
export type WarehouseOwnerLevel = 'token' | 'primitive' | 'shared-component' | 'layout' | 'route';
export type WarehouseBox = { x: number; y: number; width: number; height: number };
export type WarehouseRegionProbe = {
  box: WarehouseBox;
  scroll: { clientWidth: number; scrollWidth: number; clientHeight: number; scrollHeight: number };
  style: { display: string; overflowX: string; paddingLeft: string; paddingRight: string };
};
export type WarehouseCapture = {
  schemaVersion: 2;
  identity: string;
  contractVersion: typeof WAREHOUSE_CONTRACT_VERSION;
  fixtureVersion: string;
  route: '/warehouse' | '/403';
  activeTab: typeof WAREHOUSE_ACTIVE_TAB | null;
  actor: 'warehouse-keeper' | 'no-warehouse-read';
  state: WarehouseScenario;
  viewport: { id: string; width: number; height: number };
  fixtureRecordIds: string[];
  screenshotPath: string;
  ariaSnapshot: string;
  ariaSnapshotOptions: { mode: 'ai'; boxes: true };
  geometry: Record<string, WarehouseRegionProbe>;
  document: { clientWidth: number; scrollWidth: number; h1Count: number; headingLevels: number[]; primaryActionCount: number };
  domOrder: string[];
  focusOrder: string[];
  activeElement: string;
  consoleErrors: string[];
  pageErrors: string[];
  nonGetRequests: string[];
  owners: Record<string, string>;
};
export type WarehouseCaptureManifest = { schemaVersion: 2; contractVersion: typeof WAREHOUSE_CONTRACT_VERSION; fixtureVersion: string; captures: WarehouseCapture[] };

export type WarehouseAiFinding = {
  id: string; verdict: WarehouseFindingVerdict; evidence: string[]; expected: string; actual: string;
  severity: 'blocker' | 'high' | 'medium' | 'low'; ownerLevel: WarehouseOwnerLevel; confidence: number;
};

export type WarehouseAiReviewInput = {
  schemaVersion: 1;
  reviewerRunId: string;
  reviewerWorkflowChild: string;
  reviewerArtifactId: string;
  wrapperDisposition: 'rejected';
  wrapperDispositionEffect: 'none-on-json-findings';
  suppliedItems: { path: string; sha256: string; purpose: string }[];
  selectedEvidence: { captureIdentity: string; reasons: string[]; recordPath: string; recordSha256: string; screenshotPath: string; screenshotSha256: string }[];
  allowedDimensions: readonly ['hierarchy', 'grouping', 'visual-balance', 'information-architecture'];
  deniedFields: string[];
};

export function validateWarehouseCapture(value: unknown): asserts value is WarehouseCapture {
  const record = value as Partial<WarehouseCapture>;
  const viewport = WAREHOUSE_VIEWPORTS.find(({ id }) => id === record.viewport?.id);
  const scenario = WAREHOUSE_SCENARIOS.includes(record.state as WarehouseScenario);
  const forbidden = record.state === 'route-forbidden';
  const expectedProbeCount = forbidden ? 1 : 3;
  if (record.schemaVersion !== 2 || record.contractVersion !== WAREHOUSE_CONTRACT_VERSION || !record.fixtureVersion || !scenario || !viewport ||
      record.viewport?.width !== viewport.width || record.viewport.height !== viewport.height || !record.identity || !record.screenshotPath || !record.ariaSnapshot ||
      record.ariaSnapshotOptions?.mode !== 'ai' || record.ariaSnapshotOptions.boxes !== true || Object.keys(record.geometry ?? {}).length !== expectedProbeCount ||
      !record.document || !Array.isArray(record.fixtureRecordIds) || !Array.isArray(record.domOrder) || !Array.isArray(record.focusOrder) || !record.activeElement ||
      !Array.isArray(record.consoleErrors) || !Array.isArray(record.pageErrors) || !Array.isArray(record.nonGetRequests) ||
      Object.keys(record.owners ?? {}).length !== expectedProbeCount) throw new Error('Invalid Warehouse capture');
  if (forbidden ? record.route !== '/403' || record.actor !== 'no-warehouse-read' || record.activeTab !== null || record.fixtureRecordIds.length !== 0
    : record.route !== WAREHOUSE_ROUTE || record.actor !== 'warehouse-keeper' || record.activeTab !== WAREHOUSE_ACTIVE_TAB || record.fixtureRecordIds.length === 0) {
    throw new Error('Invalid Warehouse scenario boundary');
  }
}

export function validateWarehouseCaptureManifest(value: unknown): asserts value is WarehouseCaptureManifest {
  const manifest = value as Partial<WarehouseCaptureManifest>;
  if (manifest.schemaVersion !== 2 || manifest.contractVersion !== WAREHOUSE_CONTRACT_VERSION || !manifest.fixtureVersion || manifest.captures?.length !== 15) throw new Error('Invalid Warehouse manifest');
  manifest.captures.forEach(validateWarehouseCapture);
  const identities = manifest.captures.map(({ identity }) => identity);
  if (new Set(identities).size !== 15) throw new Error('Warehouse manifest identities are not unique');
  for (const scenario of WAREHOUSE_SCENARIOS) for (const viewport of WAREHOUSE_VIEWPORTS) {
    if (!manifest.captures.some((capture) => capture.state === scenario && capture.viewport.id === viewport.id)) throw new Error('Warehouse manifest matrix is incomplete');
  }
  const readyIds = manifest.captures.filter(({ state }) => state === 'ready').map(({ fixtureRecordIds }) => JSON.stringify(fixtureRecordIds));
  if (new Set(readyIds).size !== 1) throw new Error('Warehouse ready fixture identity drifted');
}

export function validateWarehouseAiFinding(value: unknown): asserts value is WarehouseAiFinding {
  const finding = value as Partial<WarehouseAiFinding>;
  const keys = Object.keys(finding).sort();
  const expectedKeys = ['actual', 'confidence', 'evidence', 'expected', 'id', 'ownerLevel', 'severity', 'verdict'];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys) || !finding.id || finding.verdict === 'PASS' as WarehouseFindingVerdict ||
      !['FAIL', 'NEEDS_EVIDENCE', 'UNRESOLVED'].includes(finding.verdict ?? '') || !finding.evidence?.length || !finding.expected || !finding.actual ||
      !['blocker', 'high', 'medium', 'low'].includes(finding.severity ?? '') || !['token', 'primitive', 'shared-component', 'layout', 'route'].includes(finding.ownerLevel ?? '') ||
      typeof finding.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 1 || finding.verdict === 'FAIL' && finding.confidence < 0.8) throw new Error('Invalid Warehouse AI finding');
}

export function validateWarehouseAiReviewInput(value: unknown): asserts value is WarehouseAiReviewInput {
  const input = value as Partial<WarehouseAiReviewInput>;
  const denied = ['diff', 'implementation rationale', 'auto-fix', 'unselected captures'];
  if (input.schemaVersion !== 1 || !input.reviewerRunId || !input.reviewerWorkflowChild || !input.reviewerArtifactId ||
      input.wrapperDisposition !== 'rejected' || input.wrapperDispositionEffect !== 'none-on-json-findings' || !input.suppliedItems?.length ||
      !input.selectedEvidence?.length || JSON.stringify(input.allowedDimensions) !== JSON.stringify(['hierarchy', 'grouping', 'visual-balance', 'information-architecture']) ||
      !denied.every((field) => input.deniedFields?.includes(field))) throw new Error('Invalid Warehouse AI review input');
  if (input.suppliedItems.some(({ path, sha256 }) => !path || !/^[a-f0-9]{64}$/.test(sha256)) ||
      input.selectedEvidence.some(({ captureIdentity, reasons, recordPath, recordSha256, screenshotPath, screenshotSha256 }) =>
        !captureIdentity || !reasons.length || !recordPath || !screenshotPath || !/^[a-f0-9]{64}$/.test(recordSha256) || !/^[a-f0-9]{64}$/.test(screenshotSha256))) {
    throw new Error('Invalid Warehouse AI review input evidence');
  }
}
