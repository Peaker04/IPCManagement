import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import adminContractsSource from '../src/app/pages/admin-data/AdminContractsPanel.tsx?raw'
import appRouterSource from '../src/routes/AppRouter.tsx?raw'
import weeklyFixtureSource from './weekly-menu-lifecycle-pa2b-fixture.ts?raw'
import {
  assertPcMeasurementRows,
  PC_VIEWPORTS,
  pcMeasurementRowKey,
  type PcMeasurementRow,
} from './pcActionCompletenessContract'
import {
  getPcActionExpectation,
  PC_PROJECTED_REGISTRY_ROWS,
  type PcActorId,
  type PcProjectedRegistryRow,
} from './pcActionCompletenessFixture'
import { UNKNOWN } from './stateActionRegistryContract'

const UNRESOLVED = 'CHƯA-KẾT-LUẬN-ĐƯỢC' as const

type Resolution = {
  status: 'RESOLVED' | 'UNRESOLVED'
  evidence: string
}

type LedgerGroup = {
  id: string
  family: string
  scenarioId: string
  operation: string
  actors: PcActorId[]
  viewports: 'ALL-PC-VIEWPORTS'
  canonicalUnknown: string[]
  controlEvidence: {
    status: 'OBSERVED' | 'ABSENT-AS-PROJECTED'
    selector: string
    source: string
  }
  sources: string[]
  exclusions: Record<'navigation' | 'viewport' | 'fixtureCondition' | 'roleState', Resolution>
  consequence: string
  disposition: 'DEFERRED-CANONICAL-UNKNOWN'
  pdCandidate: boolean
}

type DispositionLedger = {
  schemaVersion: number
  artifact: {
    evidenceKind: string
    generatedAt: string
    measurementRows: number
    matched: number
    unresolved: number
    missing: number
    orphan: number
    silent: number
    wrongPlace: number
    controlsObserved: number
    operationsExercised: boolean
  }
  checkpoint: {
    outcome: string
    productionCandidates: unknown[]
    reason: string
  }
  acceptedExceptions: Array<{
    id: string
    family: string
    scenarioId: string
    actors: string[]
    decision: string
    consequence: string
    sources: string[]
    pdCandidate: boolean
  }>
  groups: LedgerGroup[]
}

