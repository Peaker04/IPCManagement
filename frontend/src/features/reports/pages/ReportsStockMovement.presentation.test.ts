import { describe, expect, it } from 'vitest'
import source from './ReportsPage.tsx?raw'

describe('Wave 4 Reports stock/movement DEFAULT family', () => {
  it('gives current stock business table semantics without changing report grain', () => {
    expect(source).toContain('ariaLabel="Snapshot tồn kho theo kho và nguyên liệu"')
    expect(source).toContain('caption="Số lượng tồn hiện tại theo kho và nguyên liệu tại thời điểm cập nhật"')
    expect(source.match(/scope="col"/g)?.length ?? 0).toBeGreaterThanOrEqual(5)
    expect(source).toContain('data-cell-role="numeric"')
    expect(source).toContain('label="Chưa có snapshot tồn kho phù hợp với bộ lọc."')
  })

  it('names movement history and preserves cursor pagination', () => {
    expect(source).toContain('ariaLabel="Lịch sử nhập xuất kho theo khoảng ngày"')
    expect(source).toContain('caption="Các bút toán nhập, xuất, trả và điều chỉnh trong khoảng ngày đang lọc"')
    expect(source).toContain('emptyTitle="Chưa có bút toán kho phù hợp với bộ lọc."')
    expect(source).toContain("ariaLabel: 'Phân trang lịch sử nhập xuất kho'")
  })
})
