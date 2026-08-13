import { useMemo, useState } from 'react'
import { useConfirmInventoryIssueReceiptMutation, useGetKitchenIssuesPageQuery, useGetKitchenIssuesQuery } from '@/api/workflowApi'
import { countPendingKitchenReceipts } from '../chefReadiness'
import { getChefMutationErrorMessage, type ChefMaterial } from '../chefDashboardTypes'
import { filterKitchenIssues } from '../production/chefProductionModel'
import type { ChefFeedback, ChefShiftScope } from '../production/useChefProductionPlan'
import { toChefView } from '../chefQueryView'

const KITCHEN_RECEIPT_PAGE_SIZE = 20
const KITCHEN_ACTION_LIMIT = 500

export function useKitchenReceipts(scope: ChefShiftScope, onFeedback: (feedback: ChefFeedback) => void, enabled = true) {
  const scopeKey = `${scope.serviceDate}-${scope.apiShiftName}`
  const [pagination, setPagination] = useState({ scopeKey, page: 1 })
  const page = pagination.scopeKey === scopeKey ? pagination.page : 1
  const setPage = (nextPage: number) => setPagination({ scopeKey, page: nextPage })
  const query = useGetKitchenIssuesPageQuery({
    dateFrom: scope.serviceDate,
    dateTo: scope.serviceDate,
    pageNumber: page,
    pageSize: KITCHEN_RECEIPT_PAGE_SIZE,
  }, { skip: !enabled })
  const queryView = toChefView(query, 'phiếu xuất kho bàn giao cho bếp')
  const actionQuery = useGetKitchenIssuesQuery({
    dateFrom: scope.serviceDate,
    dateTo: scope.serviceDate,
    shiftName: scope.apiShiftName,
    limit: KITCHEN_ACTION_LIMIT,
  }, { skip: !enabled })
  const actionQueryView = toChefView(actionQuery, 'nguyên liệu có thể thao tác trong ca')
  const [confirmReceipt, confirmState] = useConfirmInventoryIssueReceiptMutation()
  const [signedMaterials, setSignedMaterials] = useState<Record<string, boolean>>({})
  const response = queryView.phase === 'ready' ? queryView.data : undefined
  const rows = useMemo(
    () => filterKitchenIssues(response?.items ?? [], scope.serviceDate, scope.activeShift),
    [response?.items, scope.serviceDate, scope.activeShift],
  )
  const actionRows = useMemo(
    () => filterKitchenIssues(actionQueryView.phase === 'ready' ? actionQueryView.data : [], scope.serviceDate, scope.activeShift),
    [actionQueryView, scope.serviceDate, scope.activeShift],
  )
  const pendingCount = countPendingKitchenReceipts(rows)
  const hasAdditionalPages = (response?.totalPages ?? 0) > 1

  const signOff = async (material: ChefMaterial | undefined, signed: boolean) => {
    if (!material) return
    const issueRow = rows.find((row) => row.id === material.id)
    const signKey = issueRow
      ? `${scope.serviceDate}-${scope.activeShift}-${issueRow.issueId}-${issueRow.id}`
      : `${scope.serviceDate}-${scope.activeShift}-${material.name}`

    if (!signed) {
      if (issueRow?.isReceivedByKitchen) {
        onFeedback({
          title: 'Phiếu đã ký nhận trên hệ thống',
          message: `Phiếu ${issueRow.issueCode} đã xác nhận nhận nguyên liệu nên không thể bỏ ký từ giao diện.`,
          variant: 'warning',
        })
        return
      }
      setSignedMaterials((current) => ({ ...current, [signKey]: false }))
      return
    }

    if (issueRow?.issueId && !issueRow.isReceivedByKitchen) {
      try {
        const response = await confirmReceipt({ issueId: issueRow.issueId, hasDiscrepancy: false }).unwrap()
        setSignedMaterials((current) => ({ ...current, [signKey]: true }))
        onFeedback({
          title: 'Đã ký nhận nguyên liệu',
          message: response.message || `Bếp đã xác nhận nhận phiếu ${issueRow.issueCode}.`,
          variant: 'info',
        })
      } catch (error) {
        onFeedback({
          title: 'Chưa ký nhận được nguyên liệu',
          message: getChefMutationErrorMessage(error, 'Kiểm tra quyền bếp trưởng hoặc trạng thái phiếu xuất rồi thử lại.'),
          variant: 'danger',
        })
      }
      return
    }
    setSignedMaterials((current) => ({ ...current, [signKey]: true }))
  }

  return {
    rows,
    actionRows,
    signedMaterials,
    pendingCount,
    page: response?.pageNumber ?? page,
    pageSize: response?.pageSize ?? KITCHEN_RECEIPT_PAGE_SIZE,
    totalCount: response?.totalCount ?? rows.length,
    hasAdditionalPages,
    allReceived: rows.length > 0 && pendingCount === 0 && !hasAdditionalPages,
    setPage,
    signOff,
    queryView,
    actionQueryView,
    isConfirming: confirmState.isLoading,
  }
}
