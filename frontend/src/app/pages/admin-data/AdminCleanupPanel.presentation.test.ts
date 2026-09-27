import { describe, expect, it } from 'vitest'
import source from './AdminCleanupPanel.tsx?raw'

describe('Admin data-quality issue table presentation', () => {
  it('names issue/owner/remediation grain and scopes all six columns', () => {
    expect(source).toContain('caption="Vấn đề chất lượng dữ liệu theo đối tượng, mức ưu tiên và trạng thái khắc phục"')
    expect((source.match(/<th scope="col"/g) ?? [])).toHaveLength(6)
    expect(source).toContain('Chưa phát hiện vấn đề dữ liệu cần xử lý.')
  })
  it('retains issue identity, remediation mutation and action handoff', () => {
    expect(source).toContain('key={`${issue.id}-${index}`}')
    expect(source).toContain('handleDataQualityRemediation(issue, issue.remediationStatus === \'resolved\' ? \'reopen\' : \'resolve\')')
    expect(source).toContain('ROUTES.ADMIN_DATA}?view=bom-import')
    expect(source).toContain('onPageChange={setQualityPage}')
  })
})
