import { warehouseDataWorkspaceContract, type WarehouseBox, type WarehouseCapture, type WarehouseCaptureManifest, type WarehouseOwnerLevel, type WarehouseVerdict } from './warehouseDataWorkspaceContract';

export const splitWorkbenchConsumerInventory = [
  { source: 'frontend/src/features/approvals/pages/ApprovalPage.tsx', instances: 2 },
  { source: 'frontend/src/features/chef/receipts/KitchenReceiptSection.tsx', instances: 1 },
  { source: 'frontend/src/features/warehouse/pages/WarehouseMovementPanel.tsx', instances: 1 },
] as const;

export type WarehouseDeterministicFinding = {
  id: string; ruleId: string; verdict: WarehouseVerdict; captureIdentity: string; selector: string;
  metric: string; expected: string; actual: string; severity: 'blocker' | 'high' | 'medium' | 'low';
  owner: { level: WarehouseOwnerLevel; source: string }; boxes?: Record<string, WarehouseBox>;
};
export type WarehouseDeterministicReport = { schemaVersion: 1; stage: 'deterministic-before-ai'; verdict: WarehouseVerdict; findings: WarehouseDeterministicFinding[] };
export type WarehouseSelectionManifest = {
  schemaVersion: 1; generatedAfter: 'deterministic-before-ai'; contractVersion: string; deterministicVerdict: WarehouseVerdict;
  selected: Array<{ captureIdentity: string; state: WarehouseCapture['state']; viewport: string; recordPath: string; screenshotPath: string; reasons: string[] }>;
  excluded: Array<{ captureIdentity: string; reason: string }>;
};

const tolerance = warehouseDataWorkspaceContract.spacing.tolerance;
const regionIds = warehouseDataWorkspaceContract.regions.map(({ id }) => id);
const fail = (condition: boolean) => condition ? 'PASS' as const : 'FAIL' as const;
const boxEndX = (box: WarehouseBox) => box.x + box.width;
const boxEndY = (box: WarehouseBox) => box.y + box.height;
const overlaps = (a: WarehouseBox, b: WarehouseBox) => a.x < boxEndX(b) - tolerance && boxEndX(a) > b.x + tolerance && a.y < boxEndY(b) - tolerance && boxEndY(a) > b.y + tolerance;
const ownerLevel = (source: string): WarehouseOwnerLevel => source === 'RoleGuard' ? 'route' : source.includes('SplitWorkbench') ? 'layout' : 'shared-component';

function finding(capture: WarehouseCapture, input: Omit<WarehouseDeterministicFinding, 'captureIdentity' | 'owner'> & { ownerSource: string }): WarehouseDeterministicFinding {
  const { ownerSource, ...rest } = input;
  return { ...rest, captureIdentity: capture.identity, owner: { level: ownerLevel(ownerSource), source: ownerSource } };
}

function evaluateForbidden(capture: WarehouseCapture): WarehouseDeterministicFinding[] {
  const probe = capture.geometry['warehouse-route-forbidden'];
  const owner = capture.owners['warehouse-route-forbidden'];
  return [finding(capture, { id: `WH-ROUTE-FORBIDDEN-${capture.viewport.id}`, ruleId: 'D08-ROUTE-FORBIDDEN', verdict: fail(Boolean(probe) && capture.route === '/403'), selector: 'main:has(h1:has-text("Không đủ quyền truy cập"))', metric: 'route boundary and named owner', expected: '/403 with one named forbidden owner', actual: `${capture.route}; owner=${owner ?? 'missing'}`, severity: 'blocker', ownerSource: owner ?? 'RoleGuard', boxes: probe ? { forbidden: probe.box } : undefined })];
}

export function classifyRailRelation(capture: WarehouseCapture): 'side-by-side' | 'stacked' | 'unresolved' {
  const current = capture.geometry['warehouse-current-stock']?.box;
  const history = capture.geometry['warehouse-movement-history']?.box;
  const rail = capture.geometry['warehouse-document-rail']?.box;
  if (!current || !history || !rail) return 'unresolved';
  const workspace = { x: Math.min(current.x, history.x), y: Math.min(current.y, history.y), width: Math.max(boxEndX(current), boxEndX(history)) - Math.min(current.x, history.x), height: Math.max(boxEndY(current), boxEndY(history)) - Math.min(current.y, history.y) };
  if (rail.y >= boxEndY(workspace) - tolerance) return 'stacked';
  if ((rail.x >= boxEndX(workspace) - tolerance || workspace.x >= boxEndX(rail) - tolerance) && rail.y < boxEndY(workspace) && boxEndY(rail) > workspace.y) return 'side-by-side';
  return 'unresolved';
}

