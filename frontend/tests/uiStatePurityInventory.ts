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
  classified('cache', 'src/app/providers/SystemOperationProvider.tsx', 1, 'a7b33b2a488c539c84fc9b0d4d44d05c6e82e98c421cab263dced2f8ee65f5c0', 'declared-domain-query-state', 'Authenticated singleton query owns the server-authoritative operation mode and version used by route eligibility and mutations.'),
  classified('cache', 'src/routes/routeDataPreloaders.ts', 1, '512496d010936a7c5f02f8dc0cd94114de7f7973698720979c4b0461b804a327', 'justified-non-visibility-infrastructure', 'Route preloader reads declared coordination selection and operation mode solely to warm eligible route data.'),

  classified('global', 'src/features/projects/pages/WeeklyMenuPage.tsx', 8, 'dfff1089d7c82908ea2533a6bd9e18229d32c7e2ec0c73eea38923a188c94713', 'declared-domain-query-state', 'Explicit persisted customer/week selection, synchronized with the page query state.'),
  classified('global', 'src/features/projects/weekly-menu/model/formatters.ts', 2, '5716cd4db41b214f47885b78acc0184acd6a4f9a59d3ee4e216692ded84453c9', 'declared-domain-query-state', 'Validated persisted week selection with stale-value cleanup.'),
  classified('global', 'src/components/common/tablePreferences.ts', 3, '3cc2d1c1522c5917547d4b99c20b2c49d6000a04b6bd0e68b8fca962ba690e46', 'justified-non-visibility-infrastructure', 'Validated account/table-scoped presentation preferences persist only column identity, visibility, and density; they do not determine business lifecycle or authorization.'),
  classified('global', 'src/lib/auth/authStorage.ts', 15, 'd174932066ac2094f74a1a1ad0a06f21c5be80c66918e3354c21d2594eeb27b0', 'justified-non-visibility-infrastructure', 'Central auth persistence boundary; UI consumes the declared auth snapshot rather than storage directly.'),

  classified('local', 'src/app/layout/MainLayout.tsx', 1, 'f4b893a2192163b724a045e45c2695da9e8728586a1f9db08b7a4491bbf92dba', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/app/pages/admin-data/ReconciliationAdminDataPage.tsx', 1, '07962d36b2c6714baa4986a5a3d78efe0a31dc5d08dd0181452e5d46d2aa9817', 'approved-ephemeral-interaction-feedback-input-state', 'Visited reconciliation admin tabs are retained only to preserve route-local interaction state after first activation.'),
  classified('local', 'src/app/pages/AdminDataPage.tsx', 1, '37f6ff40826f7515dfbd830773a18394b0dba717ddd477f9aef74cf7eda2d85d', 'approved-ephemeral-interaction-feedback-input-state', 'Visited tabs are retained only to preserve route-local interaction state after first activation.'),
  classified('local', 'src/app/pages/admin-data/AdminEmployeesPanel.tsx', 1, 'a393730110fea827fb10804db7c1d38b4b02aa4d329e8ec97191388242d320bd', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/components/common/TablePreferencesControl.tsx', 1, 'e2d81cfa641229e539e3037729b57ef7df7e22677586b6cc908c5e9d11165e8c', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/admin/components/AdvancedDisplaySettings.tsx', 3, '1409bc1659d66387f182700cddbec78bfe06ae4bd78c0875fbe434f501ea2b9e', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/admin/pages/ApprovalRulesPage.tsx', 6, 'dc5cbd7c092d21f4a23458ae599b72e529ce27ad8619dbcb51da9297ba133f4b', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/approvals/components/MenuAmendmentReconciliation.tsx', 3, '2410f3497bbf12453e1012a8c35521d0ed483416355c9f52a738e340bc2c2e92', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/approvals/pages/ApprovalPage.tsx', 1, '7e07042666125adfe6329cb6c2d7cb640d017a8f9754aba8c36599719e92185e', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/approvals/pages/ApprovalDecisionDialog.tsx', 1, '1d428404be8eed768bbc8179ef819bba0b8711a967db3d8b375fa3492f92f3ac', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/auth/components/IdleSessionGuard.tsx', 1, '42e2a0b023ae68255a33ed7439dfa0c5e8fc62f39f57cf2c3d1a93d1ebd15d42', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/auth/pages/LoginPage.tsx', 5, '253e21be9c868c08e9a26ac2f0dca820811ae0197f6f74ed578cbdf474991c46', 'approved-ephemeral-interaction-feedback-input-state', 'Login form values, validation, submission guard and password visibility remain local interaction state; authentication authority stays server-owned.'),
  classified('local', 'src/features/chef/components/excess-material-dialog.tsx', 1, 'b196e067f2058141bc67dd6cb71a1fb864db9626dce53331c28ccf41d0ba8018', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/components/operational-actions.tsx', 2, '9ae8bc9ed5c54633b79cedae49d20ee37d9409b7dd10c20fb6442897d7a21086', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/components/supplemental-request-dialog.tsx', 1, 'e733ea0157aa003d051f4198d7adfbe0eade94b9906dff7620d2a1f6531bf0da', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/pages/ChefDashboardPage.tsx', 1, '895b381e35d722dcc45dafe7bbc800d66926de36a0aee16fecccef245ed4e8b1', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/coordination/components/action-toolbar.tsx', 3, 'a7fa5b5b772febc6466ef13877ad1834a3dd3a82b7e44a3eb8a2b712a54ce776', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/coordination/components/order-table.tsx', 4, '3740a7476ff887db39c83be1dbf0f2bc72b42e1f2a4b2fa19d064485a4890ebf', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx', 1, '76cffb519c71575fe4a5d27b199961fa667fbd18f454c9fe3443746e3e89ecd5', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/chef/production/ServiceRunSection.tsx', 3, '2c58da836e7b8f021c61f9cee0a71e87e408a96197591cd7e7301a4dfeec3ec8', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx', 1, 'bdb779bb6d260360e8e6100882c18aa1d48c6ea409fc6bb6105619b974eb008e', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/purchasing/PurchaseDecisionPanel.tsx', 5, 'f205d4312a528557f4de375c1abca9217eb74c7d0aaf2305cdda24b8ba9ca02f', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/reconciliation/pages/ReconciliationPage.tsx', 4, '9ccff5eb81c185c143991aa046c416574828ac8e90583a57bb1912053d063442', 'approved-ephemeral-interaction-feedback-input-state', 'Selected detail/disposition state and completion confirmation/error feedback remain local; selected batch and lifecycle data remain server-query authoritative.'),
  classified('local', 'src/features/reconciliation/ReconciliationDispositionDrawer.tsx', 1, 'dcd90f7cb74f6cd82a78a74383145a17d2bd1451bf73325eb75625c2a3b4277b', 'approved-ephemeral-interaction-feedback-input-state', 'Disposition category, reason and inline mutation feedback remain local while server data is authoritative.'),
  classified('local', 'src/app/providers/SystemOperationProvider.tsx', 1, '29cc1666f5c99c6309a0f81ebb846bc81679f29c56d49c2dae4c546353117622', 'approved-ephemeral-interaction-feedback-input-state', 'Route-local retry sequencing prevents stale authority errors from replacing a newer successful mode snapshot.'),
  classified('local', 'src/features/reports/LegacyLineageDispositionPanel.tsx', 2, '25262389be52230bfaad43e503b78991adcddb35639ca7f745bcecc9a5b9a12e', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/pages/ReconciliationWarehousePage.tsx', 2, 'cf4458ec0b4f2ffe5eccd91f6a38940fd0445516a3d99df511094e54fda2a663', 'approved-ephemeral-interaction-feedback-input-state', 'Issue draft inputs and supplemental form state remain local; selected issue identity is URL-owned and server queries remain authoritative.'),
  classified('local', 'src/features/warehouse/pages/WarehousePage.tsx', 4, '76191917c853dfd6111f7388c53b20abaaef14121b8ca4957b0cf60dff4d0ace', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehouseBatchPurchaseReceiptDialog.tsx', 2, '08ad0cb0697cb7837c14ab9bb6af1df2943c2fc026795aac425b8f99d3775651', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx', 6, 'b58b43d4bf6e40570191851a1dfd057da1d881148bd5c3c2598e08792832038d', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehouseExceptionsWorkbench.tsx', 15, 'b25fbd12ad1a533b353ab62e4520489542082f804cedfb16763fd185ff82b213', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),
  classified('local', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 10, '5a5a1f228881d6eafa502e64587dd9f5e8a4cc7c5ac500e2d5f29c56de886d1b', 'approved-ephemeral-interaction-feedback-input-state', localInteractionReason),

  classified('order', 'src/components/common/ToastProvider.tsx', 2, 'cffdd9c145fe4fbc55ca8d9d328bb1569f42017b698bee4b8a098a9a1e3c0f34', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/components/common/KeepAliveTabPanel.tsx', 1, 'd00871b1715f232be538aeb10a7ca74eb88a72bf4521b2b264e8e024a6b4706d', 'justified-non-visibility-infrastructure', asyncInteractionReason),
  classified('order', 'src/features/approvals/pages/ApprovalPage.tsx', 3, 'd49e3e17d8bd87e671d6ac2d057b4765d49c277d8caf9f6b2c1639dbed26c14a', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/auth/components/IdleSessionGuard.tsx', 2, '52ff8eee66b413c3eed6902e5817578c67a42c6975e328cf7bd33ec54a093c28', 'declared-domain-query-state', 'Declared idle-session warning and logout timers.'),
  classified('order', 'src/features/auth/components/SessionTimeoutModal.tsx', 1, '49529ac8b7966ef18f9440aa70241d5879cb886b6fff0ba8001fd78151a280c2', 'declared-domain-query-state', 'Declared session-expiry redirect timer.'),
  classified('order', 'src/features/coordination/components/hooks.ts', 1, 'd46bda4be9f660656a2277ec33b03cff1c40fb590f4284938ac8338d0a177711', 'declared-domain-query-state', 'Declared coordination countdown refresh interval.'),
  classified('order', 'src/features/projects/pages/WeeklyMenuPage.tsx', 2, 'c776fdeae0de6cd539aa7cfd7813b6f0d67d93890a52f3c4013a75a5c3d142a1', 'justified-non-visibility-infrastructure', asyncInteractionReason),
  classified('order', 'src/features/purchasing/PurchaseDecisionPanel.tsx', 1, '87a70d681c10e8def92d51ad03b611bfa0f7597e09a8a6660063446058e3bf0d', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/reports/pages/useReportsAuditQualityViewModel.ts', 1, '9e97de760559032620d162663923b1d7e293939fff527793e091d55a5a921637', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/reports/pages/useReportsPriceViewModel.ts', 1, 'debe5396f8e9f8948bd5159a8f7f35b8a163c20e24dd6fb3b66a99a9c6c6c525', 'approved-ephemeral-interaction-feedback-input-state', asyncInteractionReason),
  classified('order', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 1, '60c754b4a4988168a673bae2ff6b950fa21d671700ded715bcc00d6546d1cabf', 'justified-non-visibility-infrastructure', asyncInteractionReason),
  classified('order', 'src/lib/useDebouncedValue.ts', 1, '45297b3ec8aa22d251d89eae10dcf7dd9c482d01868d8f47904ea90c7fe09047', 'justified-non-visibility-infrastructure', asyncInteractionReason),

  classified('time', 'src/app/layout/MainLayout.tsx', 1, '7f367bda7517c547c6f7347760d0b5b63097d606b2bdca4484a7c6f9b1d90fef', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/components/common/ApprovalQueue.tsx', 1, 'eb09750477cafed0791320dfbd6d7fb322cd08513afdd222b9e6dbb2edfdda73', 'declared-domain-query-state', 'SLA projection captures one stable reference time at component mount; render no longer reads the clock repeatedly.'),
  classified('time', 'src/components/common/ToastProvider.tsx', 1, 'f31d7afd495a37718e76f219d505f3415173b6f15f84400e5da43aadabf7a472', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/features/chef/components/excess-material-dialog.tsx', 1, 'b7889592840266e010e5edbb73b39f137734ac8d1b1453e67dd3fe4177e50666', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/coordination/components/action-toolbar.tsx', 2, '67bb83d71dbc8752c728fd851fc41708bb9571cf0b23deafb85029a4ece36e4e', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/features/coordination/components/hooks.ts', 1, 'e2c5304e4483f26997f77cf3920cc86cdc739fd9e2ce2b7806f86014128b9fbe', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/coordination/coordinationSlice.ts', 8, '4c259626f6d5ae33c529c4da78671692c214fd2b47aff8ba94551dc75fd0f8cc', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/projects/pages/WeeklyMenuPage.tsx', 1, '06ae52b14af71c768189f343541eae943528ce449fbcdc2f59df450dd7e79183', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/purchasing/purchasingModel.ts', 1, '23c201bf40c4e0e01f5b3f07fac22690647b3d3252936282d7eea3f8a16b44f8', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/reports/pages/useReportsPageModel.ts', 1, 'cd793db8ea6bc3466166778c7927b946679b7e042757e2ed50461b70e3b4a1a3', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/warehouse/pages/ReconciliationWarehousePage.tsx', 2, '8819b0d20e8892ade90a164ebd0ea32f0be5b4a0c871ef9c15af8e7cf4009dfc', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/features/warehouse/WarehousePurchaseReceiptDialog.tsx', 1, '227d6a79205ec66ff043d83af8276dd2f799cbf5d77875234a2e46410abbda57', 'justified-non-visibility-infrastructure', infrastructureClockReason),
  classified('time', 'src/lib/chefServiceDate.ts', 3, '9c56f757e2b707b94fb28ede13e9a52362c8783aa88a1af40647de6b82ec544e', 'declared-domain-query-state', domainClockReason),
  classified('time', 'src/lib/formatters.ts', 1, '2df7d1ad9caf7a1bdcc6bf8b062a5703e94fc489adfd43896a39befc773e5915', 'declared-domain-query-state', domainClockReason),
  classified('local', 'src/app/pages/admin-data/AdminBomPanel.tsx', 1, 'd5e558c42b352c72a885902b7fe0afe3f85ef63bc03c42cb51845e71a66ef77e', 'declared-domain-query-state', 'Feature-owned UI state controls an explicit visible workflow surface or dialog.'),
  classified('local', 'src/components/reconciliation/ClosedLoopTransferPanel.tsx', 3, '61d85d0bcd4a7c3936bccca64f4b1e916ca36e1256f8dc5ab640fc57abb5b50e', 'declared-domain-query-state', 'Feature-owned UI state controls an explicit visible workflow surface or dialog.'),
  classified('local', 'src/features/projects/weekly-menu/schedule/SearchableDishPicker.tsx', 1, '7066f2192779a57af2fb99124a1e07ac542c5950bc5b7551a220314088a3b95b', 'declared-domain-query-state', 'Feature-owned UI state controls an explicit visible workflow surface or dialog.'),
  classified('local', 'src/features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx', 2, '895bc8d5ca0e6fae4992b7238d02bb556d7cbda176931826b2f905199613f764', 'declared-domain-query-state', 'Feature-owned UI state controls an explicit visible workflow surface or dialog.'),
  classified('time', 'src/components/ui/VietnameseDateInput.tsx', 2, 'cde64b75771b125fde66224fa031b0c9bcd4937bcf56947ec417cd03a83fa800', 'justified-non-visibility-infrastructure', infrastructureClockReason),
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
