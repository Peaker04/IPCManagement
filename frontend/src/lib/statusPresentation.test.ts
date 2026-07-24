import { describe, expect, it } from 'vitest'
import { booleanStatusPresentation, issueCountPresentation } from './statusPresentation'

describe('status presentation helpers', () => {
  it('keeps zero issue metrics neutral instead of painting them as success', () => {
    expect(issueCountPresentation({ count: 0, singular: 'lỗi' })).toEqual({ label: 'Không có', tone: 'neutral' })
  })

  it('uses the requested severity when issues exist', () => {
    expect(issueCountPresentation({ count: 2, singular: 'cảnh báo', severity: 'warning' })).toEqual({
      label: '2 cảnh báo',
      tone: 'warning',
    })
  })

  it('supports explicit binary domain copy without inferring from text', () => {
    expect(booleanStatusPresentation({ condition: false, trueLabel: 'Đã duyệt', falseLabel: 'Chờ duyệt', falseTone: 'warning' }))
      .toEqual({ label: 'Chờ duyệt', tone: 'warning' })
  })
})
