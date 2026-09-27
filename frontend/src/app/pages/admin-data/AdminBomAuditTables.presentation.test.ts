import { describe, expect, it } from 'vitest'
import auditSource from './AdminAuditPanel.tsx?raw'
import bomSource from './AdminBomPanel.tsx?raw'
import sourceChangesSource from './AdminSourceChangesPanel.tsx?raw'

describe('Wave 4 Admin BOM/audit table family', () => {
  it('keeps the BOTH-mode BOM tables business-named and semantically scoped', () => {
    expect(bomSource).toContain('ariaLabel="BOM đang áp dụng theo món, nguyên liệu và đơn giá"')
    expect(bomSource).toContain('caption="Các dòng BOM hiện hành theo món, nguyên liệu, định lượng và hiệu lực"')
    expect(bomSource).toContain('ariaLabel="Bản xem trước thay đổi BOM theo đơn giá"')
    expect(bomSource).toContain('caption="Các dòng BOM từ file import trước khi áp dụng"')
    expect(bomSource.match(/scope="col"/g)).toHaveLength(12)
    expect(bomSource.match(/data-cell-role="numeric"/g)).toHaveLength(3)
    expect(bomSource).toContain('label="Chưa có dòng BOM đang áp dụng."')
    expect(bomSource).toContain('label="Chưa có dòng BOM trong bản xem trước."')
  })

  it('keeps the BOTH-mode audit table named and truthful when ready-empty', () => {
    expect(auditSource).toContain('ariaLabel="Nhật ký thay đổi hệ thống"')
    expect(auditSource).toContain('caption="Các thay đổi hệ thống theo thời gian, người thực hiện và đối tượng nghiệp vụ"')
    expect(auditSource).toContain('Chưa có thay đổi hệ thống phù hợp với bộ lọc.')
    expect(auditSource).toContain('<th scope="col"')
  })

  it('retains the MRX-only source-change composition as a separate lineage owner', () => {
    expect(sourceChangesSource).toContain('<ReconciliationSourceChangeLog batchId={effectiveBatchId} standalone />')
    expect(sourceChangesSource).toContain('Chưa có lô đối chiếu')
  })
})
