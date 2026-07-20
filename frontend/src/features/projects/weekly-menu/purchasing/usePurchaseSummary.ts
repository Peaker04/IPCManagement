import { useMemo, useState } from 'react'
import type { DemandLine } from '@/features/workflow'
import type { MaterialSummary } from '../model/types'
import type { WeeklyScheduleFeedback } from '../schedule/types'
import { buildPurchaseSummaryPresentation, buildWarehouseCsv } from './purchaseSummaryModel'

type Options = {
  scopeKey: string
  customerCode: string
  customerLabel: string
  weekStartDate: string
  weekLabel: string
  materialSummary: MaterialSummary
  demandLines: DemandLine[]
  aggregatedDemandLines: DemandLine[]
}

export function usePurchaseSummary({
  scopeKey,
  customerCode,
  customerLabel,
  weekStartDate,
  weekLabel,
  materialSummary,
  demandLines,
  aggregatedDemandLines,
}: Options) {
  const [navigation, setNavigation] = useState({ scopeKey, pageIndex: 0 })
  const [feedbackState, setFeedbackState] = useState<{
    scopeKey: string
    value: WeeklyScheduleFeedback | null
  }>({ scopeKey, value: null })
  const pageIndex = navigation.scopeKey === scopeKey ? navigation.pageIndex : 0
  const feedback = feedbackState.scopeKey === scopeKey ? feedbackState.value : null
  const presentation = useMemo(
    () => buildPurchaseSummaryPresentation(materialSummary, demandLines, aggregatedDemandLines, pageIndex),
    [aggregatedDemandLines, demandLines, materialSummary, pageIndex],
  )

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
    state: { pageIndex: presentation.pageIndex, feedback },
    actions: {
      setPage: (page: number) => setNavigation({ scopeKey, pageIndex: page - 1 }),
      exportWarehouseReport,
    },
    presentation: { ...presentation, customerLabel, weekLabel, materialCount: Object.keys(materialSummary).length },
  }
}

export type PurchaseSummaryWorkflow = ReturnType<typeof usePurchaseSummary>
