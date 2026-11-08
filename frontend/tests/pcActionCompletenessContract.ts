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
  surface: string
  enabled: boolean
  disabledReason: string | null
  request: PcRequestEvidence | null
  postAction: string | null
}

export type PcMeasurementRow = {
  family: string
  scenarioId: string
  actor: string
  registryActor: string
  viewport: PcViewport
  operation: string
  backendPermission: string
  frontendPermission: string
  expected: boolean
  actualControls: readonly PcActualControl[]
  exclusions: PcFalseMissingExclusions
  routeMismatch: boolean
  requestExpected: boolean
  requestObserved: boolean
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
  typeof value === 'string' && value.trim().length > 0
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

  const requiredStrings = ['role', 'accessibleName', 'selector', 'source', 'route', 'surface'] as const
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
  if (!value.enabled && value.disabledReason === null) {
    throw new Error(`PC row ${rowIndex} control ${controlIndex} is disabled without a visible reason`)
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

export type PcClassificationInput = {
  expected: boolean
  actualCount: number
  exclusions: PcFalseMissingExclusions
  unknownDimensions?: readonly string[]
  routeMismatch?: boolean
  requestExpected?: boolean
  requestObserved?: boolean
}

export const classifyPcMeasurement = ({
  expected,
  actualCount,
  exclusions,
  unknownDimensions = [],
  routeMismatch = false,
  requestExpected = false,
  requestObserved = false,
}: PcClassificationInput): PcMismatch => {
  if (unknownDimensions.length > 0) return 'CHƯA-KẾT-LUẬN-ĐƯỢC'
  if (routeMismatch && actualCount > 0) return 'LỆCH VỊ TRÍ'
  if (!expected && actualCount > 0) return 'MỒ CÔI'
  if (expected && actualCount === 0) {
    return Object.values(exclusions).every((exclusion) => exclusion.ruledOut)
      ? 'THIẾU'
      : 'CHƯA-KẾT-LUẬN-ĐƯỢC'
  }
  if (expected && actualCount > 0 && requestExpected && !requestObserved) return 'IM LẶNG'
  return 'KHỚP'
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
  if (rows.length === 0) {
    throw new Error('PC measurement rows cannot be empty for an aggregate')
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
      'registryActor',
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
    if (typeof row.routeMismatch !== 'boolean') {
      throw new Error(`PC row ${index} has invalid routeMismatch flag`)
    }
    if (typeof row.requestExpected !== 'boolean' || typeof row.requestObserved !== 'boolean') {
      throw new Error(`PC row ${index} has invalid request evidence flags`)
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

    const unknownDimensions = [
      ['operation', row.operation],
      ['actor', row.registryActor],
      ['backendPermission', row.backendPermission],
      ['frontendPermission', row.frontendPermission],
    ].filter(([, value]) => value === UNKNOWN).map(([field]) => field)
    const expectedMismatch = classifyPcMeasurement({
      expected: row.expected,
      actualCount: row.actualControls.length,
      exclusions: row.exclusions,
      unknownDimensions,
      routeMismatch: row.routeMismatch,
      requestExpected: row.requestExpected,
      requestObserved: row.requestObserved,
    })
    if (row.mismatch !== expectedMismatch) {
      throw new Error(`PC row ${index} classification ${row.mismatch} contradicts evidence; expected ${expectedMismatch}`)
    }

    if (row.mismatch === 'THIẾU') {
      const unresolved = exclusionFields.filter((field) => !row.exclusions[field].ruledOut)
      if (unresolved.length > 0) {
        throw new Error(`PC row ${index} cannot be THIẾU before ruling out: ${unresolved.join(', ')}`)
      }
    }

    if (row.mismatch === 'KHỚP') {
      const positiveEvidence = [
        row.registryActor,
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
      if (row.expected && row.actualControls.some((control) => !control.enabled)) {
        throw new Error(`PC row ${index} cannot be KHỚP with a disabled expected control`)
      }
      if (row.requestExpected) {
        if (!row.requestObserved || row.actualControls.some((control) => control.request === null || control.postAction === null)) {
          throw new Error(`PC row ${index} cannot be KHỚP without request and post-action evidence`)
        }
      }
    }

    if (row.mismatch === 'IM LẶNG' && (row.actualControls.length === 0 || !row.requestExpected || row.requestObserved)) {
      throw new Error(`PC row ${index} has invalid IM LẶNG evidence`)
    }
    if (row.mismatch === 'LỆCH VỊ TRÍ' && (!row.routeMismatch || row.actualControls.length === 0)) {
      throw new Error(`PC row ${index} has invalid LỆCH VỊ TRÍ evidence`)
    }
    if (row.mismatch === 'MỒ CÔI' && (row.expected || row.actualControls.length === 0)) {
      throw new Error(`PC row ${index} has invalid MỒ CÔI evidence`)
    }
    if (row.mismatch === 'THIẾU' && (row.expected === false || row.actualControls.length !== 0)) {
      throw new Error(`PC row ${index} has invalid THIẾU evidence`)
    }
    if (row.mismatch === 'CHƯA-KẾT-LUẬN-ĐƯỢC' && unknownDimensions.length === 0 && Object.values(row.exclusions).every((exclusion) => exclusion.ruledOut) && !row.routeMismatch && !(row.expected && row.actualControls.length > 0 && row.requestExpected && !row.requestObserved)) {
      throw new Error(`PC row ${index} has unresolved classification without unresolved evidence`)
    }

    const key = pcMeasurementRowKey(row as PcMeasurementRow)
    if (keys.has(key)) {
      throw new Error(`Duplicate PC measurement row: ${key}`)
    }
    keys.add(key)
  })
}
