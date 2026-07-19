import { cn } from '@/lib/utils'
import type { WeeklyMenuImportResult } from '../../../coordination/coordinationApi'
import { formatBomTierLabel } from '../../weeklyMenuPlanning'
import {
  formatImportDate,
  formatMenuDishName,
  getShiftLabel,
  getVariantLabel,
  importSlotLabels,
  summarizeImportWarnings,
} from '../model/formatters'
import type {
  ImportDuplicateGroup,
  ImportValidationCheck,
  ImportWizardStep,
  WeeklyMenuImportJob,
  WeeklyMenuImportJobStatus,
} from '../model/types'

const duplicateImportWarningPattern = /dòng trùng/i

export const importWizardSteps: Array<{ key: ImportWizardStep; label: string; hint: string }> = [
  { key: 'upload', label: 'Chọn file', hint: 'Chọn khách hàng, tuần và file Excel' },
  { key: 'validate', label: 'Kiểm tra', hint: 'Xem lỗi ngày, món ăn hoặc dòng trùng' },
  { key: 'commit', label: 'Lưu thực đơn', hint: 'Lưu các file đã kiểm tra xong' },
]

export const getImportJobStatusClass = (status: WeeklyMenuImportJobStatus) =>
  cn(
    'inline-flex min-w-[116px] items-center justify-center rounded border px-2 py-1 text-xs font-bold',
    status === 'committed' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
    status === 'previewed' && 'border-blue-200 bg-blue-50 text-blue-800',
    (status === 'previewing' || status === 'committing') && 'border-amber-200 bg-amber-50 text-amber-800',
    status === 'failed' && 'border-red-200 bg-red-50 text-red-700',
    status === 'idle' && 'border-slate-200 bg-slate-50 text-slate-700',
  )

export const getImportWizardStep = (jobs: WeeklyMenuImportJob[]): ImportWizardStep => {
  if (jobs.some((job) => job.status === 'committed')) return 'commit'
  if (jobs.some((job) => job.status !== 'idle')) return 'validate'
  return 'upload'
}

export const getImportWizardStepClass = (step: ImportWizardStep, activeStep: ImportWizardStep) =>
  cn(
    'rounded-md border px-3 py-2',
    step === activeStep && 'border-blue-300 bg-blue-50 text-blue-900',
    step !== activeStep && 'border-slate-200 bg-white text-slate-600',
  )

export const buildImportDuplicateGroups = (
  rows: WeeklyMenuImportResult['rows'] = [],
): ImportDuplicateGroup[] => {
  const groups = new Map<string, WeeklyMenuImportResult['rows']>()
  rows.forEach((row) => {
    const key = [row.serviceDate, row.dbShiftName, row.variant, row.slot].join('|').toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), row])
  })

  return Array.from(groups.entries())
    .filter(([, groupRows]) => groupRows.length > 1)
    .map(([key, groupRows]) => {
      const first = groupRows[0]
      return {
        key,
        label: `${formatImportDate(first.serviceDate)} ${getShiftLabel(first.dbShiftName)} ${getVariantLabel(first.variant)} / ${first.slotLabel || importSlotLabels[first.slot] || first.slot}`,
        rowCount: groupRows.length,
        locations: groupRows.map((row) => `${row.sourceColumn}${row.sourceRowNumber}: ${formatMenuDishName(row.dishName)}`),
      }
    })
}

export const getBlockingImportIssues = (result?: WeeklyMenuImportResult | null) => {
  if (!result) return []

  const issues = result.validation?.issues
    ?.filter((issue) => issue.severity.toLowerCase() === 'error')
    .map((issue) => issue.message) ?? []
  const duplicateGroups = buildImportDuplicateGroups(result.rows)
  if (duplicateGroups.length > 0 || result.warnings.some((warning) => duplicateImportWarningPattern.test(warning))) {
    issues.push('Có dòng bị trùng trong cùng ngày, ca và vị trí món. Vui lòng sửa file rồi kiểm tra lại.')
  }
  return Array.from(new Set(issues))
}

export const hasBlockingImportIssues = (result?: WeeklyMenuImportResult | null) =>
  getBlockingImportIssues(result).length > 0

