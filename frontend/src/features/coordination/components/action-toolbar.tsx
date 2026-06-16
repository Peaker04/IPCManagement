'use client'

import { Lock, Edit, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineAlert } from '@/components/common'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAppDispatch, useIsLocked, useOrders, useCurrentShift, useAppSelector } from '@/app/hooks'
import { lockOrderPlan, exportOrderReport, addAuditLog } from '../coordinationSlice'
import { useState } from 'react'

export function ActionToolbar() {
  const dispatch = useAppDispatch()
  const isLocked = useIsLocked()
  const allOrders = useOrders()
  const currentShift = useCurrentShift()
  const currentDayOfWeek = useAppSelector((state) => state.coordination.currentDayOfWeek)
  const currentUserName = useAppSelector((state) => state.auth.user?.fullName) ?? 'Điều phối ca'
  const [isExporting, setIsExporting] = useState(false)
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false)
  const [editReason, setEditReason] = useState('')
  const [feedback, setFeedback] = useState<{
    title: string
    message: string
    variant: 'info' | 'warning' | 'danger'
  } | null>(null)

  // Filter orders for the active day and shift
  const orders = allOrders.filter(
    (o) => o.dayOfWeek === currentDayOfWeek && o.shift === currentShift
  )

  const handleLock = () => {
    // UC15: Lock order plan
    dispatch(
      lockOrderPlan({
        dayOfWeek: currentDayOfWeek,
        shift: currentShift,
        orders,
        timestamp: new Date().toISOString(),
      }),
    )
    setFeedback({
      title: 'Đã ghi nhận chốt đơn ca',
      message: 'Hệ thống đã khóa dữ liệu ca hiện tại để chuẩn bị gửi sang KHSX.',
      variant: 'info',
    })
  }

  const handleRequestEdit = () => {
    setEditReason('')
    setIsReasonDialogOpen(true)
  }

  const submitEditRequest = () => {
    const reason = editReason.trim()
    if (!reason) return

    dispatch(
      addAuditLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        actor: currentUserName,
        fieldAffected: 'Order Lock Status',
        oldValue: 'Locked',
        newValue: 'Pending Review',
        reason,
        orderId: 'BATCH',
        shiftType: currentShift,
      }),
    )
    setIsReasonDialogOpen(false)
    setFeedback({
      title: 'Đã gửi yêu cầu điều chỉnh',
      message: `Lý do "${reason}" đã được ghi vào nhật ký ca ${currentShift}.`,
      variant: 'warning',
    })
  }

  const handleExportExcel = async () => {
    // UC25: Export order report to Excel
    setIsExporting(true)
    try {
      const result = await dispatch(
        exportOrderReport({
          shift: currentShift,
          dayOfWeek: currentDayOfWeek,
          orders,
          format: 'excel',
        }),
      )

      // Log audit entry for export
      dispatch(
        addAuditLog({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          actor: 'Manager',
          fieldAffected: 'Report Export',
          oldValue: 'None',
          newValue: 'Excel File Generated',
          reason: 'User requested order report export',
          orderId: 'BATCH',
          shiftType: currentShift,
        }),
      )

      const payload = result.payload as { downloadUrl?: string } | undefined
      // Trigger download
      if (payload?.downloadUrl) {
        window.open(payload.downloadUrl, '_blank')
      }
      setFeedback({
        title: 'Đã ghi nhận xuất báo cáo',
        message: 'Báo cáo đơn ca đã được tạo và ghi vào nhật ký thao tác.',
        variant: 'info',
      })
    } catch {
      setFeedback({
        title: 'Chưa xuất được báo cáo',
        message: 'Vui lòng thử lại sau khi kiểm tra dữ liệu ca hiện tại.',
        variant: 'danger',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="ipc-order-action-toolbar sticky bottom-0 border-t border-slate-200 bg-slate-50/95 backdrop-blur-sm px-5 py-4 z-10 shadow-[0_-4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Trạng thái ca:{' '}
          <span className={`font-semibold ${isLocked ? 'text-teal-700' : 'text-amber-700'}`}>
            {isLocked ? 'Đã khóa' : 'Chưa chốt'}
          </span>
        </p>

        <div className="ipc-order-action-buttons flex flex-wrap items-center gap-2">
          <Button
            onClick={handleLock}
            disabled={isLocked}
            variant="default"
            size="sm"
            className="gap-1.5 font-semibold whitespace-nowrap"
          >
            <Lock className="size-3.5" />
            Chốt đơn ca này
          </Button>

          <Button
            onClick={handleExportExcel}
            disabled={!isLocked || isExporting}
            variant="outline"
            size="sm"
            className="gap-1.5 font-semibold whitespace-nowrap"
          >
            <FileDown className="size-3.5" />
            {isExporting ? 'Đang xuất...' : 'Xuất báo cáo'}
          </Button>

          <Button
            onClick={handleRequestEdit}
            disabled={!isLocked}
            variant="outline"
            size="sm"
            className="gap-1.5 font-semibold whitespace-nowrap text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:text-slate-400 disabled:border-slate-200"
          >
            <Edit className="size-3.5" />
            Yêu cầu điều chỉnh
          </Button>
        </div>
      </div>
      {feedback && (
        <div className="mt-3">
          <InlineAlert title={feedback.title} variant={feedback.variant}>
            {feedback.message}
          </InlineAlert>
        </div>
      )}
      <Dialog open={isReasonDialogOpen} onOpenChange={setIsReasonDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yêu cầu điều chỉnh sau chốt</DialogTitle>
            <DialogDescription>
              Ghi rõ lý do để quản lí vận hành xét duyệt trước khi mở lại dữ liệu ca.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="edit-request-reason" className="text-sm font-semibold text-slate-700">
            Lý do điều chỉnh
          </label>
          <Textarea
            id="edit-request-reason"
            value={editReason}
            onChange={(event) => setEditReason(event.target.value)}
            placeholder="Ví dụ: Khách hàng báo tăng suất sau giờ chốt..."
            className="min-h-24 resize-none"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setIsReasonDialogOpen(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={submitEditRequest} disabled={!editReason.trim()}>
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
