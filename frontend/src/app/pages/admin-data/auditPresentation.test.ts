import { describe, expect, it } from 'vitest'
import { formatAuditActor, presentAudit, splitAuditField } from './auditPresentation'

const present = (businessArea: string, entityName: string, fieldName: string, oldValue?: string | null, newValue?: string | null, reason?: string | null) => presentAudit({ businessArea, entityName, fieldName, oldValue, newValue, reason })

describe('MXE-05 typed admin audit presentation', () => {
  it.each([
    ['SYSTEM_OPERATION', 'SystemOperationMode', 'Mode', 'Thay đổi chế độ vận hành'],
    ['MenuVersion', 'MenuSchedule', 'Status', 'Cập nhật thực đơn tuần'],
    ['Coordination', 'MealQuantityPlan', 'QuickForecastServings', 'Cập nhật số suất'],
    ['BOM', 'DishBom', 'BulkImport', 'Nhập định lượng món ăn'],
    ['Demand', 'MaterialRequest', 'Generate', 'Tạo nhu cầu nguyên liệu'],
    ['Purchasing', 'PurchaseRequest', 'Submit', 'Cập nhật mua hàng'],
    ['Receipt', 'InventoryReceipt', 'Receive', 'Tiếp nhận nguyên liệu'],
    ['Issue', 'InventoryIssue', 'FULLDAY', 'Tạo phiếu xuất kho'],
    ['StockException', 'MaterialRequest', 'StockShortage', 'Điều chỉnh tồn kho'],
    ['KitchenReceipt', 'InventoryIssue', 'KitchenReceived', 'Xác nhận bếp nhận nguyên liệu'],
    ['RECONCILIATION', 'ReconciliationDisposition', 'Validity', 'Cập nhật hiệu lực xử lý chênh lệch'],
    ['Admin', 'User', 'user.IsActive', 'Quản lý tài khoản và phân quyền'],
    ['DataQuality', 'MaterialRequest', 'Cleanup', 'Chuẩn hóa dữ liệu'],
  ])('dispatches the exact %s|%s|%s tuple to its approved family', (businessArea, entityName, fieldName, action) => {
    expect(present(businessArea, entityName, fieldName, null, 'COMPLETED').action).toBe(action)
  })

  it.each([
    ['Issue', 'InventoryIssue', 'FULLDAY'], ['SYSTEM_OPERATION', 'SystemOperationMode', 'Mode'],
    ['DataQuality', 'Currentstock', 'Cleanup'], ['Demand', 'MaterialRequest', 'Recalculate'],
    ['MenuVersion', 'MenuSchedule', 'Status'], ['Purchasing', 'PurchaseLineSupplierDecision', 'ConfirmSupplierDecision'],
    ['Coordination', 'MealQuantityPlan', 'QuickForecastServings'], ['Coordination', 'MealQuantityPlan', 'QuickCompleteServings'],
    ['DataQuality', 'MaterialRequestLine', 'OperationalQuantityNormalizationRollback'], ['DataQuality', 'MaterialRequestLine', 'OperationalQuantityNormalization'],
    ['StockException', 'MaterialRequest', 'StockShortage'], ['DataQuality', 'MaterialRequest', 'Cleanup'],
    ['Admin', 'User', 'PasswordHash'], ['Import', 'MenuVersion', 'WeeklyMenu'], ['Demand', 'MaterialRequest', 'Generate'],
    ['Purchase', 'PurchaseRequest', 'Status'], ['Demand', 'MaterialRequest', 'Status'], ['MenuVersion', 'MenuVersion', 'Status'],
    ['MenuVersion', 'MenuVersion', 'EffectiveRange'], ['Lifecycle', 'InventoryIssue', 'Transition'],
    ['Reconciliation', 'QuantityImportBatch', 'Commit'], ['Import', 'QuantityImportBatch', 'API'],
    ['Purchasing', 'PurchaseRequest', 'Submit'], ['DataQuality', 'UnitNormalizationReviewBatch', 'Research'],
    ['DataQuality', 'CanonicalStockRebuildBatch', 'Cleanup'], ['DataQuality', 'LegacyReceiptMovementBatch', 'Cleanup'],
    ['DataQuality', 'LegacyUnitConversionBatch', 'Cleanup'],
  ])('recognizes runtime inventory tuple %s|%s|%s without generic family fallback', (businessArea, entityName, fieldName) => {
    expect(present(businessArea, entityName, fieldName, null, null).action).not.toBe('Cập nhật dữ liệu nghiệp vụ')
  })

  it('normalizes tuple casing without substring family guessing', () => {
    expect(present(' receipt ', ' INVENTORYRECEIPT ', ' purchaseorder ', null, 'POSTED').action).toBe('Tiếp nhận nguyên liệu')
    expect(present('PurchasingElse', 'InventoryReceipt', 'PurchaseOrder', null, 'POSTED').action).toBe('Cập nhật dữ liệu nghiệp vụ')
  })

  it('keeps receipt, issue and kitchen collisions deterministic', () => {
    expect(present('Receipt', 'InventoryReceipt', 'PurchaseOrder', null, 'POSTED').action).toBe('Tiếp nhận nguyên liệu')
    expect(present('KitchenReceipt', 'InventoryIssue', 'KitchenReceived', null, 'receivedAt=2026-09-04T08:15:00Z')).toMatchObject({
      action: 'Xác nhận bếp nhận nguyên liệu', after: expect.stringContaining('Đã ghi nhận lúc'),
    })
    expect(present('Issue', 'InventoryIssue', 'FULLDAY', null, 'ISS-MXE05 - 1.000001').action).toBe('Tạo phiếu xuất kho')
  })

  it('distinguishes serving forecast from completion status', () => {
    expect(present('Coordination', 'MealQuantityPlan', 'QuickForecastServings', null, '2026-09-04|AFTERNOON|800')).toMatchObject({
      action: 'Cập nhật số suất', after: '04/09/2026 · Ca chiều · 800 suất',
    })
    expect(present('Coordination', 'MealQuantityPlan', 'QuickCompleteServings', null, '2026-09-04|MORNING|0')).toMatchObject({
      action: 'Hoàn tất số suất', after: '04/09/2026 · Ca sáng · 0 suất',
    })
    expect(present('Coordination', 'MealQuantityPlan', 'Status', 'FORECASTED', 'COMPLETED').action).toBe('Hoàn tất số suất')
  })

  it('keeps reconciliation validity ahead of generic reconciliation', () => {
    expect(present('RECONCILIATION', 'ReconciliationDisposition', 'Validity', 'ACCEPTED_VARIANCE|Đã xác minh chứng từ|v2', 'INVALIDATED')).toMatchObject({
      action: 'Cập nhật hiệu lực xử lý chênh lệch', before: 'Chấp nhận chênh lệch · Đã xác minh chứng từ · phiên bản 2', after: 'Đã mất hiệu lực',
    })
    expect(present('Reconciliation', 'UnknownEntity', 'Validity', null, 'INVALIDATED').action).toBe('Cập nhật dữ liệu nghiệp vụ')
  })

  it('keeps data-quality current-stock cleanup ahead of stock presentation', () => {
    expect(present('DataQuality', 'Currentstock', 'Cleanup', '0', '60')).toMatchObject({
      action: 'Chuẩn hóa dữ liệu tồn kho', before: '0', after: '60',
    })
  })

  it('formats weekly effective ranges and synthesized import summaries', () => {
    expect(present('MenuVersion', 'MenuVersion', 'EffectiveRange', '2026-09-01..2026-09-07|DRAFT', '2026-09-01..2026-09-07|ACTIVE').after)
      .toBe('01/09/2026 – 07/09/2026 · Đang áp dụng')
    expect(present('Import', 'MenuVersion', 'WeeklyMenu', 'menu-mxe05.xlsx', 'IMPORT-MXE05 - ACTIVE')).toMatchObject({
      action: 'Nhập thực đơn tuần', before: 'menu-mxe05.xlsx', after: 'IMPORT-MXE05 · Đang áp dụng',
    })
    expect(present('Import', 'QuantityImportBatch', 'API', null, 'QTY-MXE05 - COMPLETED; 12 plans')).toMatchObject({
      action: 'Nhập kế hoạch số suất', after: 'QTY-MXE05 · Hoàn tất · 12 kế hoạch',
    })
  })

  it('formats runtime demand, BOM, issue and shortage payloads with six-decimal MRX precision', () => {
    expect(present('Demand', 'MaterialRequest', 'Generate', null, '54 demand lines; 2 missing BOM dishes; 1 missing unit conversions').after)
      .toBe('54 dòng nhu cầu · 2 món thiếu BOM · 1 đơn vị chưa quy đổi')
    expect(present('BOM', 'DishBom', 'BulkImport', null, 'BOM-MXE05; created=2; updated=3; archived=1; rows=6; tier=30000; scope=ACTIVE').after)
      .toBe('BOM-MXE05 · tạo 2 · cập nhật 3 · lưu trữ 1 · 6 dòng · mức giá 30.000 · phạm vi Đang áp dụng')
    expect(present('Issue', 'InventoryIssue', 'FULLDAY', '00000000-0000-0000-0000-000000000001', 'ISS-MXE05 - 215.816682', 'Ngày xuất 2026-09-04')).toMatchObject({
      before: 'Thông tin kỹ thuật được lưu trong chi tiết', after: 'ISS-MXE05 · thực xuất 215,816682', reason: 'Xuất kho ngày 04/09/2026',
    })
    expect(present('StockException', 'MaterialRequest', 'StockShortage', null, 'ingredient=Cá bạc má; required=0.000001; available=0; missing=0.000001; unit=Kilogram; date=2026-09-03').after)
      .toBe('Cá bạc má: cần 0,000001 kg, hiện có 0 kg, thiếu 0,000001 kg')
  })

  it.each([
    ['Coordination', 'MealQuantityPlan', 'QuickForecastServings', '2026-02-30|MORNING|NaN', 'Dữ liệu số suất không hợp lệ'],
    ['Issue', 'InventoryIssue', 'FULLDAY', 'ISS-MXE05 - not-a-number', 'Dữ liệu phiếu xuất không hợp lệ'],
    ['StockException', 'MaterialRequest', 'StockShortage', 'ingredient=Cá; required=nope; available=0; missing=1; unit=Kilogram', 'Dữ liệu thiếu tồn kho không hợp lệ'],
    ['BOM', 'DishBom', 'BulkImport', 'BOM-MXE05; created=two; updated=3', 'Kết quả nhập BOM không hợp lệ'],
    ['RECONCILIATION', 'ReconciliationDisposition', 'Validity', 'SHORTAGE|missing-version', 'Dữ liệu xử lý chênh lệch không hợp lệ'],
    ['KitchenReceipt', 'InventoryIssue', 'KitchenReceived', 'receivedAt=not-a-date', 'Thời điểm ghi nhận không hợp lệ'],
  ])('labels malformed %s|%s|%s payloads and retains disclosure', (businessArea, entityName, fieldName, value, label) => {
    const result = present(businessArea, entityName, fieldName, null, value)
    expect(result.after).toBe(label)
    expect(result.afterDisposition).toBe('fallback')
    expect(result.newValueTitle).toBe(value)
    expect(`${result.before}${result.after}${result.reason}`).not.toMatch(/NaN|Invalid Date/)
  })

  it('preserves null, empty, zero and tiny values without coercing them into missing or invalid facts', () => {
    expect(present('Demand', 'MaterialRequest', 'Status', null, '')).toMatchObject({ before: '—', after: '—', beforeDisposition: 'empty', afterDisposition: 'empty' })
    expect(present('ServiceRun', 'ServiceRunAdjustment', 'ActualServingsCorrection', '0', '0.000001')).toMatchObject({ before: '0', after: '0.000001' })
  })

  it('uses truthful fallback for unknown enum, token and serialized values', () => {
    expect(present('Demand', 'MaterialRequest', 'Status', null, 'NEW_UNKNOWN_STATE')).toMatchObject({
      after: 'Trạng thái chưa được chuẩn hóa', afterDisposition: 'fallback', newValueTitle: 'NEW_UNKNOWN_STATE',
    })
    expect(present('UnknownArea', 'UnknownEntity', 'UnknownField', null, '{"status":"UNKNOWN"}')).toMatchObject({
      action: 'Cập nhật dữ liệu nghiệp vụ', after: 'Dữ liệu chưa được chuẩn hóa', afterDisposition: 'fallback',
    })
  })

  it('keeps UUIDs and fingerprints disclosure-only', () => {
    expect(present('MenuVersion', 'MenuVersion', 'EffectiveRange', null, '00000000-0000-0000-0000-000000000001')).toMatchObject({
      after: 'Thông tin kỹ thuật được lưu trong chi tiết', afterDisposition: 'disclosure',
    })
    expect(present('Purchasing', 'PurchaseLineSupplierDecision', 'ConfirmSupplierDecision', null, 'A'.repeat(64))).toMatchObject({
      after: 'Thông tin kỹ thuật được lưu trong chi tiết', afterDisposition: 'disclosure',
    })
    expect(present('Reconciliation', 'QuantityImportBatch', 'Commit', null, 'B'.repeat(64))).toMatchObject({
      action: 'Cam kết định lượng', after: 'Đã cam kết nguồn định lượng', afterDisposition: 'disclosure', newValueTitle: 'B'.repeat(64),
    })
  })

  it('suppresses only duplicate results and retains a distinct long Vietnamese rationale', () => {
    expect(present('SYSTEM_OPERATION', 'SystemOperationMode', 'Mode', 'DEFAULT', 'MATERIAL_RECONCILIATION', 'MATERIAL_RECONCILIATION').reason).toBe('—')
    const rationale = 'Chuyển sang Đối chiếu nguyên liệu theo biên bản họp vận hành buổi chiều; giữ nguyên dữ liệu nguồn và chỉ thay đổi trạng thái hiển thị để người phụ trách nhận biết bước tiếp theo.'
    expect(present('SYSTEM_OPERATION', 'SystemOperationMode', 'Mode', 'DEFAULT', 'MATERIAL_RECONCILIATION', rationale)).toMatchObject({
      reason: rationale, reasonDisposition: 'formatted', reasonTitle: rationale,
    })
  })

  it('masks the PasswordHash tuple across casing, whitespace, values and reason', () => {
    const canary = ['AUDIT_SECRET', 'CANARY_PASSWORD_TUPLE'].join('_')
    const result = present(' admin ', ' USER ', ' passwordhash ', canary, canary, canary)
    expect(result).toMatchObject({
      action: 'Đổi mật khẩu tài khoản', before: '—', after: 'Đã đổi mật khẩu', reason: '—',
      oldValueTitle: undefined, newValueTitle: undefined, reasonTitle: undefined,
    })
    expect(JSON.stringify(result)).not.toContain(canary)
  })

  it.each(['oldValue', 'newValue', 'reason'] as const)('masks obvious secrets in unknown or nested %s payloads without disclosure metadata', (slot) => {
    const canary = ['fixture', `credential-${slot}`, '1234567890abcdef'].join('-')
    const value = JSON.stringify({ metadata: { passwordHash: canary } })
    const context = { businessArea: 'UnknownArea', entityName: 'UnknownEntity', fieldName: 'user.PasswordHash', oldValue: 'Giá trị nghiệp vụ an toàn', newValue: 'Giá trị nghiệp vụ an toàn', reason: 'Lý do nghiệp vụ an toàn', [slot]: value }
    const result = presentAudit(context)
    expect(JSON.stringify(result)).not.toContain(canary)
    expect(result[slot === 'oldValue' ? 'before' : slot === 'newValue' ? 'after' : 'reason']).toBe('Thông tin nhạy cảm đã được ẩn')
    expect(result[slot === 'oldValue' ? 'oldValueTitle' : slot === 'newValue' ? 'newValueTitle' : 'reasonTitle']).toBeUndefined()
  })

  it('does not hide unrelated business wording that merely mentions a password change', () => {
    const safe = 'Người dùng yêu cầu đổi mật khẩu trong phiên hỗ trợ'
    expect(present('Admin', 'User', 'SupportNote', null, safe, safe)).toMatchObject({ after: safe, reason: '—' })
  })

  it('keeps the compatibility field splitter and masks technical actors', () => {
    expect(splitAuditField('InventoryReturn / StorekeeperReceived')).toEqual({ entityName: 'InventoryReturn', fieldName: 'StorekeeperReceived' })
    expect(formatAuditActor('10000000-0000-0000-0000-000000000001')).toBe('Tài khoản hệ thống')
    expect(formatAuditActor('Nguyễn Văn A')).toBe('Nguyễn Văn A')
  })
})
