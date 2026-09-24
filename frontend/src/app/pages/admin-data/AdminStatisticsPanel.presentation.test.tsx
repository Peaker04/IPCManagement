import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AdminStatisticsPanel } from './AdminStatisticsPanel'
import type { AdminDataPageModel } from './useAdminDataPageModel'

const ready = { phase: 'ready', data: {}, isRefreshing: false } as const

const model = {
  currentStockPage: 1,
  currentStockPageResponse: { pageNumber: 1, pageSize: 8, totalCount: 0 },
  currentStockRows: [],
  effectiveActiveView: 'statistics',
  operationalKpis: { failedWorkflowCount: 2, criticalDataQualityCount: 0, overdueApprovalCount: 0 },
  priceVariancePage: { pageNumber: 1, pageSize: 8, totalCount: 0 },
  priceWarningCount: 0,
  priceWarningPage: 1,
  priceWarnings: [],
  queryViews: { operationalKpis: ready, ingredientDemand: ready, purchasePlan: ready, currentStock: ready, priceVariance: ready },
  setCurrentStockPage: vi.fn(),
  setPriceWarningPage: vi.fn(),
  shortageCount: 0,
  totalIssuedQty: 0,
  totalPurchaseQty: 0,
  totalReturnedQty: 0,
  totalUsedQty: 0,
} as unknown as AdminDataPageModel

describe('AdminStatisticsPanel presentation', () => {
  it('shows exception statuses without repeating normal-state labels', () => {
    render(<MemoryRouter><AdminStatisticsPanel model={model} /></MemoryRouter>)

    expect(screen.getByText('Cần điều tra')).toBeInTheDocument()
    for (const repeatedNormalLabel of ['Ổn định', 'Đạt', 'Trong SLA', 'Không còn chờ xuất', 'Không cần mua', 'Đã xuất', 'Đã ghi nhận', 'Không hoàn kho']) {
      expect(screen.queryByText(repeatedNormalLabel)).toBeNull()
    }
  })
})
