export interface CoordinationStatusSummary {
  status: string
  hasPlans: boolean
  isReadOnly: boolean
  canEditForecast: boolean
  canRequestAdjustment: boolean
  useFinalServings: boolean
}

const LOCKED_STATUSES = new Set(['CONFIRMED', 'ADJUSTED'])
const TERMINAL_STATUSES = new Set(['COMPLETED', 'ARCHIVED', 'CANCELLED'])
const EDITABLE_STATUSES = new Set(['DRAFT', 'FORECASTED'])

export function deriveCoordinationStatus(
  statuses: readonly (string | null | undefined)[],
  loading = false,
): CoordinationStatusSummary {
  if (loading) {
    return {
      status: 'syncing',
      hasPlans: statuses.length > 0,
      isReadOnly: true,
      canEditForecast: false,
      canRequestAdjustment: false,
      useFinalServings: false,
    }
  }

  if (statuses.length === 0) {
    return {
      status: 'empty',
      hasPlans: false,
      isReadOnly: true,
      canEditForecast: false,
      canRequestAdjustment: false,
      useFinalServings: false,
    }
  }

  const normalized = statuses.map((status) => (status ?? '').trim().toUpperCase() || 'DRAFT')
  const allEditable = normalized.every((status) => EDITABLE_STATUSES.has(status))
  const allLocked = normalized.every((status) => LOCKED_STATUSES.has(status))
  const allTerminal = normalized.every((status) => TERMINAL_STATUSES.has(status))
  const allCompletedOrArchived = normalized.every((status) => status === 'COMPLETED' || status === 'ARCHIVED')

  if (allEditable) {
    return {
      status: normalized.some((status) => status === 'FORECASTED') ? 'FORECASTED' : 'DRAFT',
      hasPlans: true,
      isReadOnly: false,
      canEditForecast: true,
      canRequestAdjustment: false,
      useFinalServings: false,
    }
  }

  if (allTerminal && (allCompletedOrArchived || new Set(normalized).size === 1)) {
    return {
      status: normalized.every((status) => status === 'ARCHIVED')
        ? 'ARCHIVED'
        : normalized.every((status) => status === 'CANCELLED')
          ? 'CANCELLED'
          : 'COMPLETED',
      hasPlans: true,
      isReadOnly: true,
      canEditForecast: false,
      canRequestAdjustment: false,
      useFinalServings: true,
    }
  }

  if (allLocked) {
    return {
      status: normalized.some((status) => status === 'ADJUSTED') ? 'ADJUSTED' : 'CONFIRMED',
      hasPlans: true,
      isReadOnly: true,
      canEditForecast: false,
      canRequestAdjustment: true,
      useFinalServings: true,
    }
  }

  if (new Set(normalized).size > 1) {
    return {
      status: 'MIXED',
      hasPlans: true,
      isReadOnly: true,
      canEditForecast: false,
      canRequestAdjustment: false,
      useFinalServings: normalized.some((status) => LOCKED_STATUSES.has(status) || TERMINAL_STATUSES.has(status)),
    }
  }

  const canEditForecast = normalized[0] === 'DRAFT' || normalized[0] === 'FORECASTED'
  return {
    status: normalized[0],
    hasPlans: true,
    isReadOnly: !canEditForecast,
    canEditForecast,
    canRequestAdjustment: false,
    useFinalServings: false,
  }
}
