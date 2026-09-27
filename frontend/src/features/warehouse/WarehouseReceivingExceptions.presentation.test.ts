import { describe, expect, it } from 'vitest'
import receivingSource from './pages/WarehousePurchaseOrdersPanel.tsx?raw'
import exceptionsSource from './WarehouseExceptionsWorkbench.tsx?raw'

describe('Wave 4 Warehouse receiving/exceptions DEFAULT family', () => {
  it('scopes the receiving table and marks progress as numeric', () => {
    expect(receivingSource).toContain('ariaLabel="Đơn mua và tiến độ nhập kho"')
    expect(receivingSource).toContain('caption="Các đơn mua chờ kho ghi nhận số lượng thực nhận"')
    expect(receivingSource.match(/scope="col"/g)).toHaveLength(6)
    expect(receivingSource).toContain('data-cell-role="numeric"')
    expect(receivingSource).toContain('Chưa có đơn mua để theo dõi nhập kho.')
  })

  it('uses business captions, scoped headers and numeric roles for exception tables', () => {
    expect(exceptionsSource).toContain('caption="Yêu cầu bổ sung và trạng thái xử lý theo nguyên liệu"')
    expect(exceptionsSource).toContain('caption="Số lượng xuất, trả, hao hụt và còn dư theo dòng chứng từ"')
    expect(exceptionsSource).toContain('caption="Phiếu trả và hao hụt chờ kho kiểm đếm, tiếp nhận"')
    expect(exceptionsSource.match(/scope="col"/g)).toHaveLength(20)
    expect(exceptionsSource.match(/data-cell-role="numeric"/g)).toHaveLength(4)
  })
})
