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
      statusLabels: ['Đang chờ xử lý'],
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
      actions: ['Sao chép mã chứng từ inventoryissue-PF-001', 'Đã gửi kho'],
      statusLabels: ['Đang chờ xử lý'],
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

  classified('global', 'src/features/projects/pages/WeeklyMenuPage.tsx', 9, '7e142b41e651878d74f543088b65f056e46ef0a2880c25e1106449aa19524e07', 'declared-domain-query-state', 'Explicit persisted customer/week selection, synchronized with the page query state.'),
  classified('global', 'src/features/projects/weekly-menu/model/formatters.ts', 2, '812b0f7a3b4ddaf0150abdeb15c19161ee89c168acc83b38bb975695fe785fa8', 'declared-domain-query-state', 'Validated persisted week selection with stale-value cleanup.'),
  classified('global', 'src/lib/auth/authStorage.ts', 15, 'eecdbc6b9746bb1520543ac571c8e245effb475320afaaf54a85db842335da55', 'justified-non-visibility-infrastructure', 'Central auth persistence boundary; UI consumes the declared auth snapshot rather than storage directly.'),

  classified('local', 'src/app/layout/MainLayout.tsx', 1, 'e5163a8f161b47e46badc64da9818e225c12944b8a4f13a260cebd603565bb53', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/app/pages/admin-data/AdminEmployeesPanel.tsx', 1, 'f3e6b8b0c8cde864a35149029269c1a13d7d823728d2df2b8e4e3209eab52980', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/admin/pages/ApprovalRulesPage.tsx', 6, 'b1dea4b59bf4601c3de9d7c67597f2b24781030807a2330131759719396c4af2', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/approvals/pages/ApprovalPage.tsx', 4, 'e2bea1309bad97e2746e4ff6bf8413a230f6660e4212f896d59f6e419804232e', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/auth/components/SessionTimeoutModal.tsx', 1, '7a8153bfae0bcee29551e5046a3399255b32b290ef8cad7e82d9d69ceadbf3df', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/auth/pages/LoginPage.tsx', 4, '1fb74d567075056f870639365be344bdc09798eb5206450d45ef95de4ad2fe64', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/components/excess-material-dialog.tsx', 1, 'b605d1e212a8390f6dd2cf7a3ffbe00f9bf59707c9d61a19fc14e73dc3f18932', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/components/operational-actions.tsx', 2, '9ae8bc9ed5c54633b79cedae49d20ee37d9409b7dd10c20fb6442897d7a21086', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/components/supplemental-request-dialog.tsx', 1, '15db000f8e170fcc07e155a7a54f5ad2c1766932f401efda3ee405b1a5b112f8', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/pages/ChefDashboardPage.tsx', 1, '7689f51176adf04ac53475f0f4cabdac0a8922ef6be49e9d2d2cd6c65c602155', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/coordination/components/action-toolbar.tsx', 3, 'a7fa5b5b772febc6466ef13877ad1834a3dd3a82b7e44a3eb8a2b712a54ce776', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/coordination/components/order-table.tsx', 4, 'e7c382480ede41bcdacdbed589fb9ec90d6f8a68e79d99ea6433442bf886b17f', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx', 1, '76cffb519c71575fe4a5d27b199961fa667fbd18f454c9fe3443746e3e89ecd5', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/production/ServiceRunSection.tsx', 2, '6f67239b219287c54874b3d858307ae270e2dfec4b9c21ca4ec99646b458b4db', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/projects/weekly-menu/schedule/MenuAmendmentInbox.tsx', 2, 'a06fd5fedbcb64facdd07feff3fba9691f8dff630ed79e7b94c4f0f2c30bedb7', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx', 1, '88404bdd17a3e035b712a954922663286f95f82e20817be6e99da83a2ba39a56', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/purchasing/PurchaseDecisionPanel.tsx', 4, 'b3640b0e88ddb5ea26caa3237550c7022a2879bbe1c440996cf22de9292ef267', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/pages/WarehousePage.tsx', 4, '2956f954f4eab8789881bec9de7048047b8906b0292fce8d4eec704b1ed1c32f', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehouseExceptionsWorkbench.tsx', 13, '0db39ff9989f9f89403eb89cd2c1f439b3ebfcc73a8150eabb8bb8f75e508e2b', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 11, '79eeb0355401c57f62d8ce7989ed2e38dd7c5fba2ff6c3c8d02d6e34249a4888', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),

  classified('order', 'src/app/layout/MainLayout.tsx', 1, 'c4d10d39301777f9bcb0c9d8b0a01554ff041de35216f5fa54e9af28893fe1cc', 'justified-non-visibility-infrastructure', asyncInteractionReason),
  classified('order', 'src/components/common/ToastProvider.tsx', 2, 'cffdd9c145fe4fbc55ca8d9d328bb1569f42017b698bee4b8a098a9a1e3c0f34', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/approvals/pages/ApprovalPage.tsx', 2, '4a5548679b2383a2131d3ef08ba93b71ada9d0882eb63e9de435c1d506741b47', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/auth/components/SessionTimeoutModal.tsx', 1, '4567480731768cf463ed196d936e391066a8f1e60ecbdd40aaa6277e8c318a9c', 'declared-domain-query-state', 'Declared session-expiry redirect timer.'),
  classified('order', 'src/features/coordination/components/hooks.ts', 1, 'd46bda4be9f660656a2277ec33b03cff1c40fb590f4284938ac8338d0a177711', 'declared-domain-query-state', 'Declared coordination countdown refresh interval.'),
  classified('order', 'src/features/projects/pages/WeeklyMenuPage.tsx', 2, 'c8af0ca0983705324d8e550f015c637f2858e0d982c46060b1492b97f915671c', 'justified-non-visibility-infrastructure', asyncInteractionReason),
  classified('order', 'src/features/purchasing/PurchaseDecisionPanel.tsx', 1, '53c3daadc49813e19a8e2b81cc50531bbdc07e6650b50cd5bfd040b19d5d9595', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/reports/pages/useReportsAuditQualityViewModel.ts', 1, '14b24125c2cce7f478d9dd475f85b5eda2b30794bc16f4dcaeae8b6fde003079', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/reports/pages/useReportsPriceViewModel.ts', 1, 'fbdaf82bad6eda51bf3c5bf52b2e53364b74989515887f4a2a91b15d34603cb3', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 1, 'bc331fc1ec95526266371b383c28585527965472f69a19517185da4bbac6918c', 'justified-non-visibility-infrastructure', asyncInteractionReason),

  classified('time', 'src/app/layout/MainLayout.tsx', 1, '88f9be95813ca327ea67cb74ce141cc74e432542fa27deaa1c056e14b7d7693f', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/components/common/ApprovalQueue.tsx', 2, '71dc4f193f7e8eaf8c8fa16710e4b0d616fcd18cadfe76bf9fa64126a2cff765', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/components/common/ToastProvider.tsx', 1, 'f31d7afd495a37718e76f219d505f3415173b6f15f84400e5da43aadabf7a472', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/features/chef/components/excess-material-dialog.tsx', 1, 'fd24c866ad33bf8d55383f07218a2e0e638976e4bf10632f4694c48c19581405', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/coordination/components/action-toolbar.tsx', 2, '67bb83d71dbc8752c728fd851fc41708bb9571cf0b23deafb85029a4ece36e4e', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/features/coordination/components/hooks.ts', 1, 'e2c5304e4483f26997f77cf3920cc86cdc739fd9e2ce2b7806f86014128b9fbe', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/coordination/coordinationSlice.ts', 8, '4c259626f6d5ae33c529c4da78671692c214fd2b47aff8ba94551dc75fd0f8cc', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/projects/pages/WeeklyMenuPage.tsx', 1, '6095fd0eb8ec04667d016742ed5645fc16a054f4b4acae633ba4774fed5e6269', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/purchasing/purchasingModel.ts', 1, '05d74653fcadd2726d60fc423f276bccf9d2ab8625a9b6c003d5ce8c62bcba16', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/reports/pages/useReportsPageModel.ts', 1, '80aee7bb6902e6ac8e180b1a141d5490498b5f4e2c730516ebcf5d0d87ccc6f9', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 1, 'd4ea7f2f67ff8d149138dd4eac1b1047e8f008431edcdbd3555d8b677c92c3a6', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/lib/chefServiceDate.ts', 3, '9c56f757e2b707b94fb28ede13e9a52362c8783aa88a1af40647de6b82ec544e', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/lib/formatters.ts', 1, '29a0980a76909b8c22bf293830263d215691acc1f5cfefc3ae17c1b3a2b08fdd', 'declared-domain-query-state', domainClockReason),
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
