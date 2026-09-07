import { AUDIT_PASSWORD_CHANGED_VALUE, AUDIT_REDACTED_VALUE, containsSensitiveAuditMaterial, isPasswordAuditTuple } from '@/api/auditPrivacy'
import { formatDateOnly, formatDateTime, formatQuantityWithUnit, formatUnit, getNumberFormat } from '@/lib/formatters'
import { formatShiftName } from '@/lib/workflowConfig'

const labels: Record<string, string> = {
  DEFAULT: 'Vận hành thông thường', MATERIAL_RECONCILIATION: 'Đối chiếu nguyên liệu',
  DRAFT: 'Đang chuẩn bị', READY: 'Sẵn sàng chuyển Kho', TRANSFERRED: 'Chờ Kho xác nhận xuất',
  ISSUED: 'Đã tạo phiếu xuất', IN_PROGRESS: 'Đang đối chiếu', COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy', PENDING: 'Chờ xử lý', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối',
  ACTIVE: 'Đang áp dụng', FORECASTED: 'Dự kiến', REVIEWING: 'Đang kiểm tra',
  ROLLED_BACK: 'Đã hoàn tác', INVALIDATED: 'Đã mất hiệu lực', RESOLVED: 'Đã xử lý',
  POSTED: 'Đã ghi sổ', SUBMITTED: 'Đã gửi duyệt', ACCEPTED_VARIANCE: 'Chấp nhận chênh lệch',
  CORRECTION_REQUIRED: 'Cần điều chỉnh số liệu', FOLLOW_UP_REQUIRED: 'Cần theo dõi thêm', MORNING: 'Ca sáng', AFTERNOON: 'Ca chiều',
  FULLDAY: 'Cả ngày', Kilogram: 'Kilôgam', Gram: 'Gam', Liter: 'Lít',
}

const technicalId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fingerprint = /^[0-9a-f]{40,}$/i
const technicalToken = /^[A-Z][A-Z0-9_]{2,}$/

export interface AuditPresentationContext {
  businessArea: string
  entityName: string
  fieldName: string
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
}

export type AuditValueDisposition = 'formatted' | 'disclosure' | 'fallback' | 'empty'

export interface AuditPresentation {
  action: string
  before: string
  after: string
  reason: string
  technicalTuple: string
  oldValueTitle?: string
  newValueTitle?: string
  reasonTitle?: string
  beforeDisposition: AuditValueDisposition
  afterDisposition: AuditValueDisposition
  reasonDisposition: AuditValueDisposition
}

type AuditFamily = 'operation-mode' | 'weekly-menu' | 'servings' | 'bom' | 'demand' | 'purchasing' | 'receipt' | 'issue' | 'stock' | 'kitchen-service' | 'reconciliation' | 'admin-security' | 'data-quality'

type ValueResult = { text: string; disposition: AuditValueDisposition; title?: string }
type FamilyDefinition = { family: AuditFamily; action: string; format?: (value: string | null | undefined, slot: 'before' | 'after') => ValueResult }

const tupleKey = (businessArea: string, entityName: string, fieldName: string) => [businessArea, entityName, fieldName].map((part) => part.trim().toLocaleLowerCase('en-US')).join('|')
const tupleRegistry = new Map<string, FamilyDefinition>()

const register = (definition: FamilyDefinition, tuples: ReadonlyArray<readonly [string, string, string]>) => {
  for (const tuple of tuples) {
    const key = tupleKey(...tuple)
    if (tupleRegistry.has(key)) throw new Error(`Duplicate audit tuple registration: ${key}`)
    tupleRegistry.set(key, definition)
  }
}

const emptyValue = (): ValueResult => ({ text: '—', disposition: 'empty' })
const disclosure = (raw: string, label = 'Thông tin kỹ thuật được lưu trong chi tiết'): ValueResult => ({ text: label, disposition: 'disclosure', title: raw })
const fallback = (raw: string, label = 'Dữ liệu chưa được chuẩn hóa'): ValueResult => ({ text: label, disposition: 'fallback', title: raw })
const formatted = (text: string, raw?: string): ValueResult => ({ text, disposition: 'formatted', title: raw })

