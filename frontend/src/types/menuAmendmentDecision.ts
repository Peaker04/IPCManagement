import type { components } from '@/shared/api/contracts/schema'

export type MenuAmendmentDecisionItem = {
  decisionItemId: string
  menuAmendmentId: string
  customerId: string
  customerName: string
  serviceDate: string
  shiftName: string
  priceTierAmount: number | null
  documentIds: readonly string[]
  sourceLineIds: readonly string[]
  reason: string
  accountableRole: string
  dueAt: string
  status: string
  version: number
  allowedActions: readonly string[]
}

export type MenuAmendmentDecisionPage = {
  items: readonly MenuAmendmentDecisionItem[]
  page: number
  pageSize: number
  totalCount: number
}

export type MenuAmendmentDecisionCommand = components['schemas']['MenuAmendmentDecisionCommandRequest']

export const amendmentDecisionStatus = (status: string) => ({
  OPEN: { label: 'Chờ đối soát', tone: 'warning' as const },
  RESOLVED: { label: 'Đã ghi nhận điều chỉnh', tone: 'success' as const },
}[status] ?? { label: status || 'Chưa cập nhật', tone: 'neutral' as const })
