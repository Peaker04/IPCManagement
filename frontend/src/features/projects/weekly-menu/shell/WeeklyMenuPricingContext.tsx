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
      <span>Định mức</span>
      <strong>{formatBomTierLabel(menuPrice)}</strong>
      {menuPrice <= 0 && <StatusBadge variant="warning">Chưa cấu hình</StatusBadge>}
      <span className="text-xs text-slate-500">· <span>{menuPriceSource}</span></span>
    </div>
  </section>
)
