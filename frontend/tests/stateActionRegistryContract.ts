export const UNKNOWN = 'KHÔNG-XÁC-ĐỊNH-ĐƯỢC' as const

export const CORRESPONDENCE_VALUES = [
  'KHỚP',
  'FE-CHẶT-HƠN',
  'FE-LỎNG-HƠN',
  'CHỈ-CÓ-Ở-BE',
  'CHỈ-CÓ-Ở-FE',
] as const

export type Correspondence = typeof CORRESPONDENCE_VALUES[number]

export type RegistryRow = {
  object: string
  scenarioId: string
  operation: string
  scope: string
  entityState: string
  projectionState: string
  actor: string
  backendPermission: string
  frontendPermission: string
  source: readonly string[]
  correspondence: Correspondence
}

const REQUIRED_STRING_FIELDS = [
  'object',
  'scenarioId',
  'operation',
  'scope',
  'entityState',
  'projectionState',
  'actor',
  'backendPermission',
  'frontendPermission',
] as const

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

export const registryRowKey = (row: Pick<RegistryRow, 'object' | 'scenarioId' | 'operation'>) => (
  `${row.object}\u0000${row.scenarioId}\u0000${row.operation}`
)

export function assertStateActionRegistryRows(rows: unknown): asserts rows is readonly RegistryRow[] {
  if (!Array.isArray(rows)) {
    throw new Error('Registry rows must be an array')
  }

  const keys = new Set<string>()

  rows.forEach((row, index) => {
    if (!isRecord(row)) {
      throw new Error(`Registry row ${index} must be an object`)
    }
    if ('operations' in row) {
      throw new Error(`Registry row ${index} must contain one operation, not an operations array`)
    }

    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof row[field] !== 'string' || row[field].length === 0) {
        throw new Error(`Registry row ${index} has an invalid ${field}`)
      }
    }
    if (!Array.isArray(row.source) || row.source.length === 0 || row.source.some((item) => typeof item !== 'string')) {
      throw new Error(`Registry row ${index} has an invalid source`)
    }
    if (!CORRESPONDENCE_VALUES.includes(row.correspondence as Correspondence)) {
      throw new Error(`Registry row ${index} has an invalid correspondence`)
    }

    const key = registryRowKey(row as RegistryRow)
    if (keys.has(key)) {
      throw new Error(`Duplicate registry row key: ${row.object} + ${row.scenarioId} + ${row.operation}`)
    }
    keys.add(key)
  })
}
