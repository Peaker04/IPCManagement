import { ClipboardList, ShieldCheck } from 'lucide-react'
import { SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { formatQuantityWithUnit } from '@/lib/formatters'
import { getChefReadiness } from '../chefReadiness'
import type { DailyPlanLine } from './chefProductionModel'

type Props = {
  lines: DailyPlanLine[]
  isSending: boolean
  onReceivePlan: () => Promise<void>
}

const bomScopeLabels: Record<string, string> = {
  global: 'Dùng chung',
  customer: 'Theo khách hàng',
  standard: 'Tiêu chuẩn',
}

const formatBomScope = (scope?: string | null) => scope ? bomScopeLabels[scope.toLowerCase()] ?? 'Theo cấu hình' : 'Theo cấu hình'

export function ChefProductionSection({ lines, isSending, onReceivePlan }: Props) {
  return (
    <SectionPanel
      title="Kế hoạch trong ngày đã gửi bếp"
      icon={<ClipboardList size={18} />}
      badge={(
        <button className="ipc-button ipc-button-primary" type="button" disabled={isSending} onClick={() => void onReceivePlan()}>
          <ShieldCheck size={15} />
          Nhận kế hoạch
        </button>
      )}
    >
      <TableViewport className="max-h-[320px]" ariaLabel="Kế hoạch sản xuất gửi bếp" caption="Kế hoạch sản xuất trong ngày đã gửi bếp">
        <table className="ipc-data-table ipc-status-action-table">
          <thead>
            <tr>
              <th>Kế hoạch</th><th>Khách hàng</th><th>Món</th><th>Ca</th>
              <th>Suất</th><th>Định lượng</th><th>Thiếu</th><th>Trạng thái</th>
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
