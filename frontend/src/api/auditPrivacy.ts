export const AUDIT_REDACTED_VALUE = 'Thông tin nhạy cảm đã được ẩn'
export const AUDIT_PASSWORD_CHANGED_VALUE = 'Đã đổi mật khẩu'

export interface AuditPrivacyContext {
  businessArea: string
  entityName: string
  fieldName: string
}

const normalizedTuplePart = (value: string) => value.trim().toLocaleLowerCase('en-US')

export const isPasswordAuditTuple = ({ businessArea, entityName, fieldName }: AuditPrivacyContext) =>
  normalizedTuplePart(businessArea) === 'admin'
  && normalizedTuplePart(entityName) === 'user'
  && normalizedTuplePart(fieldName) === 'passwordhash'

const bcryptValue = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/
const bearerValue = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i
const jwtValue = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/
const privateKeyValue = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i
const sensitiveAssignment = /["']?(?:password(?:hash)?|passwd|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key)["']?\s*[:=]\s*["']?[^\s,;}"]{6,}/i

export const containsSensitiveAuditMaterial = (value?: string | null) => {
  const text = value?.trim()
  if (!text) return false
  return bcryptValue.test(text)
    || bearerValue.test(text)
    || jwtValue.test(text)
    || privateKeyValue.test(text)
    || sensitiveAssignment.test(text)
}

export const redactAuditTransportValues = (
  context: AuditPrivacyContext,
  values: { oldValue?: string | null; newValue?: string | null; reason?: string | null },
) => {
  if (isPasswordAuditTuple(context)) {
    return { oldValue: '', newValue: AUDIT_PASSWORD_CHANGED_VALUE, reason: '' }
  }

  const redact = (value?: string | null) => containsSensitiveAuditMaterial(value) ? AUDIT_REDACTED_VALUE : value ?? ''
  return {
    oldValue: redact(values.oldValue),
    newValue: redact(values.newValue),
    reason: redact(values.reason),
  }
}
