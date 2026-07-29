'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, FileDown, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineAlert } from '@/components/common'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppDispatch, useOrders, useCurrentShift, useAppSelector } from '@/app/hooks'
import { addAuditLog, markOrdersLocked } from '../coordinationSlice'
import { useExportCoordinationOrdersMutation, useLockCoordinationOrdersMutation, useSignoffCoordinationScopeMutation, useUnlockCoordinationScopeMutation } from '@/api/coordinationApi'
import { toDisplayShift } from '../types'
import type { ShiftType } from '../types'
import { ActionGuard } from '@/routes/ActionGuard'

type ConfirmationAction = 'lock' | 'export' | 'signoff' | 'unlock' | null

type ActionErrorFeedback = {
  title: string
  message: string
}

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
  ['bomRatePercent', 'BOM áp dụng (%)'],
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

const getActionErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown
      error?: unknown
      data?: {
        message?: unknown
        errors?: unknown
      }
    }

    if (typeof candidate.data?.message === 'string') return candidate.data.message
    if (typeof candidate.message === 'string') return candidate.message
    if (typeof candidate.error === 'string') return candidate.error
  }

  return fallback
}

export function ActionToolbar({ status, hasPlans }: { status?: string; hasPlans: boolean }) {
  const dispatch = useAppDispatch()
  const allOrders = useOrders()
  const currentShift = useCurrentShift()
  const selectedServiceDate = useAppSelector((state) => state.coordination.currentServiceDate)
  const currentDayOfWeek = useAppSelector((state) => state.coordination.currentDayOfWeek)
  const currentUserName = useAppSelector((state) => state.auth.user?.fullName) ?? 'Điều phối ca'
  const authToken = useAppSelector((state) => state.auth.token)
  const [lockCoordinationOrders, { isLoading: isLocking }] = useLockCoordinationOrdersMutation()
  const [exportCoordinationOrders, { isLoading: isExporting }] = useExportCoordinationOrdersMutation()
  const [signoffCoordinationScope, { isLoading: isSigningOff }] = useSignoffCoordinationScopeMutation()
  const [unlockCoordinationScope, { isLoading: isUnlocking }] = useUnlockCoordinationScopeMutation()
  const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction>(null)
  const [confirmationError, setConfirmationError] = useState<ActionErrorFeedback | null>(null)
  const [feedback, setFeedback] = useState<{
    title: string
    message: string
    variant: 'info' | 'warning' | 'danger'
  } | null>(null)

  // Filter orders for the active day and shift
  const orders = allOrders.filter(
    (o) => o.dayOfWeek === currentDayOfWeek && o.shift === currentShift
  )
  const currentServiceDate = orders.find((order) => order.serviceDate)?.serviceDate?.split('T')[0] ?? selectedServiceDate

  const normalizedStatus = (status ?? '').toUpperCase()
  const isTerminal = normalizedStatus === 'COMPLETED' || normalizedStatus === 'ARCHIVED' || normalizedStatus === 'CANCELLED'
  const isConfirmed = normalizedStatus === 'CONFIRMED' || normalizedStatus === 'ADJUSTED'
  const isMixed = normalizedStatus === 'MIXED'
  const isSyncing = normalizedStatus === 'SYNCING'
  const hasActionableData = hasPlans && orders.length > 0
  const isBusy = isLocking || isExporting || isSigningOff || isUnlocking
  const canLock = hasActionableData && !isConfirmed && !isTerminal && !isMixed && !isSyncing
  const canSignoff = hasActionableData && isConfirmed && !isTerminal && !isMixed && !isSyncing
  const canUnlock = canSignoff
  const canExport = canSignoff
  const hasStateActions = canLock || canSignoff || canUnlock || canExport

  const closeConfirmationDialog = () => {
    if (!isBusy) {
      setConfirmationAction(null)
      setConfirmationError(null)
    }
  }

  const openConfirmationDialog = (action: Exclude<ConfirmationAction, null>) => {
    setConfirmationError(null)
    setConfirmationAction(action)
  }

  const handleLock = async () => {
    // UC15: Lock order plan
    try {
      const response = await lockCoordinationOrders({
        dayOfWeek: currentDayOfWeek,
        serviceDate: currentServiceDate,
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

      const recognizedShifts = (response.data.lockedShiftNames ?? [])
        .map(toDisplayShift)
        .filter((lockedShift): lockedShift is ShiftType => lockedShift !== undefined)
      const lockedShifts = recognizedShifts.length > 0 ? recognizedShifts : [currentShift]

      dispatch(markOrdersLocked({
        dayOfWeek: currentDayOfWeek,
        shifts: lockedShifts,
      }))
      setFeedback({
        title: 'Đã ghi nhận chốt đơn cả ngày',
        message: `Backend đã khóa ${response.data.lockedLineCount} dòng kế hoạch thuộc ${response.data.lockedShiftNames.length} ca.`,
        variant: 'info',
      })
      setConfirmationAction(null)
    } catch (error) {
      setConfirmationError({
        title: 'Chưa chốt được đơn ca',
        message: getActionErrorMessage(error, 'Vui lòng thử lại sau khi kiểm tra dữ liệu ca.'),
      })
    }
  }

  const handleExportExcel = async () => {
    // UC25: Export order report to Excel
    try {
      const response = await exportCoordinationOrders({
        shift: currentShift,
        dayOfWeek: currentDayOfWeek,
        serviceDate: currentServiceDate,
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
          actor: currentUserName,
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
      setConfirmationError({
        title: 'Chưa xuất được báo cáo',
        message: getActionErrorMessage(error, 'Vui lòng thử lại sau khi kiểm tra dữ liệu ca hiện tại.'),
      })
    }
  }

  const handleSignoff = async () => {
    if (!hasPlans) {
      setFeedback({
        title: 'Chưa hoàn tất được ca',
        message: 'Không tìm thấy mã kế hoạch suất ăn cho ca hiện tại.',
        variant: 'danger',
      })
      return
    }

    try {
      const response = await signoffCoordinationScope({
        dayOfWeek: currentDayOfWeek,
        serviceDate: currentServiceDate,
        shift: currentShift,
        note: `Hoàn tất ca ${currentShift}`,
      }).unwrap()

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không hoàn tất được ca.')
      }

      setConfirmationAction(null)
      setFeedback({
        title: 'Đã hoàn tất ca',
        message: `${response.data.affectedPlanCount} kế hoạch ngày ${response.data.serviceDate} đã chuyển sang ${response.data.newStatus}.`,
        variant: 'info',
      })
    } catch (error) {
      setConfirmationError({
        title: 'Chưa hoàn tất được ca',
        message: getActionErrorMessage(error, 'Vui lòng kiểm tra trạng thái ca trước khi hoàn tất.'),
      })
    }
  }

  const handleUnlock = async () => {
    if (!hasPlans) {
      setFeedback({
        title: 'Chưa mở khóa được ca',
        message: 'Không tìm thấy mã kế hoạch suất ăn cho ca hiện tại.',
        variant: 'danger',
      })
      return
    }

    try {
      const response = await unlockCoordinationScope({
        dayOfWeek: currentDayOfWeek,
        serviceDate: currentServiceDate,
        shift: currentShift,
        note: `Mở khóa ca ${currentShift}`,
      }).unwrap()

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không mở khóa được ca.')
      }

      setFeedback({
        title: 'Đã mở khóa ca',
        message: `${response.data.affectedPlanCount} kế hoạch ca đã được mở khóa về trạng thái nháp.`,
        variant: 'info',
      })
      setConfirmationAction(null)
    } catch (error) {
      setConfirmationError({
        title: 'Chưa mở khóa được ca',
        message: getActionErrorMessage(error, 'Vui lòng thử lại sau.'),
      })
    }
  }

  const confirmDialogCopy = (() => {
    if (confirmationAction === 'lock') {
      return {
        title: 'Chốt đơn cả ngày?',
        description: 'Hệ thống sẽ chốt tất cả ca trong ngày đã chọn. Việc xem và điều chỉnh món vẫn theo ca đang hiển thị.',
        action: 'Chốt cả ngày',
      }
    }

    if (confirmationAction === 'signoff') {
      return {
        title: 'Hoàn tất ca này?',
        description: 'Sau khi hoàn tất, trạng thái kế hoạch sẽ chuyển sang COMPLETED và ghi nhật ký điều phối.',
        action: 'Hoàn tất ca',
      }
    }

    if (confirmationAction === 'unlock') {
      return {
        title: 'Mở khóa ca này?',
        description: 'Sau khi mở khóa, trạng thái kế hoạch sẽ quay lại Draft, cho phép chỉnh sửa số suất ăn dự kiến.',
        action: 'Mở khóa ca',
      }
    }

    return {
      title: 'Xuất báo cáo điều phối?',
      description: 'Hệ thống sẽ lấy dữ liệu báo cáo ca hiện tại bằng quyền đăng nhập của bạn và tải xuống file CSV.',
      action: 'Xuất báo cáo',
    }
  })()

  const handleConfirmedAction = () => {
    setConfirmationError(null)
    if (confirmationAction === 'lock') return handleLock()
    if (confirmationAction === 'signoff') return handleSignoff()
    if (confirmationAction === 'unlock') return handleUnlock()
    return handleExportExcel()
  }

  return (
    <>
      {(hasStateActions || feedback) && (
        <div className="ipc-order-action-toolbar border-b border-slate-200 bg-white px-4 py-2.5">
          {hasStateActions && (
            <div className="ipc-order-action-buttons flex flex-wrap items-center justify-end gap-2" aria-label="Thao tác điều phối">
          {canLock && <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>
            <Button
              onClick={() => openConfirmationDialog('lock')}
              disabled={isLocking}
              variant="default"
              size="sm"
              className="gap-1.5 font-semibold whitespace-nowrap"
            >
              <Lock className="size-3.5" />
              {isLocking ? 'Đang chốt...' : 'Chốt đơn cả ngày'}
            </Button>
          </ActionGuard>}

          {canSignoff && <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>
            <Button
              onClick={() => openConfirmationDialog('signoff')}
              disabled={isSigningOff}
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold whitespace-nowrap"
            >
              <CheckCircle className="size-3.5" />
              {isSigningOff ? 'Đang hoàn tất...' : 'Hoàn tất ca'}
            </Button>
          </ActionGuard>}

          {canUnlock && <ActionGuard allowedRoles={['quanly']}>
            <Button
              onClick={() => openConfirmationDialog('unlock')}
              disabled={isUnlocking}
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold whitespace-nowrap text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 disabled:text-slate-400 disabled:border-slate-200"
            >
              <Unlock className="size-3.5" />
              {isUnlocking ? 'Đang mở khóa...' : 'Mở khóa ca'}
            </Button>
          </ActionGuard>}

          {canExport && <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>
            <Button
              onClick={() => openConfirmationDialog('export')}
              disabled={isExporting}
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold whitespace-nowrap"
            >
              <FileDown className="size-3.5" />
              {isExporting ? 'Đang xuất...' : 'Xuất báo cáo'}
            </Button>
          </ActionGuard>}

            </div>
          )}
      {feedback && (
        <div className={hasStateActions ? 'mt-2.5' : ''}>
          <InlineAlert title={feedback.title} variant={feedback.variant}>
            {feedback.message}
          </InlineAlert>
        </div>
      )}
        </div>
      )}
      <Dialog open={confirmationAction !== null} onOpenChange={closeConfirmationDialog}>
        <DialogContent aria-label={confirmDialogCopy.title} className="max-w-md">
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
          {confirmationError && (
            <div role="alert">
              <InlineAlert title={confirmationError.title} variant="danger">
                {confirmationError.message}
              </InlineAlert>
            </div>
          )}
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
    </>
  )
}
