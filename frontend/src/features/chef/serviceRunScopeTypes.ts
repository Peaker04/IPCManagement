/** Handwritten Phase 05 scope contract until Wave 3 regenerates OpenAPI clients. */
export type ServiceRunScope = {
  customerId?: string
  serviceDate: string
  shiftName: string
  priceTierAmount?: number
  allCustomers?: boolean
}

export type ServiceRunCommandEnvelope = {
  commandId: string
  expectedVersion: number
  correlationId?: string
  causationId?: string
}

export type ScopedOpenServiceRunRequest = {
  planId: string
  shiftName: string
  customerId: string
  priceTierAmount: number
}

export const isExactServiceRunScope = (scope: ServiceRunScope): scope is ServiceRunScope & {
  customerId: string
  priceTierAmount: number
} => !scope.allCustomers && Boolean(scope.customerId) && scope.priceTierAmount !== undefined

export const describeServiceRunScope = (scope: ServiceRunScope) => scope.allCustomers
  ? 'Tất cả khách hàng · chỉ xem tổng hợp'
  : `${scope.shiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'} · ${scope.serviceDate}`
