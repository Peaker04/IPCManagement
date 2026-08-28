import { createHash } from 'node:crypto'
import ts from 'typescript'

import type { DemandLine, StockMovement, WorkflowDocument } from '@/types/workflow'
import type { CanonFinding, CanonSource } from './uiCanonSourceInventory'

export type UiProjection = {
  actions: string[]
  statusLabels: string[]
  mandatoryFacts: string[]
}

export type ProjectionSelector = {
  selector: string
  attribute?: string
}

export type SameStatePair = {
  id: string
  kind: 'demand-summary' | 'document-rail' | 'stock-movement'
  left: { surface: string; sourcePath: string; sourceFragment: string }
  right: { surface: string; sourcePath: string; sourceFragment: string }
  sharedProjectionOwner: { sourcePath: string; sourceFragment: string }
  selectors: {
    actions: readonly ProjectionSelector[]
    statusLabels: readonly ProjectionSelector[]
    mandatoryFacts: readonly ProjectionSelector[]
  }
  expected: UiProjection
}

export const SAME_STATE_FIXTURES = {
  demand: [{
    id: 'pf-demand-line',
    serviceDate: '2026-07-27',
    material: 'Gạo tẻ',
    source: 'Cơm gà',
    required: 12.5,
    available: 7,
    reserved: 2,
    unit: 'kilogram',
    status: 'THIẾU HÀNG',
    nextAction: 'Đề xuất mua',
    tone: 'warning',
  }] satisfies DemandLine[],
  document: [{
    id: 'PXK-PF-001',
    type: 'Phiếu xuất kho',
    title: 'Xuất nguyên liệu ca sáng',
    status: 'PENDING',
    summary: 'Chờ thủ kho xử lý',
    owner: 'Thủ kho',
    tone: 'warning',
    lines: [{ label: 'Nguyên liệu', value: 'Gạo tẻ' }],
  }] satisfies WorkflowDocument[],
  movement: [{
    id: 'pf-movement',
    type: 'issue',
    documentNo: 'inventoryissue-PF-001',
    material: 'Gạo tẻ',
    quantity: 12.5,
    beforeQty: 50,
    afterQty: 37.5,
    unit: 'kilogram',
    owner: 'Thủ kho',
    status: 'PENDING',
    nextAction: 'SENTTOWAREHOUSE',
    tone: 'warning',
  }] satisfies StockMovement[],
} as const

