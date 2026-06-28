'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Edit, FileDown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineAlert } from '@/components/common'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAppDispatch, useIsLocked, useOrders, useCurrentShift, useAppSelector } from '@/app/hooks'
import { addAuditLog, markOrdersLocked } from '../coordinationSlice'
import { useExportCoordinationOrdersMutation, useLockCoordinationOrdersMutation, useSignoffCoordinationOrderMutation } from '../coordinationApi'
import { toDisplayShift } from '../types'
import { ActionGuard } from '@/routes/ActionGuard'

type ConfirmationAction = 'lock' | 'export' | 'signoff' | null

interface OrderExportReportRow {
  quantityPlanLineId: string
  serviceDate: string
  shiftName: string
  customerName: string
  menuName: string
  forecastServings: number
  confirmedServings: number
  finalServings: number
  menuPrice: number
  bomRatePercent: number
}

interface ReportRowsResponse {
  success: boolean
  message: string
  data?: OrderExportReportRow[]
}

const csvHeaders: Array<[keyof OrderExportReportRow, string]> = [
  ['serviceDate', 'Ngày phục vụ'],
  ['shiftName', 'Ca'],
  ['customerName', 'Khách hàng'],
  ['menuName', 'Thực đơn'],
  ['forecastServings', 'Suất dự kiến'],
  ['confirmedServings', 'Suất đã chốt'],
  ['finalServings', 'Suất cuối'],
  ['menuPrice', 'Đơn giá thực đơn'],
  ['bomRatePercent', 'Tỷ lệ BOM'],
]

