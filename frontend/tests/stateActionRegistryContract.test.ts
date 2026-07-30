import { describe, expect, it } from 'vitest'
import {
  CORRESPONDENCE_VALUES,
  UNKNOWN,
  assertStateActionRegistryRows,
  type RegistryRow,
} from './stateActionRegistryContract'

const validRow = (overrides: Partial<RegistryRow> = {}): RegistryRow => ({
  object: 'CoordinationOrderScopeLifecycle',
  scenarioId: 'draft-week',
  operation: 'lock',
  scope: 'week',
  entityState: 'DRAFT',
  projectionState: 'DRAFT',
  actor: UNKNOWN,
  backendPermission: 'CoordinationAccess',
  frontendPermission: 'coordination.order.lock',
  source: ['frontend/src/features/coordination/components/action-toolbar.tsx:134-145'],
  correspondence: 'KHỚP',
  ...overrides,
})

describe('state/action registry contract', () => {
  it('exports the approved unknown marker and correspondence vocabulary', () => {
    expect(UNKNOWN).toBe('KHÔNG-XÁC-ĐỊNH-ĐƯỢC')
    expect(CORRESPONDENCE_VALUES).toEqual([
      'KHỚP',
      'FE-CHẶT-HƠN',
      'FE-LỎNG-HƠN',
      'CHỈ-CÓ-Ở-BE',
      'CHỈ-CÓ-Ở-FE',
    ])
  })

  it('rejects duplicate object + scenarioId + operation keys', () => {
    expect(() => assertStateActionRegistryRows([validRow(), validRow()]))
      .toThrow('Duplicate registry row key')
  })

  it('allows identical scenario and operation labels in different objects', () => {
    expect(() => assertStateActionRegistryRows([
      validRow(),
      validRow({ object: 'WeeklyMenuLifecycle' }),
    ])).not.toThrow()
  })

  it('rejects a correspondence value outside the approved vocabulary', () => {
    expect(() => assertStateActionRegistryRows([
      { ...validRow(), correspondence: 'GẦN-GIỐNG' },
    ])).toThrow('invalid correspondence')
  })

  it('rejects an operations-array-shaped row', () => {
    const row: Partial<RegistryRow> & { operations: string[] } = {
      ...validRow(),
      operations: ['lock', 'signoff'],
    }
    delete row.operation

    expect(() => assertStateActionRegistryRows([row])).toThrow('one operation')
  })

  it('proves production source does not import the test-owned contract', () => {
    const productionSources = import.meta.glob([
      '../src/**/*.ts',
      '../src/**/*.tsx',
    ], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>

    const contractImports = Object.entries(productionSources)
      .filter(([file]) => !file.includes('.test.') && !file.includes('.spec.'))
      .filter(([, source]) => source.includes('stateActionRegistryContract'))

    expect(contractImports).toEqual([])
  })
})
