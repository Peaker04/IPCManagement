import { describe, expect, it } from 'vitest'
import source from './ReportsPage.tsx?raw'

describe('Wave 4 Reports kitchen/usage DEFAULT family', () => {
  it('names all three operational grains and scopes their headers', () => {
    expect(source).toContain('caption="Số lượng yêu cầu và đã xuất theo phiếu, ngày, ca, kho và nguyên liệu"')
    expect(source).toContain('caption="Số lượng đã xuất, hoàn kho và sử dụng thực tế theo phiếu và nguyên liệu"')
    expect(source).toContain('caption="Đối chiếu nhu cầu, thu mua, luồng kho, bếp và hoàn hao theo dòng nhu cầu"')
    expect(source.match(/scope="col"/g)?.length ?? 0).toBeGreaterThanOrEqual(38)
  })

  it('marks quantity facts and uses grain-specific empty vocabulary', () => {
    expect(source).toContain('label="Chưa có phiếu xuất bếp phù hợp với khoảng ngày và ca."')
    expect(source).toContain('label="Chưa có dòng sử dụng thực tế phù hợp với khoảng ngày và ca."')
    expect(source).toContain('label="Chưa có dòng nhu cầu để đối soát nguồn cung trong kỳ lọc."')
    expect(source.match(/data-cell-role="numeric"/g)?.length ?? 0).toBeGreaterThanOrEqual(17)
    expect(source).toContain('key={row.materialRequestLineId}')
  })
})
