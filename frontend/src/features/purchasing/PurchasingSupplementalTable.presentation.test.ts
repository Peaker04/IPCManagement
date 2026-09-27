import { describe, expect, it } from 'vitest'
import source from './SupplementalPurchasingWorkbench.tsx?raw'

describe('Wave 4 Purchasing supplemental table DEFAULT family', () => {
  it('names the supplemental request grain and scopes all headers', () => {
    expect(source).toContain('caption="Yêu cầu thiếu hàng từ bếp theo nguyên liệu, số lượng còn thiếu và đề xuất mua liên kết"')
    expect(source.match(/scope="col"/g)).toHaveLength(6)
    expect(source).toContain('ariaLabel="Danh sách nhu cầu mua bổ sung từ bếp"')
  })

  it('marks shortage quantity and preserves request/source identities and action ownership', () => {
    expect(source).toContain('data-cell-role="numeric"')
    expect(source).toContain('key={item.requestId}')
    expect(source).toContain('item.purchaseRequestId')
    expect(source).toContain('item.issueCode')
    expect(source).toContain('setSelectedRequestId(item.requestId)')
    expect(source).toContain('Chưa có nhu cầu mua bổ sung cần xử lý')
  })
})
