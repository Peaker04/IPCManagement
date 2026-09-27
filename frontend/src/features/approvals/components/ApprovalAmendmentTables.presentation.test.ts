import { describe, expect, it } from 'vitest'
import inboxSource from './MenuAmendmentInbox.tsx?raw'
import reconciliationSource from './MenuAmendmentReconciliation.tsx?raw'

describe('Wave 4 Approvals amendment tables DEFAULT family', () => {
  it('names both amendment grains and scopes their headers', () => {
    expect(inboxSource).toContain('caption="Yêu cầu điều chỉnh theo khách hàng, tuần và trạng thái xử lý"')
    expect(reconciliationSource).toContain('caption="Yêu cầu đối soát theo khách hàng, ngày, ca và dòng chứng từ"')
    expect(inboxSource.match(/scope="col"/g)).toHaveLength(5)
    expect(reconciliationSource.match(/scope="col"/g)).toHaveLength(7)
  })

  it('marks impact/document counts as numeric while preserving immutable row identities', () => {
    expect(inboxSource).toContain('data-cell-role="numeric"')
    expect(reconciliationSource.match(/data-cell-role="numeric"/g)).toHaveLength(1)
    expect(inboxSource).toContain('key={item.menuAmendmentId}')
    expect(reconciliationSource).toContain('key={item.decisionItemId}')
    expect(inboxSource).toContain('Không có yêu cầu điều chỉnh thực đơn đang chờ')
    expect(reconciliationSource).toContain("chưa có yêu cầu cần đối soát")
  })
})
