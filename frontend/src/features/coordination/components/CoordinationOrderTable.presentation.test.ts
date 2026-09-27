import { describe, expect, it } from 'vitest'
import source from './order-table.tsx?raw'

describe('Wave 4 Coordination meal-order table DEFAULT family', () => {
  it('names the order grain and scopes every column header', () => {
    expect(source).toContain('caption="Đơn phục vụ theo khách hàng, thực đơn, món ăn và số suất trong ca"')
    expect(source.match(/scope="col"/g)).toHaveLength(6)
    expect(source).toContain('ariaLabel="Bảng điều phối đơn theo khách hàng"')
  })

  it('marks serving quantities as numeric and preserves search/row ownership', () => {
    expect(source.match(/data-cell-role="numeric"/g)).toHaveLength(3)
    expect(source).toContain('key={order.id}')
    expect(source).toContain('id="coordination-order-search"')
    expect(source).toContain('setSearch(event.target.value); setPage(1)')
    expect(source).toContain('Không tìm thấy đơn phù hợp.')
  })
})
