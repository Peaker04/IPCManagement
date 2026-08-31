import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@/lib/routeConfig'
import { isRouteEligible, retainedRoutes } from '@/lib/systemOperationEligibility'
import { ReconciliationComparisonTable } from '@/features/reconciliation/ReconciliationComparisonTable'
import type { ReconciliationLine } from '@/api/reconciliationApi'
import weeklyMenuPageSource from '@/features/projects/pages/WeeklyMenuPage.tsx?raw'

const line: ReconciliationLine = {
  batchLineId: 'line-uuid',
  ingredientId: 'ingredient-uuid',
  ingredientCode: 'NL-001',
  ingredientName: 'Gạo thơm',
  canonicalUnitId: 'unit-uuid',
  canonicalUnitName: 'kg',
  requiredQuantity: 10,
  frozenTolerance: 0.1,
  issuedQuantity: 8,
  issuedRequiredDifference: -2,
  triggers: ['ISSUED_REQUIRED'],
  status: 'NEEDS_REVIEW',
  version: 1,
}


describe('closed-loop reconciliation frontend contract', () => {
  beforeEach(() => {
    window.localStorage.clear()
    const NativeRequest = globalThis.Request
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init)
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('keeps exactly the five workflow routes and blocks excluded direct access', () => {
    expect(retainedRoutes('MATERIAL_RECONCILIATION')).toEqual([
      ROUTES.DASHBOARD,
      ROUTES.WEEKLY_MENU,
      ROUTES.WAREHOUSE,
      ROUTES.RECONCILIATION,
      ROUTES.ADMIN_DATA,
    ])
    expect(isRouteEligible('MATERIAL_RECONCILIATION', ROUTES.PURCHASING)).toBe(false)
    expect(isRouteEligible('MATERIAL_RECONCILIATION', ROUTES.REPORTS)).toBe(false)
  })

  it.each([
    { issuedQuantity: 10, issuedRequiredDifference: 0, status: 'MATCHED', label: 'Khớp' },
    { issuedQuantity: 9.95, issuedRequiredDifference: -0.05, status: 'MATCHED', label: 'Khớp' },
    { issuedQuantity: 8, issuedRequiredDifference: -2, status: 'NEEDS_REVIEW', label: 'Cần kiểm tra' },
    { issuedQuantity: 12, issuedRequiredDifference: 2, status: 'NEEDS_REVIEW', label: 'Cần kiểm tra' },
    { issuedQuantity: null, issuedRequiredDifference: null, status: 'INCOMPLETE', label: 'Chưa xuất đủ' },
  ] as const)('renders stable signed difference label for $status at $issuedQuantity', (sample) => {
    render(<MemoryRouter><ReconciliationComparisonTable lines={[{ ...line, ...sample }]} showAll /></MemoryRouter>)
    expect(screen.getByText(sample.label)).toBeInTheDocument()
    if (sample.issuedQuantity == null) expect(screen.getAllByText('Chưa xuất').length).toBeGreaterThan(0)
  })

  it('keeps transfer controls inside the material-demand tab instead of below the weekly plan', () => {
    expect(weeklyMenuPageSource).toContain("isMaterialReconciliationMode && activeView === 'demand' && <ClosedLoopTransferPanel")
    expect(weeklyMenuPageSource).not.toContain("</QueryViewBoundary>\n      {isMaterialReconciliationMode && <ClosedLoopTransferPanel")
  })

  it('renders only required-versus-issued decision fields with human labels', () => {
    render(<MemoryRouter><ReconciliationComparisonTable lines={[line]} showAll /></MemoryRouter>)
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument()
    expect(screen.getByText('Gạo thơm')).toBeInTheDocument()
    expect(screen.getByText('NL-001')).toBeInTheDocument()
    expect(screen.getByText('-2 kg')).toBeInTheDocument()
    expect(screen.queryByText(/đã mua|mua −/i)).not.toBeInTheDocument()
    expect(screen.queryByText('ingredient-uuid')).not.toBeInTheDocument()
  })
})
