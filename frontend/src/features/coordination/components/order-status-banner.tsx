'use client'

import { Archive, CheckCircle, Loader2, Lock, LockOpen } from 'lucide-react'
import { InlineAlert } from '@/components/common'

interface OrderStatusBannerProps {
  status: 'syncing' | 'draft' | 'locked' | 'DRAFT' | 'CONFIRMED' | 'ADJUSTED' | 'COMPLETED' | 'ARCHIVED' | string
}

export function OrderStatusBanner({ status }: OrderStatusBannerProps) {
  const normalizedStatus = status.toUpperCase()
  return (
    <div className="ipc-order-status-banner border-b border-slate-200 bg-slate-50 px-5 py-3">
      {status === 'syncing' ? (
        <InlineAlert
          title="Đang đồng bộ trạng thái đơn"
          icon={<Loader2 className="size-4 animate-spin text-[var(--ipc-primary-600)]" />}
          variant="info"
        >
          Hệ thống đang lấy dữ liệu mới nhất từ API điều phối.
        </InlineAlert>
      ) : status === 'locked' || normalizedStatus === 'CONFIRMED' ? (
        <InlineAlert
          title="Ca này đã khóa"
          icon={<Lock className="size-4 text-[var(--ipc-info-600)]" />}
          variant="info"
        >
          Kế hoạch suất ăn đã được chốt để bếp triển khai; các điều chỉnh sau chốt cần ghi lý do.
        </InlineAlert>
      ) : normalizedStatus === 'ADJUSTED' ? (
        <InlineAlert
          title="Ca này đã khóa và có điều chỉnh"
          icon={<Lock className="size-4 text-[var(--ipc-info-600)]" />}
          variant="info"
        >
          Kế hoạch đã chốt; số suất sau chốt đã được điều chỉnh qua luồng ghi lý do.
        </InlineAlert>
      ) : normalizedStatus === 'COMPLETED' ? (
        <InlineAlert
          title="Ca này đã hoàn tất"
          icon={<CheckCircle className="size-4 text-[var(--ipc-success-600)]" />}
          variant="info"
        >
          Dữ liệu ca đã được hoàn tất và ghi nhận vào nhật ký điều phối.
        </InlineAlert>
      ) : normalizedStatus === 'ARCHIVED' ? (
        <InlineAlert
          title="Dữ liệu đã lưu trữ"
          icon={<Archive className="size-4 text-slate-500" />}
          variant="info"
        >
          Ca này đã kết thúc và chỉ nên dùng để tra cứu lịch sử.
        </InlineAlert>
      ) : (
        <InlineAlert
          title="Dữ liệu đang ở trạng thái nháp"
          icon={<LockOpen className="size-4 text-[var(--ipc-warning)]" />}
          variant="warning"
        >
          Kiểm tra menu, số suất và chênh lệch trước khi chốt đơn ca này.
        </InlineAlert>
      )}
    </div>
  )
}
