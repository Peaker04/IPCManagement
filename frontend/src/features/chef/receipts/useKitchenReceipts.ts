import { useMemo, useState } from 'react'
import {
  useConfirmInventoryIssueReceiptMutation,
  useGetKitchenIssuesQuery,
} from '@/features/workflow'
import { countPendingKitchenReceipts } from '../chefReadiness'
import { getChefMutationErrorMessage, type ChefMaterial } from '../chefDashboardTypes'
import { filterKitchenIssues } from '../production/chefProductionModel'
import type { ChefFeedback, ChefShiftScope } from '../production/useChefProductionPlan'

export function useKitchenReceipts(scope: ChefShiftScope, onFeedback: (feedback: ChefFeedback) => void) {
  const query = useGetKitchenIssuesQuery({
    dateFrom: scope.serviceDate,
    dateTo: scope.serviceDate,
    shiftName: scope.apiShiftName,
    limit: 100,
  })
  const [confirmReceipt, confirmState] = useConfirmInventoryIssueReceiptMutation()
  const [signedMaterials, setSignedMaterials] = useState<Record<string, boolean>>({})
  const rows = useMemo(
    () => filterKitchenIssues(query.data ?? [], scope.serviceDate, scope.activeShift),
    [query.data, scope.serviceDate, scope.activeShift],
  )

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
    pendingCount: countPendingKitchenReceipts(rows),
    signOff,
    isLoading: query.isLoading,
    isError: query.isError,
    isConfirming: confirmState.isLoading,
  }
}
