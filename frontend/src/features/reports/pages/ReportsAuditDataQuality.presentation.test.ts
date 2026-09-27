import { describe, expect, it } from 'vitest'
import reportsSource from './ReportsPage.tsx?raw'
import qualitySource from './ReportsDataQualityPanel.tsx?raw'

describe('Wave 4 Reports audit/data-quality DEFAULT family', () => {
  it('names both table grains and scopes all headers', () => {
    expect(reportsSource).toContain('caption="Lịch sử thay đổi theo thời gian, người thực hiện, mảng nghiệp vụ và đối tượng"')
    expect(qualitySource).toContain('caption="Vấn đề dữ liệu, mức độ, SLA, chủ trì và hướng xử lý trước vận hành"')
    expect(reportsSource.match(/scope="col"/g)?.length ?? 0).toBeGreaterThanOrEqual(45)
    expect(qualitySource.match(/scope="col"/g)).toHaveLength(7)
  })

  it('uses specific ready-empty vocabulary and preserves cursor/service-run composition', () => {
    expect(reportsSource).toContain('label="Chưa có thay đổi hệ thống phù hợp với khoảng ngày và ca."')
    expect(qualitySource).toContain('label="Chưa ghi nhận vấn đề dữ liệu trước vận hành."')
    expect(reportsSource).toContain('<CursorPaginationBar')
    expect(reportsSource).toContain('<ServiceRunReportPanel')
    expect(qualitySource).toContain('Không tìm thấy vấn đề dữ liệu phù hợp.')
  })
})
