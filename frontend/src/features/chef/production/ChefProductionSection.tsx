import { ClipboardList } from 'lucide-react';
import { SectionPanel, StatusBadge, TableViewport } from '@/components/common';
import { formatQuantityWithUnit } from '@/lib/formatters';
import { getChefReadiness } from '../chefReadiness';
import { formatShiftName } from '@/lib/workflowConfig';
import type { DailyPlanLine } from './chefProductionModel';

type Props = {
  lines: DailyPlanLine[];
  isLoading: boolean;
  isError: boolean;
  totalPlans: number;
  sentPlans: number;
};

const bomScopeLabels: Record<string, string> = {
  global: 'Dùng chung',
  customer: 'Theo khách hàng',
  standard: 'Tiêu chuẩn',
};

const formatBomScope = (scope?: string | null) => (scope ? (bomScopeLabels[scope.toLowerCase()] ?? 'Theo cấu hình') : 'Theo cấu hình');

export function ChefProductionSection({ lines, isLoading, isError, totalPlans, sentPlans }: Props) {
  const isComplete = totalPlans > 0 && sentPlans >= totalPlans;

  return (
    <SectionPanel
      title="Kế hoạch điều phối trong ngày"
      icon={<ClipboardList size={18} />}
      description="Kế hoạch sản xuất và phân bổ số suất theo từng ca phục vụ trong ngày của bếp."
      badge={
        isComplete ? (
          <StatusBadge variant="success">Kế hoạch đã đồng bộ</StatusBadge>
        ) : isLoading ? (
          <StatusBadge variant="neutral">Đang tải</StatusBadge>
        ) : isError ? (
          <StatusBadge variant="danger">Không tải được</StatusBadge>
        ) : (
          <StatusBadge variant="warning">Chờ Điều phối gửi</StatusBadge>
        )
      }
    >
      <TableViewport className="max-h-[320px]" ariaLabel="Kế hoạch điều phối trong ngày" caption="Kế hoạch điều phối trong ngày">
        <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="text-left">Kế hoạch / khách hàng</th>
              <th className="text-left">Món / ca</th>
              <th className="text-right">Số suất</th>
              <th className="text-left">Định lượng</th>
              <th className="text-right">Mua dự kiến</th>
              <th className="text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Chưa có kế hoạch cho ngày/ca này.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const readiness = getChefReadiness(line);
                return (
                  <tr key={`${line.planCode}-${line.planLineId}`}>
                    <td className="text-left"><span className="block font-semibold text-slate-900">{line.planCode}</span><span className="block text-xs text-slate-500">{line.customerName ?? 'Chưa có tên khách hàng'}</span></td>
                    <td className="text-left"><span className="block font-medium text-slate-900">{line.dishName ?? 'Chưa có tên món'}</span><span className="block text-xs text-slate-500">{formatShiftName(line.shiftName ?? undefined)}</span></td>
                    <td className="text-right tabular-nums font-semibold text-slate-900">{line.totalServings}</td>
                    <td className="text-left text-slate-700">{line.priceTierAmount ? `${line.priceTierAmount / 1000}k / ${formatBomScope(line.bomScope)}` : 'Chưa xác định định lượng'}</td>
                    <td className="text-right tabular-nums text-slate-700">{formatQuantityWithUnit(line.suggestedPurchaseQty, '')}</td>
                    <td className="text-center">
                      <StatusBadge variant={readiness.variant}>{readiness.label}</StatusBadge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableViewport>
    </SectionPanel>
  );
}
