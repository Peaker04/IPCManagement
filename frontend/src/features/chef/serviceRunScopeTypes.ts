import type { components, paths } from '@/shared/api/contracts/schema'

type GeneratedServiceRunScope = NonNullable<paths['/api/service-runs/scope']['get']['parameters']['query']>

export type ServiceRunScope = {
  customerId?: GeneratedServiceRunScope['CustomerId']
  serviceDate: NonNullable<GeneratedServiceRunScope['ServiceDate']>
  shiftName: NonNullable<GeneratedServiceRunScope['ShiftName']>
  priceTierAmount?: GeneratedServiceRunScope['PriceTierAmount']
  allCustomers?: GeneratedServiceRunScope['AllCustomers']
}

export type ServiceRunCommandEnvelope = {
  commandId: string
  expectedVersion: number
  correlationId?: string
  causationId?: string
}

export type ScopedOpenServiceRunRequest = components['schemas']['OpenServiceRunRequest'] & {
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
