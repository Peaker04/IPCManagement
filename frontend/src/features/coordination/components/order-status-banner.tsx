'use client'

import { AlertTriangle, Archive, CheckCircle, Loader2, Lock, LockOpen } from 'lucide-react'
import { PageBanner } from '@/components/common'
import type { StatusTone } from '@/lib/statusPresentation'

interface OrderStatusBannerProps {
  status: 'syncing' | 'draft' | 'locked' | 'DRAFT' | 'CONFIRMED' | 'ADJUSTED' | 'COMPLETED' | 'ARCHIVED' | string
}

export function OrderStatusBanner({ status }: OrderStatusBannerProps) {
  const normalizedStatus = status.toUpperCase()
  const presentation = status === 'syncing'
    ? { title: 'Đang đồng bộ trạng thái đơn', detail: 'Đang lấy dữ liệu mới nhất.', tone: 'info' as StatusTone, icon: <Loader2 className="size-4 shrink-0" />, spin: true }
    : normalizedStatus === 'EMPTY'
      ? { title: 'Chưa có kế hoạch suất ăn', detail: 'Không có dữ liệu để thao tác trong ca này.', tone: 'neutral' as StatusTone, icon: <LockOpen className="size-4 shrink-0" /> }
      : normalizedStatus === 'MIXED'
        ? { title: 'Trạng thái kế hoạch chưa đồng nhất', detail: 'Tải lại hoặc xử lý kế hoạch dở dang trước khi thao tác.', tone: 'warning' as StatusTone, icon: <AlertTriangle className="size-4 shrink-0" /> }
        : status === 'locked' || normalizedStatus === 'CONFIRMED'
          ? { title: 'Ca này đã khóa', detail: 'Điều chỉnh sau chốt cần ghi lý do.', tone: 'info' as StatusTone, icon: <Lock className="size-4 shrink-0" /> }
          : normalizedStatus === 'ADJUSTED'
            ? { title: 'Ca này đã khóa và có điều chỉnh', detail: 'Số suất sau chốt đã được cập nhật.', tone: 'info' as StatusTone, icon: <Lock className="size-4 shrink-0" /> }
            : normalizedStatus === 'COMPLETED'
              ? { title: 'Ca này đã hoàn tất', detail: 'Dữ liệu đã ghi nhận vào nhật ký điều phối.', tone: 'success' as StatusTone, icon: <CheckCircle className="size-4 shrink-0" /> }
              : normalizedStatus === 'ARCHIVED'
                ? { title: 'Dữ liệu đã lưu trữ', detail: 'Chỉ dùng để tra cứu lịch sử.', tone: 'neutral' as StatusTone, icon: <Archive className="size-4 shrink-0" /> }
                : normalizedStatus === 'CANCELLED'
                  ? { title: 'Kế hoạch đã hủy', detail: 'Không thể chốt, hoàn tất hoặc điều chỉnh.', tone: 'warning' as StatusTone, icon: <Archive className="size-4 shrink-0" /> }
                  : { title: 'Dữ liệu đang ở trạng thái nháp', detail: 'Kiểm tra số suất trước khi chốt đơn cả ngày.', tone: 'warning' as StatusTone, icon: <LockOpen className="size-4 shrink-0" /> }

  return (
    <PageBanner
      title={presentation.title}
      detail={presentation.detail}
      tone={presentation.tone}
      icon={presentation.icon}
      spin={presentation.spin}
      className="ipc-order-status-banner"
    />
  )
}
