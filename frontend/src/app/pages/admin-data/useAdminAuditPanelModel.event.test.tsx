import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const querySpy = vi.hoisted(() => vi.fn(() => ({
  data: { items: [], limit: 8, hasNext: false, nextCursorOffset: 0 },
  isLoading: false,
  isFetching: false,
  isError: false,
})))

vi.mock('@/app/hooks', () => ({ useAppSelector: () => 'token-mxe08' }))
vi.mock('@/features/reports/reportsApi', () => ({ useGetAuditChangePageQuery: querySpy }))

import { useAdminAuditPanelModel } from './useAdminAuditPanelModel'

describe('MXE-08 useAdminAuditPanelModel event opt-in', () => {
  beforeEach(() => querySpy.mockClear())

  it('adds groupBy=event only for the reconciliation owner', () => {
    const { unmount } = renderHook(() => useAdminAuditPanelModel('audit', true))
    expect(querySpy).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'event' }), { skip: false })
    unmount()

    renderHook(() => useAdminAuditPanelModel('audit'))
    expect(querySpy).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: undefined }), { skip: false })
  })
})
