import { useMemo, useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { apiSlice } from '@/api/apiSlice'
import { useGenerateMaterialDemandMutation, useGetApprovalHistoryQuery, useGetIngredientDemandAggregatePageQuery, useGetIngredientDemandQuery, useGetMaterialDemandStalenessQuery, useGetWorkflowDocumentsQuery } from '@/api/workflowApi'
import type { DemandLine } from '@/types/workflow'
import { useUpsertQuickServingsMutation } from '@/api/coordinationApi'
import { aggregateDemandLinesByMaterial, runInBatches } from '../model/scope'
import { getApiErrorMessage } from '../model/formatters'
import { toQueryView } from '@/lib/queryView'
import type { WeeklyPlanRow } from '../model/types'
import type { QuickServingRow, WeeklyMenuScope, WeeklyScheduleFeedback } from '../schedule/types'
import { attachDemandDishSources, buildDemandApprovalHref, buildDemandDayPages, buildKhsxDraftDocument, getDemandApprovalPresentation, getDemandDayIndex, getDemandInventoryStatus, getPendingQuickServingRows, getWeekStalenessState, isDemandDocumentForDate, partitionDemandLines } from './demandModel'

type Options = {
  enabled?: boolean
  stalenessEnabled?: boolean
  scope: WeeklyMenuScope
  reportDateFrom?: string
  reportDateTo?: string
  sourceMenuValue: string
  customerCode: string
  customerLabel: string
  materialSummaryCount: number
  weeklyPlanRows: WeeklyPlanRow[]
  invalidScheduleMenuPrices: number[]
  quickServingRows: QuickServingRow[]
}

const EMPTY_QUERY_ROWS: never[] = []

export function useMaterialDemand({
  enabled = true,
  stalenessEnabled = enabled,
  scope,
  reportDateFrom,
  reportDateTo,
  sourceMenuValue,
  customerCode,
  customerLabel,
  materialSummaryCount,
  weeklyPlanRows,
  invalidScheduleMenuPrices,
  quickServingRows,
}: Options) {
  const reduxDispatch = useAppDispatch()
  const scopeKey = `${scope.customerId}:${scope.weekStartDate}`
  const [navigation, setNavigation] = useState({
    scopeKey,
    selectedDayKey: null as string | null,
    aggregatePageNumber: 1,
  })
  const [feedbackState, setFeedbackState] = useState<{
    scopeKey: string
    value: WeeklyScheduleFeedback | null
  }>({ scopeKey, value: null })
  const selectedDayKey = navigation.scopeKey === scopeKey ? navigation.selectedDayKey : null
  const aggregatePageNumber = navigation.scopeKey === scopeKey ? navigation.aggregatePageNumber : 1
  const feedback = feedbackState.scopeKey === scopeKey ? feedbackState.value : null
  const setFeedback = (value: WeeklyScheduleFeedback | null) => setFeedbackState({ scopeKey, value })
  const serviceDates = useMemo(
    () => Array.from(new Set(weeklyPlanRows.map((row) => row.serviceDate).filter(Boolean))),
    [weeklyPlanRows],
  )
  const [generateMaterialDemand, { isLoading: isGenerating }] = useGenerateMaterialDemandMutation()
  const [upsertQuickServings, { isLoading: isSavingQuickServings }] = useUpsertQuickServingsMutation()
  const reportQuery = useMemo(() => ({
    limit: 100,
    customerId: scope.customerId,
    dateFrom: reportDateFrom,
    dateTo: reportDateTo,
  }), [reportDateFrom, reportDateTo, scope.customerId])
  const demandQuery = useGetIngredientDemandQuery(reportQuery, { skip: !enabled || !scope.customerId })
  const documentsQuery = useGetWorkflowDocumentsQuery(reportQuery, { skip: !enabled || !scope.customerId })
  const stalenessQuery = (serviceDate?: string) => ({
    serviceDate: serviceDate ?? '',
    customerId: scope.customerId,
    scope: 'FULLDAY' as const,
  })
  const staleness0 = useGetMaterialDemandStalenessQuery(stalenessQuery(serviceDates[0]), { skip: !stalenessEnabled || !scope.customerId || !serviceDates[0] })
  const staleness1 = useGetMaterialDemandStalenessQuery(stalenessQuery(serviceDates[1]), { skip: !stalenessEnabled || !scope.customerId || !serviceDates[1] })
  const staleness2 = useGetMaterialDemandStalenessQuery(stalenessQuery(serviceDates[2]), { skip: !stalenessEnabled || !scope.customerId || !serviceDates[2] })
  const staleness3 = useGetMaterialDemandStalenessQuery(stalenessQuery(serviceDates[3]), { skip: !stalenessEnabled || !scope.customerId || !serviceDates[3] })
  const staleness4 = useGetMaterialDemandStalenessQuery(stalenessQuery(serviceDates[4]), { skip: !stalenessEnabled || !scope.customerId || !serviceDates[4] })
  const staleness5 = useGetMaterialDemandStalenessQuery(stalenessQuery(serviceDates[5]), { skip: !stalenessEnabled || !scope.customerId || !serviceDates[5] })
  const staleness6 = useGetMaterialDemandStalenessQuery(stalenessQuery(serviceDates[6]), { skip: !stalenessEnabled || !scope.customerId || !serviceDates[6] })
  const stalenessResults = [staleness0, staleness1, staleness2, staleness3, staleness4, staleness5, staleness6]
  const weekStaleness = getWeekStalenessState(
    serviceDates,
    stalenessResults,
  )
  const staleness = weekStaleness.staleness
  const dayPages = useMemo(() => buildDemandDayPages(scope, weeklyPlanRows), [scope, weeklyPlanRows])
  const dayIndex = getDemandDayIndex(dayPages, selectedDayKey, scope.activeDayKey)
  const activeDay = dayPages[dayIndex]
  const activeDate = activeDay?.rows[0]?.serviceDate ?? ''
  const activeDateIndex = serviceDates.indexOf(activeDate)
  const activeStaleness = activeDateIndex >= 0 ? stalenessResults[activeDateIndex]?.data?.data ?? undefined : undefined
  const regenerableServiceDates = serviceDates.filter((_, index) => stalenessResults[index]?.data?.data?.canRegenerate !== false)
  const aggregateQuery = useGetIngredientDemandAggregatePageQuery({
    customerId: scope.customerId,
    dateFrom: activeDate || undefined,
    dateTo: activeDate || undefined,
    pageNumber: aggregatePageNumber,
    pageSize: 100,
  }, { skip: !enabled || !scope.customerId || !activeDate })
  const retryDemand = () => Promise.all([
    ...(!demandQuery.isUninitialized ? [demandQuery.refetch()] : []),
    ...(!documentsQuery.isUninitialized ? [documentsQuery.refetch()] : []),
    ...(!aggregateQuery.isUninitialized ? [aggregateQuery.refetch()] : []),
  ])
  const currentDemandData = demandQuery.currentData !== undefined
    && documentsQuery.currentData !== undefined
    && aggregateQuery.currentData !== undefined
    ? {
        demandLines: demandQuery.currentData,
        workflowDocuments: documentsQuery.currentData,
        aggregatePage: aggregateQuery.currentData,
      }
    : undefined
  const demandView = toQueryView({
    currentData: currentDemandData,
    error: demandQuery.error ?? documentsQuery.error ?? aggregateQuery.error,
    isUninitialized: demandQuery.isUninitialized || documentsQuery.isUninitialized || aggregateQuery.isUninitialized,
    isLoading: demandQuery.isLoading || documentsQuery.isLoading || aggregateQuery.isLoading,
    isFetching: demandQuery.isFetching || documentsQuery.isFetching || aggregateQuery.isFetching,
    isSuccess: demandQuery.isSuccess && documentsQuery.isSuccess && aggregateQuery.isSuccess,
    isError: demandQuery.isError || documentsQuery.isError || aggregateQuery.isError,
  }, {
    instruction: !scope.customerId
      ? 'Chọn khách hàng để xem nhu cầu nguyên liệu.'
      : !activeDate
        ? 'Chọn ngày KHSX để xem nhu cầu nguyên liệu.'
        : 'Mở tab Nhu cầu để tải dữ liệu nguyên liệu.',
    retry: retryDemand,
    errorMessage: 'Không tải được nhu cầu nguyên liệu.',
    forbiddenMessage: 'Bạn không có quyền xem nhu cầu nguyên liệu của phạm vi này.',
  })
  const demandData = demandView.phase === 'ready' ? demandView.data : undefined
  const demandLines = demandData ? demandData.demandLines : EMPTY_QUERY_ROWS
  const workflowDocuments = demandData ? demandData.workflowDocuments : EMPTY_QUERY_ROWS
  const aggregatePage = demandData?.aggregatePage
  const isFetchingAggregate = aggregateQuery.isFetching
  const activeDemand = demandLines.find((line) => line.serviceDate === activeDate && line.materialRequestId)
    ?? (activeStaleness?.materialRequestId ? {
      materialRequestId: activeStaleness.materialRequestId,
      materialRequestStatus: activeStaleness.status ?? undefined,
      sourceDocumentCode: activeStaleness.requestCode ?? undefined,
      serviceDate: activeDate,
    } as DemandLine : undefined)
  const { currentData: approvalHistoryResponse, isError: isApprovalHistoryError } = useGetApprovalHistoryQuery({
    documentType: 'material-demand',
    documentId: activeDemand?.materialRequestId ?? '',
  }, { skip: !enabled || !activeDemand?.materialRequestId })
  const rejectionReason = approvalHistoryResponse?.data
    ?.filter((item) => item.decision.toUpperCase() === 'REJECT')
    .at(-1)?.reason ?? undefined
  const demandApprovalStatus = getDemandApprovalPresentation(activeDemand ? [activeDemand] : demandLines, activeDate, rejectionReason)
  const approvalHref = demandApprovalStatus.targetId
    ? buildDemandApprovalHref({
      week: scope.weekStartDate,
      serviceDate: activeDate,
      targetId: demandApprovalStatus.targetId,
    })
    : undefined
  const aggregateLines = attachDemandDishSources(aggregatePage?.items ?? [], demandLines, activeDate)
  const inventoryStatus = getDemandInventoryStatus(aggregateLines, aggregatePage?.totalCount, aggregatePage?.shortageCount)
  const inventoryGroups = partitionDemandLines(aggregateLines)
  const activeQuickServingRows = activeDay ? quickServingRows.filter((row) => row.serviceDate === activeDate) : []
  const aggregatedDemandLines = aggregateDemandLinesByMaterial(demandLines)
  const draftDocument = buildKhsxDraftDocument({ activeDay, allRows: weeklyPlanRows, customerCode, customerLabel, hasDemand: Boolean(activeDemand) })
  const backendDocuments = workflowDocuments.filter((document) => ['KHSX', 'Đơn mua', 'Phiếu xuất'].includes(document.type))
  const activeDateDocuments = backendDocuments.filter((document) => isDemandDocumentForDate(document, activeDate))
  const documents = draftDocument ? [draftDocument, ...activeDateDocuments] : activeDateDocuments
  const weeklyDocuments = draftDocument ? [draftDocument, ...backendDocuments] : backendDocuments
  // Nếu một trong ba nguồn nhu cầu lỗi/forbidden thì danh sách rỗng KHÔNG có
  // nghĩa là tuần này không cần mua gì; view state quyết định presentation.
  const isDemandError = demandView.phase === 'error' || demandView.phase === 'forbidden'
  const isDemandRetrying = demandView.phase === 'error'
    ? demandView.isRetrying
    : demandView.phase === 'ready' && demandView.isRefreshing

  const selectDay = (dayKey: string | null) => {
    setNavigation({ scopeKey, selectedDayKey: dayKey, aggregatePageNumber: 1 })
  }

  const generate = async () => {
    if (!scope.customerId) {
      setFeedback({ title: 'Chưa chọn khách hàng', message: 'Vui lòng chọn khách hàng trước khi tạo nhu cầu nguyên liệu.', variant: 'warning' })
      return
    }
    if (serviceDates.length === 0) {
      setFeedback({ title: 'Chưa có ngày để tạo nhu cầu', message: 'Vui lòng nhập hoặc tải kế hoạch tuần trước khi tạo nhu cầu nguyên liệu.', variant: 'warning' })
      return
    }
    if (weekStaleness.status !== 'ready') {
      setFeedback({
        title: weekStaleness.status === 'error' ? 'Chưa kiểm tra được độ mới nhu cầu' : 'Đang kiểm tra độ mới nhu cầu',
        message: `Đã kiểm tra ${weekStaleness.completedDateCount}/${weekStaleness.expectedDateCount} ngày. Vui lòng chờ hoặc thử lại trước khi tạo nhu cầu.`,
        variant: weekStaleness.status === 'error' ? 'danger' : 'info',
      })
      return
    }
    if (regenerableServiceDates.length === 0) {
      setFeedback({
        title: 'Nhu cầu đã khóa, chỉ có thể xem',
        message: weekStaleness.staleness?.regenerationBlockReason ?? 'Các ngày trong tuần đã có chứng từ nghiệp vụ phía sau. Hãy dùng luồng điều chỉnh riêng thay vì tính đè.',
        variant: 'info',
      })
      return
    }
    if (invalidScheduleMenuPrices.length > 0) {
      setFeedback({ title: 'Định mức không hợp lệ', message: 'Có lịch thực đơn dùng giá ngoài 25k, 30k hoặc 34k. Vui lòng nhập lại thực đơn với định mức cố định trước khi tạo nhu cầu.', variant: 'danger' })
      return
    }
    const missingServings = weeklyPlanRows.filter((row) => row.portions <= 0)
    if (missingServings.length > 0) {
      const dates = Array.from(new Set(missingServings.map((row) => row.date))).slice(0, 4)
      setFeedback({ title: 'Chưa tạo được nhu cầu', message: `Hiện còn ${missingServings.length} dòng KHSX chưa có số suất vận hành${dates.length > 0 ? ` (${dates.join(', ')})` : ''}. Cần có số suất chốt hoặc số suất tạm từ tệp trước khi tạo nhu cầu.`, variant: 'danger' })
      return
    }
    const pending = getPendingQuickServingRows(quickServingRows, serviceDates)
    if (pending.length > 0) {
      setFeedback({ title: 'Đang hoàn tất số suất', message: `Đang lưu và chốt ${pending.length} ca trước khi tạo nhu cầu nguyên liệu.`, variant: 'info' })
      try {
        await runInBatches(pending, 3, async (row) => {
          const response = await upsertQuickServings({ customerId: scope.customerId, serviceDate: row.serviceDate, shiftName: row.shiftName, servings: row.nextServings, complete: true }).unwrap()
          if (!response.success) throw new Error(response.message || 'Không hoàn tất được số suất.')
        })
      } catch (error) {
        setFeedback({ title: 'Chưa hoàn tất được số suất', message: getApiErrorMessage(error, 'Không lưu/chốt được số suất đang nhập. Vui lòng kiểm tra lại ngày, ca và khách hàng.'), variant: 'danger' })
        return
      }
    }
    setFeedback({ title: 'Đang tạo nhu cầu', message: `Đang tính nhu cầu nguyên liệu cho ${regenerableServiceDates.length}/${serviceDates.length} ngày có thể cập nhật.`, variant: 'info' })
    const results = await runInBatches(regenerableServiceDates, 2, async (serviceDate) => {
      try {
        const response = await generateMaterialDemand({ serviceDate, customerId: scope.customerId, scope: 'FULLDAY' }).unwrap()
        if (!response.success || !response.data) throw new Error(response.message || 'Không tạo được nhu cầu nguyên liệu.')
        return { serviceDate, response }
      } catch (error) {
        return { serviceDate, error }
      }
    })
    const succeeded = results.filter((result): result is { serviceDate: string; response: NonNullable<(typeof result)['response']> } => 'response' in result)
    if (succeeded.length === 0) {
      const firstError = results.find((result) => 'error' in result)?.error
      setFeedback({ title: 'Chưa tạo được nhu cầu', message: getApiErrorMessage(firstError, 'Không tìm thấy số suất đã chốt cho các ngày trong tuần.'), variant: 'danger' })
      return
    }
    reduxDispatch(apiSlice.util.invalidateTags(['Coordination']))
    const skipped = results.length - succeeded.length
    const demandLineCount = succeeded.reduce((sum, result) => sum + result.response.data!.lines.length, 0)
    const shortageLineCount = succeeded.reduce((sum, result) => sum + result.response.data!.lines.filter((line) => line.suggestedPurchaseQty > 0).length, 0)
    const missingBomCount = succeeded.reduce((sum, result) => sum + result.response.data!.missingBomDishes.length, 0)
    const planLineCount = succeeded.reduce((sum, result) => sum + result.response.data!.productionPlanLineCount, 0)
    setFeedback({
      title: skipped > 0 ? 'Đã tạo nhu cầu cho ngày đã chốt' : 'Đã tạo nhu cầu cho tuần',
      message: `Tạo thành công ${succeeded.length}/${results.length} ngày, ${planLineCount} dòng KHSX, ${demandLineCount} dòng nguyên liệu, ${shortageLineCount} dòng thiếu. ${shortageLineCount > 0 ? 'Kế hoạch thu mua dự kiến sẽ lấy trực tiếp từ nhu cầu, tồn kho và lượng hàng đang chờ nhận.' : 'Không phát sinh dòng thiếu để mua thêm.'} ${missingBomCount > 0 ? `${missingBomCount} món chưa có định lượng nguyên liệu cần bổ sung.` : 'Định lượng nguyên liệu đã đủ cho các dòng nhu cầu.'}`,
      variant: missingBomCount > 0 || skipped > 0 ? 'warning' : 'info',
    })
  }

  return {
    scope,
    dataState: demandView,
    state: { selectedDayKey, aggregatePageNumber, feedback },
    status: {
      isGenerating,
      isSavingQuickServings,
      isFetchingAggregate,
      isDemandError,
      isDemandRetrying,
      isApprovalHistoryError,
      stalenessState: weekStaleness.status,
      stalenessCompletedDateCount: weekStaleness.completedDateCount,
      stalenessExpectedDateCount: weekStaleness.expectedDateCount,
    },
    actions: {
      selectDay,
      retryDemand,
      setAggregatePage: (page: number) => setNavigation({
        scopeKey,
        selectedDayKey,
        aggregatePageNumber: page,
      }),
      generate,
    },
    presentation: {
      sourceMenuValue, materialSummaryCount, weeklyPlanRows, missingBomRows: weeklyPlanRows.filter((row) => !row.hasCatalogBom),
      importDefaultRows: weeklyPlanRows.filter((row) => row.servingsStatus === 'import-default'),
      demandLines, aggregatedDemandLines, staleness, activeStaleness, dayPages, dayIndex, activeDay, activeDate,
      activeRows: activeDay?.rows ?? [], activeQuickServingRows, aggregatePage, aggregateLines, inventoryStatus, inventoryGroups, documents, weeklyDocuments,
      demandApprovalStatus,
      approvalHref,
    },
  }
}

export type MaterialDemandWorkflow = ReturnType<typeof useMaterialDemand>
