import { StatusBadge } from '@/components/common'
import { formatBomTierLabel } from '../../weeklyMenuPlanning'

export const WeeklyMenuPricingContext = ({
  menuPrice,
  menuPriceSource,
}: {
  menuPrice: number
  menuPriceSource: string
}) => (
  <section className="ipc-weekly-pricing-context" aria-label="Cấu hình định lượng đang áp dụng">
    <div className="ipc-weekly-pricing-primary">
      <span>Định mức đang áp dụng</span>
      <strong>{formatBomTierLabel(menuPrice)}</strong>
      {menuPrice > 0 ? <StatusBadge variant="success">Đang dùng</StatusBadge> : <StatusBadge variant="warning">Chưa cấu hình</StatusBadge>}
    </div>
    <dl className="ipc-weekly-pricing-meta">
      <div><dt>Nguồn</dt><dd>{menuPriceSource}</dd></div>
    </dl>
  </section>
)
