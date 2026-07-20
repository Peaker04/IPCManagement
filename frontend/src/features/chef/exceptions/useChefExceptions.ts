import { useState } from 'react'
import {
  useCreateInventoryReturnMutation,
  useCreateSupplementalMaterialRequestMutation,
  type KitchenIssueRow,
} from '@/features/workflow'
import { formatQuantityWithUnit } from '@/lib/formatters'
import type { ExcessMaterial, ProductionPlan, SupplementalRequest } from '@/lib/types'
import { getChefMutationErrorMessage, type ChefMaterial } from '../chefDashboardTypes'
import type { ChefFeedback, ChefShiftScope } from '../production/useChefProductionPlan'

type RecordedReturn = ExcessMaterial & { serviceDate: string; shift: ChefShiftScope['activeShift'] }

export function useChefExceptions(
  scope: ChefShiftScope,
  productionPlan: ProductionPlan,
  kitchenIssues: KitchenIssueRow[],
  onFeedback: (feedback: ChefFeedback) => void,
) {
  const [returns, setReturns] = useState<RecordedReturn[]>([])
  const [createReturn, returnState] = useCreateInventoryReturnMutation()
  const [createSupplemental, supplementalState] = useCreateSupplementalMaterialRequestMutation()

  const requestSupplemental = async (data: SupplementalRequest) => {
    const material = productionPlan.receivedMaterials.find((item) => item.id === data.ingredientId) as ChefMaterial | undefined
    if (!material?.issueId || !material.isReceivedByKitchen) {
      onFeedback({
        title: 'Chưa thể gửi yêu cầu bổ sung',
        message: 'Chỉ có thể yêu cầu thêm từ dòng nguyên liệu thuộc phiếu xuất mà bếp đã ký nhận.',
        variant: 'warning',
      })
      return false
    }
    try {
      const response = await createSupplemental({
        issueId: material.issueId,
        issueLineId: material.id,
        requestedQty: data.requestedQty,
        reason: data.reason,
      }).unwrap()
      onFeedback({
        title: 'Đã gửi yêu cầu bổ sung tới kho',
        message: response.data
          ? `${response.data.requestCode}: ${data.ingredientName} ${formatQuantityWithUnit(data.requestedQty, data.unit)} đang chờ kho xử lý.`
          : response.message || 'Yêu cầu đã được lưu trên hệ thống.',
        variant: 'info',
      })
      return true
    } catch (error) {
      onFeedback({
        title: 'Chưa gửi được yêu cầu bổ sung',
        message: getChefMutationErrorMessage(error, 'Kiểm tra phiếu xuất đã nhận và thử lại.'),
        variant: 'danger',
      })
      return false
    }
  }

  const recordReturn = async (data: ExcessMaterial) => {
    const issueRow = kitchenIssues.find((row) => row.id === data.ingredientId)
    const material = productionPlan.receivedMaterials.find((item) => item.id === data.ingredientId) as ChefMaterial | undefined
    if (!issueRow || !material?.warehouseId || !material.ingredientId || !material.unitId) {
      onFeedback({
        title: 'Chưa có phiếu xuất để trả kho',
        message: 'Bếp chỉ có thể ghi nhận trả nguyên liệu khi checklist đang lấy từ phiếu xuất kho live.',
        variant: 'warning',
      })
      return
    }
    if (!Number.isFinite(data.returnedQty) || data.returnedQty <= 0) {
      onFeedback({ title: 'Số lượng trả không hợp lệ', message: 'Số lượng trả kho phải lớn hơn 0.', variant: 'warning' })
      return
    }
    if (data.returnedQty > material.quantity) {
      onFeedback({
        title: 'Số lượng trả vượt số đã xuất',
        message: `${data.ingredientName} chỉ được ghi nhận tối đa ${formatQuantityWithUnit(material.quantity, material.unit)} từ phiếu xuất ${material.issueCode}.`,
        variant: 'danger',
      })
      return
    }

    const returnType = data.condition === 'damaged' ? 'WASTE' : 'RETURN'
    const reason = data.notes?.trim() || (returnType === 'WASTE'
      ? `Bếp ghi nhận hao hụt/hư hỏng ${data.ingredientName}.`
      : `Bếp trả nguyên liệu thừa ${data.ingredientName} sau ca ${scope.activeShift}.`)
    try {
      const response = await createReturn({
        returnDate: scope.serviceDate,
        shiftName: issueRow.shiftName,
        returnType,
        warehouseId: material.warehouseId,
        issueId: material.issueId!,
        reason,
        lines: [{ ingredientId: material.ingredientId, quantity: data.returnedQty, unitId: material.unitId }],
      }).unwrap()
      setReturns((current) => [...current, { ...data, serviceDate: scope.serviceDate, shift: scope.activeShift }])
      onFeedback({
        title: returnType === 'WASTE' ? 'Đã ghi nhận hao hụt thực tế' : 'Đã tạo phiếu trả kho',
        message: response.data
          ? `${response.data.returnCode}: ${data.ingredientName} ${formatQuantityWithUnit(data.returnedQty, data.unit)} đã được lưu trên hệ thống.`
          : response.message || 'Phiếu trả nguyên liệu đã được ghi nhận.',
        variant: 'info',
      })
    } catch (error) {
      onFeedback({
        title: 'Chưa ghi nhận được phiếu trả',
        message: getChefMutationErrorMessage(error, 'Kiểm tra số lượng đã xuất/đã trả và thử lại.'),
        variant: 'danger',
      })
    }
  }

  return {
    activeReturns: returns.filter((item) => item.serviceDate === scope.serviceDate && item.shift === scope.activeShift),
    requestSupplemental,
    recordReturn,
    isSubmittingSupplemental: supplementalState.isLoading,
    isCreatingReturn: returnState.isLoading,
  }
}
