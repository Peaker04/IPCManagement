import { BarChart3 } from 'lucide-react';
import { KeepAliveTabPanel, TableViewport, SectionPanel, StatusBadge } from '@/components/common';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/routeConfig';
import { formatQuantity } from '@/lib/formatters';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

const renderKpiStatus = (
  isAlert: boolean,
  alertLabel: string,
  _okLabel: string,
  alertTone: 'danger' | 'warning' | 'neutral' = 'danger',
) => isAlert
  ? <StatusBadge variant={alertTone}>{alertLabel}</StatusBadge>
  : <span className="text-slate-400" aria-label="Không có cảnh báo">—</span>;

type AdminStatisticsPanelProps = { model: AdminDataPageModel };

export function AdminStatisticsPanel({ model }: AdminStatisticsPanelProps) {
  const { effectiveActiveView, operationalKpis, priceWarningCount, queryViews, shortageCount, totalIssuedQty, totalPurchaseQty, totalReturnedQty, totalUsedQty } = model;
  return (
    <KeepAliveTabPanel id="admin-statistics" active={effectiveActiveView === 'statistics'} className="flex flex-col gap-4">
      <AdminQueryBoundary queries={[
        { label: 'KPI vận hành', view: queryViews.operationalKpis },
        { label: 'nhu cầu nguyên liệu', view: queryViews.ingredientDemand },
        { label: 'kế hoạch thu mua', view: queryViews.purchasePlan },
        { label: 'cảnh báo giá', view: queryViews.priceVariance },
      ]}>
        <SectionPanel
          title="Thống kê vận hành"
          icon={<BarChart3 size={18} />}
          description="Chỉ số cần Admin theo dõi và chuyển xử lý."
        >
          <TableViewport caption="Chỉ số thống kê vận hành cho Admin" ariaLabel="Bảng chỉ số thống kê vận hành">
            <table className="ipc-data-table ipc-erp-grid-table ipc-admin-statistics-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Nhóm thống kê</th>
                  <th className="text-right">Chỉ số</th>
                  <th className="text-left">Ý nghĩa vận hành</th>
                  <th className="text-center">Cảnh báo</th>
                  <th className="text-center">Chuyển xử lý</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Workflow thất bại</td>
                  <td className="text-right tabular-nums">{operationalKpis?.failedWorkflowCount ?? 0} bản ghi</td>
                  <td className="text-left text-slate-600">Dữ liệu nhập, nhu cầu hoặc mua hàng đang bị lỗi và cần điều tra.</td>
                  <td className="text-center">
                    {renderKpiStatus(Boolean(operationalKpis?.failedWorkflowCount), 'Cần điều tra', 'Ổn định')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.REPORTS}>Mở báo cáo</Link></td>
                </tr>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Cảnh báo biến động giá</td>
                  <td className="text-right tabular-nums">{priceWarningCount} cảnh báo</td>
                  <td className="text-left text-slate-600">Biến động giá cần được phân tích tại báo cáo theo đúng bộ lọc và đơn vị dữ liệu.</td>
                  <td className="text-center">
                    {renderKpiStatus(Boolean(priceWarningCount), 'Cần theo dõi', 'Không có cảnh báo', 'warning')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={`${ROUTES.REPORTS}?view=price&subview=lines`}>Mở báo cáo biến động giá</Link></td>
                </tr>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Vấn đề dữ liệu nghiêm trọng</td>
                  <td className="text-right tabular-nums">{operationalKpis?.criticalDataQualityCount ?? 0} lỗi</td>
                  <td className="text-left text-slate-600">Lỗi dữ liệu cần xử lý trước khi tiếp tục vận hành.</td>
                  <td className="text-center">
                    {renderKpiStatus(Boolean(operationalKpis?.criticalDataQualityCount), 'Đang chặn', 'Đạt')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={`${ROUTES.ADMIN_DATA}?view=cleanup`}>Mở vấn đề dữ liệu</Link></td>
                </tr>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Approval chờ lâu</td>
                  <td className="text-right tabular-nums">{operationalKpis?.overdueApprovalCount ?? 0} phiếu</td>
                  <td className="text-left text-slate-600">Phiếu chưa có quyết định sau 24 giờ hoặc đã qua ngày yêu cầu.</td>
                  <td className="text-center">
                    {renderKpiStatus(Boolean(operationalKpis?.overdueApprovalCount), 'Quá SLA', 'Trong SLA', 'warning')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.APPROVALS}>Mở phê duyệt</Link></td>
                </tr>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Nhu cầu nguyên liệu</td>
                  <td className="text-right tabular-nums">{shortageCount} dòng chưa xuất</td>
                  <td className="text-left text-slate-600">Dòng ngày–nguyên liệu còn phải xuất; không phải đề xuất mua.</td>
                  <td className="text-center">
                    {renderKpiStatus(Boolean(shortageCount), `${shortageCount} chưa xuất`, 'Không còn chờ xuất', 'warning')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WEEKLY_MENU}>Mở KHSX/BOM</Link></td>
                </tr>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Kế hoạch thu mua</td>
                  <td className="text-right tabular-nums">{formatQuantity(totalPurchaseQty)} SL thiếu</td>
                  <td className="text-left text-slate-600">Đề xuất mua cho các ngày thiếu nguyên liệu sau kiểm tồn.</td>
                  <td className="text-center">
                    {renderKpiStatus(Boolean(totalPurchaseQty), 'Có đề xuất mua', 'Không cần mua', 'warning')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Mở thu mua</Link></td>
                </tr>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Xuất bếp</td>
                  <td className="text-right tabular-nums">{formatQuantity(totalIssuedQty)} đã xuất</td>
                  <td className="text-left text-slate-600">Tổng số lượng đã xuất cho bếp theo ca trong ngày.</td>
                  <td className="text-center">
                    {renderKpiStatus(!totalIssuedQty, 'Chưa xuất bếp', 'Đã xuất', 'neutral')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                </tr>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Thực tế sử dụng tại bếp</td>
                  <td className="text-right tabular-nums">{formatQuantity(totalUsedQty)} đã dùng</td>
                  <td className="text-left text-slate-600">Số lượng bếp thực tế đã nấu và ghi nhận.</td>
                  <td className="text-center">
                    {renderKpiStatus(!totalUsedQty, 'Chưa ghi nhận dùng', 'Đã ghi nhận', 'neutral')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.CHEF_DASHBOARD}>Mở bếp trưởng</Link></td>
                </tr>
                <tr>
                  <td className="text-left font-semibold text-slate-900">Hoàn kho từ bếp</td>
                  <td className="text-right tabular-nums">{formatQuantity(totalReturnedQty)} hoàn kho</td>
                  <td className="text-left text-slate-600">Nguyên liệu thừa được lập phiếu hoàn về kho.</td>
                  <td className="text-center">
                    {renderKpiStatus(Boolean(totalReturnedQty), 'Có hoàn kho', 'Không hoàn kho', 'neutral')}
                  </td>
                  <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                </tr>
              </tbody>
            </table>
          </TableViewport>
        </SectionPanel>

      </AdminQueryBoundary>
    </KeepAliveTabPanel>
  );
}
