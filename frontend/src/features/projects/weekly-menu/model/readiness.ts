export type WeeklyMenuReadinessTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type WeeklyMenuCheckpointState = 'complete' | 'pending' | 'warning' | 'danger'

export type WeeklyMenuReadinessInput = {
  hasSelectedCustomer: boolean
  isSyncing: boolean
  hasCatalogIssue: boolean
  hasDemandIssue: boolean
  menuCount: number
  missingServingCount: number
  missingBomCount: number
  invalidBomTierCount: number
  demandMaterialCount: number
  demandShortageCount: number
}

export type WeeklyMenuReadinessCheckpoint = {
  key: 'menu' | 'servings' | 'bom' | 'demand'
  label: string
  value: string
  state: WeeklyMenuCheckpointState
}

export type WeeklyMenuReadiness = {
  label: string
  detail: string
  tone: WeeklyMenuReadinessTone
  checkpoints: WeeklyMenuReadinessCheckpoint[]
}

const checkpointState = (hasData: boolean, hasIssue: boolean, severity: 'warning' | 'danger') => {
  if (hasIssue) return severity
  return hasData ? 'complete' : 'pending'
}

export function buildWeeklyMenuReadiness(input: WeeklyMenuReadinessInput): WeeklyMenuReadiness {
  const {
    hasSelectedCustomer,
    isSyncing,
    hasCatalogIssue,
    hasDemandIssue,
    menuCount,
    missingServingCount,
    missingBomCount,
    invalidBomTierCount,
    demandMaterialCount,
    demandShortageCount,
  } = input

  const bomIssueParts = [
    missingBomCount > 0 ? `${missingBomCount} món chưa có BOM` : '',
    invalidBomTierCount > 0 ? `${invalidBomTierCount} ca sai đơn giá` : '',
  ].filter(Boolean)

  const checkpoints: WeeklyMenuReadinessCheckpoint[] = [
    {
      key: 'menu',
      label: 'Thực đơn',
      value: menuCount > 0 ? `${menuCount} dòng món` : 'Chưa có dữ liệu',
      state: checkpointState(menuCount > 0, false, 'warning'),
    },
    {
      key: 'servings',
      label: 'Số lượng khách',
      value: missingServingCount > 0 ? `${missingServingCount} dòng chưa chốt suất` : menuCount > 0 ? 'Đã chốt đủ' : 'Chưa kiểm tra',
      state: checkpointState(menuCount > 0, missingServingCount > 0, 'warning'),
    },
    {
      key: 'bom',
      label: 'BOM & định mức',
      value: bomIssueParts.length > 0 ? bomIssueParts.join(' · ') : menuCount > 0 ? `${menuCount}/${menuCount} món` : 'Chưa kiểm tra',
      state: checkpointState(menuCount > 0, bomIssueParts.length > 0, 'danger'),
    },
    {
      key: 'demand',
      label: 'Nhu cầu theo ngày',
      value: hasDemandIssue
        ? 'Không tải được'
        : demandMaterialCount > 0
          ? demandShortageCount > 0
            ? `Thiếu ${demandShortageCount}/${demandMaterialCount} dòng`
            : `Đủ ${demandMaterialCount}/${demandMaterialCount} dòng`
          : 'Chưa tính',
      state: checkpointState(demandMaterialCount > 0, hasDemandIssue || demandShortageCount > 0, 'danger'),
    },
  ]

  if (!hasSelectedCustomer) {
    return { label: 'Chọn khách hàng để bắt đầu', detail: 'Chưa xác định phạm vi thực đơn tuần.', tone: 'neutral', checkpoints }
  }
  if (isSyncing) {
    return { label: 'Đang đồng bộ dữ liệu tuần', detail: 'Hệ thống đang tải thực đơn, suất ăn, danh mục BOM và nhu cầu theo ngày.', tone: 'info', checkpoints }
  }
  if (hasCatalogIssue) {
    return { label: 'Thiếu dữ liệu danh mục món', detail: 'Kiểm tra danh mục trước khi phân tích BOM và giá vốn.', tone: 'warning', checkpoints }
  }
  if (hasDemandIssue) {
    return { label: 'Không tải được nhu cầu theo ngày', detail: 'Không thể xác nhận trạng thái thiếu/đủ của tuần. Hãy tải lại trước khi tiếp tục thu mua.', tone: 'danger', checkpoints }
  }
  if (menuCount === 0) {
    return { label: 'Chưa có thực đơn tuần', detail: 'Nhập Excel hoặc chỉnh sửa thực đơn để tiếp tục.', tone: 'warning', checkpoints }
  }
  if (bomIssueParts.length > 0) {
    return { label: 'Chưa thể tính nhu cầu', detail: bomIssueParts.join(' · '), tone: 'danger', checkpoints }
  }
  if (missingServingCount > 0) {
    return { label: 'Cần bổ sung số lượng khách', detail: `${missingServingCount} dòng món chưa có số suất vận hành.`, tone: 'warning', checkpoints }
  }
  if (demandMaterialCount === 0) {
    return { label: 'Sẵn sàng tính nhu cầu', detail: 'Thực đơn, số lượng khách và BOM đã đầy đủ.', tone: 'info', checkpoints }
  }
  if (demandShortageCount > 0) {
    return { label: 'Còn nguyên liệu cần xử lý', detail: `${demandShortageCount}/${demandMaterialCount} dòng ngày–nguyên liệu chưa được đáp ứng theo lifecycle.`, tone: 'warning', checkpoints }
  }
  return { label: 'Vật tư tuần đã được đáp ứng', detail: `${demandMaterialCount}/${demandMaterialCount} dòng ngày–nguyên liệu đã hoàn tất cấp phát.`, tone: 'success', checkpoints }
}