export const buildImportValidationChecks = (job?: WeeklyMenuImportJob): ImportValidationCheck[] => {
  if (!job) return [{
    key: 'empty', label: 'Chưa có file', value: 'Chưa chọn',
    detail: 'Thêm ít nhất một file Excel để bắt đầu kiểm tra.', tone: 'neutral',
  }]

  const result = job.previewResult
  const duplicateGroups = buildImportDuplicateGroups(result?.rows ?? [])
  const newDishCount = result?.rows.filter((row) => !row.existingDish).length ?? 0
  const warningCount = result?.validation?.warningCount ?? result?.warnings.length ?? 0
  const errorCount = result?.validation?.errorCount ?? 0
  const weekMatches = !result?.weekStartDate || !job.weekStartDate || result.weekStartDate.startsWith(job.weekStartDate)

  return [
    {
      key: 'template', label: 'File Excel',
      value: result ? `${result.detectedLayout.sheetName || 'Trang tính'} / ${result.detectedLayout.dayColumns.length} ngày` : 'Chưa kiểm tra',
      detail: result ? `${result.detectedLayout.rowsImported} dòng món hợp lệ, ${result.detectedLayout.rowsSkipped} dòng bỏ qua.` : 'Bấm Kiểm tra để đọc file Excel.',
      tone: result ? 'success' : job.status === 'failed' ? 'danger' : 'neutral', blocking: job.status === 'failed' && !result,
    },
    {
      key: 'customer', label: 'Khách hàng',
      value: result ? `${result.customerCode} - ${result.customerName}` : `${job.customerCode} - ${job.customerName}`,
      detail: result ? 'Đã nhận đúng khách hàng đã chọn.' : 'Khách hàng này sẽ dùng cho file vừa chọn.', tone: result ? 'success' : 'neutral',
    },
    {
      key: 'week', label: 'Tuần',
      value: result?.weekStartDate ? `${formatImportDate(result.weekStartDate)} - ${formatImportDate(result.weekEndDate)}` : job.weekStartDate ? formatImportDate(job.weekStartDate) : 'Tự nhận theo file',
      detail: weekMatches ? 'Tuần import đã có mốc ngày rõ ràng.' : 'Tuần trong file khác ngày bắt đầu đã chọn.',
      tone: weekMatches ? (result ? 'success' : 'neutral') : 'danger', blocking: !weekMatches,
    },
    { key: 'price-tier', label: 'Định mức BOM', value: formatBomTierLabel(job.priceTierAmount), detail: 'Áp dụng cho toàn bộ file khi lưu menu.', tone: 'success' },
    {
      key: 'dish', label: 'Món ăn', value: result ? `${result.rows.length - newDishCount} đã có / ${newDishCount} món mới` : 'Chưa kiểm tra',
      detail: newDishCount > 0 ? 'Món mới sẽ được tạo khi lưu; kiểm tra lại tên món.' : 'Các món trong file đã khớp với danh sách món hiện có.',
      tone: !result ? 'neutral' : newDishCount > 0 ? 'warning' : 'success',
    },
    {
      key: 'duplicate', label: 'Dòng trùng', value: result ? `${duplicateGroups.length} nhóm trùng` : 'Chưa kiểm tra',
      detail: duplicateGroups.length > 0 ? duplicateGroups.slice(0, 2).map((group) => `${group.label}: ${group.locations.join(', ')}`).join(' | ') : 'Không thấy dòng trùng cùng ngày/ca/loại/ô món.',
      tone: duplicateGroups.length > 0 || result?.validation?.issues.some((issue) => issue.code === 'DUPLICATE_SLOT') ? 'danger' : result ? 'success' : 'neutral',
      blocking: duplicateGroups.length > 0 || result?.validation?.issues.some((issue) => issue.code === 'DUPLICATE_SLOT'),
    },
    {
      key: 'critical', label: 'Lỗi cần sửa', value: result ? `${errorCount} lỗi` : 'Chưa kiểm tra',
      detail: errorCount > 0 ? result?.validation?.issues.filter((issue) => issue.severity.toLowerCase() === 'error').slice(0, 2).map((issue) => `${issue.cell ?? issue.field ?? issue.code}: ${issue.message}`).join(' | ') ?? 'Có lỗi cần sửa.' : 'Không có lỗi bắt buộc sửa; file có thể lưu nếu các mục khác ổn.',
      tone: errorCount > 0 ? 'danger' : result ? 'success' : 'neutral', blocking: errorCount > 0,
    },
    {
      key: 'warnings', label: 'Nhắc nhở', value: result ? `${warningCount} nhắc nhở` : 'Chưa kiểm tra',
      detail: warningCount > 0 ? summarizeImportWarnings(result?.warnings ?? []).slice(0, 2).join(' | ') : 'Không có nhắc nhở.',
      tone: warningCount > 0 ? 'warning' : result ? 'success' : 'neutral',
    },
  ]
}
