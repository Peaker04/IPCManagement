'use client'

import { AlertTriangle, Archive, CheckCircle, Loader2, Lock, LockOpen } from 'lucide-react'

interface OrderStatusBannerProps {
  status: 'syncing' | 'draft' | 'locked' | 'DRAFT' | 'CONFIRMED' | 'ADJUSTED' | 'COMPLETED' | 'ARCHIVED' | string
}

export function OrderStatusBanner({ status }: OrderStatusBannerProps) {
  const normalizedStatus = status.toUpperCase()
  const presentation = status === 'syncing'
    ? { title: 'Đang đồng bộ trạng thái đơn', detail: 'Đang lấy dữ liệu mới nhất.', tone: 'info', icon: Loader2, spin: true }
    : normalizedStatus === 'EMPTY'
      ? { title: 'Chưa có kế hoạch suất ăn', detail: 'Không có dữ liệu để thao tác trong ca này.', tone: 'neutral', icon: LockOpen }
      : normalizedStatus === 'MIXED'
        ? { title: 'Trạng thái kế hoạch chưa đồng nhất', detail: 'Tải lại hoặc xử lý kế hoạch dở dang trước khi thao tác.', tone: 'warning', icon: AlertTriangle }
        : status === 'locked' || normalizedStatus === 'CONFIRMED'
          ? { title: 'Ca này đã khóa', detail: 'Điều chỉnh sau chốt cần ghi lý do.', tone: 'info', icon: Lock }
          : normalizedStatus === 'ADJUSTED'
            ? { title: 'Ca này đã khóa và có điều chỉnh', detail: 'Số suất sau chốt đã được cập nhật.', tone: 'info', icon: Lock }
            : normalizedStatus === 'COMPLETED'
              ? { title: 'Ca này đã hoàn tất', detail: 'Dữ liệu đã ghi nhận vào nhật ký điều phối.', tone: 'success', icon: CheckCircle }
              : normalizedStatus === 'ARCHIVED'
                ? { title: 'Dữ liệu đã lưu trữ', detail: 'Chỉ dùng để tra cứu lịch sử.', tone: 'neutral', icon: Archive }
                : normalizedStatus === 'CANCELLED'
                  ? { title: 'Kế hoạch đã hủy', detail: 'Không thể chốt, hoàn tất hoặc điều chỉnh.', tone: 'warning', icon: Archive }
                  : { title: 'Dữ liệu đang ở trạng thái nháp', detail: 'Kiểm tra số suất trước khi chốt đơn cả ngày.', tone: 'warning', icon: LockOpen }

  const Icon = presentation.icon
  const toneClasses = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  } as const

  return (
    <div className={`ipc-order-status-banner flex items-center gap-2 border-b px-4 py-2 ${toneClasses[presentation.tone as keyof typeof toneClasses]}`} role="status">
      <Icon className={`size-4 shrink-0 ${presentation.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="text-sm font-semibold">{presentation.title}</span>
      <span className="text-sm opacity-80">— {presentation.detail}</span>
    </div>
  )
}
