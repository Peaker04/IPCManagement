import { UNKNOWN } from './stateActionRegistryContract'
import { PA2B_VIEWPORTS } from './weekly-menu-lifecycle-pa2b-fixture'

export const PC_VIEWPORTS = PA2B_VIEWPORTS

export const PC_MISMATCH_VALUES = [
  'KHỚP',
  'THIẾU',
  'MỒ CÔI',
  'IM LẶNG',
  'LỆCH VỊ TRÍ',
  'CHƯA-KẾT-LUẬN-ĐƯỢC',
] as const

export const PC_EVIDENCE_KIND = 'FE-fixture-read-only' as const

export type PcViewport = typeof PC_VIEWPORTS[number]
export type PcMismatch = typeof PC_MISMATCH_VALUES[number]

export type PcExclusionEvidence = {
  ruledOut: boolean
  evidence: string
}

export type PcFalseMissingExclusions = {
  navigation: PcExclusionEvidence
  viewport: PcExclusionEvidence
  fixtureCondition: PcExclusionEvidence
  roleState: PcExclusionEvidence
}

export type PcRequestEvidence = {
  method: string
  path: string
  outcome: string
}

export type PcActualControl = {
  role: string
  accessibleName: string
  selector: string
  source: string
  route: string
  enabled: boolean
  disabledReason: string | null
  request: PcRequestEvidence | null
  postAction: string | null
}

export type PcMeasurementRow = {
  family: string
  scenarioId: string
  actor: string
  viewport: PcViewport
  operation: string
  backendPermission: string
  frontendPermission: string
  expected: boolean
  actualControls: readonly PcActualControl[]
  exclusions: PcFalseMissingExclusions
  mismatch: PcMismatch
  source: readonly string[]
  disposition: string
  evidenceKind: typeof PC_EVIDENCE_KIND
}

export const PC_FIXTURE_SAFETY = {
  readOnly: true,
  apiInterceptionRequired: true,
  mutableBackendAllowed: false,
  databaseRequired: false,
  evidenceKind: PC_EVIDENCE_KIND,
  viewports: PC_VIEWPORTS,
} as const

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.length > 0
)

const isKnownViewport = (value: unknown): value is PcViewport => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.width === 'number'
  && typeof value.height === 'number'
  && PC_VIEWPORTS.some((viewport) => (
    viewport.id === value.id
    && viewport.width === value.width
    && viewport.height === value.height
  ))
)

const assertExclusionEvidence = (
  value: unknown,
  rowIndex: number,
  field: keyof PcFalseMissingExclusions,
): asserts value is PcExclusionEvidence => {
  if (!isRecord(value) || typeof value.ruledOut !== 'boolean' || !isNonEmptyString(value.evidence)) {
    throw new Error(`PC row ${rowIndex} has invalid ${field} exclusion evidence`)
  }
}

const assertActualControl = (value: unknown, rowIndex: number, controlIndex: number) => {
  if (!isRecord(value)) {
    throw new Error(`PC row ${rowIndex} control ${controlIndex} must be an object`)
  }

  const requiredStrings = ['role', 'accessibleName', 'selector', 'source', 'route'] as const
  requiredStrings.forEach((field) => {
    if (!isNonEmptyString(value[field])) {
      throw new Error(`PC row ${rowIndex} control ${controlIndex} has invalid ${field}`)
    }
  })

  if (typeof value.enabled !== 'boolean') {
    throw new Error(`PC row ${rowIndex} control ${controlIndex} has invalid enabled flag`)
  }
  if (value.disabledReason !== null && !isNonEmptyString(value.disabledReason)) {
    throw new Error(`PC row ${rowIndex} control ${controlIndex} has invalid disabledReason`)
  }
  if (value.postAction !== null && !isNonEmptyString(value.postAction)) {
    throw new Error(`PC row ${rowIndex} control ${controlIndex} has invalid postAction`)
  }
  if (value.request !== null) {
    if (!isRecord(value.request)) {
      throw new Error(`PC row ${rowIndex} control ${controlIndex} has invalid request`)
    }
    for (const field of ['method', 'path', 'outcome'] as const) {
      if (!isNonEmptyString(value.request[field])) {
        throw new Error(`PC row ${rowIndex} control ${controlIndex} has invalid request ${field}`)
      }
    }
  }
}

