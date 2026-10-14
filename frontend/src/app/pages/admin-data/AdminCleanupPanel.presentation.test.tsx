import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { QueryView } from '@/lib/queryView'
import { AdminCleanupPanel } from './AdminCleanupPanel'
import type { AdminDataPageModel } from './useAdminDataPageModel'

const ready = <T,>(data: T): QueryView<T> => ({ phase: 'ready', data, isRefreshing: false, truncation: null })

const mockIssue = {
  id: 'issue-1',
  category: 'Thiếu định mức BOM',
  categoryCode: 'missing_bom',
  message: 'Món Cá thu sốt cà chưa có BOM hiệu lực',
  severity: 'error' as const,
  remediationStatus: 'open' as const,
  remediationAt: undefined,
  priorityRank: 1,
  slaHours: 2,
  slaLabel: 'Quá hạn 2 giờ',
  owner: 'Bếp trưởng',
  entityId: 'dish-101',
  entityCode: 'DISH-101',
  entityName: 'Cá thu sốt cà',
  entityLabel: 'Món ăn',
  suggestedAction: 'Nhập công thức BOM mới cho món ăn',
  actionLabel: 'Nhập BOM',
  route: '/admin-data?view=bom-import',
}

const buildModel = (overrides: Partial<AdminDataPageModel> = {}): AdminDataPageModel => ({
  dataQualityFeedback: null,
  dataQualityIssues: [],
  dataQualityReport: null,
  effectiveActiveView: 'cleanup',
  handleDataQualityRemediation: vi.fn(),
  qualityPage: 1,
  queryViews: { dataQuality: ready(null) },
  setActiveView: vi.fn(),
  setQualityPage: vi.fn(),
  updateDataQualityIssueRemediationState: { isLoading: false },
  ...overrides,
} as unknown as AdminDataPageModel)

describe('AdminCleanupPanel data-quality issue presentation and behavior', () => {
  it('renders an empty state with 6 column headers when no issues are found', () => {
    const model = buildModel({ dataQualityIssues: [] })
    render(
      <MemoryRouter>
        <AdminCleanupPanel model={model} />
      </MemoryRouter>,
    )

    const region = screen.getByRole('region', { name: 'Bảng vấn đề dữ liệu cần xử lý' })
    expect(region).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()

    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(6)
    expect(headers.map((h) => h.getAttribute('scope'))).toEqual(['col', 'col', 'col', 'col', 'col', 'col'])
    expect(screen.getByRole('columnheader', { name: 'Vấn đề' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Ưu tiên' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Trạng thái xử lý' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Phụ trách' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Đối tượng' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Thao tác' })).toBeInTheDocument()

    expect(screen.getByText('Chưa phát hiện vấn đề dữ liệu cần xử lý.')).toBeInTheDocument()
  })

  it('renders issues, severity badges, and triggers remediation action upon button click', () => {
    const handleRemediation = vi.fn()
    const model = buildModel({
      dataQualityIssues: [mockIssue],
      handleDataQualityRemediation: handleRemediation,
    })

    render(
      <MemoryRouter>
        <AdminCleanupPanel model={model} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Thiếu định mức BOM')).toBeInTheDocument()
    expect(screen.getByText('Món Cá thu sốt cà chưa có BOM hiệu lực')).toBeInTheDocument()
    expect(screen.getByText('DISH-101')).toBeInTheDocument()
    expect(screen.getByText('Bếp trưởng')).toBeInTheDocument()

    const resolveButton = screen.getByRole('button', { name: 'Đánh dấu đã xử lý' })
    expect(resolveButton).toBeInTheDocument()
    fireEvent.click(resolveButton)

    expect(handleRemediation).toHaveBeenCalledWith(mockIssue, 'resolve')
  })

  it('toggles action button to reopen when issue is already resolved', () => {
    const handleRemediation = vi.fn()
    const resolvedIssue = { ...mockIssue, remediationStatus: 'resolved' as const }
    const model = buildModel({
      dataQualityIssues: [resolvedIssue],
      handleDataQualityRemediation: handleRemediation,
    })

    render(
      <MemoryRouter>
        <AdminCleanupPanel model={model} />
      </MemoryRouter>,
    )

    const reopenButton = screen.getByRole('button', { name: 'Mở lại xử lý' })
    expect(reopenButton).toBeInTheDocument()
    fireEvent.click(reopenButton)

    expect(handleRemediation).toHaveBeenCalledWith(resolvedIssue, 'reopen')
  })
})
