import { fireEvent, render, screen, act } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { HandoffScreen } from './HandoffScreen'

const source = vi.hoisted(() => ({ pending: false, denied: false, calls: [] as number[] }))
vi.mock('@/api/reportsApi', () => ({ useGetIngredientDemandAggregatePageQuery: ({ pageNumber, searchKeyword }: { pageNumber: number; searchKeyword?: string }) => {
  source.calls.push(pageNumber)
  if (source.denied) return { isError: true, error: { status: 403 } }
  if (source.pending) return { isFetching: true, currentData: undefined }
  return { isSuccess: true, currentData: { items: [], totalCount: searchKeyword ? 0 : 21, totalPages: searchKeyword ? 0 : 3, pageNumber, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 } }
} }))
const props = { scope: { customerId: 'customer', customerLabel: 'Customer', weekStartDate: '2026-09-21', weekLabel: 'Week', menuPrice: 25000 as const, fixedBomRatePercent: 100, activeServiceLabel: 'Week', displayDays: [] }, customerCode: 'KH', materialSummary: {}, bomQueries: [], bomBlocked: false }

it('keeps page navigation focusable outside pending data, blocks repeats, and clears metadata on search or denial', () => {
  source.pending = false; source.denied = false; source.calls = []
  const { rerender } = render(<HandoffScreen {...props}/>)
  const next = screen.getByRole('button', { name: /Trang sau/ })
  next.focus(); source.pending = true; fireEvent.click(next)
  expect(screen.getByRole('navigation', { name: 'Phân trang danh sách' })).toHaveAttribute('aria-busy', 'true')
  expect(next).toHaveFocus(); expect(next).toHaveAttribute('aria-disabled', 'true')
  expect(next.closest('[inert]')).toBeNull()
  fireEvent.click(next); expect(source.calls.at(-1)).toBe(2)
  source.pending = false; rerender(<HandoffScreen {...props}/>)
  expect(next).toHaveFocus()
  fireEvent.click(next)
  expect(screen.getByText('Trang 3/3')).toBeVisible()
  expect(next).toBeDisabled()
  expect(screen.getByRole('button', { name: /Trang trước/ })).toHaveFocus()
  source.pending = true
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no-match' } })
  expect(screen.queryByRole('navigation', { name: 'Phân trang danh sách' })).not.toBeInTheDocument()
  source.pending = false; act(() => rerender(<HandoffScreen {...props}/>))
  expect(screen.getByText('Không có kết quả phù hợp')).toBeVisible()
  source.denied = true; rerender(<HandoffScreen {...props}/>)
  expect(screen.getByRole('alert')).toHaveTextContent('không có quyền')
  expect(screen.queryByRole('navigation', { name: 'Phân trang danh sách' })).not.toBeInTheDocument()
})