const getTrimmed = (value?: string | null) => value?.trim() ?? ''
const formatNumber = (value: string | number) => getNumberFormat('vi-VN', { maximumFractionDigits: 6 }).format(Number(value))
const parseFinite = (value: string) => {
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
const isIsoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3])
}
const isIsoDateTime = (value: string) => !Number.isNaN(Date.parse(value))

const parseEntries = (value: string) => {
  const entries: Record<string, string> = {}
  for (const segment of value.split(';')) {
    const index = segment.indexOf('=')
    if (index <= 0) return undefined
    const key = segment.slice(0, index).trim()
    const entryValue = segment.slice(index + 1).trim()
    if (!key || !entryValue || key in entries) return undefined
    entries[key] = entryValue
  }
  return entries
}

const formatStatusValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  if (labels[raw]) return formatted(labels[raw], raw)
  if (technicalId.test(raw) || fingerprint.test(raw)) return disclosure(raw)
  if (technicalToken.test(raw)) return fallback(raw, 'Trạng thái chưa được chuẩn hóa')
  return formatted(raw, raw)
}

const formatGenericValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  if (labels[raw]) return formatted(labels[raw], raw)
  if (technicalId.test(raw) || fingerprint.test(raw)) return disclosure(raw)
  if (technicalToken.test(raw)) return fallback(raw, 'Giá trị chưa được chuẩn hóa')
  if (/^[{[]/.test(raw) || (raw.includes(';') && raw.includes('='))) return fallback(raw)
  return formatted(raw, raw)
}

const formatWeeklyValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const range = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})\|(.+)$/.exec(raw)
  if (range) {
    if (!isIsoDate(range[1]) || !isIsoDate(range[2])) return fallback(raw, 'Phạm vi thực đơn không hợp lệ')
    const status = formatStatusValue(range[3])
    if (status.disposition === 'fallback') return fallback(raw, 'Trạng thái thực đơn chưa được chuẩn hóa')
    return formatted(`${formatDateOnly(range[1])} – ${formatDateOnly(range[2])} · ${status.text}`, raw)
  }
  return formatStatusValue(raw)
}

const formatMenuImportValue = (value: string | null | undefined, slot: 'before' | 'after'): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  if (slot === 'before') return formatGenericValue(raw)
  const match = /^(.+?)\s+-\s+([A-Z][A-Z0-9_]*)$/.exec(raw)
  if (!match) return fallback(raw, 'Kết quả nhập thực đơn không hợp lệ')
  const status = formatStatusValue(match[2])
  if (status.disposition === 'fallback') return fallback(raw, 'Trạng thái nhập thực đơn chưa được chuẩn hóa')
  return formatted(`${match[1].trim()} · ${status.text}`, raw)
}

const formatServingValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const payload = /^(\d{4}-\d{2}-\d{2})\|(MORNING|AFTERNOON)\|(.+)$/.exec(raw)
  if (payload) {
    const servings = parseFinite(payload[3])
    if (!isIsoDate(payload[1]) || servings === undefined || servings < 0) return fallback(raw, 'Dữ liệu số suất không hợp lệ')
    return formatted(`${formatDateOnly(payload[1])} · ${formatShiftName(payload[2])} · ${formatNumber(servings)} suất`, raw)
  }
  const number = parseFinite(raw)
  if (number !== undefined) return formatted(`${formatNumber(number)} suất`, raw)
  return formatStatusValue(raw)
}

const formatIssueValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const payload = /^(ISS-[A-Z0-9-]+)\s*-\s*(.+)$/i.exec(raw)
  if (payload) {
    const quantity = parseFinite(payload[2])
    return quantity === undefined || quantity < 0
      ? fallback(raw, 'Dữ liệu phiếu xuất không hợp lệ')
      : formatted(`${payload[1]} · thực xuất ${formatNumber(quantity)}`, raw)
  }
  const quantity = parseFinite(raw)
  if (quantity !== undefined) return formatted(formatNumber(quantity), raw)
  return formatStatusValue(raw)
}

const formatReasonValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const issueDate = /^Ngày xuất\s+(\d{4}-\d{2}-\d{2})$/i.exec(raw)
  if (issueDate) return isIsoDate(issueDate[1]) ? formatted(`Xuất kho ngày ${formatDateOnly(issueDate[1])}`, raw) : fallback(raw, 'Ngày xuất không hợp lệ')
  return formatGenericValue(raw)
}

const formatReceiptValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const receivedAt = /^receivedAt=(.+)$/.exec(raw)
  if (receivedAt) return isIsoDateTime(receivedAt[1]) ? formatted(`Đã ghi nhận lúc ${formatDateTime(receivedAt[1])}`, raw) : fallback(raw, 'Thời điểm ghi nhận không hợp lệ')
  return formatStatusValue(raw)
}

const formatShortageValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const entries = parseEntries(raw)
  if (!entries || !entries.ingredient || !entries.required || !entries.available || !entries.missing || !entries.unit) return fallback(raw, 'Dữ liệu thiếu tồn kho không hợp lệ')
  const required = parseFinite(entries.required)
  const available = parseFinite(entries.available)
  const missing = parseFinite(entries.missing)
  if (required === undefined || available === undefined || missing === undefined || required < 0 || available < 0 || missing < 0 || (entries.date && !isIsoDate(entries.date))) return fallback(raw, 'Dữ liệu thiếu tồn kho không hợp lệ')
  const unit = formatUnit(entries.unit)
  return formatted(`${entries.ingredient}: cần ${formatQuantityWithUnit(required, unit, { maximumFractionDigits: 6 })}, hiện có ${formatQuantityWithUnit(available, unit, { maximumFractionDigits: 6 })}, thiếu ${formatQuantityWithUnit(missing, unit, { maximumFractionDigits: 6 })}`, raw)
}

const formatDemandValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const match = /^(\d+) demand lines; (\d+) missing BOM dishes; (\d+) missing unit conversions$/i.exec(raw)
  return match
    ? formatted(`${formatNumber(match[1])} dòng nhu cầu · ${formatNumber(match[2])} món thiếu BOM · ${formatNumber(match[3])} đơn vị chưa quy đổi`, raw)
    : formatStatusValue(raw)
}

const formatBomValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const segments = raw.split(';')
  const batch = segments.shift()?.trim() ?? ''
  const entries = parseEntries(segments.join(';'))
  const requiredKeys = ['created', 'updated', 'archived', 'rows', 'tier', 'scope']
  if (!batch || !entries || requiredKeys.some((key) => !(key in entries))) return fallback(raw, 'Kết quả nhập BOM không hợp lệ')
  const created = parseFinite(entries.created)
  const updated = parseFinite(entries.updated)
  const archived = parseFinite(entries.archived)
  const rows = parseFinite(entries.rows)
  const tier = parseFinite(entries.tier)
  if ([created, updated, archived, rows, tier].some((number) => number === undefined || number! < 0)) return fallback(raw, 'Kết quả nhập BOM không hợp lệ')
  return formatted(`${batch} · tạo ${formatNumber(created!)} · cập nhật ${formatNumber(updated!)} · lưu trữ ${formatNumber(archived!)} · ${formatNumber(rows!)} dòng · mức giá ${formatNumber(tier!)} · phạm vi ${labels[entries.scope] ?? entries.scope}`, raw)
}

const formatReconciliationValidity = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  if (labels[raw]) return formatted(labels[raw], raw)
  const match = /^([^|]+)\|([^|]+)\|v(\d+)$/.exec(raw)
  if (!match) return fallback(raw, 'Dữ liệu xử lý chênh lệch không hợp lệ')
  const category = labels[match[1].trim()]
  if (!category) return fallback(raw, 'Loại xử lý chênh lệch chưa được chuẩn hóa')
  return formatted(`${category} · ${match[2].trim()} · phiên bản ${formatNumber(match[3])}`, raw)
}

const formatQuantityImportValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const match = /^(.+?)\s+-\s+([A-Z][A-Z0-9_]*);\s*(\d+) plans$/i.exec(raw)
  if (!match) return fallback(raw, 'Kết quả nhập số suất không hợp lệ')
  const status = formatStatusValue(match[2].toUpperCase())
  if (status.disposition === 'fallback') return fallback(raw, 'Trạng thái nhập số suất chưa được chuẩn hóa')
  return formatted(`${match[1].trim()} · ${status.text} · ${formatNumber(match[3])} kế hoạch`, raw)
}

const formatDataQualityValue = (value?: string | null): ValueResult => {
  const raw = getTrimmed(value)
  if (!raw) return emptyValue()
  const number = parseFinite(raw)
  if (number !== undefined) return formatted(formatNumber(number), raw)
  return formatStatusValue(raw)
}

register({ family: 'operation-mode', action: 'Thay đổi chế độ vận hành', format: formatStatusValue }, [
  ['SYSTEM_OPERATION', 'SystemOperationMode', 'Mode'],
])
register({ family: 'weekly-menu', action: 'Cập nhật thực đơn tuần', format: formatWeeklyValue }, [
  ['MenuVersion', 'MenuSchedule', 'Status'], ['MenuVersion', 'MenuVersion', 'Status'], ['MenuVersion', 'MenuVersion', 'EffectiveRange'],
  ['Menu', 'MenuVersion', 'Status'], ['MenuVersion', 'MenuItem', 'MenuItem.DishId'],
])
register({ family: 'weekly-menu', action: 'Nhập thực đơn tuần', format: formatMenuImportValue }, [
  ['Import', 'MenuVersion', 'WeeklyMenu'],
])
register({ family: 'servings', action: 'Cập nhật số suất', format: formatServingValue }, [
  ['Coordination', 'MealQuantityPlan', 'QuickForecastServings'], ['Coordination', 'MealQuantityPlanLine', 'forecastServings'],
  ['Coordination', 'MealQuantityPlanLine', 'finalServings'], ['Số suất', 'MealQuantityPlanLine', 'FinalServings'],
])
register({ family: 'servings', action: 'Hoàn tất số suất', format: formatServingValue }, [
  ['Coordination', 'MealQuantityPlan', 'QuickCompleteServings'], ['Coordination', 'MealQuantityPlan', 'Status'],
  ['Signoff', 'MealQuantityPlan', 'Status'],
])
register({ family: 'servings', action: 'Nhập kế hoạch số suất', format: formatQuantityImportValue }, [
  ['Import', 'QuantityImportBatch', 'API'],
])
register({ family: 'bom', action: 'Nhập định lượng món ăn', format: formatBomValue }, [
  ['BOM', 'DishBom', 'BulkImport'],
])
register({ family: 'bom', action: 'Cam kết định lượng' }, [
  ['Reconciliation', 'QuantityImportBatch', 'Commit'],
])
register({ family: 'demand', action: 'Tạo nhu cầu nguyên liệu', format: formatDemandValue }, [
  ['Demand', 'MaterialRequest', 'Generate'],
])
register({ family: 'demand', action: 'Tính lại nhu cầu nguyên liệu', format: formatDemandValue }, [
  ['Demand', 'MaterialRequest', 'Recalculate'],
])
register({ family: 'demand', action: 'Cập nhật nhu cầu nguyên liệu', format: formatStatusValue }, [
  ['Demand', 'MaterialRequest', 'Status'], ['InventoryIssue', 'MaterialRequest', 'Status'],
])
register({ family: 'purchasing', action: 'Cập nhật mua hàng', format: formatStatusValue }, [
  ['Purchase', 'PurchaseRequest', 'Status'], ['Purchasing', 'PurchaseRequest', 'Submit'], ['Purchasing', 'PurchaseRequest', 'GenerateFromDemand'],
  ['Purchasing', 'PurchaseRequestLine', 'SupplierDecisionNote'], ['Purchasing', 'PurchasePriceException', 'CreatePriceException'],
])
register({ family: 'purchasing', action: 'Duyệt và chọn nhà cung cấp', format: formatStatusValue }, [
  ['Purchasing', 'PurchaseLineSupplierDecision', 'ConfirmSupplierDecision'],
])
register({ family: 'receipt', action: 'Tiếp nhận nguyên liệu', format: formatReceiptValue }, [
  ['Receipt', 'InventoryReceipt', 'Receive'], ['Receipt', 'InventoryReceipt', 'InventoryReceipt.Status'], ['Receipt', 'InventoryReceipt', 'PurchaseOrder'],
  ['Receipt', 'PurchaseOrder', 'PurchaseOrder.Status'], ['Receipt', 'PurchaseRequest', 'PurchaseRequest.Status'],
])
register({ family: 'receipt', action: 'Điều chỉnh phiếu nhập', format: formatReceiptValue }, [
  ['Receipt', 'ReceiptCorrection', 'POSTED'],
])
register({ family: 'issue', action: 'Tạo phiếu xuất kho', format: formatIssueValue }, [
  ['Issue', 'InventoryIssue', 'FULLDAY'], ['Lifecycle', 'InventoryIssue', 'Transition'], ['Inventory', 'InventoryIssueLine', 'InventoryIssueLine.IssuedQty'],
])
register({ family: 'stock', action: 'Điều chỉnh tồn kho', format: formatShortageValue }, [
  ['StockException', 'MaterialRequest', 'StockShortage'],
])
register({ family: 'stock', action: 'Kiểm kê tồn kho', format: formatStatusValue }, [
  ['Stocktake', 'Stocktake', 'Status'],
])
register({ family: 'kitchen-service', action: 'Giao nguyên liệu cho bếp', format: formatStatusValue }, [
  ['Kitchen', 'ProductionPlan', 'SendToKitchen'],
])
register({ family: 'kitchen-service', action: 'Xác nhận bếp nhận nguyên liệu', format: formatReceiptValue }, [
  ['KitchenReceipt', 'InventoryIssue', 'KitchenReceived'], ['KitchenReceipt', 'InventoryIssue', 'KitchenReceiptDiscrepancy'],
])
register({ family: 'kitchen-service', action: 'Xác nhận phục vụ', format: formatStatusValue }, [
  ['ServiceRun', 'ServiceRunAdjustment', 'ActualServingsCorrection'], ['ServiceRun', 'ServiceRun', 'ServiceConfirmationInvalidated'],
  ['ServiceRun', 'ServiceRun', 'ServingVarianceDecisionInvalidated'],
])
register({ family: 'kitchen-service', action: 'Ghi nhận hoàn trả hoặc hao hụt', format: formatReceiptValue }, [
  ['ProductionWaste', 'InventoryReturnLine', 'WasteQuantity'], ['StorekeeperReturnReceipt', 'InventoryReturnLine', 'Quantity'],
  ['StorekeeperReturnReceipt', 'InventoryReturn', 'StorekeeperReceiptDiscrepancy'], ['StorekeeperReturnReceipt', 'InventoryReturn', 'StorekeeperReceived'],
])
register({ family: 'reconciliation', action: 'Cập nhật hiệu lực xử lý chênh lệch', format: formatReconciliationValidity }, [
  ['RECONCILIATION', 'ReconciliationDisposition', 'Validity'],
])
register({ family: 'reconciliation', action: 'Xử lý đối chiếu', format: formatStatusValue }, [
  ['RECONCILIATION', 'ReconciliationDisposition', 'Disposition'],
])
register({ family: 'admin-security', action: 'Đổi mật khẩu tài khoản', format: formatGenericValue }, [
  ['Admin', 'User', 'PasswordHash'],
])
register({ family: 'admin-security', action: 'Quản lý tài khoản và phân quyền', format: formatStatusValue }, [
  ['Admin', 'User', 'user.FullName'], ['Admin', 'User', 'user.Username'], ['Admin', 'User', 'user.RoleId'], ['Admin', 'User', 'user.IsActive'],
])
register({ family: 'data-quality', action: 'Chuẩn hóa dữ liệu tồn kho', format: formatDataQualityValue }, [
  ['DataQuality', 'Currentstock', 'Cleanup'], ['DataQuality', 'CanonicalStockRebuildBatch', 'Cleanup'], ['DataQuality', 'LegacyReceiptMovementBatch', 'Cleanup'],
])
register({ family: 'data-quality', action: 'Chuẩn hóa dữ liệu', format: formatDataQualityValue }, [
  ['DataQuality', 'MaterialRequestLine', 'OperationalQuantityNormalization'], ['DataQuality', 'MaterialRequestLine', 'OperationalQuantityNormalizationRollback'],
  ['DataQuality', 'MaterialRequest', 'Cleanup'], ['DataQuality', 'UnitNormalizationReviewBatch', 'Research'], ['DataQuality', 'LegacyUnitConversionBatch', 'Cleanup'],
  ['DataQuality', 'DataQualityIssue', 'Remediation'],
])

