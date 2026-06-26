'use client'

import { Loader2, Lock, LockOpen, CheckCircle, Archive } from 'lucide-react'
import { InlineAlert } from '@/components/common'

interface OrderStatusBannerProps {
  status: 'syncing' | 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'ARCHIVED' | string
}

export function OrderStatusBanner({ status }: OrderStatusBannerProps) {
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
      ) : status === 'CONFIRMED' ? (
        <InlineAlert
          title="Ca này đã khóa (Đang sản xuất)"
          icon={<Lock className="size-4 text-[var(--ipc-info-600)]" />}
          variant="info"
        >
          Kế hoạch suất ăn đã được khóa để nhà bếp tiến hành nấu. Số liệu đã được chuyển sang xưởng sản xuất.
        </InlineAlert>
      ) : status === 'COMPLETED' ? (
        <InlineAlert
          title="Đã chốt ca thành công"
          icon={<CheckCircle className="size-4 text-[var(--ipc-success-600)]" />}
          variant="success"
        >
          Mọi dữ liệu của ca này đã được chốt và đồng bộ. Không thể thay đổi số lượng.
        </InlineAlert>
      ) : status === 'ARCHIVED' ? (
        <InlineAlert
          title="Dữ liệu đã được lưu trữ"
          icon={<Archive className="size-4 text-[var(--ipc-neutral-500)]" />}
          variant="neutral"
        >
          Phiên làm việc này đã kết thúc và được lưu vào kho lưu trữ lịch sử.
        </InlineAlert>
      ) : (
        <InlineAlert
          title="Dữ liệu đang ở trạng thái nháp"
          icon={<LockOpen className="size-4 text-[var(--ipc-warning-600)]" />}
          variant="warning"
        >
          Kiểm tra thực đơn, số suất và chênh lệch trước khi gửi khóa đơn ca này.
        </InlineAlert>
      )}
    </div>
  )
}
