import { describe, expect, it } from 'vitest'
import source from './SupplierQuotationSection.tsx?raw'

describe('Wave 4 Purchasing supplier quotation table DEFAULT family', () => {
  it('names the ingredient-supplier quotation grain and scopes all headers', () => {
    expect(source).toContain('caption="Báo giá theo nhà cung cấp, đơn giá, thời hạn hiệu lực và trạng thái cho nguyên liệu đang chọn"')
    expect(source.match(/scope="col"/g)).toHaveLength(7)
    expect(source).toContain('ariaLabel="Bảng báo giá theo nguyên liệu"')
  })

  it('marks currency and effective dates while preserving quotation identity/actions', () => {
    expect(source.match(/data-cell-role="numeric"/g)).toHaveLength(3)
    expect(source).toContain('key={quotation.quotationId}')
    expect(source).toContain('workflow.edit(quotation)')
    expect(source).toContain('workflow.setDeactivateTargetId(quotation.quotationId)')
    expect(source).toContain('Chưa có báo giá nào cho nguyên liệu này')
  })
})
