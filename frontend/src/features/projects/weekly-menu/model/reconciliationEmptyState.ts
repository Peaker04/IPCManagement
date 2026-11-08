export type ReconciliationScheduleEmptyAction = 'customer' | 'week'

export type ReconciliationScheduleEmptyState = {
  title: string
  description: string
  actionLabel: string
  action: ReconciliationScheduleEmptyAction
}

export function getReconciliationScheduleEmptyState({
  customerId,
  weekStartDate,
  isMenuReady,
  rowCount,
}: {
  customerId: string
  weekStartDate: string
  isMenuReady: boolean
  rowCount: number
}): ReconciliationScheduleEmptyState | null {
  if (!customerId) return {
    title: 'Chưa chọn khách hàng',
    description: 'Chọn khách hàng để tải đúng kế hoạch tuần và định lượng nguyên liệu.',
    actionLabel: 'Chọn khách hàng',
    action: 'customer',
  }

  if (!weekStartDate) return {
    title: 'Chưa chọn tuần bắt đầu',
    description: 'Chọn ngày bắt đầu tuần để giữ cùng một phạm vi từ kế hoạch đến xuất kho.',
    actionLabel: 'Chọn tuần bắt đầu',
    action: 'week',
  }

  if (isMenuReady && rowCount === 0) return {
    title: 'Chưa có kế hoạch tuần cho phạm vi đã chọn',
    description: 'Khách hàng và tuần này chưa có thực đơn đã được nhập. Chọn phạm vi khác hoặc hoàn tất nguồn thực đơn trước khi tính định lượng.',
    actionLabel: 'Chọn phạm vi khác',
    action: 'customer',
  }

  return null
}
