import { deriveCoordinationStatus } from '../src/features/coordination/coordinationStatus'

export const COORDINATION_ENTITY_STATES = [
  'DRAFT',
  'FORECASTED',
  'CONFIRMED',
  'ADJUSTED',
  'COMPLETED',
  'ARCHIVED',
  'CANCELLED',
] as const

export type CoordinationEntityState = typeof COORDINATION_ENTITY_STATES[number]
export type CoordinationQueryState = 'ready' | 'loading'
export type CoordinationPresentationState = 'ready' | 'empty' | 'syncing'
export type CoordinationScopeKind = 'week' | 'service-date' | 'shift' | 'document' | 'source-line'

export type CoordinationScope = {
  kind: CoordinationScopeKind
  value: string
}

export type CoordinationScenario = {
  object: 'CoordinationOrderScopeLifecycle'
  scenarioId: string
  scope: CoordinationScope
  entityState: readonly CoordinationEntityState[]
  queryState: CoordinationQueryState
  presentationState: CoordinationPresentationState
  projectionState: ReturnType<typeof deriveCoordinationStatus>
}

type CoordinationScenarioInput = Omit<
  CoordinationScenario,
  'object' | 'presentationState' | 'projectionState'
>

const validEntityStates = new Set<string>(COORDINATION_ENTITY_STATES)

export const createCoordinationScenario = (
  input: CoordinationScenarioInput,
): CoordinationScenario => {
  const invalidState = input.entityState.find((state) => !validEntityStates.has(state))
  if (invalidState !== undefined) {
    throw new Error(`Invalid Coordination entity state: ${invalidState}`)
  }

  const projectionState = deriveCoordinationStatus(
    input.entityState,
    input.queryState === 'loading',
  )
  const presentationState: CoordinationPresentationState = input.queryState === 'loading'
    ? 'syncing'
    : input.entityState.length === 0
      ? 'empty'
      : 'ready'

  return {
    ...input,
    object: 'CoordinationOrderScopeLifecycle',
    presentationState,
    projectionState,
  }
}

const shiftScope = {
  kind: 'shift',
  value: '2026-07-27|MORNING',
} as const

const scenario = (
  scenarioId: string,
  entityState: readonly CoordinationEntityState[],
  queryState: CoordinationQueryState = 'ready',
): CoordinationScenario => createCoordinationScenario({
  scenarioId,
  scope: shiftScope,
  entityState,
  queryState,
})

export const coordinationOrderScopeLifecycleScenarios: readonly CoordinationScenario[] = [
  scenario('draft', ['DRAFT']),
  scenario('forecasted', ['FORECASTED']),
  scenario('confirmed', ['CONFIRMED']),
  scenario('adjusted', ['ADJUSTED']),
  scenario('completed', ['COMPLETED']),
  scenario('archived', ['ARCHIVED']),
  scenario('cancelled', ['CANCELLED']),
  scenario('mixed-confirmed-completed', ['CONFIRMED', 'COMPLETED']),
  scenario('empty', []),
  scenario('loading-draft', ['DRAFT'], 'loading'),
]
