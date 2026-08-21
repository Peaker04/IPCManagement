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
        <SectionPanel title="Thống kê vận hành cho Admin" icon={<BarChart3 size={18} />}>
          <TableViewport caption="Chỉ số thống kê vận hành cho Admin" ariaLabel="Bảng chỉ số thống kê vận hành">
            <table className="ipc-data-table ipc-status-action-table ipc-admin-statistics-table">
              <thead>
                <tr>
                  <th>Nhóm thống kê</th>
                  <th>Chỉ số</th>
                  <th>Ý nghĩa vận hành</th>
                  <th>Trạng thái</th>
                  <th>Chuyển xử lý</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">Workflow thất bại</td>
                  <td className="ipc-numeric-cell">{operationalKpis?.failedWorkflowCount ?? 0} bản ghi</td>
                  <td className="text-left">Dữ liệu nhập, nhu cầu hoặc mua hàng đang bị lỗi và cần điều tra.</td>
                  <td className="ipc-badge-cell">
                    {renderKpiStatus(Boolean(operationalKpis?.failedWorkflowCount), 'Cần điều tra', 'Ổn định')}
                  </td>
                  <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.REPORTS}>Mở báo cáo</Link></td>
                </tr>
                <tr>
                  <td className="font-semibold">Vấn đề dữ liệu nghiêm trọng</td>
                  <td className="ipc-numeric-cell">{operationalKpis?.criticalDataQualityCount ?? 0} lỗi</td>
                  <td className="text-left">Lỗi dữ liệu cần xử lý trước khi tiếp tục vận hành.</td>
                  <td className="ipc-badge-cell">
                    {renderKpiStatus(Boolean(operationalKpis?.criticalDataQualityCount), 'Đang chặn', 'Đạt')}
                  </td>
                  <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={`${ROUTES.ADMIN_DATA}?view=cleanup`}>Mở vấn đề dữ liệu</Link></td>
                </tr>
                <tr>
                  <td className="font-semibold">Approval chờ lâu</td>
                  <td className="ipc-numeric-cell">{operationalKpis?.overdueApprovalCount ?? 0} phiếu</td>
                  <td className="text-left">Phiếu chưa có quyết định sau 24 giờ hoặc đã qua ngày yêu cầu.</td>
                  <td className="ipc-badge-cell">
                    {renderKpiStatus(Boolean(operationalKpis?.overdueApprovalCount), 'Quá SLA', 'Trong SLA', 'warning')}
                  </td>
                  <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.APPROVALS}>Mở phê duyệt</Link></td>
                </tr>
                <tr>
                  <td className="font-semibold">Nhu cầu nguyên liệu</td>
                  <td className="ipc-numeric-cell">{shortageCount} dòng thiếu</td>
                  <td className="text-left">Tổng hợp sau bước hệ thống tính nhu cầu trước khi kiểm tồn.</td>
                  <td className="ipc-badge-cell">
                    {renderKpiStatus(Boolean(shortageCount), `${shortageCount} thiếu`, 'Đủ tồn', 'warning')}
                  </td>
                  <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WEEKLY_MENU}>Mở KHSX/BOM</Link></td>
                </tr>
                <tr>
                  <td className="font-semibold">Kế hoạch thu mua</td>
                  <td className="ipc-numeric-cell">{formatQuantity(totalPurchaseQty)} SL thiếu</td>
                  <td className="text-left">Đề xuất mua cho các ngày thiếu nguyên liệu sau kiểm tồn.</td>
                  <td className="ipc-badge-cell">
                    {renderKpiStatus(Boolean(totalPurchaseQty), 'Có đề xuất mua', 'Không cần mua', 'warning')}
                  </td>
                  <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Mở thu mua</Link></td>
                </tr>
                <tr>
                  <td className="font-semibold">Xuất bếp</td>
                  <td className="ipc-numeric-cell">{formatQuantity(totalIssuedQty)} đã xuất</td>
                  <td className="text-left">Tổng số lượng đã xuất cho bếp theo ca trong ngày.</td>
                  <td className="ipc-badge-cell">
                    {renderKpiStatus(!totalIssuedQty, 'Chưa xuất bếp', 'Đã xuất', 'neutral')}
                  </td>
                  <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                </tr>
                <tr>
                  <td className="font-semibold">Thực tế sử dụng tại bếp</td>
                  <td className="ipc-numeric-cell">{formatQuantity(totalUsedQty)} đã dùng</td>
                  <td className="text-left">Số lượng bếp thực tế đã nấu và ghi nhận.</td>
                  <td className="ipc-badge-cell">
                    {renderKpiStatus(!totalUsedQty, 'Chưa ghi nhận dùng', 'Đã ghi nhận', 'neutral')}
                  </td>
                  <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.CHEF_DASHBOARD}>Mở bếp trưởng</Link></td>
                </tr>
                <tr>
                  <td className="font-semibold">Hoàn kho từ bếp</td>
                  <td className="ipc-numeric-cell">{formatQuantity(totalReturnedQty)} hoàn kho</td>
                  <td className="text-left">Nguyên liệu thừa được lập phiếu hoàn về kho.</td>
                  <td className="ipc-badge-cell">
                    {renderKpiStatus(Boolean(totalReturnedQty), 'Có hoàn kho', 'Không hoàn kho', 'neutral')}
                  </td>
                  <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                </tr>
              </tbody>
            </table>
          </TableViewport>
        </SectionPanel>

        <SectionPanel title="Snapshot tồn kho hiện tại" icon={<PackageCheck size={18} />}>
          <PaginatedTableFrame ariaLabel="Bảng snapshot tồn kho trong trang admin">
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th>Kho</th>
                  <th>Nguyên liệu</th>
                  <th>Số lượng</th>
                  <th>Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {currentStockRows.length === 0 ? <EmptyRow colSpan={4} /> : currentStockRows.map((row) => (
                  <tr key={`${row.warehouseId}-${row.ingredientId}`}>
                    <td>{row.warehouse}</td>
                    <td>{row.ingredient}</td>
                    <td className="ipc-numeric-cell font-medium">{formatQuantityWithUnit(row.currentQty, row.unit, { maximumFractionDigits: 3 })}</td>
                    <td>{formatDateTime(row.lastUpdated)}</td>
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
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th>Nguyên liệu</th>
                  <th>Nhà cung cấp</th>
                  <th>Giá trước</th>
                  <th>Giá hiện tại</th>
                  <th>Mức tăng</th>
                </tr>
              </thead>
              <tbody>
                {priceWarnings.length === 0 ? <EmptyRow colSpan={5} /> : priceWarnings.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td>{row.name}</td>
                    <td>{row.supplier}</td>
                    <td className="ipc-numeric-cell">{formatCurrency(row.pricePrev)}</td>
                    <td className="ipc-numeric-cell">{formatCurrency(row.priceCurrent)}</td>
                    <td className="ipc-numeric-cell font-bold text-[var(--ipc-danger)]">+{formatPercent(row.change, 1)}</td>
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
