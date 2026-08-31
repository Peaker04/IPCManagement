import { describe, expect, it, vi } from 'vitest'
import {
  createSystemOperationAuthorityChannel,
  isSystemOperationAuthorityNewer,
  type SystemOperationAuthorityMessage,
} from './systemOperationAuthorityChannel'

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>()
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  private readonly name: string

  constructor(name: string) {
    this.name = name
    const peers = FakeBroadcastChannel.channels.get(name) ?? new Set()
    peers.add(this)
    FakeBroadcastChannel.channels.set(name, peers)
  }

  postMessage(message: unknown) {
    for (const peer of FakeBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer !== this) peer.onmessage?.({ data: message } as MessageEvent<unknown>)
    }
  }

  close() {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this)
  }
}

class FakeStorageEventTarget {
  private listeners = new Set<(event: StorageEvent) => void>()
  addEventListener(_type: 'storage', listener: (event: StorageEvent) => void) { this.listeners.add(listener) }
  removeEventListener(_type: 'storage', listener: (event: StorageEvent) => void) { this.listeners.delete(listener) }
  emit(key: string, newValue: string) {
    for (const listener of this.listeners) listener({ key, newValue } as StorageEvent)
  }
}

const authority = (version: number): SystemOperationAuthorityMessage => ({
  mode: version % 2 === 0 ? 'MATERIAL_RECONCILIATION' : 'DEFAULT',
  version,
})

describe('system operation authority channel', () => {
  it('treats only higher server versions as newer authority', () => {
    expect(isSystemOperationAuthorityNewer(authority(2), authority(3))).toBe(true)
    expect(isSystemOperationAuthorityNewer(authority(2), authority(2))).toBe(false)
    expect(isSystemOperationAuthorityNewer(authority(4), authority(3))).toBe(false)
    expect(isSystemOperationAuthorityNewer(null, authority(1))).toBe(true)
  })

  it('uses messages as refetch hints and accepts authority only after independent confirmation', () => {
    FakeBroadcastChannel.channels.clear()
    const make = () => createSystemOperationAuthorityChannel({
      createBroadcastChannel: (name) => new FakeBroadcastChannel(name),
    })
    const tabA = make()
    const tabB = make()
    let accepted = { mode: 'DEFAULT', version: 1 } as SystemOperationAuthorityMessage
    let hinted = accepted
    let refetchCount = 0
    const unsubscribe = tabA.subscribe((message) => {
      const current = hinted ?? accepted
      if (!isSystemOperationAuthorityNewer(current, message)) return
      hinted = message
      refetchCount += 1
    })

    tabB.publish({ mode: 'MATERIAL_RECONCILIATION', version: 2 })
    tabB.publish({ mode: 'MATERIAL_RECONCILIATION', version: 2 })
    tabB.publish({ mode: 'DEFAULT', version: 1 })

    expect(refetchCount).toBe(1)
    expect(accepted).toEqual({ mode: 'DEFAULT', version: 1 })

    accepted = { mode: 'MATERIAL_RECONCILIATION', version: 2 }
    hinted = accepted
    tabB.publish({ mode: 'MATERIAL_RECONCILIATION', version: 3 })

    expect(refetchCount).toBe(2)
    unsubscribe()
    tabA.dispose()
    tabB.dispose()
  })

  it('carries stable authority between independent BroadcastChannel adapters and disposes cleanly', () => {
    FakeBroadcastChannel.channels.clear()
    const make = () => createSystemOperationAuthorityChannel({
      createBroadcastChannel: (name) => new FakeBroadcastChannel(name),
    })
    const tabA = make()
    const tabB = make()
    const received: SystemOperationAuthorityMessage[] = []
    const unsubscribe = tabA.subscribe((message) => received.push(message))

    tabB.publish(authority(2))
    tabB.publish(authority(2))
    tabB.publish({ mode: 'DEFAULT', version: 1 })

    expect(received).toEqual([authority(2), authority(2), { mode: 'DEFAULT', version: 1 }])
    unsubscribe()
    tabA.dispose()
    tabB.publish(authority(4))
    expect(received).toHaveLength(3)
    tabB.dispose()
  })

  it('falls back to storage events and ignores malformed payloads', () => {
    const target = new FakeStorageEventTarget()
    const storage = {
      setItem: vi.fn((key: string, value: string) => target.emit(key, value)),
      removeItem: vi.fn(),
    }
    const tab = createSystemOperationAuthorityChannel({ createBroadcastChannel: null, storage, storageEventTarget: target })
    const received: SystemOperationAuthorityMessage[] = []
    tab.subscribe((message) => received.push(message))

    tab.publish(authority(3))
    target.emit('ipc.system-operation-authority.v1', JSON.stringify({ mode: 'DEFAULT', version: -1 }))
    target.emit('ipc.system-operation-authority.v1', '{bad-json')

    expect(received).toEqual([authority(3)])
    expect(storage.removeItem).toHaveBeenCalledWith('ipc.system-operation-authority.v1')
    tab.dispose()
  })
})