export const SAME_STATE_PAIRS: readonly SameStatePair[] = [
  {
    id: 'material-demand-vs-warehouse-demand',
    kind: 'demand-summary',
    left: {
      surface: 'Weekly menu material demand',
      sourcePath: 'src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx',
      sourceFragment: '<DemandSummary lines={inventoryGroups.exceptionLines}',
    },
    right: {
      surface: 'Warehouse demand',
      sourcePath: 'src/features/warehouse/WarehouseDemandPanel.tsx',
      sourceFragment: '<DemandSummary lines={lines} showServiceDate',
    },
    sharedProjectionOwner: {
      sourcePath: 'src/components/common/DemandSummary.tsx',
      sourceFragment: 'export function DemandSummary',
    },
    selectors: {
      actions: [{ selector: '.ipc-demand-next-action' }],
      statusLabels: [{ selector: '.ipc-demand-status-badge' }],
      mandatoryFacts: [
        { selector: 'tbody td:nth-child(1)' },
        { selector: 'tbody td:nth-child(2)' },
        { selector: 'tbody td:nth-child(3)' },
        { selector: 'tbody td:nth-child(4)' },
        { selector: 'tbody td:nth-child(5)' },
      ],
    },
    expected: {
      actions: ['Đề xuất mua'],
      statusLabels: ['Thiếu hàng'],
      mandatoryFacts: ['Gạo tẻ', 'Cơm gà', '12,5 kg', '5 kg', '-7,5 kg'],
    },
  },
  {
    id: 'material-demand-vs-chef-documents',
    kind: 'document-rail',
    left: {
      surface: 'Weekly menu demand documents',
      sourcePath: 'src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx',
      sourceFragment: '<DocumentRail documents={presentation.documents}',
    },
    right: {
      surface: 'Chef journal documents',
      sourcePath: 'src/features/chef/journal/ChefDocumentsSection.tsx',
      sourceFragment: '<DocumentRail documents={documents}',
    },
    sharedProjectionOwner: {
      sourcePath: 'src/components/common/DocumentRail.tsx',
      sourceFragment: 'export function DocumentRail',
    },
    selectors: {
      actions: [{ selector: 'button[aria-label^="Sao chép mã chứng từ"]', attribute: 'aria-label' }],
      statusLabels: [{ selector: '.ipc-document-zone-status > span' }],
      mandatoryFacts: [
        { selector: '.ipc-document-type-label' },
        { selector: '.ipc-document-zone-identity strong' },
        { selector: '.ipc-document-code' },
        { selector: '.ipc-document-zone-detail > div:not(.ipc-document-code-field) dd' },
        { selector: '.ipc-document-zone-owner dd' },
      ],
    },
    expected: {
      actions: ['Sao chép mã chứng từ PXK-PF-001'],
      statusLabels: ['Chờ duyệt'],
      mandatoryFacts: ['Phiếu xuất kho', 'Xuất nguyên liệu ca sáng', 'PXK-PF-001', 'Gạo tẻ', 'Thủ kho'],
    },
  },
  {
    id: 'admin-vs-reports-stock-movement',
    kind: 'stock-movement',
    left: {
      surface: 'Admin inventory movement',
      sourcePath: 'src/app/pages/admin-data/AdminInventoryPanel.tsx',
      sourceFragment: '<StockMovementTable',
    },
    right: {
      surface: 'Reports movement',
      sourcePath: 'src/features/reports/pages/ReportsPage.tsx',
      sourceFragment: '<StockMovementTable',
    },
    sharedProjectionOwner: {
      sourcePath: 'src/components/common/StockMovementTable.tsx',
      sourceFragment: 'export function StockMovementTable',
    },
    selectors: {
      actions: [
        { selector: 'button[aria-label^="Sao chép mã chứng từ"]', attribute: 'aria-label' },
        { selector: 'tbody td:nth-child(7)' },
      ],
      statusLabels: [{ selector: 'tbody td:nth-child(6)' }],
      mandatoryFacts: [
        { selector: 'tbody td:nth-child(1) > div > span' },
        { selector: '.ipc-table-badge-label' },
        { selector: 'tbody td:nth-child(3)' },
        { selector: 'tbody td:nth-child(4) > div:first-child' },
        { selector: 'tbody td:nth-child(5)' },
      ],
    },
    expected: {
      actions: ['Sao chép mã chứng từ inventoryissue-PF-001', 'Đã xuất kho'],
      statusLabels: ['Chờ duyệt'],
      mandatoryFacts: ['II-PF-001', 'Xuất kho', 'Gạo tẻ', '12,5 kg', 'Thủ kho'],
    },
  },
]

export type HiddenDependencyCategory = 'local' | 'global' | 'time' | 'order' | 'cache'
export type HiddenStateDisposition =
  | 'declared-domain-query-state'
  | 'approved-ephemeral-interaction-feedback-input-state'
  | 'justified-non-visibility-infrastructure'

export type HiddenStateFinding = CanonFinding & {
  category: HiddenDependencyCategory
  key: string
}

export type HiddenStateClassification = {
  category: HiddenDependencyCategory
  path: string
  count: number
  fingerprint: string
  disposition: HiddenStateDisposition
  reason: string
}

const findingKey = (finding: Omit<HiddenStateFinding, 'key'>) => [
  finding.category,
  finding.path,
  finding.line,
  finding.kind,
  finding.text.replace(/\s+/g, ' ').trim(),
].join('|')

const hiddenFinding = (
  source: CanonSource,
  node: ts.Node,
  category: HiddenDependencyCategory,
  kind: string,
): HiddenStateFinding => {
  const finding = {
    path: source.path,
    line: source.sourceFile.getLineAndCharacterOfPosition(node.getStart(source.sourceFile)).line + 1,
    category,
    kind,
    text: node.getText(source.sourceFile),
  }
  return { ...finding, key: findingKey(finding) }
}

const visitNodes = (root: ts.Node, visitor: (node: ts.Node) => void) => {
  const walk = (node: ts.Node) => {
    visitor(node)
    ts.forEachChild(node, walk)
  }
  walk(root)
}

