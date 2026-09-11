export type SystemOperationMode = 'DEFAULT' | 'MATERIAL_RECONCILIATION'

export interface SystemOperationCapabilities {
  navigation: readonly string[]
  pageTabs: Readonly<Record<string, readonly string[]>>
}

export interface SystemOperationSnapshot {
  mode: SystemOperationMode
  label: string
  version: number
  updatedAt: string
  reasonRequired: boolean
  capabilities: SystemOperationCapabilities
}

export interface ChangeSystemOperationMode {
  mode: SystemOperationMode
  expectedVersion: number
  confirmed: boolean
  reason?: string
}
