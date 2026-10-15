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
    <div className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
      <span className="text-slate-500">Định mức:</span>
      <strong className="font-semibold text-slate-900">{formatBomTierLabel(menuPrice)}</strong>
      {menuPrice <= 0 && <StatusBadge variant="warning" size="sm">Chưa cấu hình</StatusBadge>}
      <span className="text-slate-400">·</span>
      <span className="font-medium text-slate-600">{menuPriceSource}</span>
    </div>
  </section>
)
