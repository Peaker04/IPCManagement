import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportQueryBoundary } from './ReportQueryBoundary'
import type { QueryView } from '@/lib/queryView'

function ReportShell({ onMount = () => undefined }: { onMount?: () => void }) {
  useEffect(() => {
    onMount()
  }, [onMount])

  return <section data-testid="report-shell"><h2>Báo cáo thử nghiệm</h2><label>Tìm kiếm<input /></label><table><thead><tr><th>Nguyên liệu</th></tr></thead><tbody /></table><nav>Phân trang</nav></section>
}

const views: QueryView<unknown>[] = [
  { phase: 'uninitialized', instruction: 'Chọn phạm vi' },
  { phase: 'loading' },
  { phase: 'forbidden', message: 'Không có quyền' },
  { phase: 'error', message: 'Không tải được', retry: () => undefined, isRetrying: false },
]

describe('ReportQueryBoundary', () => {
  it.each(views)('retains stable geometry but suppresses the stale shell during $phase', (view) => {
    render(<ReportQueryBoundary view={view}><ReportShell /></ReportQueryBoundary>)

    const shellLayer = screen.getByTestId('report-shell').parentElement
    expect(shellLayer).toHaveClass('invisible', 'col-start-1', 'row-start-1')
    expect(shellLayer).toHaveAttribute('inert')
    expect(shellLayer).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not remount the report shell across blocking, ready, and refresh transitions', () => {
    const onMount = vi.fn()
    const loading: QueryView<unknown> = { phase: 'loading' }
    const ready: QueryView<unknown> = { phase: 'ready', data: [], isRefreshing: false, truncation: null }
    const refreshing: QueryView<unknown> = { ...ready, isRefreshing: true }
    const { rerender } = render(<ReportQueryBoundary view={loading}><ReportShell onMount={onMount} /></ReportQueryBoundary>)
    const shell = screen.getByTestId('report-shell')

    rerender(<ReportQueryBoundary view={ready}><ReportShell onMount={onMount} /></ReportQueryBoundary>)
    expect(screen.getByTestId('report-shell')).toBe(shell)
    expect(shell.parentElement).not.toHaveClass('invisible')
    expect(shell.parentElement?.parentElement?.querySelector('.z-10')).toBeNull()

    rerender(<ReportQueryBoundary view={refreshing}><ReportShell onMount={onMount} /></ReportQueryBoundary>)
    expect(screen.getByTestId('report-shell')).toBe(shell)
    expect(screen.getByText('Đang cập nhật...')).toBeInTheDocument()
    expect(shell.parentElement?.parentElement?.querySelector('.z-10')).toHaveClass('pointer-events-none')
    expect(onMount).toHaveBeenCalledTimes(1)
  })
})
