import { BarChart3, PackageCheck, TrendingUp } from 'lucide-react';
import { TableViewport, PaginationBar, PaginatedTableFrame, SectionPanel, StatusBadge } from '@/components/common';
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
    <>
      {effectiveActiveView === 'statistics' && (
        <div id="admin-statistics-panel" role="tabpanel" aria-labelledby="admin-statistics-tab" className="flex flex-col gap-4">
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
                    <td className="text-left">Import, nhu cầu hoặc mua hàng đang ở trạng thái FAILED/IMPORT_FAILED.</td>
                    <td className="ipc-badge-cell">
                      {renderKpiStatus(Boolean(operationalKpis?.failedWorkflowCount), 'Cần điều tra', 'Ổn định')}
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.REPORTS}>Mở báo cáo</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Data quality critical</td>
                    <td className="ipc-numeric-cell">{operationalKpis?.criticalDataQualityCount ?? 0} lỗi</td>
                    <td className="text-left">Issue mức error cần xử lý trước khi tiếp tục luồng production.</td>
                    <td className="ipc-badge-cell">
                      {renderKpiStatus(Boolean(operationalKpis?.criticalDataQualityCount), 'Đang chặn', 'Đạt')}
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={`${ROUTES.ADMIN_DATA}?view=cleanup`}>Mở data quality</Link></td>
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
                      {renderKpiStatus(shortageCount > 0, 'Cần xử lý', 'Đủ tồn')}
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Mở mua thêm</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Mua hàng</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(totalPurchaseQty, 'đơn vị', { maximumFractionDigits: 3 })}</td>
                    <td className="text-left">Kế hoạch thu mua dự kiến theo ngày từ demand, tồn kho và pending receipt.</td>
                    <td className="ipc-badge-cell">{renderKpiStatus(totalPurchaseQty > 0, 'Có phát sinh', 'Không phát sinh', 'warning')}</td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Theo dõi thu mua</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Xuất bếp</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(totalIssuedQty, 'đơn vị', { maximumFractionDigits: 3 })}</td>
                    <td className="text-left">Theo phiếu xuất kho cho bếp, phục vụ kiểm tra luồng thủ kho.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={totalIssuedQty > 0 ? 'neutral' : 'warning'}>
                        {totalIssuedQty > 0 ? 'Đã ghi nhận' : 'Chưa có phiếu'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Sử dụng thực tế</td>
                    <td className="ipc-numeric-cell">{formatQuantity(totalUsedQty, { maximumFractionDigits: 3 })} dùng / {formatQuantity(totalReturnedQty, { maximumFractionDigits: 3 })} hoàn</td>
                    <td className="text-left">Ghép xuất kho và hoàn kho để tránh tách trùng bước kiểm nguyên liệu dư.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={totalUsedQty > 0 || totalReturnedQty > 0 ? 'success' : 'neutral'}>
                        {totalUsedQty > 0 || totalReturnedQty > 0 ? 'Có đối chiếu' : 'Chưa có dữ liệu'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.CHEF_DASHBOARD}>Mở bếp trưởng</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Biến động giá</td>
                    <td className="ipc-numeric-cell">{priceWarningCount} cảnh báo</td>
                    <td className="text-left">So giá nhập từ phiếu nhập với giá tham chiếu để admin theo dõi rủi ro.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={priceWarningCount ? 'danger' : 'success'}>{priceWarningCount ? 'Vượt ngưỡng' : 'Ổn định'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.REPORTS}>Mở báo cáo</Link></td>
                  </tr>
                </tbody>
              </table>
            </TableViewport>
          </SectionPanel>

          <SectionPanel title="Theo dõi tồn kho và xuất bếp" icon={<PackageCheck size={18} />}>
            <PaginatedTableFrame ariaLabel="Bảng tồn kho ưu tiên">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Kho</th>
                    <th>Nguyên liệu</th>
                    <th>Tồn hiện tại</th>
                    <th>Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStockRows.length === 0 ? <EmptyRow colSpan={4} /> : currentStockRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td>{row.warehouse}</td>
                      <td>{row.ingredient}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.currentQty, row.unit, { maximumFractionDigits: 3 })}</td>
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

          <SectionPanel title="Cảnh báo cần admin theo dõi" icon={<TrendingUp size={18} />}>
            <PaginatedTableFrame ariaLabel="Bảng cảnh báo biến động giá">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>Nhà cung cấp</th>
                    <th>Giá tham chiếu</th>
                    <th>Giá nhập</th>
                    <th>Biến động</th>
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
        </div>
      )}


    </>
  );
}