type AggregateSnapshot = {
  schemaVersion: 1
  generatedAt: string
  evidenceKind: string
  scope: string
  canonical: { measuredViewportCount: number }
  rows: PcMeasurementRow[]
  requests: Array<{ scenario: string; method: string; path: string; status: number; mutation: boolean }>
  screenshots: Array<{ family: string; scenarioId?: string; actor: PcActorId; viewport: string; path: string; kind: 'family-final' | 'scenario-exclusion' }>
  performance: Array<{ family: string; scenarioId: string; actor: PcActorId; viewport: string; overflow: boolean }>
  browserIssueCount: number
  overflowCount: number
  sourceArtifact: string
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LEGACY_WORKSTREAM_PHASES = resolve(
  REPO_ROOT,
  '.planning',
  'workstreams',
  'goal-make-every-existing-route-tab-and-declared-canonical-st',
  'phases',
)
const dispositionSource = readFileSync(resolve(
  LEGACY_WORKSTREAM_PHASES,
  '20-pc-pd-action-completeness',
  '20-DISPOSITION.md',
), 'utf8').replace(/\r\n/g, '\n')
const aggregateSnapshot = JSON.parse(readFileSync(resolve(
  LEGACY_WORKSTREAM_PHASES,
  '20-pc-pd-action-completeness',
  '20-PC-AGGREGATE.json',
), 'utf8')) as AggregateSnapshot

const parseDispositionLedger = (source: string): DispositionLedger => {
  const match = source.match(/```json disposition-ledger\n([\s\S]*?)\n```/)
  if (!match?.[1]) throw new Error('20-DISPOSITION.md is missing the machine-readable ledger')
  return JSON.parse(match[1]) as DispositionLedger
}

const projectedGroupKey = (
  row: Pick<PcProjectedRegistryRow, 'family' | 'scenarioId' | 'operation'>,
) => [row.family, row.scenarioId, row.operation].join('\u0000')

const canonicalUnknownFields = (row: PcProjectedRegistryRow) => ([
  ['operation', row.operation],
  ['actor', row.registryActor],
  ['backendPermission', row.backendPermission],
  ['frontendPermission', row.frontendPermission],
] as const).filter(([, value]) => value === UNKNOWN).map(([field]) => field)

const unresolvedProjectedRows = PC_PROJECTED_REGISTRY_ROWS.filter((row) => (
  canonicalUnknownFields(row).length > 0
))

const sorted = (items: readonly string[]) => [...items].sort((left, right) => left.localeCompare(right))
const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const historicalControlSource = new Map<string, string>([
  ['frontend/src/features/coordination/components/action-toolbar.tsx:389-400', 'frontend/src/features/coordination/components/action-toolbar.tsx:378-388'],
  ['frontend/src/features/coordination/components/action-toolbar.tsx:402-413', 'frontend/src/features/coordination/components/action-toolbar.tsx:391-401'],
  ['frontend/src/features/coordination/components/action-toolbar.tsx:415-426', 'frontend/src/features/coordination/components/action-toolbar.tsx:404-414'],
  ['frontend/src/features/coordination/components/action-toolbar.tsx:428-439', 'frontend/src/features/coordination/components/action-toolbar.tsx:417-427'],
  ['frontend/src/features/coordination/components/order-table.tsx:344', 'frontend/src/features/coordination/components/order-table.tsx:327'],
  ['frontend/src/features/coordination/components/order-table.tsx:372', 'frontend/src/features/coordination/components/order-table.tsx:355'],
])

const assertSameStrings = (actual: readonly string[], expected: readonly string[], label: string) => {
  if (JSON.stringify(sorted(actual)) !== JSON.stringify(sorted(expected))) {
    throw new Error(`${label} does not match its canonical projection`)
  }
}

const countMismatch = (rows: readonly PcMeasurementRow[], mismatch: PcMeasurementRow['mismatch']) => (
  rows.filter((row) => row.mismatch === mismatch).length
)

const assertAggregateSnapshot = (aggregate: AggregateSnapshot) => {
  if (aggregate.schemaVersion !== 1 || aggregate.scope !== 'aggregate-five-viewport') {
    throw new Error('Disposition requires the tracked five-viewport aggregate snapshot')
  }
  if (!Number.isFinite(Date.parse(aggregate.generatedAt))) throw new Error('Aggregate snapshot has an invalid timestamp')
  if (aggregate.evidenceKind !== 'FE-fixture-read-only' || aggregate.canonical.measuredViewportCount !== 5) {
    throw new Error('Aggregate snapshot has invalid evidence scope')
  }
  assertPcMeasurementRows(aggregate.rows)
  if (aggregate.rows.length !== 535) throw new Error(`Aggregate snapshot has ${aggregate.rows.length} rows, expected 535`)
  if (aggregate.browserIssueCount !== 0 || aggregate.overflowCount !== 0 || aggregate.performance.some((item) => item.overflow)) {
    throw new Error('Aggregate snapshot contains a browser issue or overflow')
  }
  const exercised = aggregate.rows.filter((row) => {
    const projected = PC_PROJECTED_REGISTRY_ROWS.find((candidate) => (
      candidate.family === row.family
      && candidate.scenarioId === row.scenarioId
      && candidate.operation === row.operation
    ))
    return row.expected && row.actualControls.length > 0 && projected && getPcActionExpectation(projected) !== null
  })
  if (exercised.length === 0 || exercised.some((row) => row.actualControls.some((control) => control.postAction === null))) {
    throw new Error('Aggregate snapshot does not prove exercised operations')
  }
  if (exercised.some((row) => row.requestExpected && !row.requestObserved)) {
    throw new Error('Aggregate snapshot has an exercised mutation without an intercepted request')
  }
}

const assertDispositionLedger = (ledger: DispositionLedger, aggregate: AggregateSnapshot = aggregateSnapshot) => {
  assertAggregateSnapshot(aggregate)
  const aggregateRows = aggregate.rows
  if (ledger.schemaVersion !== 1) throw new Error('Unsupported disposition schema')
  if (
    ledger.artifact.evidenceKind !== 'FE-fixture-read-only'
    || ledger.artifact.generatedAt !== aggregate.generatedAt
    || ledger.artifact.measurementRows !== aggregateRows.length
    || ledger.artifact.matched !== countMismatch(aggregateRows, 'KHỚP')
    || ledger.artifact.unresolved !== countMismatch(aggregateRows, 'CHƯA-KẾT-LUẬN-ĐƯỢC')
    || ledger.artifact.controlsObserved !== aggregateRows.reduce((count, row) => count + row.actualControls.length, 0)
    || ledger.artifact.operationsExercised !== true
  ) {
    throw new Error('Disposition artifact summary drifted from the final PC aggregate')
  }
  const actionableCounts = [
    ['missing', 'THIẾU'],
    ['orphan', 'MỒ CÔI'],
    ['silent', 'IM LẶNG'],
    ['wrongPlace', 'LỆCH VỊ TRÍ'],
  ] as const
  if (actionableCounts.some(([field, mismatch]) => ledger.artifact[field] !== countMismatch(aggregateRows, mismatch))) {
    throw new Error('Actionable mismatch counts do not match the aggregate')
  }
  if (
    ledger.checkpoint.outcome !== 'DEFERRED'
    || ledger.checkpoint.productionCandidates.length !== 0
    || ledger.checkpoint.reason.length === 0
  ) {
    throw new Error('No-PD checkpoint is incomplete')
  }

  const projectedByKey = new Map(unresolvedProjectedRows.map((row) => [projectedGroupKey(row), row]))
  const aggregateByKey = new Map(aggregateRows.map((row) => [pcMeasurementRowKey(row), row]))
  const ledgerIds = new Set<string>()
  const expandedKeys = new Set<string>()

  ledger.groups.forEach((group) => {
    if (!hasText(group.id) || ledgerIds.has(group.id)) throw new Error(`Invalid disposition group id: ${group.id}`)
    ledgerIds.add(group.id)
    const projected = projectedByKey.get(projectedGroupKey(group))
    if (!projected) throw new Error(`${group.id} does not map to a canonical unresolved row`)
    if (group.viewports !== 'ALL-PC-VIEWPORTS') throw new Error(`${group.id} has incomplete viewport scope`)
    assertSameStrings(group.actors, projected.actors, `${group.id} actors`)
    assertSameStrings(group.canonicalUnknown, canonicalUnknownFields(projected), `${group.id} UNKNOWN fields`)
    if (group.canonicalUnknown.length === 0) throw new Error(`${group.id} resolved UNKNOWN without canonical evidence`)
    if (!group.sources.includes(projected.source[0])) throw new Error(`${group.id} is missing canonical source`)
    if (group.sources.some((source) => !/:\d/.test(source))) throw new Error(`${group.id} has a source without file:line`)
    if (
      group.consequence !== UNRESOLVED
      || group.disposition !== 'DEFERRED-CANONICAL-UNKNOWN'
      || group.pdCandidate !== false
    ) {
      throw new Error(`${group.id} guesses a consequence or opens PD`)
    }

    const exclusionNames = ['navigation', 'viewport', 'fixtureCondition', 'roleState'] as const
    exclusionNames.forEach((name) => {
      const exclusion = group.exclusions?.[name]
      if (!exclusion || !hasText(exclusion.evidence)) throw new Error(`${group.id} is missing ${name} exclusion`)
    })
    const expectedRoleStateStatus = projected.registryActor === UNKNOWN ? 'UNRESOLVED' : 'RESOLVED'
    if (
      group.exclusions.navigation.status !== 'RESOLVED'
      || group.exclusions.viewport.status !== 'RESOLVED'
      || group.exclusions.fixtureCondition.status !== 'RESOLVED'
      || group.exclusions.roleState.status !== expectedRoleStateStatus
    ) {
      throw new Error(`${group.id} roleState exclusion does not match canonical actor evidence`)
    }

    if (projected.expectedControl) {
      // The tracked aggregate remains immutable evidence. Current-source line moves
      // are reconciled explicitly instead of rewriting the historical artifact.
      const aggregateControlSource = historicalControlSource.get(projected.expectedControl.source)
        ?? projected.expectedControl.source
      if (
        group.controlEvidence.status !== 'OBSERVED'
        || group.controlEvidence.selector === 'none'
        || group.controlEvidence.source !== aggregateControlSource
      ) {
        throw new Error(`${group.id} has incomplete observed-control evidence`)
      }
    } else if (
      group.controlEvidence.status !== 'ABSENT-AS-PROJECTED'
      || group.controlEvidence.selector !== 'none'
    ) {
      throw new Error(`${group.id} invents a control for an actionless projection`)
    }

    group.actors.forEach((actor) => {
      PC_VIEWPORTS.forEach((viewport) => {
        const key = pcMeasurementRowKey({
          family: group.family,
          scenarioId: group.scenarioId,
          actor,
          viewport,
          operation: group.operation,
        })
        if (expandedKeys.has(key)) throw new Error(`Duplicate disposition identity: ${key}`)
        expandedKeys.add(key)
        const measured = aggregateByKey.get(key)
        if (!measured || measured.mismatch !== UNRESOLVED) {
          throw new Error(`${group.id} has no matching unresolved aggregate row for ${actor}/${viewport.id}`)
        }
        if (group.controlEvidence.status === 'OBSERVED') {
          if (measured.actualControls.length === 0 || measured.actualControls.some((control) => control.source !== group.controlEvidence.source)) {
            throw new Error(`${group.id} control evidence does not match the aggregate`)
          }
        } else if (measured.actualControls.length !== 0) {
          throw new Error(`${group.id} claims projected absence but the aggregate observed a control`)
        }
        const expectedExclusionStatus = {
          navigation: measured.exclusions.navigation.ruledOut ? 'RESOLVED' : 'UNRESOLVED',
          viewport: measured.exclusions.viewport.ruledOut ? 'RESOLVED' : 'UNRESOLVED',
          fixtureCondition: measured.exclusions.fixtureCondition.ruledOut ? 'RESOLVED' : 'UNRESOLVED',
          roleState: measured.exclusions.roleState.ruledOut ? 'RESOLVED' : 'UNRESOLVED',
        }
        for (const name of ['navigation', 'viewport', 'fixtureCondition', 'roleState'] as const) {
          if (group.exclusions[name].status !== expectedExclusionStatus[name]) {
            throw new Error(`${group.id} ${name} exclusion does not match the aggregate`)
          }
        }
        const screenshot = aggregate.screenshots.find((item) => (
          item.kind !== 'family-final'
          && item.viewport === viewport.id
          && item.family === group.family
          && item.scenarioId === group.scenarioId
          && item.actor === actor
        ))
        if (!screenshot || !hasText(screenshot.path)) {
          throw new Error(`${group.id} is missing aggregate screenshot evidence for ${actor}/${viewport.id}`)
        }
      })
    })
  })

  const expectedKeys = unresolvedProjectedRows.flatMap((row) => row.actors.flatMap((actor) => (
    PC_VIEWPORTS.map((viewport) => pcMeasurementRowKey({
      family: row.family,
      scenarioId: row.scenarioId,
      actor,
      viewport,
      operation: row.operation,
    }))
  )))
  const aggregateNonMatchKeys = aggregateRows
    .filter((row) => row.mismatch === UNRESOLVED)
    .map(pcMeasurementRowKey)
  if (expandedKeys.size !== aggregateNonMatchKeys.length) {
    throw new Error(`Disposition identity count is ${expandedKeys.size}, aggregate has ${aggregateNonMatchKeys.length} non-match rows`)
  }
  assertSameStrings([...expandedKeys], expectedKeys, 'Expanded disposition identities')
  assertSameStrings([...expandedKeys], aggregateNonMatchKeys, 'Disposition versus aggregate identities')

  const d01 = ledger.acceptedExceptions.find((item) => item.id === 'D-01')
  if (
    !d01
    || d01.family !== 'WeeklyMenuLifecycle'
    || d01.scenarioId !== 'draft'
    || d01.decision !== 'INTENTIONAL-FE-STRICTER'
    || d01.pdCandidate !== false
    || d01.sources.length === 0
  ) {
    throw new Error('D-01 intentional FE-stricter disposition drifted')
  }
  assertSameStrings(d01.actors, ['manager', 'coordinator'], 'D-01 actors')
}

const validLedger = parseDispositionLedger(dispositionSource)

describe('PC action completeness disposition ledger', () => {
  it('expands compact groups to all 255 canonical unresolved identities', () => {
    expect(unresolvedProjectedRows).toHaveLength(22)
    expect(() => assertDispositionLedger(validLedger)).not.toThrow()
  })

  it('fails when one compact disposition group is omitted', () => {
    const missing = structuredClone(validLedger)
    missing.groups.pop()
    expect(() => assertDispositionLedger(missing)).toThrow('Disposition identity count')
  })

  it('fails when canonical UNKNOWN is treated as resolved', () => {
    const guessed = structuredClone(validLedger)
    guessed.groups[0].canonicalUnknown = []
    guessed.groups[0].exclusions.roleState.status = 'RESOLVED'
    expect(() => assertDispositionLedger(guessed)).toThrow('UNKNOWN fields')
  })

  it('fails when source or one false-missing exclusion is absent', () => {
    const noSource = structuredClone(validLedger)
    noSource.groups[0].sources = []
    expect(() => assertDispositionLedger(noSource)).toThrow('missing canonical source')

    const noViewport = structuredClone(validLedger)
    delete (noViewport.groups[0].exclusions as Partial<LedgerGroup['exclusions']>).viewport
    expect(() => assertDispositionLedger(noViewport)).toThrow('missing viewport exclusion')
  })

  it('locks D-01 as intentional FE-stricter with source fragments', () => {
    expect(weeklyFixtureSource).toContain('manager: { backendAvailable: true, frontendAvailable: false }')
    expect(weeklyFixtureSource).toContain('coordinator: { backendAvailable: true, frontendAvailable: false }')
    expect(adminContractsSource).toContain("handleUpdateScheduleVersion('ACTIVE')")
    expect(appRouterSource).toContain("<RoleGuard requiredPermissions={['*']}")

    const drifted = structuredClone(validLedger)
    const d01Index = drifted.acceptedExceptions.findIndex((item) => item.id === 'D-01')
    expect(d01Index).toBeGreaterThanOrEqual(0)
    drifted.acceptedExceptions[d01Index].decision = 'ALIGN-WITH-BACKEND'
    expect(() => assertDispositionLedger(drifted)).toThrow('D-01 intentional FE-stricter disposition drifted')
  })

  it('keeps disposition artifacts outside production imports', () => {
    const productionSources = import.meta.glob([
      '../src/*.ts',
      '../src/*.tsx',
      '../src/**/*.ts',
      '../src/**/*.tsx',
    ], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>

    expect(Object.entries(productionSources).filter(([, source]) => (
      source.includes('pcActionCompletenessDisposition')
      || source.includes('20-DISPOSITION')
    ))).toEqual([])
  })
})
