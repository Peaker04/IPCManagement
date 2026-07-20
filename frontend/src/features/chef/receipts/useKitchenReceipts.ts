import { useMemo, useState } from 'react'
import {
  useConfirmInventoryIssueReceiptMutation,
  useGetKitchenIssuesPageQuery,
} from '@/features/workflow'
import { countPendingKitchenReceipts } from '../chefReadiness'
import { getChefMutationErrorMessage, type ChefMaterial } from '../chefDashboardTypes'
import { filterKitchenIssues } from '../production/chefProductionModel'
import type { ChefFeedback, ChefShiftScope } from '../production/useChefProductionPlan'

export function useKitchenReceipts(scope: ChefShiftScope, onFeedback: (feedback: ChefFeedback) => void) {
  const scopeKey = `${scope.serviceDate}-${scope.apiShiftName}`
  const [pagination, setPagination] = useState({ scopeKey, page: 1 })
  const page = pagination.scopeKey === scopeKey ? pagination.page : 1
  const setPage = (nextPage: number) => setPagination({ scopeKey, page: nextPage })
  const query = useGetKitchenIssuesPageQuery({
    dateFrom: scope.serviceDate,
    dateTo: scope.serviceDate,
    shiftName: scope.apiShiftName,
    pageNumber: page,
    pageSize: 100,
  })
  const [confirmReceipt, confirmState] = useConfirmInventoryIssueReceiptMutation()
  const [signedMaterials, setSignedMaterials] = useState<Record<string, boolean>>({})
  const response = query.currentData ?? query.data
  const rows = useMemo(
    () => filterKitchenIssues(response?.items ?? [], scope.serviceDate, scope.activeShift),
    [response?.items, scope.serviceDate, scope.activeShift],
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
    signedMaterials,
    pendingCount,
    page: response?.pageNumber ?? page,
    pageSize: response?.pageSize ?? 100,
    totalCount: response?.totalCount ?? rows.length,
    hasAdditionalPages,
    allReceived: rows.length > 0 && pendingCount === 0 && !hasAdditionalPages,
    setPage,
    signOff,
    isLoading: query.isLoading,
    isError: query.isError,
    isConfirming: confirmState.isLoading,
  }
}
