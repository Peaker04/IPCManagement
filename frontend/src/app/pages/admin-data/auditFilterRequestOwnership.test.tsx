import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportsApi, useGetAuditChangePageQuery } from '@/api/reportsApi'
import { apiSlice } from '@/api/apiSlice'

const createStore = () => configureStore({
  reducer: {
    auth: (state = { token: null }) => state,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
})

const pageResponse = (auditId: string, businessArea: string, entityName: string, fieldName: string) => new Response(JSON.stringify({
  success: true,
  data: {
    items: [{
      auditId,
      changedAt: '2026-09-05T08:00:00Z',
      changedBy: 'actor-id',
      changedByName: 'Fixture actor',
      businessArea,
      entityName,
      fieldName,
      oldValue: null,
      newValue: 'fixture-result',
      reason: 'fixture-reason',
    }],
    limit: 8,
    hasNext: false,
    nextCursorOffset: 0,
  },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

function AuditFilterProbe() {
  const [query, setQuery] = React.useState({ entityName: 'InventoryIssue', fieldName: 'FULLDAY', limit: 8 })
  const result = useGetAuditChangePageQuery(query)
  return <>
    <button type="button" onClick={() => setQuery({ entityName: 'User', fieldName: 'PasswordHash', limit: 8 })}>Lọc mật khẩu</button>
    <output aria-label="Audit visible identity">{result.data?.items.map((row) => `${row.id}|${row.entityName}|${row.fieldName}|${row.fieldAffected}`).join(',') ?? 'loading'}</output>
  </>
}

import React from 'react'

describe('MXE-03 audit filter request ownership', () => {
  beforeEach(() => {
    const NativeRequest = globalThis.Request
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init)
      }
    })
  })

  afterEach(() => {
    reportsApi.util.resetApiState()
    vi.unstubAllGlobals()
  })

  it('keeps request params, response cache identity and visible DOM identity together when responses arrive out of order', async () => {
    let releaseIssue!: () => void
    let releasePassword!: () => void
    const issuePending = new Promise<void>((resolve) => { releaseIssue = resolve })
    const passwordPending = new Promise<void>((resolve) => { releasePassword = resolve })
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requestedUrls.push(request.url)
      const url = new URL(request.url)
      if (url.searchParams.get('entityName') === 'User') {
        await passwordPending
        return pageResponse('password-row', 'Admin', 'User', 'PasswordHash')
      }
      await issuePending
      return pageResponse('issue-row', 'Issue', 'InventoryIssue', 'FULLDAY')
    }))
    const store = createStore()

    render(<Provider store={store}><AuditFilterProbe /></Provider>)
    await vi.waitFor(() => expect(requestedUrls).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Lọc mật khẩu' }))
    await vi.waitFor(() => expect(requestedUrls).toHaveLength(2))

    const filteredUrl = new URL(requestedUrls[1])
    expect(filteredUrl.pathname).toBe('/api/workflow-reports/audit-changes/page')
    expect(filteredUrl.searchParams.get('entityName')).toBe('User')
    expect(filteredUrl.searchParams.get('fieldName')).toBe('PasswordHash')
    expect(filteredUrl.searchParams.get('limit')).toBe('8')

    releasePassword()
    await vi.waitFor(() => expect(screen.getByLabelText('Audit visible identity')).toHaveTextContent('password-row|User|PasswordHash|User / PasswordHash'))

    releaseIssue()
    await vi.waitFor(() => expect(screen.getByLabelText('Audit visible identity')).not.toHaveTextContent('issue-row'))
    expect(screen.getByLabelText('Audit visible identity')).toHaveTextContent('password-row|User|PasswordHash|User / PasswordHash')

    const issueUrl = new URL(requestedUrls[0])
    expect(issueUrl.searchParams.get('entityName')).toBe('InventoryIssue')
    expect(issueUrl.searchParams.get('fieldName')).toBe('FULLDAY')
  })
})