const identifiersIn = (node: ts.Node) => {
  const identifiers = new Set<string>()
  visitNodes(node, (child) => {
    if (ts.isIdentifier(child)) identifiers.add(child.text)
  })
  return identifiers
}

const containsJsx = (node: ts.Node) => {
  let found = false
  visitNodes(node, (child) => {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) found = true
  })
  return found
}

const visibilityIdentifiers = (sourceFile: ts.SourceFile) => {
  const identifiers = new Set<string>()
  visitNodes(sourceFile, (node) => {
    if (ts.isBinaryExpression(node) && ['&&', '||', '??'].includes(node.operatorToken.getText(sourceFile)) && containsJsx(node)) {
      identifiersIn(node.left).forEach((identifier) => identifiers.add(identifier))
    }
    if (ts.isConditionalExpression(node) && containsJsx(node)) {
      identifiersIn(node.condition).forEach((identifier) => identifiers.add(identifier))
    }
    if (ts.isIfStatement(node) && (containsJsx(node.thenStatement) || Boolean(node.elseStatement && containsJsx(node.elseStatement)))) {
      identifiersIn(node.expression).forEach((identifier) => identifiers.add(identifier))
    }
    if (ts.isJsxAttribute(node) && ['open', 'hidden', 'visible', 'expanded', 'collapsed'].includes(node.name.getText(sourceFile))) {
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        identifiersIn(node.initializer.expression).forEach((identifier) => identifiers.add(identifier))
      }
    }
  })
  return identifiers
}

const useStateBinding = (node: ts.Node, sourceFile: ts.SourceFile) => {
  if (!ts.isVariableDeclaration(node) || !ts.isArrayBindingPattern(node.name) || !node.initializer || !ts.isCallExpression(node.initializer)) return undefined
  const expression = node.initializer.expression.getText(sourceFile)
  if (expression !== 'useState' && expression !== 'React.useState') return undefined
  const first = node.name.elements[0]
  return first && ts.isBindingElement(first) && ts.isIdentifier(first.name) ? first.name.text : undefined
}

const storageOwner = (expression: ts.Expression, sourceFile: ts.SourceFile) => {
  const text = expression.getText(sourceFile)
  return /(?:^|\.)(?:localStorage|sessionStorage)$/.test(text)
}

const callMember = (node: ts.CallExpression) => ts.isPropertyAccessExpression(node.expression)
  ? node.expression.name.text
  : ts.isIdentifier(node.expression)
    ? node.expression.text
    : undefined

export const scanHiddenStateSources = (sources: readonly CanonSource[]): HiddenStateFinding[] => {
  const findings = new Map<string, HiddenStateFinding>()

  sources.forEach((source) => {
    const visibleState = visibilityIdentifiers(source.sourceFile)
    visitNodes(source.sourceFile, (node) => {
      const stateBinding = useStateBinding(node, source.sourceFile)
      if (stateBinding && visibleState.has(stateBinding)) {
        const finding = hiddenFinding(source, node, 'local', `useState-visibility:${stateBinding}`)
        findings.set(finding.key, finding)
      }

      if (ts.isNewExpression(node) && node.expression.getText(source.sourceFile) === 'Date' && (node.arguments?.length ?? 0) === 0) {
        const finding = hiddenFinding(source, node, 'time', 'wall-clock:new-Date')
        findings.set(finding.key, finding)
      }

      if (!ts.isCallExpression(node)) return
      const member = callMember(node)
      if (!member) return

      if (ts.isPropertyAccessExpression(node.expression)
        && storageOwner(node.expression.expression, source.sourceFile)
        && ['getItem', 'setItem', 'removeItem', 'clear'].includes(member)) {
        const finding = hiddenFinding(source, node, 'global', `web-storage:${member}`)
        findings.set(finding.key, finding)
      }

      const owner = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.expression.getText(source.sourceFile)
        : ''
      if ((owner === 'Date' && member === 'now') || (owner === 'performance' && member === 'now')) {
        const finding = hiddenFinding(source, node, 'time', `wall-clock:${owner}.${member}`)
        findings.set(finding.key, finding)
      }

      if (owner === 'Math' && member === 'random') {
        const finding = hiddenFinding(source, node, 'order', 'nondeterminism:Math.random')
        findings.set(finding.key, finding)
      }

      if (['setTimeout', 'setInterval', 'requestAnimationFrame', 'queueMicrotask'].includes(member)) {
        const finding = hiddenFinding(source, node, 'order', `timer-order:${member}`)
        findings.set(finding.key, finding)
      }

      if (['getState', 'getQueryData', 'setQueryData', 'updateQueryData'].includes(member)) {
        const finding = hiddenFinding(source, node, 'cache', `direct-store-cache:${member}`)
        findings.set(finding.key, finding)
      }
    })
  })

  return [...findings.values()].sort((left, right) => left.key.localeCompare(right.key))
}

