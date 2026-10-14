import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuAmendmentInboxItem } from '@/api/coordinationApi'

const mocks = vi.hoisted(() => ({
  role: 'quanly',
  items: [] as MenuAmendmentInboxItem[],
  review: vi.fn(),
  execute: vi.fn(),
}))

vi.mock('@/lib/useHasRole', () => ({
  useHasRole: (roles: string[]) => roles.includes(mocks.role),
}))

vi.mock('@/api/coordinationApi', () => ({
  useGetMenuAmendmentsQuery: () => ({
    data: { data: mocks.items },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useReviewMenuAmendmentMutation: () => [mocks.review, { isLoading: false }],
  useExecuteMenuAmendmentMutation: () => [mocks.execute, { isLoading: false }],
}))

import { MenuAmendmentInbox } from './MenuAmendmentInbox'

const buildAmendmentItem = (id: string, status: string, reason: string): MenuAmendmentInboxItem => ({
  menuAmendmentId: id,
  customerId: 'cust-1',
  customerName: 'Công ty Test',
  weekStartDate: '2026-09-14',
  createdAt: '2026-09-12T08:00:00Z',
  status,
  reason,
  requiresReconciliation: false,
  hasPurchaseOrder: false,
  hasReceipt: false,
  hasIssue: false,
  affectedDemandCount: 1,
  affectedPurchaseRequestCount: 1,
})

describe('Menu amendment backend status parity in MenuAmendmentInbox', () => {
  beforeEach(() => {
    mocks.role = 'quanly'
    mocks.items = []
  })

  it('renders exact review lifecycle status badges corresponding to backend MenuAmendmentService contract', () => {
    mocks.items = [
      buildAmendmentItem('amend-1', 'APPROVED_FOR_EXECUTION', 'Đã duyệt chờ thực thi'),
      buildAmendmentItem('amend-2', 'CORRECTION_REQUIRED', 'Yêu cầu chỉnh sửa lại'),
      buildAmendmentItem('amend-3', 'RATIFIED_RECONCILIATION_REQUIRED', 'Đã duyệt kèm đối soát'),
      buildAmendmentItem('amend-4', 'PENDING_REVIEW', 'Chờ duyệt mới'),
      buildAmendmentItem('amend-5', 'EXECUTED', 'Đã thực thi thành công'),
      buildAmendmentItem('amend-6', 'RECONCILIATION_REQUIRED', 'Cần đối soát bổ sung'),
    ]

    render(<MenuAmendmentInbox />)

    const table = screen.getByRole('region', { name: 'Yêu cầu điều chỉnh thực đơn' })
    expect(table).toBeInTheDocument()

    // Verify exact Vietnamese status badges rendered in the DOM
    expect(within(table).getByText('Chờ Admin thực thi')).toBeInTheDocument()
    expect(within(table).getByText('Cần Điều phối chỉnh sửa')).toBeInTheDocument()
    expect(within(table).getByText('Đã duyệt · cần đối soát')).toBeInTheDocument()
    expect(within(table).getByText('Chờ Quản lý duyệt')).toBeInTheDocument()
    expect(within(table).getByText('Đã thực thi')).toBeInTheDocument()
    expect(within(table).getByText('Cần đối soát')).toBeInTheDocument()

    // Ensure raw unmapped status strings or legacy "APPROVED" do not appear as badges
    expect(within(table).queryByText('APPROVED')).toBeNull()
    expect(within(table).queryByText('Đã duyệt')).toBeNull()
  })
})
