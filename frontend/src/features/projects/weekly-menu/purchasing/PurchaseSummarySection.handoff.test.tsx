import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DemandSummary } from '@/components/common/DemandSummary'
import { mapDemandAggregateLine } from '@/api/reportMappers'
import PurchaseSummarySection from './PurchaseSummarySection'
import type { PurchaseSummaryWorkflow } from './usePurchaseSummary'

const aggregate = (issuedQty: number, receivedByKitchenQty: number) => mapDemandAggregateLine({
  requestDate: '2026-08-15', customerId: 'customer-a', customerName: 'Khách A', priceTierAmount: 25000,
  ingredientId: 'rice', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', totalRequiredQty: 200,
  currentStockQty: 200, suggestedPurchaseQty: 0, fulfilledQty: 200, unissuedQty: 0,
  pendingKitchenReceiptQty: 0, outstandingQty: 0, fulfillmentStatus: 'FULFILLED',
  lineCount: 2, hasCancelledLine: false, issuedQty, receivedByKitchenQty, remainingToIssueQty: 200 - issuedQty,
})

describe('physical handoff consumers', () => {
  it.each([[0, 0, 'Chưa xuất'], [80, 30, 'Chưa xuất'], [200, 0, 'Chờ nhận'], [200, 200, 'Bếp đã nhận']])(
    'summary displays issue %s / ack %s without buying or stock claims, including actors denied destinations',
    (issued, received, status) => {
      const workflow = {
        actions: { setPage: vi.fn(), setSearch: vi.fn() }, state: { search: '', pageIndex: 0, feedback: null },
        queryView: null,
        presentation: { usesDemand: true, totalItems: 1, materialCount: 1, totalCost: 0, pageIndex: 0,
          shortageCount: issued < 200 ? 1 : 0, pendingKitchenCount: issued > received ? 1 : 0,
          customerLabel: 'Khách A', weekLabel: 'Tuần đang xem', demandRows: [aggregate(issued, received)], materialRows: [] },
      } as unknown as PurchaseSummaryWorkflow
      render(<PurchaseSummarySection workflow={workflow} />)
      expect(screen.getAllByRole('columnheader')).toHaveLength(6)
      expect(screen.getByRole('columnheader', { name: 'Bàn giao' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Nguyên liệu / nguồn' })).toBeInTheDocument()
      expect(screen.getByText((_, element) => element?.textContent === `Đã xuất: ${issued} kg`)).toBeInTheDocument()
      expect(screen.getByText((_, element) => element?.textContent === `Chưa xuất: ${200 - issued} kg`)).toBeInTheDocument()
      expect(screen.getByText(status, { selector: 'span' })).toBeInTheDocument()
      expect(screen.queryByText('Đủ hàng')).not.toBeInTheDocument()
      expect(screen.queryByText('Tồn khả dụng')).not.toBeInTheDocument()
      // No destination permission or exact source command eligibility is supplied: actor handoff only.
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByText('Khách A · 25k · 2 dòng nhu cầu')).toBeInTheDocument()
    },
  )

  it('warehouse shared summary distinguishes gross issue from allocation and cannot offer buying', () => {
    render(<DemandSummary lines={[aggregate(0, 0)]} showServiceDate />)
    expect(screen.getByRole('columnheader', { name: 'Bàn giao' })).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === 'Đã xuất: 0 kg')).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === 'Chưa xuất: 200 kg')).toBeInTheDocument()
    expect(screen.getByText('Kho xử lý xuất')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('Đủ hàng')).not.toBeInTheDocument()
  })
})