export const splitAuditField = (fieldAffected?: string | null) => {
  const [entityName = '', ...fieldParts] = (fieldAffected ?? '').split(/\s*\/\s*/)
  return { entityName: entityName.trim(), fieldName: fieldParts.join(' / ').trim() }
}

export const formatAuditActor = (value?: string | null) => {
  if (!value) return 'Hệ thống'
  return technicalId.test(value.trim()) ? 'Tài khoản hệ thống' : value
}

const normalizeComparable = (value: string) => value.toLocaleLowerCase('vi-VN').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const suppressDuplicateReason = (reason: ValueResult, after: ValueResult) => {
  if (reason.disposition === 'empty') return reason
  const normalizedReason = normalizeComparable(reason.text)
  const normalizedAfter = normalizeComparable(after.text)
  if (normalizedReason && normalizedAfter && normalizedReason === normalizedAfter) return emptyValue()
  return reason
}

export const presentAudit = (context: AuditPresentationContext): AuditPresentation => {
  const technicalTuple = `${context.businessArea}|${context.entityName}|${context.fieldName}`
  const definition = tupleRegistry.get(tupleKey(context.businessArea, context.entityName, context.fieldName))
  const isPassword = isPasswordAuditTuple(context)
  const formatter = definition?.format ?? formatGenericValue
  const safeValue = (value: string | null | undefined, slot: 'before' | 'after') => containsSensitiveAuditMaterial(value)
    ? { text: AUDIT_REDACTED_VALUE, disposition: 'disclosure' as const }
    : formatter(value, slot)
  let before = isPassword ? emptyValue() : safeValue(context.oldValue, 'before')
  let after = isPassword ? formatted(AUDIT_PASSWORD_CHANGED_VALUE) : safeValue(context.newValue, 'after')

  if (definition?.family === 'bom' && tupleKey(context.businessArea, context.entityName, context.fieldName) === tupleKey('Reconciliation', 'QuantityImportBatch', 'Commit')) {
    before = emptyValue()
    after = context.newValue ? disclosure(context.newValue, 'Đã cam kết nguồn định lượng') : formatted('Đã cam kết nguồn định lượng')
  }

  const reason = suppressDuplicateReason(
    isPassword
      ? emptyValue()
      : containsSensitiveAuditMaterial(context.reason)
        ? { text: AUDIT_REDACTED_VALUE, disposition: 'disclosure' as const }
        : formatReasonValue(context.reason),
    after,
  )
  return {
    action: definition?.action ?? 'Cập nhật dữ liệu nghiệp vụ',
    before: before.text,
    after: after.text,
    reason: reason.text,
    technicalTuple,
    oldValueTitle: before.title,
    newValueTitle: after.title,
    reasonTitle: reason.title,
    beforeDisposition: before.disposition,
    afterDisposition: after.disposition,
    reasonDisposition: reason.disposition,
  }
}

// Compatibility helpers for report surfaces that still show a combined field string.
export const formatAuditLabel = (value?: string | null) => value ? value.split(/\s*\/\s*/).map((part) => labels[part] ?? part).join(' · ') : 'Cập nhật dữ liệu'
export const formatAuditValue = (value?: string | null) => formatGenericValue(value).text
