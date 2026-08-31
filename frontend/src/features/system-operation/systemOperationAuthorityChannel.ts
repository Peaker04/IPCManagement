import type { SystemOperationMode } from './systemOperationEligibility'
import type { SystemOperationSnapshot } from './systemOperationApi'

export const SYSTEM_OPERATION_AUTHORITY_STORAGE_KEY = 'ipc.system-operation-authority.v1'
const CHANNEL_NAME = 'ipc.system-operation-authority'

export interface SystemOperationAuthorityMessage {
  mode: SystemOperationMode
  version: number
}

export interface SystemOperationAuthorityLike {
  mode: SystemOperationMode
  version: number
}

interface BroadcastChannelPort {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage(message: unknown): void
  close(): void
}

interface StoragePort {
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface StorageEventTargetPort {
  addEventListener(type: 'storage', listener: (event: Event) => void): void
  removeEventListener(type: 'storage', listener: (event: Event) => void): void
}

export interface SystemOperationAuthorityChannel {
  subscribe(listener: (message: SystemOperationAuthorityMessage) => void): () => void
  publish(message: SystemOperationAuthorityMessage): void
  dispose(): void
}

export interface SystemOperationAuthorityChannelOptions {
  createBroadcastChannel?: ((name: string) => BroadcastChannelPort) | null
  storage?: StoragePort
  storageEventTarget?: StorageEventTargetPort
}

const parseMessage = (value: unknown): SystemOperationAuthorityMessage | null => {
  if (!value || typeof value !== 'object') return null
  const { mode, version } = value as Record<string, unknown>
  if ((mode !== 'DEFAULT' && mode !== 'MATERIAL_RECONCILIATION') || !Number.isInteger(version) || (version as number) < 0) return null
  return { mode, version: version as number }
}

export const authorityFromSnapshot = ({ mode, version }: SystemOperationSnapshot): SystemOperationAuthorityMessage => ({ mode, version })

export const isSystemOperationAuthorityNewer = (
  current: SystemOperationAuthorityLike | null | undefined,
  candidate: SystemOperationAuthorityLike,
) => !current || candidate.version > current.version

export function createSystemOperationAuthorityChannel(options: SystemOperationAuthorityChannelOptions = {}): SystemOperationAuthorityChannel {
  const listeners = new Set<(message: SystemOperationAuthorityMessage) => void>()
  const createBroadcastChannel = options.createBroadcastChannel === null
    ? undefined
    : options.createBroadcastChannel ?? (typeof BroadcastChannel === 'undefined' ? undefined : (name: string) => new BroadcastChannel(name))
  const storage = options.storage ?? (typeof window === 'undefined' ? undefined : window.localStorage)
  const storageEventTarget = options.storageEventTarget ?? (typeof window === 'undefined' ? undefined : window)
  const broadcast = createBroadcastChannel?.(CHANNEL_NAME)

  const deliver = (value: unknown) => {
    const message = parseMessage(value)
    if (message) listeners.forEach((listener) => listener(message))
  }
  if (broadcast) broadcast.onmessage = (event) => deliver(event.data)

  const onStorage = (event: Event) => {
    const storageEvent = event as StorageEvent
    if (storageEvent.key !== SYSTEM_OPERATION_AUTHORITY_STORAGE_KEY || !storageEvent.newValue) return
    try { deliver(JSON.parse(storageEvent.newValue)) } catch { /* Ignore malformed untrusted browser messages. */ }
  }
  if (!broadcast) storageEventTarget?.addEventListener('storage', onStorage)

  let disposed = false
  return {
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    publish(message) {
      if (disposed) return
      const parsed = parseMessage(message)
      if (!parsed) return
      if (broadcast) {
        broadcast.postMessage(parsed)
        return
      }
      if (!storage) return
      storage.setItem(SYSTEM_OPERATION_AUTHORITY_STORAGE_KEY, JSON.stringify(parsed))
      storage.removeItem(SYSTEM_OPERATION_AUTHORITY_STORAGE_KEY)
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
      if (broadcast) broadcast.close()
      else storageEventTarget?.removeEventListener('storage', onStorage)
    },
  }
}

let runtimeChannel: SystemOperationAuthorityChannel | undefined
export const getSystemOperationAuthorityChannel = () => runtimeChannel ??= createSystemOperationAuthorityChannel()
export const publishSystemOperationAuthority = (snapshot: SystemOperationSnapshot) => getSystemOperationAuthorityChannel().publish(authorityFromSnapshot(snapshot))
