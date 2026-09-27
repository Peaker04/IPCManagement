import { describe, expect, it } from 'vitest'
import queueSource from '@/components/common/ApprovalQueue.tsx?raw'
import historySource from './ApprovalHistoryTab.tsx?raw'

describe('Wave 4 Approval queue/history DEFAULT family', () => {
  it('names the queue grain and marks date/SLA facts', () => {
    expect(queueSource).toContain('caption="Chứng từ chờ duyệt theo nghiệp vụ, ngày phục vụ, phụ trách, hạn duyệt và trạng thái"')
    expect(queueSource.match(/scope="col"/g)).toHaveLength(7)
    expect(queueSource.match(/data-cell-role="numeric"/g)).toHaveLength(2)
    expect(queueSource).toContain('key={record.id}')
  })

  it('exposes approval history as a semantic timeline without changing history identity', () => {
    expect(historySource).toContain('role="list"')
    expect(historySource).toContain('aria-label="Tiến trình phê duyệt theo thời gian"')
    expect(historySource).toContain('role="listitem"')
    expect(historySource).toContain('key={item.historyId}')
    expect(historySource).toContain('key={request.purchaseRequestId}')
  })
})
