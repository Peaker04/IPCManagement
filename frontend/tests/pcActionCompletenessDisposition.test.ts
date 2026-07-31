import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import adminContractsSource from '../src/app/pages/admin-data/AdminContractsPanel.tsx?raw'
import appRouterSource from '../src/routes/AppRouter.tsx?raw'
import weeklyFixtureSource from './weekly-menu-lifecycle-pa2b-fixture.ts?raw'
import {
  PC_VIEWPORTS,
  pcMeasurementRowKey,
} from './pcActionCompletenessContract'
import {
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

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dispositionSource = readFileSync(resolve(
  REPO_ROOT,
  '.planning',
  'phases',
  '20-pc-pd-action-completeness',
  '20-DISPOSITION.md',
), 'utf8').replace(/\r\n/g, '\n')

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

const assertSameStrings = (actual: readonly string[], expected: readonly string[], label: string) => {
  if (JSON.stringify(sorted(actual)) !== JSON.stringify(sorted(expected))) {
    throw new Error(`${label} does not match its canonical projection`)
  }
}

const assertDispositionLedger = (ledger: DispositionLedger) => {
  if (ledger.schemaVersion !== 1) throw new Error('Unsupported disposition schema')
  if (
    ledger.artifact.evidenceKind !== 'FE-fixture-read-only'
    || ledger.artifact.measurementRows !== 535
    || ledger.artifact.matched !== 280
    || ledger.artifact.unresolved !== 255
    || ledger.artifact.controlsObserved !== 360
    || ledger.artifact.operationsExercised !== false
  ) {
    throw new Error('Disposition artifact summary drifted from the final PC aggregate')
  }
  if ([
    ledger.artifact.missing,
    ledger.artifact.orphan,
    ledger.artifact.silent,
    ledger.artifact.wrongPlace,
  ].some((count) => count !== 0)) {
    throw new Error('Actionable mismatch count must remain zero for this ledger')
  }
  if (
    ledger.checkpoint.outcome !== 'DEFERRED'
    || ledger.checkpoint.productionCandidates.length !== 0
    || ledger.checkpoint.reason.length === 0
  ) {
    throw new Error('No-PD checkpoint is incomplete')
  }

  const projectedByKey = new Map(unresolvedProjectedRows.map((row) => [projectedGroupKey(row), row]))
  const ledgerIds = new Set<string>()
  const expandedKeys = new Set<string>()

  ledger.groups.forEach((group) => {
    if (!group.id || ledgerIds.has(group.id)) throw new Error(`Invalid disposition group id: ${group.id}`)
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
      if (!exclusion || !exclusion.evidence) throw new Error(`${group.id} is missing ${name} exclusion`)
    })
    if (
      group.exclusions.navigation.status !== 'RESOLVED'
      || group.exclusions.viewport.status !== 'RESOLVED'
      || group.exclusions.fixtureCondition.status !== 'RESOLVED'
      || group.exclusions.roleState.status !== 'UNRESOLVED'
    ) {
      throw new Error(`${group.id} resolves an UNKNOWN role/permission condition`)
    }

    if (projected.expectedControl) {
      if (
        group.controlEvidence.status !== 'OBSERVED'
        || group.controlEvidence.selector === 'none'
        || group.controlEvidence.source !== projected.expectedControl.source
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
  if (expandedKeys.size !== 255) throw new Error(`Disposition identity count is ${expandedKeys.size}, expected 255`)
  assertSameStrings([...expandedKeys], expectedKeys, 'Expanded disposition identities')

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
    drifted.acceptedExceptions[0].decision = 'ALIGN-WITH-BACKEND'
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
