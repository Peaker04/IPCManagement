import { ClipboardList, ShieldCheck } from 'lucide-react'
import { SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatQuantityWithUnit } from '@/lib/formatters'
import { getChefReadiness } from '../chefReadiness'
import type { DailyPlanLine } from './chefProductionModel'

type Props = {
  lines: DailyPlanLine[]
  isSending: boolean
  isLoading: boolean
  isError: boolean
  totalPlans: number
  sentPlans: number
  onReceivePlan: () => Promise<void>
}

const bomScopeLabels: Record<string, string> = {
  global: 'Dùng chung',
  customer: 'Theo khách hàng',
  standard: 'Tiêu chuẩn',
}

const formatBomScope = (scope?: string | null) => scope ? bomScopeLabels[scope.toLowerCase()] ?? 'Theo cấu hình' : 'Theo cấu hình'

export function ChefProductionSection({
  lines,
  isSending,
  isLoading,
  isError,
  totalPlans,
  sentPlans,
  onReceivePlan,
}: Props) {
  const isComplete = totalPlans > 0 && sentPlans >= totalPlans
  const canReceivePlan = !isLoading && !isError && totalPlans > 0 && !isComplete
  const blockedReason = isLoading
    ? 'Đang kiểm tra kế hoạch sản xuất.'
    : isError
      ? 'Chưa tải được kế hoạch sản xuất. Thử lại trước khi xác nhận.'
    : totalPlans === 0
          ? 'Chưa có kế hoạch sản xuất cho ngày/ca này.'
          : undefined

  return (
    <SectionPanel
      title="Kế hoạch điều phối trong ngày"
      icon={<ClipboardList size={18} />}
      badge={(
        isComplete ? (
          <StatusBadge variant="success">Kế hoạch đã đồng bộ</StatusBadge>
        ) : (
          <Button size="sm" type="button" disabled={isSending || !canReceivePlan} onClick={() => void onReceivePlan()}>
            <ShieldCheck size={15} aria-hidden="true" />
            {isSending ? 'Đang nhận...' : 'Nhận kế hoạch'}
          </Button>
        )
      )}
    >
      {blockedReason ? <p className="mb-3 text-caption leading-[1.4] text-slate-600" role="status">{blockedReason}</p> : null}
      <TableViewport className="max-h-[320px]" ariaLabel="Kế hoạch điều phối trong ngày" caption="Kế hoạch điều phối trong ngày">
        <table className="ipc-data-table ipc-status-action-table ipc-chef-production-table">
          <thead>
            <tr>
              <th>Kế hoạch</th><th>Khách hàng</th><th>Món</th><th>Ca</th>
              <th>Suất</th><th>Định lượng</th><th>Mua dự kiến</th><th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-500">Chưa có kế hoạch cho ngày/ca này.</td></tr>
            ) : lines.map((line) => {
              const readiness = getChefReadiness(line)
              return (
                <tr key={`${line.planCode}-${line.planLineId}`}>
                  <td>{line.planCode}</td><td>{line.customerName ?? '-'}</td><td>{line.dishName ?? line.dishId}</td>
                  <td>{line.shiftName ?? '-'}</td><td className="ipc-numeric-cell">{line.totalServings}</td>
                  <td>{line.priceTierAmount ? `${line.priceTierAmount / 1000}k / ${formatBomScope(line.bomScope)}` : 'Chưa xác định định lượng'}</td>
                  <td className="ipc-numeric-cell">{formatQuantityWithUnit(line.suggestedPurchaseQty, '')}</td>
                  <td className="ipc-badge-cell"><StatusBadge variant={readiness.variant}>{readiness.label}</StatusBadge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableViewport>
    </SectionPanel>
  )
}