const baselineGroupId = ({ category, path }: Pick<HiddenStateFinding, 'category' | 'path'>) => `${category}|${path}`

const fingerprintFindings = (findings: readonly HiddenStateFinding[]) => createHash('sha256')
  .update(findings.map((finding) => finding.key).sort().join('\n'))
  .digest('hex')

export const summarizeHiddenStateFindings = (findings: readonly HiddenStateFinding[]) => {
  const groups = new Map<string, HiddenStateFinding[]>()
  findings.forEach((finding) => {
    const id = baselineGroupId(finding)
    groups.set(id, [...(groups.get(id) ?? []), finding])
  })
  return [...groups.values()].map((group) => ({
    category: group[0].category,
    path: group[0].path,
    count: group.length,
    fingerprint: fingerprintFindings(group),
  })).sort((left, right) => baselineGroupId(left).localeCompare(baselineGroupId(right)))
}

const classified = (
  category: HiddenDependencyCategory,
  path: string,
  count: number,
  fingerprint: string,
  disposition: HiddenStateDisposition,
  reason: string,
): HiddenStateClassification => ({ category, path, count, fingerprint, disposition, reason })

const localInteractionReason = 'Component-owned interaction, feedback, dialog, filter or input state; no undeclared business lifecycle owner.'
const asyncInteractionReason = 'Bounded focus, preload, debounce, countdown, toast or identifier sequencing; not a hidden business-state owner.'
const domainClockReason = 'Explicit business-date, SLA, countdown or persisted lifecycle metadata projection.'
const infrastructureClockReason = 'Timestamp or unique-id infrastructure; it does not select a business action or mandatory fact.'

