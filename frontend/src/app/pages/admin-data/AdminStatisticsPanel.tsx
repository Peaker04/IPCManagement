import { BarChart3, PackageCheck, TrendingUp } from 'lucide-react';
import { KeepAliveTabPanel, TableViewport, PaginationBar, PaginatedTableFrame, SectionPanel, StatusBadge } from '@/components/common';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/routeConfig';
import { formatCurrency, formatDateTime, formatPercent, formatQuantity, formatQuantityWithUnit } from '@/lib/formatters';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

const renderKpiStatus = (
  isAlert: boolean,
  alertLabel: string,
  okLabel: string,
  alertTone: 'danger' | 'warning' | 'neutral' = 'danger',
) => (
  <StatusBadge variant={isAlert ? alertTone : 'success'}>
    {isAlert ? alertLabel : okLabel}
  </StatusBadge>
);

type AdminStatisticsPanelProps = { model: AdminDataPageModel };

export function AdminStatisticsPanel({ model }: AdminStatisticsPanelProps) {
  const { currentStockPage, currentStockPageResponse, currentStockRows, effectiveActiveView, operationalKpis, priceVariancePage, priceWarningCount, priceWarningPage, priceWarnings, queryViews, setCurrentStockPage, setPriceWarningPage, shortageCount, totalIssuedQty, totalPurchaseQty, totalReturnedQty, totalUsedQty } = model;
  return (
    <KeepAliveTabPanel id="admin-statistics" active={effectiveActiveView === 'statistics'} className="flex flex-col gap-4">
      <AdminQueryBoundary queries={[
        { label: 'KPI vận hành', view: queryViews.operationalKpis },
        { label: 'nhu cầu nguyên liệu', view: queryViews.ingredientDemand },
        { label: 'kế hoạch thu mua', view: queryViews.purchasePlan },
        { label: 'tồn kho hiện tại', view: queryViews.currentStock },
        { label: 'cảnh báo giá', view: queryViews.priceVariance },
      ]}>
        <SectionPanel
          title="Thống kê vận hành cho Admin"
          icon={<BarChart3 size={18} />}
          description="Tổng hợp các chỉ số KPI vận hành, tỷ lệ giao hàng đúng hạn và cảnh báo biến động giá."
        >
          <TableViewport caption="Chỉ số thống kê vận hành cho Admin" ariaLabel="Bảng chỉ số thống kê vận hành">
            <table className="ipc-erp-grid-table ipc-admin-statistics-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Nhóm thống kê</th>
                  <th className="text-right">Chỉ số</th>
                  <th className="text-left">Ý nghĩa vận hành</th>
                  <th className="text-center">Trạng thái</th>
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
                  <td className="text-right tabular-nums">{shortageCount} dòng thiếu</td>
                  <td className="text-left text-slate-600">Tổng hợp sau bước hệ thống tính nhu cầu trước khi kiểm tồn.</td>
                  <td className="text-center">
                    {renderKpiStatus(Boolean(shortageCount), `${shortageCount} thiếu`, 'Đủ tồn', 'warning')}
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

        <SectionPanel title="Snapshot tồn kho hiện tại" icon={<PackageCheck size={18} />}>
          <PaginatedTableFrame ariaLabel="Bảng snapshot tồn kho trong trang admin">
            <table className="ipc-erp-grid-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Kho</th>
                  <th className="text-left">Nguyên liệu</th>
                  <th className="text-right">Số lượng</th>
                  <th className="text-center">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {currentStockRows.length === 0 ? <EmptyRow colSpan={4} /> : currentStockRows.map((row) => (
                  <tr key={`${row.warehouseId}-${row.ingredientId}`}>
                    <td className="text-left text-slate-700">{row.warehouse}</td>
                    <td className="text-left font-medium text-slate-900">{row.ingredient}</td>
                    <td className="text-right tabular-nums font-semibold text-slate-900">{formatQuantityWithUnit(row.currentQty, row.unit, { maximumFractionDigits: 3 })}</td>
                    <td className="text-center tabular-nums text-slate-600">{formatDateTime(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PaginatedTableFrame>
          <PaginationBar
            page={currentStockPageResponse?.pageNumber ?? currentStockPage}
            pageSize={currentStockPageResponse?.pageSize ?? 8}
            totalItems={currentStockPageResponse?.totalCount ?? 0}
            onPageChange={setCurrentStockPage}
          />
        </SectionPanel>

        <SectionPanel title={`Cảnh báo biến động giá (${priceWarningCount} cảnh báo)`} icon={<TrendingUp size={18} />}>
          <PaginatedTableFrame ariaLabel="Bảng cảnh báo biến động giá trong trang admin">
            <table className="ipc-erp-grid-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Nguyên liệu</th>
                  <th className="text-left">Nhà cung cấp</th>
                  <th className="text-right">Giá trước</th>
                  <th className="text-right">Giá hiện tại</th>
                  <th className="text-right">Mức tăng</th>
                </tr>
              </thead>
              <tbody>
                {priceWarnings.length === 0 ? <EmptyRow colSpan={5} /> : priceWarnings.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td className="text-left font-medium text-slate-900">{row.name}</td>
                    <td className="text-left text-slate-700">{row.supplier}</td>
                    <td className="text-right tabular-nums text-slate-600">{formatCurrency(row.pricePrev)}</td>
                    <td className="text-right tabular-nums font-semibold text-slate-900">{formatCurrency(row.priceCurrent)}</td>
                    <td className="text-right tabular-nums font-bold text-red-600">+{formatPercent(row.change, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PaginatedTableFrame>
          <PaginationBar
            page={priceVariancePage?.pageNumber ?? priceWarningPage}
            pageSize={priceVariancePage?.pageSize ?? 8}
            totalItems={priceVariancePage?.totalCount ?? 0}
            onPageChange={setPriceWarningPage}
          />
        </SectionPanel>
      </AdminQueryBoundary>
    </KeepAliveTabPanel>
  );
}
