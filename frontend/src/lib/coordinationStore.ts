import { useSelector } from 'react-redux'

import type { OrderRow, WeeklyMenuState } from '@/types/coordination'

export interface CoordinationStoreProjection {
  coordination: {
    orders: OrderRow[]
    weeklyMenu: WeeklyMenuState
    lossRate: number
    lockedShifts: Record<string, boolean>
  }
}

export const useCoordinationStoreSelector = useSelector.withTypes<CoordinationStoreProjection>()