// Exact grouped fingerprints from the reviewed current-source scan. Any added, removed, moved or changed finding fails.
export const HIDDEN_STATE_BASELINE: readonly HiddenStateClassification[] = [
  classified('cache', 'src/api/apiSlice.ts', 4, 'ab3010193fcf41d74b01f6f22fec2bd3f131fabe1382fb72c82382df90b773e9', 'justified-non-visibility-infrastructure', 'RTK base-query reads declared auth state for transport headers, token-generation checks and exact in-flight mutation ownership.'),
  classified('cache', 'src/app/session/logoutSession.ts', 1, '85ba08cfad57eca067b635af8b2311802051771361f7ad740aff25fd72ac2988', 'justified-non-visibility-infrastructure', 'Single-flight logout orchestration reads the declared auth token before clearing the session.'),
  classified('cache', 'src/features/coordination/coordinationSlice.ts', 1, '438d88c39e6d088870ad858763beaee3b65da2ff937a3f72ec648558e21cea7c', 'declared-domain-query-state', 'Coordination thunk reads its feature-owned Redux state projection.'),
  classified('cache', 'src/routes/routeDataPreloaders.ts', 1, '493fa73b676522db32c6f28a29d52fb168bb1a0bb3d464056dab52c6fdb7a19a', 'justified-non-visibility-infrastructure', 'Route preloader reads declared coordination selection solely to warm route data.'),

  classified('global', 'src/features/projects/pages/WeeklyMenuPage.tsx', 8, '0ccfe86dd09b45cb852fcc0bdf7635026a5f83b93c8d12d1ce225048dd6e8afa', 'declared-domain-query-state', 'Explicit persisted customer/week selection, synchronized with the page query state.'),
  classified('global', 'src/features/projects/weekly-menu/model/formatters.ts', 2, '5716cd4db41b214f47885b78acc0184acd6a4f9a59d3ee4e216692ded84453c9', 'declared-domain-query-state', 'Validated persisted week selection with stale-value cleanup.'),
  classified('global', 'src/components/common/tablePreferences.ts', 3, '3cc2d1c1522c5917547d4b99c20b2c49d6000a04b6bd0e68b8fca962ba690e46', 'justified-non-visibility-infrastructure', 'Validated account/table-scoped presentation preferences persist only column identity, visibility, and density; they do not determine business lifecycle or authorization.'),
  classified('global', 'src/lib/auth/authStorage.ts', 15, 'eecdbc6b9746bb1520543ac571c8e245effb475320afaaf54a85db842335da55', 'justified-non-visibility-infrastructure', 'Central auth persistence boundary; UI consumes the declared auth snapshot rather than storage directly.'),

  classified('local', 'src/app/layout/MainLayout.tsx', 1, 'e5163a8f161b47e46badc64da9818e225c12944b8a4f13a260cebd603565bb53', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/app/pages/AdminDataPage.tsx', 1, '218e5659d0841d2bc0e5151479fd4e22f3acd936e53061f7e365d813569eb9ad', 'approved-ephemeral-interaction-feedback-input-state', 'Visited tabs are retained only to preserve route-local interaction state after first activation.'),
  classified('local', 'src/app/pages/admin-data/AdminEmployeesPanel.tsx', 1, 'a393730110fea827fb10804db7c1d38b4b02aa4d329e8ec97191388242d320bd', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/admin/components/AdvancedDisplaySettings.tsx', 3, 'b007d6716ef10e1dd9e0e7c3bed86965a8133db5f6ba15b18d3cd944cc025313', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/admin/pages/ApprovalRulesPage.tsx', 6, 'ff99e3cc3746aad1223e97281363a9ce75ad781066c5dfea0343230a83182cb7', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/approvals/components/MenuAmendmentReconciliation.tsx', 3, '2410f3497bbf12453e1012a8c35521d0ed483416355c9f52a738e340bc2c2e92', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/approvals/pages/ApprovalPage.tsx', 2, '6b5c3c4f46d04352eb4f9959cf71eb830154c96cf2c37a66f602c8319f2ca464', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/auth/components/SessionTimeoutModal.tsx', 1, '7a8153bfae0bcee29551e5046a3399255b32b290ef8cad7e82d9d69ceadbf3df', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/auth/pages/LoginPage.tsx', 5, 'a73d66a9eafd8e2813e72bf45c72688711e5837daeca12f5cb63eedcbfc36a3c', 'approved-ephemeral-interaction-feedback-input-state', 'Login form values, validation, submission guard and password visibility remain local interaction state; authentication authority stays server-owned.'),
  classified('local', 'src/features/chef/components/excess-material-dialog.tsx', 1, '4f2c7df4e5bbb90e700ab0307acabad1e671597357eff0926136456d66adcfd0', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/components/operational-actions.tsx', 2, '9ae8bc9ed5c54633b79cedae49d20ee37d9409b7dd10c20fb6442897d7a21086', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/components/supplemental-request-dialog.tsx', 1, 'e733ea0157aa003d051f4198d7adfbe0eade94b9906dff7620d2a1f6531bf0da', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/pages/ChefDashboardPage.tsx', 1, '895b381e35d722dcc45dafe7bbc800d66926de36a0aee16fecccef245ed4e8b1', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/coordination/components/action-toolbar.tsx', 3, 'a7fa5b5b772febc6466ef13877ad1834a3dd3a82b7e44a3eb8a2b712a54ce776', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/coordination/components/order-table.tsx', 4, '3740a7476ff887db39c83be1dbf0f2bc72b42e1f2a4b2fa19d064485a4890ebf', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx', 1, '0773f47d331364e1caf1633dc4bdff79a07212b83bf41f532a32e7ab13c8817d', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/production/ServiceRunSection.tsx', 3, '4bcf1d4fcfa51c906bd9461945a93e59c86089a6980195a1dc91f9c066844011', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx', 1, 'bdb779bb6d260360e8e6100882c18aa1d48c6ea409fc6bb6105619b974eb008e', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/purchasing/PurchaseDecisionPanel.tsx', 5, '0903533a91da5cde501e769a4fe361c9a6c0087637ab60343ffbfbcda02164c7', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/reconciliation/ReconciliationActualDrawer.tsx', 1, '5cfe3e8a4bc8e04836a1cac29500712c5e1f9805136df36dde6a0e7ca22e2423', 'approved-ephemeral-interaction-feedback-input-state', 'Quantity, confirmation, correction reason and inline mutation feedback remain local while server data is authoritative.'),
  classified('local', 'src/features/reconciliation/ReconciliationDispositionDrawer.tsx', 1, 'a087eb2fb2cd5a3467716ef6b6abd914981804716161bc316279d3750686748f', 'approved-ephemeral-interaction-feedback-input-state', 'Disposition category, reason and inline mutation feedback remain local while server data is authoritative.'),
  classified('local', 'src/features/reconciliation/ReconciliationWorkspace.tsx', 3, '10ed823e27e70c01be297566c6210381aeb94a6442da0750a70f5125c5a027b8', 'approved-ephemeral-interaction-feedback-input-state', 'Selected batch/source, exception filter, selected editor line IDs and inline mutation feedback are route-local interaction state; refreshed server query lines remain authoritative.'),
  classified('local', 'src/features/reports/LegacyLineageDispositionPanel.tsx', 2, '3f9d14e6ae649b2a759a442d185ec87d485fa359cf5bc0eddd6af6c780bbf705', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/pages/WarehousePage.tsx', 4, '423447de54fd4444a5dcd46dc107065db8e12087b46b431bcd9cfeeb044be45d', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehouseBatchPurchaseReceiptDialog.tsx', 2, '08ad0cb0697cb7837c14ab9bb6af1df2943c2fc026795aac425b8f99d3775651', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx', 6, 'b58b43d4bf6e40570191851a1dfd057da1d881148bd5c3c2598e08792832038d', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehouseExceptionsWorkbench.tsx', 15, '3e6d7b4a3e86085307921b7de67315280527e30e6fa17391586c39dda53ebe18', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 10, '5a5a1f228881d6eafa502e64587dd9f5e8a4cc7c5ac500e2d5f29c56de886d1b', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),

  classified('order', 'src/components/common/ToastProvider.tsx', 2, 'cffdd9c145fe4fbc55ca8d9d328bb1569f42017b698bee4b8a098a9a1e3c0f34', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/components/common/KeepAliveTabPanel.tsx', 1, 'd00871b1715f232be538aeb10a7ca74eb88a72bf4521b2b264e8e024a6b4706d', 'justified-non-visibility-infrastructure', asyncInteractionReason),
  classified('order', 'src/features/approvals/pages/ApprovalPage.tsx', 3, '62295b5a33f5be4358d189760c626e8ce84d86a84cc9b7aa3564a6fe9d0e5343', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/auth/components/SessionTimeoutModal.tsx', 1, '4567480731768cf463ed196d936e391066a8f1e60ecbdd40aaa6277e8c318a9c', 'declared-domain-query-state', 'Declared session-expiry redirect timer.'),
  classified('order', 'src/features/coordination/components/hooks.ts', 1, 'd46bda4be9f660656a2277ec33b03cff1c40fb590f4284938ac8338d0a177711', 'declared-domain-query-state', 'Declared coordination countdown refresh interval.'),
  classified('order', 'src/features/projects/pages/WeeklyMenuPage.tsx', 2, '4823e684ff50247f9172a60eddfc51d563455b804e215125d71a1adb6fb25c10', 'justified-non-visibility-infrastructure', asyncInteractionReason),
  classified('order', 'src/features/purchasing/PurchaseDecisionPanel.tsx', 1, '83b38eed45a42cad6b2aa0f6cbcc6dce78d645a9943fd6d545baee6924cc9132', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/reports/pages/useReportsAuditQualityViewModel.ts', 1, '9e97de760559032620d162663923b1d7e293939fff527793e091d55a5a921637', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/reports/pages/useReportsPriceViewModel.ts', 1, 'debe5396f8e9f8948bd5159a8f7f35b8a163c20e24dd6fb3b66a99a9c6c6c525', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 1, '60c754b4a4988168a673bae2ff6b950fa21d671700ded715bcc00d6546d1cabf', 'justified-non-visibility-infrastructure', asyncInteractionReason),
  classified('order', 'src/lib/useDebouncedValue.ts', 1, '45297b3ec8aa22d251d89eae10dcf7dd9c482d01868d8f47904ea90c7fe09047', 'justified-non-visibility-infrastructure', asyncInteractionReason),

  classified('time', 'src/app/layout/MainLayout.tsx', 1, '942bc0303bff2cb30e653436e07cf2250af2ffa2c5896f87aed1eaec4e3cfce4', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/components/common/ApprovalQueue.tsx', 2, '711982a4eb0796e1731fb8f90983387377daf22665226f5c0f4d23378e538d28', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/components/ui/input.tsx', 2, '6886caa44dcea6e996112b3a77897eb6785db21e38c8ead92aa8dda2eb5c7ce4', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/components/common/ToastProvider.tsx', 1, 'f31d7afd495a37718e76f219d505f3415173b6f15f84400e5da43aadabf7a472', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/features/chef/components/excess-material-dialog.tsx', 1, '6bd93894e54c64260fa0fbacdf608ab725cf425e528dfd8030215cd06358c3b0', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/coordination/components/action-toolbar.tsx', 2, '67bb83d71dbc8752c728fd851fc41708bb9571cf0b23deafb85029a4ece36e4e', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/features/coordination/components/hooks.ts', 1, 'e2c5304e4483f26997f77cf3920cc86cdc739fd9e2ce2b7806f86014128b9fbe', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/coordination/coordinationSlice.ts', 8, '4c259626f6d5ae33c529c4da78671692c214fd2b47aff8ba94551dc75fd0f8cc', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/projects/pages/WeeklyMenuPage.tsx', 1, '302cb19514cf23fc746f7ad277439c03ceb8187c18181e7cd96b4c336d5099b5', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/purchasing/purchasingModel.ts', 1, '23c201bf40c4e0e01f5b3f07fac22690647b3d3252936282d7eea3f8a16b44f8', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/reports/pages/useReportsPageModel.ts', 1, 'cd793db8ea6bc3466166778c7927b946679b7e042757e2ed50461b70e3b4a1a3', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 1, '227d6a79205ec66ff043d83af8276dd2f799cbf5d77875234a2e46410abbda57', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/lib/chefServiceDate.ts', 3, '4bc9f951b748b01011280c09d057c6f3b1e07a13ec168f6eb30bb4558e5d9d58', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/lib/formatters.ts', 1, '94e2221b1a62cf3a06f1671799ac3744dddb6cad7a8d8388161812923e27ced8', 'declared-domain-query-state', domainClockReason),
]

export const assertHiddenStateBaseline = (
  findings: readonly HiddenStateFinding[],
  baseline: readonly HiddenStateClassification[] = HIDDEN_STATE_BASELINE,
) => {
  const duplicateGroups = baseline.filter((entry, index) => baseline.findIndex((candidate) => baselineGroupId(candidate) === baselineGroupId(entry)) !== index)
  if (duplicateGroups.length > 0) throw new Error(`Duplicate hidden-state baseline groups: ${duplicateGroups.map(baselineGroupId).join('\n')}`)

  const actual = summarizeHiddenStateFindings(findings)
  const baselineByGroup = new Map(baseline.map((entry) => [baselineGroupId(entry), entry]))
  const unclassified = actual.filter((group) => {
    const expected = baselineByGroup.get(baselineGroupId(group))
    return !expected || expected.count !== group.count || expected.fingerprint !== group.fingerprint
  })
  const stale = baseline.filter((entry) => !actual.some((group) => baselineGroupId(group) === baselineGroupId(entry)))
  if (unclassified.length > 0 || stale.length > 0) {
    throw new Error([
      ...unclassified.map((group) => `UNCLASSIFIED ${JSON.stringify(group)}`),
      ...stale.map((entry) => `STALE ${baselineGroupId(entry)}`),
    ].join('\n'))
  }
}

export const sourceFromText = (path: string, text: string): CanonSource => ({
  path,
  sourceFile: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
})
