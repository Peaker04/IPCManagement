import { describe, expect, it } from 'vitest'
import { containsSensitiveAuditMaterial, redactAuditTransportValues } from './auditPrivacy'

const syntheticCredential = (suffix: string) => ['fixture', suffix, '1234567890abcdef'].join('-')

describe('MXE-06 audit privacy detector', () => {
  it.each([
    () => `passwordHash=${syntheticCredential('assignment')}`,
    () => JSON.stringify({ nested: { accessToken: syntheticCredential('nested') } }),
    () => `Bearer ${syntheticCredential('bearer')}`,
    () => `${['$2a$', '12$', 'x'.repeat(24)].join('')}`,
  ])('detects explicit credential, token and hash-shaped material', (value) => {
    expect(containsSensitiveAuditMaterial(value())).toBe(true)
  })

  it.each([
    'Người dùng yêu cầu đổi mật khẩu trong phiên hỗ trợ',
    'Khóa định lượng đã hoàn tất',
    'token định lượng đã hết hạn; hãy kiểm tra lại nguồn',
    'previewToken=preview-command-42',
    'Mã phiếu ISS-20260905-000001',
  ])('preserves unrelated business text: %s', (value) => {
    expect(containsSensitiveAuditMaterial(value)).toBe(false)
  })

  it('normalizes PasswordHash tuple casing and whitespace without broadening to unrelated fields', () => {
    const credential = syntheticCredential('transport')
    expect(redactAuditTransportValues(
      { businessArea: ' admin ', entityName: ' USER ', fieldName: ' passwordhash ' },
      { oldValue: credential, newValue: credential, reason: credential },
    )).toEqual({ oldValue: '', newValue: 'Đã đổi mật khẩu', reason: '' })

    expect(redactAuditTransportValues(
      { businessArea: 'Admin', entityName: 'User', fieldName: 'PasswordHint' },
      { oldValue: 'Gợi ý nghiệp vụ an toàn', newValue: 'Đã xác minh', reason: 'Theo yêu cầu hỗ trợ' },
    )).toEqual({ oldValue: 'Gợi ý nghiệp vụ an toàn', newValue: 'Đã xác minh', reason: 'Theo yêu cầu hỗ trợ' })
  })
})
