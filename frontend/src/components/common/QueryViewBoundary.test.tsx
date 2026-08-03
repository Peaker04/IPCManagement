import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { QueryView } from '@/lib/queryView'
import { QueryViewBoundary } from './QueryViewBoundary'

const ready = (overrides: Partial<Extract<QueryView<unknown>, { phase: 'ready' }>> = {}): QueryView<unknown> => ({
  phase: 'ready',
  data: [],
  isRefreshing: false,
  truncation: null,
  ...overrides,
})

const renderBoundary = (views: QueryView<unknown>[], preserveFallback = false) => render(
  <QueryViewBoundary
    preserveFallback={preserveFallback}
    queries={views.map((view, index) => ({ label: `nguồn ${index + 1}`, view }))}
  >
    <div>Kết quả điều phối</div>
  </QueryViewBoundary>,
)

describe('QueryViewBoundary', () => {
  it('keeps uninitialized distinct from empty', () => {
    renderBoundary([{ phase: 'uninitialized', instruction: 'Chọn khách hàng.' }])
    expect(screen.getByText('Chọn khách hàng.')).toBeInTheDocument()
    expect(screen.queryByText('Kết quả điều phối')).toBeNull()
  })

  it('blocks false-empty while loading', () => {
    renderBoundary([{ phase: 'loading' }])
    expect(screen.getByText('Đang tải nguồn 1')).toBeInTheDocument()
    expect(screen.queryByText('Kết quả điều phối')).toBeNull()
  })

  it('renders forbidden without retry', () => {
    renderBoundary([{ phase: 'forbidden', message: 'Không có quyền.' }])
    expect(screen.getByRole('alert')).toHaveTextContent('Không có quyền.')
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull()
  })

  it('keeps non-forbidden errors retryable', () => {
    const retry = vi.fn()
    renderBoundary([{ phase: 'error', message: 'Lỗi máy chủ.', retry, isRetrying: false }])
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByText('Kết quả điều phối')).toBeNull()
  })

  it('prioritizes an actionable failure over an earlier passive loading state', () => {
    renderBoundary([
      { phase: 'loading' },
      { phase: 'error', message: 'Lỗi chỉ số.', retry: vi.fn(), isRetrying: false },
    ])

    expect(screen.getByRole('alert')).toHaveTextContent('Lỗi chỉ số.')
    expect(screen.queryByText('Đang tải nguồn 1')).toBeNull()
    expect(screen.queryByText('Kết quả điều phối')).toBeNull()
  })

  it('renders ready-empty as an authoritative result', () => {
    renderBoundary([ready()])
    expect(screen.getByText('Kết quả điều phối')).toBeInTheDocument()
  })

  it('keeps stale content while refreshing without changing document flow', () => {
    renderBoundary([ready({ isRefreshing: true })])
    expect(screen.getByText('Kết quả điều phối')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveClass('absolute')
  })

  it('shows partial evidence without hiding ready data', () => {
    renderBoundary([ready({ truncation: { shown: 20, total: 25 } })])
    expect(screen.getByText('Kết quả điều phối')).toBeInTheDocument()
    expect(screen.getByText(/20\/25 dòng; kết quả này chưa đầy đủ/)).toBeInTheDocument()
  })

  it('preserves explicitly available fallback data on failure', () => {
    renderBoundary([{ phase: 'error', message: 'Lỗi tải.', retry: vi.fn(), isRetrying: false }], true)
    expect(screen.getByText('Kết quả điều phối')).toBeInTheDocument()
    expect(screen.getByText(/Lỗi tải/)).toBeInTheDocument()
  })
})
