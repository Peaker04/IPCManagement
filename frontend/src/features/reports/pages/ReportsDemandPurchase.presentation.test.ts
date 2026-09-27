import { describe, expect, it } from 'vitest'
import source from './ReportsPage.tsx?raw'

describe('Wave 4 Reports demand/purchase DEFAULT family', () => {
  it('names the demand and purchase grains with scoped headers', () => {
    expect(source).toContain('caption="Nhu cầu và trạng thái bàn giao theo ngày, nguyên liệu và nguồn phát sinh"')
    expect(source).toContain('caption="Số lượng cần, cân đối và đề xuất mua theo kỳ, nguyên liệu và đơn vị tính"')
    expect(source.match(/scope="col"/g)?.length ?? 0).toBeGreaterThanOrEqual(17)
  })

  it('marks quantity facts and uses filter-aware empty vocabulary', () => {
    expect(source).toContain('label="Chưa có nhu cầu nguyên liệu phù hợp với khoảng ngày và bộ lọc."')
    expect(source).toContain('label="Chưa có dòng kế hoạch thu mua phù hợp với kỳ và bộ lọc."')
    expect(source.match(/data-cell-role="numeric"/g)?.length ?? 0).toBeGreaterThanOrEqual(6)
    expect(source).toContain("key={`${row.periodKey}-${row.ingredientId}-${row.unitId}`}")
  })
})