const escapeCsvValue = (value: unknown) => {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

const buildCsv = (rows: OrderExportReportRow[]) => {
  const headerLine = csvHeaders.map(([, label]) => escapeCsvValue(label)).join(',')
  const rowLines = rows.map((row) =>
    csvHeaders.map(([key]) => escapeCsvValue(row[key])).join(','),
  )
  return ['\ufeff' + headerLine, ...rowLines].join('\r\n')
}

const resolveDownloadUrl = (downloadUrl: string) => {
  if (!import.meta.env.VITE_API_BASE_URL) {
    return downloadUrl
  }

  return new URL(downloadUrl, import.meta.env.VITE_API_BASE_URL).toString()
}

const downloadCsv = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function ActionToolbar({ status }: { status?: string }) {
  const dispatch = useAppDispatch()
  const isLocked = useIsLocked()
  const allOrders = useOrders()
  const currentShift = useCurrentShift()
  const currentDayOfWeek = useAppSelector((state) => state.coordination.currentDayOfWeek)
  const currentUserName = useAppSelector((state) => state.auth.user?.fullName) ?? 'Điều phối ca'
  const authToken = useAppSelector((state) => state.auth.token)
  const [lockCoordinationOrders, { isLoading: isLocking }] = useLockCoordinationOrdersMutation()
  const [exportCoordinationOrders, { isLoading: isExporting }] = useExportCoordinationOrdersMutation()
  const [signoffCoordinationOrder, { isLoading: isSigningOff }] = useSignoffCoordinationOrderMutation()
  const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction>(null)
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

  const normalizedStatus = (status ?? '').toUpperCase()
  const isTerminal = normalizedStatus === 'COMPLETED' || normalizedStatus === 'ARCHIVED'
  const isConfirmed = normalizedStatus === 'CONFIRMED' || normalizedStatus === 'LOCKED' || isLocked
  const currentPlanId = orders.find((order) => order.quantityPlanId)?.quantityPlanId
  const isBusy = isLocking || isExporting || isSigningOff

  const closeConfirmationDialog = () => {
    if (!isBusy) {
      setConfirmationAction(null)
    }
  }

  const handleLock = async () => {
    // UC15: Lock order plan
    try {
      const response = await lockCoordinationOrders({
        dayOfWeek: currentDayOfWeek,
        shift: currentShift,
        scope: 'FULLDAY',
        lines: orders.map((order) => ({
          quantityPlanLineId: order.quantityPlanLineId ?? order.id,
          actualQuantity: order.actualQuantity || order.forecastQuantity,
        })),
      }).unwrap()

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không chốt được đơn.')
      }

      const lockedShifts = response.data.lockedShiftNames?.length
        ? response.data.lockedShiftNames.map(toDisplayShift)
        : [currentShift]

      dispatch(markOrdersLocked({
        dayOfWeek: currentDayOfWeek,
        shifts: lockedShifts,
      }))
      setFeedback({
        title: 'Đã ghi nhận chốt đơn ca',
        message: `Backend đã khóa ${response.data.lockedLineCount} dòng kế hoạch cho ca hiện tại.`,
        variant: 'info',
      })
      setConfirmationAction(null)
    } catch (error) {
      setFeedback({
        title: 'Chưa chốt được đơn ca',
        message: error instanceof Error ? error.message : 'Vui lòng thử lại sau khi kiểm tra dữ liệu ca.',
        variant: 'danger',
      })
    }
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
    try {
      const response = await exportCoordinationOrders({
        shift: currentShift,
        dayOfWeek: currentDayOfWeek,
        format: 'excel',
      }).unwrap()

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không xuất được báo cáo.')
      }

      const reportResponse = await fetch(resolveDownloadUrl(response.data.downloadUrl), {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      })

      if (!reportResponse.ok) {
        throw new Error('Không tải được dữ liệu báo cáo từ backend.')
      }

      const report = (await reportResponse.json()) as ReportRowsResponse
      if (!report.success || !report.data) {
        throw new Error(report.message || 'Backend chưa trả dữ liệu báo cáo hợp lệ.')
      }

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

      const filename = `bao-cao-dieu-phoi-${currentDayOfWeek}-${currentShift
        .toLowerCase()
        .replace(/\s+/g, '-')}.csv`
      downloadCsv(buildCsv(report.data), filename)
      setConfirmationAction(null)
      setFeedback({
        title: 'Đã tải báo cáo điều phối',
        message: `Đã tạo file CSV cho ${report.data.length} dòng đơn ca hiện tại và ghi nhật ký thao tác.`,
        variant: 'info',
      })
    } catch (error) {
      setFeedback({
        title: 'Chưa xuất được báo cáo',
        message: error instanceof Error ? error.message : 'Vui lòng thử lại sau khi kiểm tra dữ liệu ca hiện tại.',
        variant: 'danger',
      })
    }
  }

  const handleSignoff = async () => {
    if (!currentPlanId) {
      setFeedback({
        title: 'Chưa hoàn tất được ca',
        message: 'Không tìm thấy mã kế hoạch suất ăn cho ca hiện tại.',
        variant: 'danger',
      })
      return
    }

    try {
      const response = await signoffCoordinationOrder({
        id: currentPlanId,
        body: { note: `Hoàn tất ca ${currentShift}` },
      }).unwrap()

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không hoàn tất được ca.')
      }

      setConfirmationAction(null)
      setFeedback({
        title: 'Đã hoàn tất ca',
        message: `Kế hoạch ngày ${response.data.serviceDate} đã chuyển từ ${response.data.oldStatus} sang ${response.data.newStatus}.`,
        variant: 'info',
      })
    } catch (error) {
      setFeedback({
        title: 'Chưa hoàn tất được ca',
        message: error instanceof Error ? error.message : 'Vui lòng kiểm tra trạng thái ca trước khi hoàn tất.',
        variant: 'danger',
      })
    }
  }

  const confirmDialogCopy = (() => {
    if (confirmationAction === 'lock') {
      return {
        title: 'Chốt đơn ca này?',
        description: 'Sau khi chốt, số suất của ca hiện tại sẽ được ghi nhận vào backend và chuyển sang trạng thái đã khóa.',
        action: 'Chốt đơn ca',
      }
    }

    if (confirmationAction === 'signoff') {
      return {
        title: 'Hoàn tất ca này?',
        description: 'Sau khi hoàn tất, trạng thái kế hoạch sẽ chuyển sang COMPLETED và ghi nhật ký điều phối.',
        action: 'Hoàn tất ca',
      }
    }

    return {
        title: 'Xuất báo cáo điều phối?',
        description: 'Hệ thống sẽ lấy dữ liệu báo cáo ca hiện tại bằng quyền đăng nhập của bạn và tải xuống file CSV.',
        action: 'Xuất báo cáo',
      }
  })()

  const handleConfirmedAction = () => {
    if (confirmationAction === 'lock') return handleLock()
    if (confirmationAction === 'signoff') return handleSignoff()
    return handleExportExcel()
  }

  return (
    <div className="ipc-order-action-toolbar sticky bottom-0 border-t border-slate-200 bg-slate-50/95 backdrop-blur-sm px-5 py-4 z-10 shadow-[0_-4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Trạng thái ca:{' '}
          <span className={`font-semibold ${isTerminal ? 'text-emerald-700' : isConfirmed ? 'text-teal-700' : 'text-amber-700'}`}>
            {isTerminal ? 'Đã hoàn tất' : isConfirmed ? 'Đã khóa' : normalizedStatus === 'SYNCING' ? 'Đang đồng bộ...' : 'Chưa chốt'}
          </span>
        </p>

        <div className="ipc-order-action-buttons flex flex-wrap items-center gap-2">
          <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>
            <Button
              onClick={() => setConfirmationAction('lock')}
              disabled={isConfirmed || isTerminal || isLocking || orders.length === 0}
              variant="default"
              size="sm"
              className="gap-1.5 font-semibold whitespace-nowrap"
            >
              <Lock className="size-3.5" />
              {isLocking ? 'Đang chốt...' : 'Chốt đơn ca này'}
            </Button>
          </ActionGuard>

          <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>
            <Button
              onClick={() => setConfirmationAction('signoff')}
              disabled={!isConfirmed || isTerminal || isSigningOff || !currentPlanId}
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold whitespace-nowrap"
            >
              <CheckCircle className="size-3.5" />
              {isSigningOff ? 'Đang hoàn tất...' : 'Hoàn tất ca'}
            </Button>
          </ActionGuard>

          <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>
            <Button
              onClick={() => setConfirmationAction('export')}
              disabled={!isConfirmed || isExporting}
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold whitespace-nowrap"
            >
              <FileDown className="size-3.5" />
              {isExporting ? 'Đang xuất...' : 'Xuất báo cáo'}
            </Button>
          </ActionGuard>

          <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>
            <Button
              onClick={handleRequestEdit}
              disabled={!isConfirmed || isTerminal}
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold whitespace-nowrap text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:text-slate-400 disabled:border-slate-200"
            >
              <Edit className="size-3.5" />
              Yêu cầu điều chỉnh
            </Button>
          </ActionGuard>
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
      <Dialog open={confirmationAction !== null} onOpenChange={closeConfirmationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              {confirmDialogCopy.title}
            </DialogTitle>
            <DialogDescription>{confirmDialogCopy.description}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <div className="font-semibold text-slate-800">Ca hiện tại: {currentShift}</div>
            <div>Số dòng đơn: {orders.length}</div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={closeConfirmationDialog} disabled={isBusy}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleConfirmedAction}
              disabled={isBusy}
            >
              {isBusy ? 'Đang xử lí...' : confirmDialogCopy.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
