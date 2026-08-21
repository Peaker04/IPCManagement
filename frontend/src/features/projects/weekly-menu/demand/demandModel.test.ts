import { describe, expect, it } from 'vitest'
import type { DemandLine } from '@/types/workflow'
import type { QuickServingRow } from '../schedule/types'
import {
  aggregateWeekStaleness,
  attachDemandDishSources,
  buildDemandApprovalHref,
  getDemandApprovalPresentation,
  getDemandActionPresentation,
  getDemandDayIndex,
  getDemandInventoryStatus,
  getPendingQuickServingRows,
  getWeekStalenessState,
  isDemandDocumentForDate,
  partitionDemandLines,
} from './demandModel'

describe('material demand model', () => {
  it('uses server totals when summarizing a paged inventory result', () => {
    const lines = [{
      tone: 'warning',
      required: 12,
      available: 4,
      reserved: 1,
    }] as DemandLine[]

    expect(getDemandInventoryStatus(lines, 42, 7)).toEqual({
      warningCount: 1,
      staleCount: 1,
      shortageCount: 7,
      pendingKitchenCount: 0,
      enoughCount: 34,
      totalCount: 42,
      tone: 'danger',
      label: 'Còn nguyên liệu chưa xuất',
    })
  })

  it('marks the week stale when any service date is stale and keeps date-specific reasons', () => {
    expect(aggregateWeekStaleness([
      { serviceDate: '2026-07-20', staleness: { hasExistingPlan: true, isStale: false, canRegenerate: false, regenerationBlockReason: 'Đã có phiếu xuất kho.', lastGeneratedAt: '2026-07-20T08:00:00Z', reasons: [] } },
      { serviceDate: '2026-07-22', staleness: { hasExistingPlan: true, isStale: true, canRegenerate: true, lastGeneratedAt: '2026-07-22T09:00:00Z', reasons: ['Số suất đã thay đổi'] } },
    ])).toEqual({
      hasExistingPlan: true,
      isStale: true,
      canRegenerate: true,
      regenerationBlockReason: null,
      lastGeneratedAt: '2026-07-22T09:00:00Z',
      reasons: ['2026-07-22: Số suất đã thay đổi'],
    })
    expect(aggregateWeekStaleness([
      { serviceDate: '2026-07-20', staleness: { hasExistingPlan: true, isStale: false, canRegenerate: false, reasons: [] } },
    ], 2)).toBeUndefined()
  })

  it('keeps partial week staleness loading and exposes a failed day instead of treating the week as clean', () => {
    const dates = ['2026-07-20', '2026-07-21']
    const cleanResult = { data: { data: { hasExistingPlan: true, isStale: false, canRegenerate: false, reasons: [] } } }

    expect(getWeekStalenessState(dates, [cleanResult, { isFetching: true }])).toEqual({
      status: 'loading',
      expectedDateCount: 2,
      completedDateCount: 1,
      staleness: undefined,
    })
    expect(getWeekStalenessState(dates, [cleanResult, { isError: true }])).toEqual({
      status: 'error',
      expectedDateCount: 2,
      completedDateCount: 1,
      staleness: undefined,
    })
  })

  it('selects the requested day before falling back to the active day', () => {
    const pages = [
      { key: 't2', label: 'Thứ 2', date: '20/07/2026', rows: [] },
      { key: 't3', label: 'Thứ 3', date: '21/07/2026', rows: [] },
    ] as Parameters<typeof getDemandDayIndex>[0]

    expect(getDemandDayIndex(pages, 't3', 't2')).toBe(1)
    expect(getDemandDayIndex(pages, null, 't2')).toBe(0)
  })

  it('uses the consolidated selector for only positive, unfinished servings in the generated week', () => {
    const rows = [
      { serviceDate: '2026-07-20', inputValue: '125.4', isCompleted: false },
      { serviceDate: '2026-07-20', inputValue: '0', isCompleted: false },
      { serviceDate: '2026-07-20', inputValue: '90', isCompleted: true },
      { serviceDate: '2026-07-27', inputValue: '70', isCompleted: false },
    ] as QuickServingRow[]

    const pending = getPendingQuickServingRows(rows, ['2026-07-20'])

    expect(pending).toHaveLength(1)
    expect(pending[0].nextServings).toBe(125)
  })

  it('keeps a terminal week read-only and carries server block reasons into the UI contract', () => {
    expect(aggregateWeekStaleness([
      { serviceDate: '2026-07-20', staleness: { hasExistingPlan: true, isStale: true, canRegenerate: false, regenerationBlockReason: 'Đã có đơn mua hàng.', reasons: ['Menu thay đổi'] } },
      { serviceDate: '2026-07-21', staleness: { hasExistingPlan: true, isStale: true, canRegenerate: false, regenerationBlockReason: 'Đã có phiếu xuất kho.', reasons: ['Menu thay đổi'] } },
    ])).toMatchObject({
      canRegenerate: false,
      regenerationBlockReason: '2026-07-20: Đã có đơn mua hàng. | 2026-07-21: Đã có phiếu xuất kho.',
    })
  })

  it('puts shortages and stale demand lines before sufficient material lines', () => {
    const lines = [
      { id: 'enough', required: 4, available: 10, reserved: 1, tone: 'success' },
      { id: 'short', required: 12, available: 4, reserved: 1, tone: 'danger' },
      { id: 'stale', required: 2, available: 8, reserved: 0, tone: 'warning' },
    ] as DemandLine[]

    const groups = partitionDemandLines(lines)

    expect(groups.exceptionLines.map((line) => line.id)).toEqual(['short', 'stale'])
    expect(groups.sufficientLines.map((line) => line.id)).toEqual(['enough'])
  })

  it('replaces aggregate source counts with dish names from the active day', () => {
    const aggregateLines = [
      { ingredientId: 'ingredient-1', material: 'Bí đao', unit: 'kg', priceTierAmount: 25_000, source: '2 dòng nhu cầu trong ngày' },
      { ingredientId: 'ingredient-2', material: 'Tôm', unit: 'kg', source: '1 dòng nhu cầu trong ngày' },
    ] as DemandLine[]
    const detailLines = [
      { ingredientId: 'ingredient-1', material: 'Bí đao', unit: 'kg', priceTierAmount: 25_000, source: 'Bí đao nấu tôm', serviceDate: '2026-07-24' },
      { ingredientId: 'ingredient-1', material: 'Bí đao', unit: 'kg', priceTierAmount: 25_000, source: 'Canh bí đao', serviceDate: '2026-07-24' },
      { ingredientId: 'ingredient-1', material: 'Bí đao', unit: 'kg', priceTierAmount: 30_000, source: 'Món tier khác', serviceDate: '2026-07-24' },
      { ingredientId: 'ingredient-1', material: 'Bí đao', unit: 'kg', source: 'Món ngày khác', serviceDate: '2026-07-25' },
    ] as DemandLine[]

    expect(attachDemandDishSources(aggregateLines, detailLines, '2026-07-24').map((line) => line.source)).toEqual([
      'Bí đao nấu tôm, Canh bí đao',
      'Chưa xác định',
    ])
  })

  it('uses fallback plan dish sources when detail lines are empty', () => {
    const aggregateLines = [
      { ingredientId: 'ingredient-1', material: 'Chả cá', unit: 'Miếng', source: '1 dòng nhu cầu' },
      { ingredientId: 'ingredient-2', material: 'Chuối', unit: 'Quả', source: '1 dòng nhu cầu' },
    ] as DemandLine[]
    const fallbackSources = {
      'ingredient-1': { dishNames: ['Chả cá chiên', 'Bún chả cá'] },
      'Chuối': { dishNames: ['Chuối tráng miệng'] },
    }

    expect(attachDemandDishSources(aggregateLines, [], '2026-08-10', fallbackSources).map((line) => line.source)).toEqual([
      'Chả cá chiên, Bún chả cá',
      'Chuối tráng miệng',
    ])
  })

  it('matches document lineage to the active day across ISO, compact, and Vietnamese dates', () => {
    const document = (id: string, value = '') => ({
      id,
      type: 'Đơn mua',
      title: 'Chứng từ mua',
      status: 'Đã tạo',
      owner: 'Thu mua',
      summary: '',
      route: '/purchasing',
      tone: 'neutral',
      lines: value ? [{ label: 'Ngày', value }] : [],
    }) as Parameters<typeof isDemandDocumentForDate>[0]

    expect(isDemandDocumentForDate(document('MR-ANV-20260724-FULLDAY'), '2026-07-24')).toBe(true)
    expect(isDemandDocumentForDate(document('MR-1', '24/07/2026'), '2026-07-24')).toBe(true)
    expect(isDemandDocumentForDate(document('MR-ANV-20260725-FULLDAY'), '2026-07-24')).toBe(false)
  })

  it.each([
    ['DRAFT', 'Chờ duyệt', 'warning', 'Mở hàng đợi duyệt'],
    ['MANAGERAPPROVED', 'Đã duyệt', 'success', 'Mở thu mua'],
    ['EXPORTED', 'Đã xuất kho', 'success', 'Mở thu mua'],
    ['CANCELLED', 'Đã hủy', 'neutral', 'Tính lại nhu cầu'],
  ] as const)('maps server demand status %s to operational approval copy', (status, label, tone, actionLabel) => {
    const presentation = getDemandApprovalPresentation([{
      materialRequestId: 'demand-42',
      materialRequestStatus: status,
      sourceDocumentCode: 'MR-20260720-FULLDAY',
      serviceDate: '2026-07-20',
    } as DemandLine], '2026-07-20', status === 'CANCELLED' ? 'Thiếu căn cứ mua hàng.' : undefined)

    expect(presentation).toMatchObject({
      targetId: 'demand-42',
      documentCode: 'MR-20260720-FULLDAY',
      label,
      tone,
      actionLabel,
    })
    expect(presentation.reason).toBeUndefined()
  })

  it.each([
    ['not-created', false, 'generate', true, false],
    ['pending', false, 'approval', true, true],
    ['approved', false, 'purchasing', false, false],
    ['approved', true, 'purchasing', true, true],
    ['rejected', false, 'generate', true, false],
  ] as const)('keeps action hierarchy safe for %s (stale: %s)', (status, stale, primaryAction, showGenerate, generateIsSecondary) => {
    expect(getDemandActionPresentation(status, stale)).toMatchObject({
      primaryAction,
      showGenerate,
      generateIsSecondary,
      requiresRegenerateConfirmation: status === 'approved',
    })
  })

  it('hides regeneration when the server marks the lineage read-only', () => {
    expect(getDemandActionPresentation('rejected', true, false)).toMatchObject({
      showGenerate: false,
      primaryAction: 'generate',
    })
  })

  it('shows not-created state without inventing a target', () => {
    expect(getDemandApprovalPresentation([], '2026-07-20')).toEqual({
      status: 'not-created',
      label: 'Chưa tạo',
      tone: 'neutral',
      actionLabel: 'Tạo nhu cầu từ KHSX',
    })
  })

  it('preserves Monday week, service date, FULLDAY scope, and target ID in the approval link', () => {
    expect(buildDemandApprovalHref({
      week: '2026-07-20',
      serviceDate: '2026-07-22',
      targetId: 'demand/42',
    })).toBe('/approvals?target=material-demand&week=2026-07-20&date=2026-07-22&scope=FULLDAY&id=demand%2F42')
  })
})
