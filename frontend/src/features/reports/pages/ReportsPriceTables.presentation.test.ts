import { describe, expect, it } from 'vitest'
import source from './ReportsPricePanel.tsx?raw'

describe('Wave 4 Reports price tables DEFAULT family', () => {
  it('names all four price grains and scopes their column headers', () => {
    expect(source).toContain('caption="Các dòng nhập kho và mức biến động so với giá tham chiếu"')
    expect(source).toContain('caption="Giá nhập tổng hợp theo nguyên liệu, nhà cung cấp và đơn vị tính"')
    expect(source).toContain('caption="Giá nhập tổng hợp theo nguyên liệu, đơn vị tính và tháng"')
    expect(source).toContain('caption="Mức biến động giá có trọng số theo nhóm món"')
    expect(source.match(/scope="col"/g)).toHaveLength(23)
  })

  it('marks numeric facts and uses grain-specific empty vocabulary', () => {
    expect(source.match(/data-cell-role="numeric"/g)?.length ?? 0).toBeGreaterThanOrEqual(15)
    expect(source).toContain('label="Chưa có dòng nhập kho phù hợp với bộ lọc giá."')
    expect(source).toContain('label="Chưa có dữ liệu giá theo nhà cung cấp trong kỳ lọc."')
    expect(source).toContain('label="Chưa có dữ liệu giá theo tháng trong kỳ lọc."')
    expect(source).toContain('label="Chưa có dữ liệu giá theo nhóm món trong kỳ lọc."')
  })
})
