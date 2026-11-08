import { describe, expect, it } from 'vitest'
import {
  coordinationOrderScopeLifecycleScenarios,
  createCoordinationScenario,
  type CoordinationEntityState,
} from './coordinationOrderScopeLifecycleFixture'

const scenarioById = (scenarioId: string) => {
  const scenario = coordinationOrderScopeLifecycleScenarios.find((candidate) => (
    candidate.scenarioId === scenarioId
  ))
  if (!scenario) {
    throw new Error(`Missing Coordination scenario: ${scenarioId}`)
  }
  return scenario
}

describe('CoordinationOrderScopeLifecycle fixture', () => {
  it('keeps stable scenario IDs and explicit scope kind/value', () => {
    expect(coordinationOrderScopeLifecycleScenarios.map(({ scenarioId }) => scenarioId)).toEqual([
      'draft',
      'forecasted',
      'confirmed',
      'adjusted',
      'completed',
      'archived',
      'cancelled',
      'mixed-confirmed-completed',
      'empty',
      'loading-draft',
    ])
    expect(new Set(coordinationOrderScopeLifecycleScenarios.map(({ scenarioId }) => scenarioId)).size)
      .toBe(coordinationOrderScopeLifecycleScenarios.length)
    expect(coordinationOrderScopeLifecycleScenarios.every(({ scope }) => (
      scope.kind === 'shift' && scope.value === '2026-07-27|MORNING'
    ))).toBe(true)
  })

  it('preserves divergent raw entity evidence when the imported projection is MIXED', () => {
    const mixed = scenarioById('mixed-confirmed-completed')

    expect(mixed.entityState).toEqual(['CONFIRMED', 'COMPLETED'])
    expect(mixed.projectionState.status).toBe('MIXED')
    expect(mixed.entityState).not.toContain('MIXED')
  })

  it('types query and presentation states separately from entity lifecycle', () => {
    const empty = scenarioById('empty')
    const loading = scenarioById('loading-draft')

    expect(empty.entityState).toEqual([])
    expect(empty.queryState).toBe('ready')
    expect(empty.presentationState).toBe('empty')
    expect(empty.projectionState.status).toBe('empty')

    expect(loading.entityState).toEqual(['DRAFT'])
    expect(loading.queryState).toBe('loading')
    expect(loading.presentationState).toBe('syncing')
    expect(loading.projectionState.status).toBe('syncing')
  })

  it('rejects query or loading markers supplied as entity state', () => {
    const invalidEntityState = ['loading'] as unknown as readonly CoordinationEntityState[]

    expect(() => createCoordinationScenario({
      scenarioId: 'invalid-query-state',
      scope: { kind: 'shift', value: '2026-07-27|MORNING' },
      entityState: invalidEntityState,
      queryState: 'ready',
    })).toThrow('Invalid Coordination entity state: loading')
  })

  it('remains test-owned and absent from production imports', () => {
    const productionSources = import.meta.glob([
      '../src/**/*.ts',
      '../src/**/*.tsx',
    ], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>

    const fixtureImports = Object.entries(productionSources)
      .filter(([file]) => !file.includes('.test.'))
      .filter(([, source]) => source.includes('coordinationOrderScopeLifecycleFixture'))

    expect(fixtureImports).toEqual([])
  })
})
