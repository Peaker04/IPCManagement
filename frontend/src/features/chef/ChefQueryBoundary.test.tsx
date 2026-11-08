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
    expect(screen.getByText('Kết quả bếp').parentElement).toHaveClass('invisible')
  })

  it('blocks children while loading', () => {
    renderBoundary([{ phase: 'loading' }])

    expect(screen.getByText('Đang tải nguồn 1')).toBeInTheDocument()
    const shell = screen.getByText('Kết quả bếp').parentElement
    expect(shell).toHaveClass('invisible')
    expect(shell).toHaveAttribute('inert')
    expect(shell).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders forbidden without retry', () => {
    renderBoundary([{ phase: 'forbidden', message: 'Không có quyền.' }])

    expect(screen.getByRole('alert')).toHaveTextContent('Không có quyền.')
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull()
  })

  it('prioritizes a retryable error over an earlier loading dependency', () => {
    renderBoundary([
      { phase: 'loading' },
      { phase: 'error', message: 'Nguồn phụ lỗi.', retry: vi.fn(), isRetrying: false },
    ])

    expect(screen.getByRole('alert')).toHaveTextContent('Nguồn phụ lỗi.')
    expect(screen.queryByText('Đang tải nguồn 1')).toBeNull()
  })

  it('never exposes fallback content when access becomes forbidden', () => {
    renderBoundary([{ phase: 'forbidden', message: 'Không có quyền.' }], true)
    const shell = screen.getByText('Kết quả bếp').parentElement
    expect(shell).toHaveClass('invisible')
    expect(shell).toHaveAttribute('inert')
    expect(shell).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps a non-forbidden error retryable', () => {
    const retry = vi.fn()
    renderBoundary([{ phase: 'error', message: 'Lỗi máy chủ.', retry, isRetrying: false }])

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByText('Kết quả bếp').parentElement).toHaveClass('invisible')
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

  it('keeps decision-relevant ready notices in normal flow instead of the blocking overlay cell', () => {
    renderBoundary([ready({ isRefreshing: true, truncation: { shown: 20 } })])

    expect(screen.getByText('Kết quả bếp')).toBeInTheDocument()
    expect(screen.getByText('Đang cập nhật nguồn 1').closest('.grid')).toBeNull()
    expect(screen.getByText(/20 dòng; kết quả này chưa đầy đủ/).closest('.grid')).toBeNull()
  })

  it('preserves an explicitly labelled fallback on failure', () => {
    renderBoundary([{ phase: 'error', message: 'Lỗi phiếu xuất.', retry: vi.fn(), isRetrying: false }], true)

    expect(screen.getByText('Kết quả bếp')).toBeInTheDocument()
    expect(screen.getByText(/Lỗi phiếu xuất/)).toBeInTheDocument()
  })

  it('keeps the fallback refresh indicator in a stable non-overlapping flow slot', () => {
    renderBoundary([ready({ isRefreshing: true })], true)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Đang cập nhật dữ liệu ca')
    expect(status).toHaveAttribute('data-refresh-status', 'true')
    expect(status).not.toHaveClass('absolute')
    expect(screen.getByText('Kết quả bếp')).toBeInTheDocument()
  })

  it('retains the same shell node across initial load and ready', () => {
    const loading: QueryView<unknown> = { phase: 'loading' }
    const { rerender } = render(<ChefQueryBoundary stabilizeInitialLoad preserveFallback queries={[{ label: 'kế hoạch', view: loading }]}><div data-testid="chef-shell">Kết quả bếp</div></ChefQueryBoundary>)
    const shell = screen.getByTestId('chef-shell')
    rerender(<ChefQueryBoundary stabilizeInitialLoad preserveFallback queries={[{ label: 'kế hoạch', view: ready() }]}><div data-testid="chef-shell">Kết quả bếp</div></ChefQueryBoundary>)
    expect(screen.getByTestId('chef-shell')).toBe(shell)
    expect(shell.parentElement).not.toHaveClass('invisible')
  })

  it('uses the retained shell instead of a generic initial-load reservation', () => {
    const { rerender } = render(
      <ChefQueryBoundary stabilizeInitialLoad preserveFallback queries={[{ label: 'kế hoạch', view: { phase: 'loading' } }]}>
        <div>Kết quả bếp</div>
      </ChefQueryBoundary>,
    )

    const loading = screen.getByText('Đang tải kế hoạch').closest('[data-initial-load]')
    expect(loading).toHaveAttribute('data-initial-load', 'true')
    expect(loading).not.toHaveClass('min-h-[32rem]')
    expect(screen.getByText('Đang tải kế hoạch').closest('.grid')).not.toBeNull()
    expect(screen.getByText('Kết quả bếp').parentElement).toHaveClass('invisible')

    rerender(
      <ChefQueryBoundary stabilizeInitialLoad preserveFallback queries={[{ label: 'kế hoạch', view: ready() }]}>
        <div>Kết quả bếp</div>
      </ChefQueryBoundary>,
    )
    expect(screen.getByText('Kết quả bếp').parentElement).not.toHaveClass('invisible')
  })

  it('keeps the reservation until every initial dependency is ready', () => {
    render(
      <ChefQueryBoundary stabilizeInitialLoad preserveFallback queries={[
        { label: 'kế hoạch', view: ready() },
        { label: 'phiếu xuất', view: { phase: 'loading' } },
      ]}>
        <div>Kết quả bếp</div>
      </ChefQueryBoundary>,
    )

    expect(screen.getByText('Đang tải phiếu xuất').closest('[data-initial-load]')).not.toHaveClass('min-h-[32rem]')
    expect(screen.getByText('Kết quả bếp').parentElement).toHaveClass('invisible')
  })

  it('blocks a grouped ready result when one dependency fails', () => {
    renderBoundary([
      ready(),
      { phase: 'error', message: 'Nguồn phụ lỗi.', retry: vi.fn(), isRetrying: false },
    ])

    expect(screen.getByText('Kết quả bếp').parentElement).toHaveClass('invisible')
    expect(screen.getByText(/Nguồn phụ lỗi/)).toBeInTheDocument()
  })
})
