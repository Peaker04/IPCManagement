import { describe, expect, it } from 'vitest'
import groupsSource from './PurchaseLineGroups.tsx?raw'
import workbenchSource from './PurchaseServiceDateWorkbench.tsx?raw'

describe('Wave 4 Purchasing workflow table DEFAULT family', () => {
  it('names the grouped purchase-line grain and scopes ready/loading/empty headers', () => {
    expect(groupsSource).toContain('caption="Nhu cầu mua theo nguyên liệu và đơn vị, giữ liên kết đến từng dòng nguồn"')
    expect(groupsSource.match(/scope="col"/g)).toHaveLength(7)
    expect(workbenchSource.match(/scope="col"/g)).toHaveLength(14)
  })

  it('marks purchase quantities and price/readiness facts without changing source-line identity', () => {
    expect(groupsSource.match(/data-cell-role="numeric"/g)).toHaveLength(3)
    expect(groupsSource).toContain('`${line.ingredientId}__${line.unitId}`')
    expect(groupsSource).toContain('key={line.purchaseRequestLineId}')
    expect(groupsSource).toContain('onLineChange(line.purchaseRequestLineId)')
    expect(groupsSource).toContain('Không có dòng nguyên liệu khớp bộ lọc.')
  })
})
