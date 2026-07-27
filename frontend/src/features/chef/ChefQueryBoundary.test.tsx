import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { QueryView } from '@/lib/queryView'
import { ChefQueryBoundary } from './ChefQueryBoundary'

const ready = (overrides: Partial<Extract<QueryView<unknown>, { phase: 'ready' }>> = {}): QueryView<unknown> => ({
  phase: 'ready',
  data: [],
  isRefreshing: false,
  truncation: null,
  ...overrides,
})

const renderBoundary = (views: QueryView<unknown>[], preserveFallback = false) => render(
  <ChefQueryBoundary
    preserveFallback={preserveFallback}
    queries={views.map((view, index) => ({ label: `nguồn ${index + 1}`, view }))}
  >
    <div>Kết quả bếp</div>
  </ChefQueryBoundary>,
)

describe('ChefQueryBoundary', () => {
  it('keeps uninitialized distinct from empty', () => {
    renderBoundary([{ phase: 'uninitialized', instruction: 'Chọn ca sản xuất.' }])

    expect(screen.getByText('Chọn ca sản xuất.')).toBeInTheDocument()
    expect(screen.queryByText('Kết quả bếp')).toBeNull()
  })

  it('blocks children while loading', () => {
    renderBoundary([{ phase: 'loading' }])

    expect(screen.getByText('Đang tải nguồn 1')).toBeInTheDocument()
    expect(screen.queryByText('Kết quả bếp')).toBeNull()
  })

  it('renders forbidden without retry', () => {
    renderBoundary([{ phase: 'forbidden', message: 'Không có quyền.' }])

    expect(screen.getByRole('alert')).toHaveTextContent('Không có quyền.')
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull()
  })

  it('keeps a non-forbidden error retryable', () => {
    const retry = vi.fn()
    renderBoundary([{ phase: 'error', message: 'Lỗi máy chủ.', retry, isRetrying: false }])

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByText('Kết quả bếp')).toBeNull()
  })

  it('renders children for ready-empty', () => {
    renderBoundary([ready()])

    expect(screen.getByText('Kết quả bếp')).toBeInTheDocument()
  })

  it('keeps ready children while refreshing', () => {
    renderBoundary([ready({ isRefreshing: true })])

    expect(screen.getByText('Kết quả bếp')).toBeInTheDocument()
    expect(screen.getByText('Đang cập nhật nguồn 1')).toBeInTheDocument()
  })

  it('shows partial evidence without hiding ready data', () => {
    renderBoundary([ready({ truncation: { shown: 20 } })])

    expect(screen.getByText('Kết quả bếp')).toBeInTheDocument()
    expect(screen.getByText(/20 dòng; kết quả này chưa đầy đủ/)).toBeInTheDocument()
  })

  it('preserves an explicitly labelled fallback on failure', () => {
    renderBoundary([{ phase: 'error', message: 'Lỗi phiếu xuất.', retry: vi.fn(), isRetrying: false }], true)

    expect(screen.getByText('Kết quả bếp')).toBeInTheDocument()
    expect(screen.getByText(/Lỗi phiếu xuất/)).toBeInTheDocument()
  })

  it('keeps the fallback refresh indicator outside document flow', () => {
    renderBoundary([ready({ isRefreshing: true })], true)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Đang cập nhật dữ liệu ca')
    expect(status).toHaveClass('absolute')
    expect(screen.getByText('Kết quả bếp')).toBeInTheDocument()
  })

  it('blocks a grouped ready result when one dependency fails', () => {
    renderBoundary([
      ready(),
      { phase: 'error', message: 'Nguồn phụ lỗi.', retry: vi.fn(), isRetrying: false },
    ])

    expect(screen.queryByText('Kết quả bếp')).toBeNull()
    expect(screen.getByText(/Nguồn phụ lỗi/)).toBeInTheDocument()
  })
})
