'use client'

import { Lock, LockOpen } from 'lucide-react'
import { InlineAlert } from '@/components/common'

interface OrderStatusBannerProps {
  isLocked: boolean
}

export function OrderStatusBanner({ isLocked }: OrderStatusBannerProps) {
  return (
    <div className="ipc-order-status-banner border-b border-slate-200 bg-slate-50 px-5 py-3">
      {isLocked ? (
        <InlineAlert
          title="Ca này đã chốt"
          icon={<Lock className="size-4 text-[var(--ipc-success)]" />}
          variant="info"
        >
          Chỉ có thể điều chỉnh qua luồng sau chốt trước khi gửi tính định lượng.
        </InlineAlert>
      ) : (
        <InlineAlert
          title="Dữ liệu đang ở trạng thái dự thảo"
          icon={<LockOpen className="size-4 text-[var(--ipc-warning)]" />}
          variant="warning"
        >
          Kiểm tra menu, số suất và chênh lệch trước khi chốt đơn ca này.
        </InlineAlert>
      )}
    </div>
  )
}
