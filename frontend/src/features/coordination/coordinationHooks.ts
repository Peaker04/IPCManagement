import { useSelector } from 'react-redux'

import type { AuthState } from '@/lib/auth/authTypes'
import type { CoordinationState } from './types'

type CoordinationStoreState = {
  auth: AuthState
  coordination: CoordinationState
}

export const useCoordinationSelector = useSelector.withTypes<CoordinationStoreState>()

export const useCoordinationState = () =>
  useCoordinationSelector((state) => state.coordination)

export const useOrders = () =>
  useCoordinationSelector((state) => state.coordination.orders)

export const useCurrentShift = () =>
  useCoordinationSelector((state) => state.coordination.currentShift)

export const useIsLocked = () =>
  useCoordinationSelector((state) => state.coordination.isLocked)

export const useAuditLogs = () =>
  useCoordinationSelector((state) => state.coordination.auditLogs)

export const useLoading = () =>
  useCoordinationSelector((state) => state.coordination.loading)

export const useError = () =>
  useCoordinationSelector((state) => state.coordination.error)
