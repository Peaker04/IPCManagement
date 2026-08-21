import { useDeferredValue, useMemo, useState } from 'react'
import { useGetIngredientDemandAggregatePageQuery } from '@/features/reports/reportsApi'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import type { DemandLine } from '@/types/workflow'
import type { MaterialSummary } from '../model/types'
import type { WeeklyScheduleFeedback } from '../schedule/types'
import { buildPurchaseSummaryPresentation, buildWarehouseCsv } from './purchaseSummaryModel'

type Options = {
  enabled?: boolean
  scopeKey: string
  customerId: string
  customerCode: string
  customerLabel: string
  weekStartDate: string
  weekLabel: string
  materialSummary: MaterialSummary
  demandLines: DemandLine[]
  aggregatedDemandLines: DemandLine[]
}

const addIsoDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.valueOf())) return ''
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function usePurchaseSummary({
  enabled = true,
  scopeKey,
  customerId,
  customerCode,
  customerLabel,
  weekStartDate,
  weekLabel,
  materialSummary,
  demandLines,
  aggregatedDemandLines,
}: Options) {
  const [navigation, setNavigation] = useState({ scopeKey, pageIndex: 0 })
  const [searchState, setSearchState] = useState({ scopeKey, value: '' })
  const [feedbackState, setFeedbackState] = useState<{
    scopeKey: string
    value: WeeklyScheduleFeedback | null
  }>({ scopeKey, value: null })
  const pageIndex = navigation.scopeKey === scopeKey ? navigation.pageIndex : 0
  const search = searchState.scopeKey === scopeKey ? searchState.value : ''
  const deferredSearch = useDeferredValue(search.trim())
  const feedback = feedbackState.scopeKey === scopeKey ? feedbackState.value : null
  const localPresentation = useMemo(
    () => buildPurchaseSummaryPresentation(materialSummary, demandLines, aggregatedDemandLines, pageIndex),
    [aggregatedDemandLines, demandLines, materialSummary, pageIndex],
  )
  const aggregateResult = useGetIngredientDemandAggregatePageQuery({
    customerId,
    dateFrom: weekStartDate || undefined,
    dateTo: weekStartDate ? addIsoDays(weekStartDate, 6) : undefined,
    searchKeyword: deferredSearch || undefined,
    pageNumber: pageIndex + 1,
    pageSize: 10,
  }, { skip: !enabled || !customerId || !weekStartDate })
  const shouldLoadAggregate = enabled && Boolean(customerId) && Boolean(weekStartDate)
  const queryView = shouldLoadAggregate
    ? toLabeledQueryView(aggregateResult, 'tổng hợp mua của tuần')
    : null
  const aggregatePage = queryView?.phase === 'ready' ? queryView.data : undefined
  const presentation = aggregatePage ? {
    ...localPresentation,
    usesDemand: aggregatePage.totalCount > 0,
    totalItems: aggregatePage.totalCount,
    totalPages: aggregatePage.totalPages,
    pageIndex: Math.max(0, aggregatePage.pageNumber - 1),
    demandRows: aggregatePage.items,
    materialRows: [],
    shortageCount: aggregatePage.shortageCount,
  } : localPresentation

  const exportWarehouseReport = () => {
    const effectiveCustomerCode = customerCode || 'UNKNOWN'
    const effectiveWeek = weekStartDate || '2026-06-15'
    const csv = buildWarehouseCsv(materialSummary, effectiveCustomerCode, effectiveWeek)
    if (!csv) {
      setFeedbackState({ scopeKey, value: {
        title: 'Chưa có nguyên liệu để gửi kho',
        message: 'Các ca trong tuần đang có số suất bằng 0 nên chưa sinh nhu cầu xuất kho.',
        variant: 'warning',
      } })
      return
    }
    const fileName = `Bao_cao_gui_kho_${effectiveCustomerCode}_tuan_${effectiveWeek}.csv`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setFeedbackState({ scopeKey, value: {
      title: 'Đã xuất báo cáo gửi kho thành công',
      message: `Tệp báo cáo '${fileName}' đã được tải xuống máy tính của bạn.`,
      variant: 'info',
    } })
  }

  return {
    state: { pageIndex: presentation.pageIndex, feedback, search },
    queryView,
    actions: {
      setPage: (page: number) => setNavigation({ scopeKey, pageIndex: page - 1 }),
      setSearch: (value: string) => {
        setSearchState({ scopeKey, value })
        setNavigation({ scopeKey, pageIndex: 0 })
      },
      exportWarehouseReport,
    },
    presentation: { ...presentation, customerLabel, weekLabel, materialCount: Object.keys(materialSummary).length },
  }
}

export type PurchaseSummaryWorkflow = ReturnType<typeof usePurchaseSummary>
