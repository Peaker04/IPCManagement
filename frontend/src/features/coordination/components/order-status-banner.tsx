'use client'

import { Loader2, Lock, LockOpen } from 'lucide-react'
import { InlineAlert } from '@/components/common'

interface OrderStatusBannerProps {
  status: 'syncing' | 'draft' | 'locked'
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
      ) : status === 'locked' ? (
        <InlineAlert
          title="Ca này đã khóa"
          icon={<Lock className="size-4 text-[var(--ipc-success)]" />}
          variant="info"
        >
          Backend đã khóa kế hoạch suất ăn cho ca này; chỉ số thực tế sau khóa còn được điều chỉnh qua API.
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
