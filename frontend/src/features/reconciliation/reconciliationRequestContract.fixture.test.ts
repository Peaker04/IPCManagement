import { configureStore } from '@reduxjs/toolkit'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiSlice } from '@/api/apiSlice'
import { reconciliationApi, type CreateReconciliationIssueRequest } from './reconciliationApi'

const fixturePath = resolve(import.meta.dirname, '../../../../contracts/phase30/reconciliation-stale-request.json')
const forbiddenHeaderPattern = /authorization|cookie|api[-_]?key|host|origin|referer|forwarded|token|secret/i
const allowedHeaders = new Set(['accept', 'content-type'])

const staleRequest: CreateReconciliationIssueRequest = {
  commandId: 'phase30-stale-request-v1',
  expectedVersion: 3,
  issueDate: '2026-08-26',
  reconciliationBatchId: '11111111-1111-4111-8111-111111111101',
  lines: [
    {
      reconciliationBatchLineId: '22222222-2222-4222-8222-222222222202',
      ingredientId: '33333333-3333-4333-8333-333333333303',
      requestedQty: 2,
      issuedQty: 2,
      unitId: '44444444-4444-4444-8444-444444444404',
    },
  ],
}

type TrackedRequest = {
  schemaVersion: 1
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  )
}

const serializeTrackedRequest = (request: TrackedRequest) => `${JSON.stringify(stableValue(request), null, 2)}\n`

const captureProductionRequest = async () => {
  let captured: Request | undefined
  const NativeRequest = globalThis.Request
  vi.stubGlobal('Request', class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === 'string' && input.startsWith('/') ? `http://fixture.invalid${input}` : input, init)
    }
  })
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = input instanceof Request ? input : new Request(input, init)
    return new Response(JSON.stringify({ success: false, message: 'captured' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    })
  })

  const store = configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: () => ({ token: null, user: null }),
    },
    middleware: getDefaultMiddleware => getDefaultMiddleware().concat(apiSlice.middleware),
  })

  await store.dispatch(reconciliationApi.endpoints.createReconciliationIssue.initiate(staleRequest))
  if (!captured) throw new Error('Production RTK endpoint did not issue a request.')

  const url = new URL(captured.url, 'http://fixture.invalid')
  const headers = Object.fromEntries(
    [...captured.headers.entries()]
      .map(([name, value]) => [name.toLowerCase(), value] as const)
      .filter(([name]) => allowedHeaders.has(name))
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  const allHeaderNames = [...captured.headers.keys()].map(name => name.toLowerCase())

  expect(allHeaderNames.filter(name => !allowedHeaders.has(name))).toEqual([])
  expect(allHeaderNames.some(name => forbiddenHeaderPattern.test(name))).toBe(false)
  expect(url.username).toBe('')
  expect(url.password).toBe('')
  expect(url.search).toBe('')

  return serializeTrackedRequest({
    schemaVersion: 1,
    method: captured.method.toUpperCase(),
    path: url.pathname,
    headers,
    body: JSON.parse(await captured.text()),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('production reconciliation issue request fixture', () => {
  it('is credential-free and byte-identical to current RTK serialization', async () => {
    const fresh = await captureProductionRequest()

    if (process.argv.includes('--update')) {
      await writeFile(fixturePath, fresh, 'utf8')
    }

    const tracked = await readFile(fixturePath, 'utf8')
    expect(tracked.endsWith('\n')).toBe(true)
    expect(tracked).toBe(fresh)
  })
})
