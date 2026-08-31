import { ClipboardList, ShieldCheck } from 'lucide-react';
import { SectionPanel, StatusBadge, TableViewport } from '@/components/common';
import { Button } from '@/components/ui/button';
import { formatQuantityWithUnit } from '@/lib/formatters';
import { getChefReadiness } from '../chefReadiness';
import { formatShiftName } from '@/lib/workflowConfig';
import type { DailyPlanLine } from './chefProductionModel';

type Props = {
  lines: DailyPlanLine[];
  isSending: boolean;
  isLoading: boolean;
  isError: boolean;
  totalPlans: number;
  sentPlans: number;
  onReceivePlan: () => Promise<void>;
};

const bomScopeLabels: Record<string, string> = {
  global: 'Dùng chung',
  customer: 'Theo khách hàng',
  standard: 'Tiêu chuẩn',
};

const formatBomScope = (scope?: string | null) => (scope ? (bomScopeLabels[scope.toLowerCase()] ?? 'Theo cấu hình') : 'Theo cấu hình');

export function ChefProductionSection({ lines, isSending, isLoading, isError, totalPlans, sentPlans, onReceivePlan }: Props) {
  const isComplete = totalPlans > 0 && sentPlans >= totalPlans;
  const canReceivePlan = !isLoading && !isError && totalPlans > 0 && !isComplete;

  return (
    <SectionPanel
      title="Kế hoạch điều phối trong ngày"
      icon={<ClipboardList size={18} />}
      description="Kế hoạch sản xuất và phân bổ số suất theo từng ca phục vụ trong ngày của bếp."
      badge={
        isComplete ? (
          <StatusBadge variant="success">Kế hoạch đã đồng bộ</StatusBadge>
        ) : (
          <Button size="sm" type="button" disabled={isSending || !canReceivePlan} onClick={() => void onReceivePlan()}>
            <ShieldCheck size={15} aria-hidden="true" />
            {isSending ? 'Đang nhận...' : 'Nhận kế hoạch'}
          </Button>
        )
      }
    >
      <TableViewport className="max-h-[320px]" ariaLabel="Kế hoạch điều phối trong ngày" caption="Kế hoạch điều phối trong ngày">
        <table className="ipc-erp-grid-table w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="text-left">Kế hoạch</th>
              <th className="text-left">Khách hàng</th>
              <th className="text-left">Món</th>
              <th className="text-left">Ca</th>
              <th className="text-right">Số suất</th>
              <th className="text-left">Định lượng</th>
              <th className="text-right">Mua dự kiến</th>
              <th className="text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Chưa có kế hoạch cho ngày/ca này.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const readiness = getChefReadiness(line);
                return (
                  <tr key={`${line.planCode}-${line.planLineId}`}>
                    <td className="text-left font-semibold text-slate-900">{line.planCode}</td>
                    <td className="text-left text-slate-800">{line.customerName ?? '-'}</td>
                    <td className="text-left text-slate-800">{line.dishName ?? line.dishId}</td>
                    <td className="text-left text-slate-700">{formatShiftName(line.shiftName ?? undefined)}</td>
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