export const pcMeasurementRowKey = (
  row: Pick<PcMeasurementRow, 'family' | 'scenarioId' | 'actor' | 'viewport' | 'operation'>,
) => [
  row.family,
  row.scenarioId,
  row.actor,
  `${row.viewport.width}x${row.viewport.height}`,
  row.operation,
].join('\u0000')

export function assertPcMeasurementRows(rows: unknown): asserts rows is readonly PcMeasurementRow[] {
  if (!Array.isArray(rows)) {
    throw new Error('PC measurement rows must be an array')
  }

  const keys = new Set<string>()

  rows.forEach((row, index) => {
    if (!isRecord(row)) {
      throw new Error(`PC row ${index} must be an object`)
    }

    const requiredStrings = [
      'family',
      'scenarioId',
      'actor',
      'operation',
      'backendPermission',
      'frontendPermission',
      'disposition',
    ] as const

    requiredStrings.forEach((field) => {
      if (!isNonEmptyString(row[field])) {
        throw new Error(`PC row ${index} has invalid ${field}`)
      }
    })

    if (!isKnownViewport(row.viewport)) {
      throw new Error(`PC row ${index} has an unsupported viewport`)
    }
    if (typeof row.expected !== 'boolean') {
      throw new Error(`PC row ${index} has invalid expected flag`)
    }
    if (!Array.isArray(row.actualControls)) {
      throw new Error(`PC row ${index} has invalid actualControls`)
    }
    row.actualControls.forEach((control, controlIndex) => assertActualControl(control, index, controlIndex))
    if (!Array.isArray(row.source) || row.source.length === 0 || row.source.some((item) => !isNonEmptyString(item))) {
      throw new Error(`PC row ${index} has invalid source evidence`)
    }
    if (!PC_MISMATCH_VALUES.includes(row.mismatch as PcMismatch)) {
      throw new Error(`PC row ${index} has invalid mismatch`)
    }
    if (row.evidenceKind !== PC_EVIDENCE_KIND) {
      throw new Error(`PC row ${index} has invalid evidence kind`)
    }
    if (!isRecord(row.exclusions)) {
      throw new Error(`PC row ${index} has invalid false-missing exclusions`)
    }

    const exclusionFields = [
      'navigation',
      'viewport',
      'fixtureCondition',
      'roleState',
    ] as const
    exclusionFields.forEach((field) => assertExclusionEvidence(row.exclusions[field], index, field))

    if (row.mismatch === 'THIẾU') {
      const unresolved = exclusionFields.filter((field) => !row.exclusions[field].ruledOut)
      if (unresolved.length > 0) {
        throw new Error(`PC row ${index} cannot be THIẾU before ruling out: ${unresolved.join(', ')}`)
      }
    }

    if (row.mismatch === 'KHỚP') {
      const positiveEvidence = [
        row.actor,
        row.operation,
        row.backendPermission,
        row.frontendPermission,
      ]
      if (positiveEvidence.includes(UNKNOWN)) {
        throw new Error(`PC row ${index} cannot be KHỚP with ${UNKNOWN} evidence`)
      }
      if (row.expected !== (row.actualControls.length > 0)) {
        throw new Error(`PC row ${index} cannot be KHỚP when expected and actual presence differ`)
      }
    }

    const key = pcMeasurementRowKey(row as PcMeasurementRow)
    if (keys.has(key)) {
      throw new Error(`Duplicate PC measurement row: ${key}`)
    }
    keys.add(key)
  })
}