function evaluateWorkspace(capture: WarehouseCapture): WarehouseDeterministicFinding[] {
  const findings: WarehouseDeterministicFinding[] = [];
  const geometry = capture.geometry;
  const current = geometry['warehouse-current-stock']; const history = geometry['warehouse-movement-history']; const rail = geometry['warehouse-document-rail'];
  const layoutOwner = capture.owners['warehouse-document-rail'] ?? 'SplitWorkbench/DocumentRail';
  const regionEvidence = regionIds.every((id) => geometry[id] && capture.owners[id]);
  findings.push(finding(capture, { id: `WH-REGIONS-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-REGIONS-OWNERSHIP', verdict: fail(regionEvidence), selector: '[aria-label="Phiếu kho"], section:has(h3)', metric: 'required named region/owner count', expected: '3/3 regions with explicit owners', actual: `${regionIds.filter((id) => geometry[id] && capture.owners[id]).length}/3`, severity: 'blocker', ownerSource: layoutOwner }));
  findings.push(finding(capture, { id: `WH-H1-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-SEMANTIC-H1', verdict: fail(capture.document.h1Count === 1), selector: 'h1', metric: 'H1 count', expected: '1', actual: String(capture.document.h1Count), severity: 'high', ownerSource: 'MainLayout/OperationalFrame' }));
  const noHeadingSkip = capture.document.headingLevels.includes(1) && capture.document.headingLevels.includes(3);
  findings.push(finding(capture, { id: `WH-HEADINGS-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-HEADING-ORDER', verdict: fail(noHeadingSkip), selector: 'h1,h2,h3', metric: 'declared heading levels', expected: 'shell H1 and declared H3 dataset headings', actual: capture.document.headingLevels.join(','), severity: 'high', ownerSource: 'WarehouseMovementPanel/SectionPanel' }));
  findings.push(finding(capture, { id: `WH-OVERFLOW-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-DOCUMENT-OVERFLOW', verdict: fail(capture.document.scrollWidth <= capture.document.clientWidth + tolerance), selector: 'html', metric: 'scrollWidth-clientWidth', expected: '<= 0.5px', actual: `${capture.document.scrollWidth - capture.document.clientWidth}px`, severity: 'high', ownerSource: layoutOwner }));
  const regionClipping = Object.values(geometry).some(({ scroll }) => scroll.scrollWidth > scroll.clientWidth + tolerance && scroll.clientWidth > 0);
  findings.push(finding(capture, { id: `WH-CLIPPING-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-REGION-CLIPPING', verdict: fail(!regionClipping), selector: '[aria-label="Phiếu kho"], section:has(h3)', metric: 'region scroll overflow', expected: 'no contracted region clipping', actual: regionClipping ? 'region content exceeds owner width' : 'none', severity: 'high', ownerSource: layoutOwner }));
  const overlap = current && history && rail ? overlaps(current.box, history.box) || overlaps(current.box, rail.box) || overlaps(history.box, rail.box) : true;
  findings.push(finding(capture, { id: `WH-OVERLAP-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-REGION-OVERLAP', verdict: fail(!overlap), selector: '.ipc-split-workbench', metric: 'pairwise bounding-box overlap', expected: 'none', actual: overlap ? 'overlap detected' : 'none', severity: 'blocker', ownerSource: layoutOwner, boxes: current && history && rail ? { current: current.box, history: history.box, rail: rail.box } : undefined }));
  const order = capture.domOrder.join('>');
  findings.push(finding(capture, { id: `WH-DOM-ORDER-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-DOM-FOCUS-ORDER', verdict: fail(order === warehouseDataWorkspaceContract.domAndFocusOrder.join('>') && capture.focusOrder.length > 0), selector: '.ipc-split-workbench', metric: 'DOM order and focusable sequence', expected: warehouseDataWorkspaceContract.domAndFocusOrder.join('>'), actual: `${order}; focusables=${capture.focusOrder.length}`, severity: 'high', ownerSource: layoutOwner }));
  const relation = classifyRailRelation(capture);
  const expectedRelation = warehouseDataWorkspaceContract.responsiveExpected[capture.viewport.id as keyof typeof warehouseDataWorkspaceContract.responsiveExpected];
  findings.push(finding(capture, { id: `WH-RESPONSIVE-${capture.state}-${capture.viewport.id}`, ruleId: 'D05-RESPONSIVE-RELATION', verdict: relation === 'unresolved' ? 'NEEDS_EVIDENCE' : fail(relation === expectedRelation), selector: '.ipc-split-workbench > .ipc-split-primary, .ipc-split-workbench > aside', metric: 'workspace/rail bounding-box relation', expected: expectedRelation, actual: relation, severity: 'blocker', ownerSource: layoutOwner, boxes: current && history && rail ? { current: current.box, history: history.box, rail: rail.box } : undefined }));
  findings.push(finding(capture, { id: `WH-ACTIONS-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-PRIMARY-ACTIONS', verdict: fail(capture.document.primaryActionCount === 0), selector: '.ipc-split-primary [data-variant="primary"], .ipc-split-primary .ipc-button-primary', metric: 'competing primary action count', expected: '0', actual: String(capture.document.primaryActionCount), severity: 'medium', ownerSource: 'WarehouseMovementPanel' }));
  const runtimeCount = capture.consoleErrors.length + capture.pageErrors.length + capture.nonGetRequests.length;
  findings.push(finding(capture, { id: `WH-RUNTIME-${capture.state}-${capture.viewport.id}`, ruleId: 'D12-RUNTIME', verdict: fail(runtimeCount === 0), selector: 'page/runtime', metric: 'console + page + non-GET count', expected: '0', actual: String(runtimeCount), severity: 'blocker', ownerSource: 'WarehousePage' }));
  if (current && history) {
    const gap = history.box.y - boxEndY(current.box);
    findings.push(finding(capture, { id: `WH-SPACING-PRIMARY-HISTORY-${capture.state}-${capture.viewport.id}`, ruleId: 'D15-PRIMARY-HISTORY-GAP', verdict: fail(Math.abs(gap - 16) <= tolerance), selector: '.ipc-split-primary > .flex.flex-col.gap-4', metric: 'history.top-current.bottom', expected: '16px ±0.5px', actual: `${gap}px`, severity: 'medium', ownerSource: 'WarehouseMovementPanel', boxes: { current: current.box, history: history.box } }));
  }
  return findings;
}

export function evaluateWarehouseManifest(manifest: WarehouseCaptureManifest): WarehouseDeterministicReport {
  const findings = manifest.captures.flatMap((capture) => capture.state === 'route-forbidden' ? evaluateForbidden(capture) : evaluateWorkspace(capture));
  const verdict: WarehouseVerdict = findings.some(({ verdict }) => verdict === 'FAIL') ? 'FAIL' : findings.some(({ verdict }) => verdict === 'NEEDS_EVIDENCE') ? 'NEEDS_EVIDENCE' : findings.some(({ verdict }) => verdict === 'UNRESOLVED') ? 'UNRESOLVED' : 'PASS';
  return { schemaVersion: 1, stage: 'deterministic-before-ai', verdict, findings };
}

export function buildWarehouseSelectionManifest(manifest: WarehouseCaptureManifest, report: WarehouseDeterministicReport): WarehouseSelectionManifest {
  const selectedKeys = new Map<string, string[]>([
    ['ready/1920x1080', ['wide ready capture required by D-17', 'context for deterministic responsive finding']],
    ['ready/1366x768', ['transition-wide ready capture required by D-17', 'adjacent canonical breakpoint evidence']],
    ['ready/1365x900', ['transition-narrow ready capture required by D-17', 'adjacent canonical breakpoint evidence']],
    ['ready/1280x900', ['narrow ready capture required by D-17']],
    ['mixed-empty/1280x900', ['narrow mixed-empty capture required by D-17', 'independent region ownership context']],
    ['route-forbidden/1440x900', ['representative route-forbidden capture required by D-17']],
  ]);
  const selected = manifest.captures.filter((capture) => selectedKeys.has(`${capture.state}/${capture.viewport.id}`)).map((capture) => ({
    captureIdentity: capture.identity, state: capture.state, viewport: capture.viewport.id,
    recordPath: `captures/${capture.state}/${capture.viewport.id}/record.json`, screenshotPath: capture.screenshotPath,
    reasons: selectedKeys.get(`${capture.state}/${capture.viewport.id}`)!,
  }));
  return {
    schemaVersion: 1, generatedAfter: report.stage, contractVersion: manifest.contractVersion, deterministicVerdict: report.verdict, selected,
    excluded: manifest.captures.filter((capture) => !selectedKeys.has(`${capture.state}/${capture.viewport.id}`)).map((capture) => ({ captureIdentity: capture.identity, reason: 'not required by bounded D-17 selection and not near an additional measured threshold' })),
  };
}
