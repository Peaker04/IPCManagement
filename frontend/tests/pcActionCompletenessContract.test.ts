import { describe, expect, it } from 'vitest'
import actionToolbarSource from '../src/features/coordination/components/action-toolbar.tsx?raw'
import operationalFamilyManifest from './operationalRegistryFamilyManifest.json'
import { UNKNOWN } from './stateActionRegistryContract'
import {
  assertPcMeasurementRows,
  PC_EVIDENCE_KIND,
  PC_FIXTURE_SAFETY,
  PC_MISMATCH_VALUES,
  PC_VIEWPORTS,
  type PcMeasurementRow,
} from './pcActionCompletenessContract'
import {
  assertUniquePcSourceFragments,
  findProductionPcImports,
} from './pcActionCompletenessSourceGuards'

const ruledOutExclusions = {
  navigation: { ruledOut: true, evidence: 'production route and tab inspected' },
  viewport: { ruledOut: true, evidence: 'all five desktop viewports inspected' },
  fixtureCondition: { ruledOut: true, evidence: 'eligible fixture data supplied' },
  roleState: { ruledOut: true, evidence: 'declared actor and lifecycle state supplied' },
} as const

const createRow = (overrides: Partial<PcMeasurementRow> = {}): PcMeasurementRow => ({
  family: 'CoordinationOrderScopeLifecycle',
  scenarioId: 'draft',
  actor: 'quanly',
  viewport: PC_VIEWPORTS[0],
  operation: 'lock-to-confirmed',
  backendPermission: 'CoordinationAccess',
  frontendPermission: 'canLock + ActionGuard[quanly,dieuphoi]',
  expected: true,
  actualControls: [{
    role: 'button',
    accessibleName: 'Khóa kế hoạch',
    selector: 'role=button[name="Khóa kế hoạch"]',
    source: 'frontend/src/features/coordination/components/action-toolbar.tsx',
    route: '/coordination',
    enabled: true,
    disabledReason: null,
    request: { method: 'POST', path: '/api/coordination/orders/lock', outcome: 'intercepted 200' },
    postAction: 'status rendered as CONFIRMED',
  }],
  exclusions: ruledOutExclusions,
  mismatch: 'KHỚP',
  source: ['registry:CoordinationOrderScopeLifecycle:draft:lock-to-confirmed'],
  disposition: 'rendered control matches the registry operation',
  evidenceKind: PC_EVIDENCE_KIND,
  ...overrides,
})

describe('PC action completeness contract', () => {
  it('locks the five desktop viewports, mismatch vocabulary, and read-only evidence label', () => {
    expect(PC_VIEWPORTS.map(({ id }) => id)).toEqual([
      '1920x1080',
      '1440x900',
      '1366x768',
      '1365x900',
      '1280x900',
    ])
    expect(PC_VIEWPORTS.map(({ width, height }) => `${width}x${height}`)).toEqual([
      '1920x1080',
      '1440x900',
      '1366x768',
      '1365x900',
      '1280x900',
    ])
    expect(PC_MISMATCH_VALUES).toEqual([
      'KHỚP',
      'THIẾU',
      'MỒ CÔI',
      'IM LẶNG',
      'LỆCH VỊ TRÍ',
      'CHƯA-KẾT-LUẬN-ĐƯỢC',
    ])
    expect(PC_FIXTURE_SAFETY).toMatchObject({
      readOnly: true,
      apiInterceptionRequired: true,
      mutableBackendAllowed: false,
      databaseRequired: false,
      evidenceKind: 'FE-fixture-read-only',
    })
  })

  it('accepts one complete normalized row while preserving raw control evidence', () => {
    const rows = [createRow()]

    expect(() => assertPcMeasurementRows(rows)).not.toThrow()
    expect(rows[0].actualControls[0]).toMatchObject({
      accessibleName: 'Khóa kế hoạch',
      enabled: true,
      postAction: 'status rendered as CONFIRMED',
    })
  })

  it('rejects duplicate family×scenario×actor×viewport×operation identities', () => {
    const duplicate = createRow()

    expect(() => assertPcMeasurementRows([duplicate, { ...duplicate }]))
      .toThrow('Duplicate PC measurement row')
  })

  it('rejects incomplete raw control evidence and a false positive match', () => {
    expect(() => assertPcMeasurementRows([createRow({
      actualControls: [{} as PcMeasurementRow['actualControls'][number]],
    })])).toThrow('control 0 has invalid role')

    expect(() => assertPcMeasurementRows([createRow({ actualControls: [] })]))
      .toThrow('cannot be KHỚP when expected and actual presence differ')
  })

  it('rejects THIẾU until all four false-missing causes are ruled out', () => {
    const unresolved = createRow({
      actualControls: [],
      mismatch: 'THIẾU',
      exclusions: {
        ...ruledOutExclusions,
        navigation: { ruledOut: false, evidence: 'another tab has not been inspected yet' },
      },
    })

    expect(() => assertPcMeasurementRows([unresolved]))
      .toThrow('cannot be THIẾU before ruling out: navigation')
    expect(() => assertPcMeasurementRows([createRow({ actualControls: [], mismatch: 'THIẾU' })]))
      .not.toThrow()
  })

  it('rejects UNKNOWN operation, actor, or permission evidence as a positive match', () => {
    const fields: Array<Partial<PcMeasurementRow>> = [
      { operation: UNKNOWN },
      { actor: UNKNOWN },
      { backendPermission: UNKNOWN },
      { frontendPermission: UNKNOWN },
    ]

    fields.forEach((field) => {
      expect(() => assertPcMeasurementRows([createRow(field)]))
        .toThrow(`cannot be KHỚP with ${UNKNOWN} evidence`)
    })

    expect(() => assertPcMeasurementRows([createRow({
      actor: UNKNOWN,
      actualControls: [],
      mismatch: 'CHƯA-KẾT-LUẬN-ĐƯỢC',
      disposition: 'actor source remains unresolved',
    })])).not.toThrow()
  })

  it('guards executable family membership and a real operation-control source fragment', () => {
    const executableFamilies = operationalFamilyManifest.families
      .filter((family) => family.disposition === 'registry')
      .map((family) => family.id)

    expect(executableFamilies).toEqual([
      'ApprovalDocument',
      'CoordinationOrderScopeLifecycle',
      'MaterialDemand',
      'PurchasingWorkflow',
      'WarehouseFulfilment',
      'WeeklyMenuLifecycle',
    ])
    expect(() => assertUniquePcSourceFragments([{
      sourcePath: 'frontend/src/features/coordination/components/action-toolbar.tsx',
      source: actionToolbarSource,
      fragments: [
        "{canLock && <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>",
      ],
    }])).not.toThrow()
    expect(() => assertUniquePcSourceFragments([{
      sourcePath: 'stale-source.tsx',
      source: actionToolbarSource,
      fragments: ['missing-PC-source-fragment'],
    }])).toThrow('must contain exactly one PC source fragment')
  })

  it('keeps the PC contract, source guards, and future fixture outside production imports', () => {
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

    expect(findProductionPcImports(productionSources, [
      'pcActionCompletenessContract',
      'pcActionCompletenessSourceGuards',
      'pcActionCompletenessFixture',
    ])).toEqual([])

    expect(findProductionPcImports({
      '../src/example.ts': "import './pcActionCompletenessContract'",
    }, ['pcActionCompletenessContract'])).toEqual(['../src/example.ts'])
  })
})
