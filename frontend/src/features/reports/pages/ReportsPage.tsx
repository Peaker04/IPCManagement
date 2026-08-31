import { lazy, Suspense } from 'react';
import {
  ArrowLeftRight,
  Database,
  Download,
  PackageCheck,
  RotateCcw,
  Search,
  ShoppingCart,
  Utensils,
  Warehouse,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { typography } from '@/lib/typography';
import {
  CommandBar,
  ContextStrip,
  CursorPaginationBar,
  KeepAliveTabPanel,
  OperationalFrame,
  PaginationBar,
  TableViewport,
  SectionPanel,
  StatusBadge,
  TabContentSkeleton,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routeConfig';
import { ReconciliationWorkspace } from '@/features/reconciliation/ReconciliationWorkspace';
import { useHasPermission } from '@/lib/useHasPermission';
import { useHasRole } from '@/lib/useHasRole';
import { formatCurrency, formatDateOnly, formatDateTime, formatQuantityWithUnit } from '@/lib/formatters';
import { uiCopy } from '@/lib/uiCopy';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import { normalizePurchasePlanGroupBy } from '../reportPlanning';
import { useGetSupplyLineReconciliationQuery } from '@/features/reports/reportsApi';
import {
  standardPageSizeOptions,
  useReportsPageModel,
} from './useReportsPageModel';
import { StockMovementTable } from '@/components/common/StockMovementTable';
import { ReportsNavigation } from './ReportsNavigation';
import { ReportEmptyRow as EmptyRow } from './ReportEmptyRow';
import { ReportQueryBoundary } from './ReportQueryBoundary';
import { Input } from '@/components/ui/input';
import { formatReconciliationDisposition } from '@/lib/workflowConfig';

const ReportsPricePanel = lazy(() => import('./ReportsPricePanel').then(({ ReportsPricePanel: component }) => ({ default: component })))
const ReportsDataQualityPanel = lazy(() => import('./ReportsDataQualityPanel').then(({ ReportsDataQualityPanel: component }) => ({ default: component })))
const ReportsFilters = lazy(() => import('./ReportsFilters').then(({ ReportsFilters: component }) => ({ default: component })))
const ServiceRunReportPanel = lazy(() => import('./ServiceRunReportPanel').then(({ ServiceRunReportPanel: component }) => ({ default: component })))
const LegacyLineageDispositionPanel = lazy(() => import('../LegacyLineageDispositionPanel').then(({ LegacyLineageDispositionPanel: component }) => ({ default: component })))
const reportCapabilityFallback = <TabContentSkeleton columns={7} rows={7} message="Đang tải báo cáo vận hành..." />

const reconciliationTone = (disposition: string) => {
  if (disposition === 'MATCHED') return 'success' as const;
  if (disposition.includes('LEGACY') || disposition.includes('OVER_ISSUED')) return 'danger' as const;
  if (disposition.includes('PENDING') || disposition.includes('OPEN')) return 'warning' as const;
  return 'info' as const;
};

const ReportsPage = () => {
  const canReadPurchaseReports = useHasPermission('purchase.read');
  const canReadWarehouseReports = useHasPermission('warehouse.read');
  const canReadAuditChanges = useHasRole(['admin']);
  const model = useReportsPageModel({ canReadAuditChanges, canReadPurchaseReports, canReadWarehouseReports });
  const { activeView, auditCursors, auditResult, auditRows, currentStockResult, currentStockRows, dateFrom, dateTo, demandPage, demandPageSize, demandSearch, exportConfig, handleExportActiveReport, ingredientDemandResult, ingredientDemandRows, isMaterialReconciliationMode, kitchenIssueResult, kitchenIssueRows, kitchenPage, movementCursors, movementSearch, openNextAuditPage, openNextMovementPage, operationalPageSize, purchasePage, purchasePageSize, purchasePlanGroupBy, purchasePlanResult, purchasePlanRows, purchasePlanSummary, purchaseSearch, reportContextItems, reportQuery, reportViews, resetReportPagesAndUrl, setAuditCursors, setDateFrom, setDateTo, setDemandPage, setDemandPageSize, setDemandSearch, setKitchenPage, setMovementCursors, setMovementSearch, setNumberedPage, setNumberedPageSize, setOperationalPageSize, setPurchasePage, setPurchasePageSize, setPurchasePlanGroupBy, setPurchaseSearch, setShiftName, setSortDirection, setStockPage, setStockPageSize, setStockSearch, setUsagePage, shiftName, sortDirection, stockMovementResult, stockMovementRows, stockPage, stockPageSize, stockSearch, usagePage, usageResult, usageRows, visibleReportTabs } = model;
  const reconciliationResult = useGetSupplyLineReconciliationQuery(reportQuery, { skip: isMaterialReconciliationMode || activeView !== 'usage' });
  const reconciliationRows = reconciliationResult.data ?? [];

  if (isMaterialReconciliationMode || visibleReportTabs.length === 0) {
    return (
      <OperationalFrame className={`${typography.body} ipc-reports-page`}>
        <ReconciliationWorkspace owner="reports" />
      </OperationalFrame>
    );
  }

  return (
    <OperationalFrame
      className={`${typography.body} ipc-reports-page`}
      command={
        <CommandBar
          actions={
            <>
              {exportConfig && (
                <button
                  type="button"
                  className="ipc-button ipc-button-primary"
                  onClick={handleExportActiveReport}
                >
                  <Download size={16} />
                  Xuất dữ liệu trang hiện tại
                </button>
              )}
              <button
                type="button"
                className="ipc-button ipc-button-secondary"
                onClick={resetReportPagesAndUrl}
              >
                <RotateCcw size={16} />
                Đặt lại bộ lọc
              </button>
            </>
          }
        >
          <Suspense fallback={<div aria-hidden="true" className="min-h-8 w-[32rem] rounded-md bg-slate-50" />}>
            <ReportsFilters activeView={activeView} dateFrom={dateFrom} dateTo={dateTo} shiftName={shiftName} sortDirection={sortDirection} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onShiftNameChange={setShiftName} onSortDirectionChange={setSortDirection} />
          </Suspense>
        </CommandBar>
      }
      context={
        <ContextStrip items={reportContextItems} />
      }
    >
      <ReportsNavigation model={model} />

      <KeepAliveTabPanel id="reports-price" active={activeView === 'price'} fallback={reportCapabilityFallback}>
        <Suspense fallback={reportCapabilityFallback}><ReportsPricePanel model={model} /></Suspense>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="reports-demand" active={activeView === 'demand'}>
        <ReportQueryBoundary view={reportViews.demand}>
          <SectionPanel title="Tổng hợp nhu cầu theo từng ngày trong khoảng đã chọn" icon={<Utensils size={18} />}>
            <label htmlFor="report-demand-search" className="mb-3 grid max-w-xl gap-1 text-xs font-semibold text-slate-700">
              Tìm nguyên liệu trong khoảng ngày
              <span className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="report-demand-search"
                  type="search"
                  value={demandSearch}
                  onChange={(event) => { setDemandSearch(event.target.value); setDemandPage(1); }}
                  placeholder="Tên hoặc mã nguyên liệu"
                  className="h-9 pl-9"
                />
              </span>
            </label>
            <TableViewport ariaLabel="Bảng nhu cầu nguyên liệu">
              <table className="ipc-erp-grid-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className="text-center">Ngày</th>
                    <th className="text-left">Nguyên liệu</th>
                    <th className="text-left">Nguồn</th>
                    <th className="text-right">Cần</th>
                    <th className="text-right">Đã cấp/xuất</th>
                    <th className="text-right">Chưa xuất</th>
                    <th className="text-center">Trạng thái</th>
                    <th className="text-center">Chuyển xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientDemandRows.length === 0 ? <EmptyRow colSpan={8} /> : ingredientDemandRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td className="text-center whitespace-nowrap text-slate-600">{row.serviceDate ? formatDateOnly(row.serviceDate) : 'Chưa xác định'}</td>
                      <td className="text-left font-medium text-slate-900">{row.material}</td>
                      <td className="text-left text-slate-600">{row.source}</td>
                      <td className="text-right tabular-nums">{formatQuantityWithUnit(row.required, row.unit)}</td>
                      <td className="text-right tabular-nums">{formatQuantityWithUnit(row.available, row.unit)}</td>
                      <td className="text-right tabular-nums font-semibold text-slate-900">{formatQuantityWithUnit(row.unissuedQty ?? Math.max(row.required - row.available, 0), row.unit)}</td>
                      <td className="text-center"><StatusBadge variant={row.tone} size="sm">{formatWorkflowStatus(row.status)}</StatusBadge></td>
                      <td className="text-center">{row.actionHref
                        ? <Link className="ipc-button ipc-button-primary ipc-button-compact" to={row.actionHref}>{row.nextAction}</Link>
                        : <span className="text-xs text-slate-500">{row.nextAction}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar
              page={ingredientDemandResult.data?.pageNumber ?? demandPage}
              pageSize={ingredientDemandResult.data?.pageSize ?? demandPageSize}
              totalItems={ingredientDemandResult.data?.totalCount ?? 0}
              itemLabel="nguyên liệu"
              isPending={ingredientDemandResult.isFetching}
              pageSizeOptions={standardPageSizeOptions}
              onPageSizeChange={(nextSize) => setNumberedPageSize(setDemandPage, setDemandPageSize, nextSize)}
              onPageChange={(nextPage) => setNumberedPage(setDemandPage, nextPage)}
            />
          </SectionPanel>
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="reports-purchase" active={activeView === 'purchase'}>
        <ReportQueryBoundary view={reportViews.purchase}>
          <SectionPanel
            title="Kế hoạch thu mua dự kiến"
            icon={<ShoppingCart size={18} />}
            badge={(
              <div className="flex flex-wrap gap-2">
                {(['day', 'week'] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={purchasePlanGroupBy === mode ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setPurchasePlanGroupBy(normalizePurchasePlanGroupBy(mode))}
                  >
                    {mode === 'day' ? 'Theo ngày' : 'Theo tuần'}
                  </Button>
                ))}
              </div>
            )}
          >
            <label htmlFor="report-purchase-search" className="mb-3 grid max-w-xl gap-1 text-xs font-semibold text-slate-700">
              Tìm trong kế hoạch thu mua
              <span className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input id="report-purchase-search" type="search" value={purchaseSearch} onChange={(event) => setPurchaseSearch(event.target.value)} placeholder="Nguyên liệu, nhà cung cấp, kỳ hoặc cảnh báo" className="h-9 pl-9" />
              </span>
            </label>
            <ContextStrip
              items={[
                { label: 'Dòng kế hoạch', value: String(purchasePlanSummary.rowCount), tone: purchasePlanSummary.rowCount ? 'info' : 'neutral' },
                { label: 'Thiếu sau pending', value: formatQuantityWithUnit(purchasePlanSummary.totalShortageQty, ''), tone: purchasePlanSummary.shortageTone },
                { label: 'Tổng dự kiến', value: formatCurrency(purchasePlanSummary.totalEstimatedAmount), tone: 'neutral' },
              ]}
            />
            <TableViewport ariaLabel="Bảng kế hoạch thu mua dự kiến">
              <table className="ipc-erp-grid-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className="text-center">Kỳ</th>
                    <th className="text-left">Nguyên liệu</th>
                    <th className="text-right">Cần</th>
                    <th className="text-right">Tồn</th>
                    <th className="text-right">{uiCopy.reports.pending}</th>
                    <th className="text-right">Đề xuất mua</th>
                    <th className="text-left">Nhà cung cấp</th>
                    <th className="text-center">Cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasePlanRows.length === 0 ? <EmptyRow colSpan={8} isError={purchasePlanResult.isError} /> : purchasePlanRows.map((row) => (
                    <tr key={`${row.periodKey}-${row.ingredientId}-${row.unitId}`}>
                      <td className="text-center text-slate-600">{row.periodKey}</td>
                      <td className="text-left font-medium text-slate-900">{row.ingredientName ?? row.ingredientId}</td>
                      <td className="text-right tabular-nums">{formatQuantityWithUnit(row.requiredQty, row.unitName ?? '')}</td>
                      <td className="text-right tabular-nums">{formatQuantityWithUnit(row.currentStockQty, row.unitName ?? '')}</td>
                      <td className="text-right tabular-nums">{formatQuantityWithUnit(row.pendingReceiptQty, row.unitName ?? '')}</td>
                      <td className="text-right tabular-nums font-semibold text-blue-700">{formatQuantityWithUnit(row.shortageQty, row.unitName ?? '')}</td>
                      <td className="text-left text-slate-700">{row.supplierName ?? 'Chưa có báo giá'}</td>
                      <td className="text-center">
                        <StatusBadge variant={row.warnings.length ? 'warning' : 'success'} size="sm">
                          {row.warnings[0] ?? 'Sẵn sàng'}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar
              page={purchasePlanResult.data?.pageNumber ?? purchasePage}
              pageSize={purchasePlanResult.data?.pageSize ?? purchasePageSize}
              totalItems={purchasePlanResult.data?.totalCount ?? 0}
              itemLabel="kế hoạch"
              isPending={purchasePlanResult.isFetching}
              pageSizeOptions={standardPageSizeOptions}
              onPageSizeChange={(nextSize) => setNumberedPageSize(setPurchasePage, setPurchasePageSize, nextSize)}
              onPageChange={(nextPage) => setNumberedPage(setPurchasePage, nextPage)}
            />
          </SectionPanel>
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="reports-stock" active={activeView === 'stock'}>
        <ReportQueryBoundary view={reportViews.stock}>
          <SectionPanel
            title="Tồn kho hiện tại theo kho"
            icon={<Warehouse size={18} />}
            description="Theo dõi số lượng tồn và cập nhật gần nhất của từng nguyên liệu theo các kho."
            actions={
              <div className="relative w-64 max-w-full">
                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="report-stock-search"
                  type="search"
                  value={stockSearch}
                  onChange={(event) => setStockSearch(event.target.value)}
                  placeholder="Kho, mã, nguyên liệu..."
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-300 focus:bg-white"
                  aria-label="Tìm trong snapshot tồn kho hiện tại"
                />
              </div>
            }
          >
            <TableViewport ariaLabel="Bảng tồn kho hiện tại">
              <table className="ipc-erp-grid-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className="text-left">Kho</th>
                    <th className="text-left">Nguyên liệu</th>
                    <th className="text-right">Số lượng hiện tại</th>
                    <th className="text-center">Cập nhật</th>
                    <th className="text-center">Chuyển xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStockRows.length === 0 ? <EmptyRow colSpan={5} /> : currentStockRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td className="text-left text-slate-700">{row.warehouse}</td>
                      <td className="text-left font-medium text-slate-900">{row.ingredient}</td>
                      <td className="text-right tabular-nums font-semibold text-slate-900">{formatQuantityWithUnit(row.currentQty, row.unit)}</td>
                      <td className="text-center tabular-nums text-slate-600">{formatDateTime(row.lastUpdated)}</td>
                      <td className="text-center"><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar
              page={currentStockResult.data?.pageNumber ?? stockPage}
              pageSize={currentStockResult.data?.pageSize ?? stockPageSize}
              totalItems={currentStockResult.data?.totalCount ?? 0}
              itemLabel="nguyên liệu"
              isPending={currentStockResult.isFetching}
              pageSizeOptions={standardPageSizeOptions}
              onPageSizeChange={(nextSize) => setNumberedPageSize(setStockPage, setStockPageSize, nextSize)}
              onPageChange={(nextPage) => setNumberedPage(setStockPage, nextPage)}
            />
          </SectionPanel>
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="reports-movement" active={activeView === 'movement'}>
        <ReportQueryBoundary view={reportViews.movement}>
          <SectionPanel
            title="Lịch sử nhập, xuất, trả và điều chỉnh theo khoảng ngày"
            icon={<ArrowLeftRight size={18} />}
            description="Tra cứu tất cả các bút toán luân chuyển kho phát sinh trong khoảng thời gian đã chọn."
            actions={
              <div className="relative w-64 max-w-full">
                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="report-movement-search"
                  type="search"
                  value={movementSearch}
                  onChange={(event) => setMovementSearch(event.target.value)}
                  placeholder="Kho, nguyên liệu, lý do..."
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-300 focus:bg-white"
                  aria-label="Tìm bút toán trong khoảng ngày"
                />
              </div>
            }
          >
            <StockMovementTable
              movements={stockMovementRows}
              cursorPagination={{
                page: movementCursors.length + 1,
                hasNext: stockMovementResult.data?.hasNext ?? false,
                isPending: stockMovementResult.isFetching,
                onPrevious: () => setMovementCursors((current) => current.slice(0, -1)),
                onNext: openNextMovementPage,
                ariaLabel: 'Phân trang lịch sử nhập xuất kho',
              }}
            />
          </SectionPanel>
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="reports-kitchen" active={activeView === 'kitchen'}>
        <ReportQueryBoundary view={reportViews.kitchen}>
          <SectionPanel title="Xuất kho cho bếp theo ca" icon={<PackageCheck size={18} />}>
            <TableViewport ariaLabel="Bảng xuất kho cho bếp">
              <table className="ipc-erp-grid-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className="text-left">Phiếu xuất</th>
                    <th className="text-center">Ngày</th>
                    <th className="text-left">Ca</th>
                    <th className="text-left">Kho</th>
                    <th className="text-left">Nguyên liệu</th>
                    <th className="text-right">Yêu cầu</th>
                    <th className="text-right">Đã xuất</th>
                  </tr>
                </thead>
                <tbody>
                  {kitchenIssueRows.length === 0 ? <EmptyRow colSpan={7} /> : kitchenIssueRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td className={typography.code}>{row.issueCode}</td>
                      <td className="text-center tabular-nums text-slate-600">{formatDateOnly(row.issueDate)}</td>
                      <td className="text-slate-700">{row.shiftName ?? 'Cả ngày'}</td>
                      <td className="text-slate-700">{row.warehouse}</td>
                      <td className="font-medium text-slate-900">{row.ingredient}</td>
                      <td className="text-right tabular-nums">{formatQuantityWithUnit(row.requestedQty, row.unit)}</td>
                      <td className="text-right tabular-nums font-semibold text-slate-900">{formatQuantityWithUnit(row.issuedQty, row.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar
              page={kitchenIssueResult.data?.pageNumber ?? kitchenPage}
              pageSize={kitchenIssueResult.data?.pageSize ?? operationalPageSize}
              totalItems={kitchenIssueResult.data?.totalCount ?? 0}
              itemLabel="phiếu xuất"
              isPending={kitchenIssueResult.isFetching}
              pageSizeOptions={standardPageSizeOptions}
              onPageSizeChange={(nextSize) => setNumberedPageSize(setKitchenPage, setOperationalPageSize, nextSize)}
              onPageChange={(nextPage) => setNumberedPage(setKitchenPage, nextPage)}
            />
          </SectionPanel>
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="reports-usage" active={activeView === 'usage'}>
        <ReportQueryBoundary view={reportViews.usage}>
          <SectionPanel title="Sử dụng thực tế của bếp: đã xuất - hoàn kho" icon={<RotateCcw size={18} />}>
            <TableViewport ariaLabel="Bảng sử dụng thực tế sau hoàn kho">
              <table className="ipc-data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Phiếu xuất</th>
                    <th>Ngày</th>
                    <th>Ca</th>
                    <th>Nguyên liệu</th>
                    <th className="text-right">Đã xuất</th>
                    <th className="text-right">Hoàn kho</th>
                    <th className="text-right">Đã dùng</th>
                  </tr>
                </thead>
                <tbody>
                  {usageRows.length === 0 ? <EmptyRow colSpan={7} /> : usageRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td className={typography.code}>{row.issueCode}</td>
                      <td>{formatDateOnly(row.issueDate)}</td>
                      <td>{row.shiftName ?? 'Cả ngày'}</td>
                      <td>{row.ingredient}</td>
                      <td className="ipc-numeric-cell text-right tabular-nums">{formatQuantityWithUnit(row.issuedQty, row.unit)}</td>
                      <td className="ipc-numeric-cell text-right tabular-nums">{formatQuantityWithUnit(row.returnedQty, row.unit)}</td>
                      <td className="ipc-numeric-cell text-right tabular-nums font-bold">{formatQuantityWithUnit(row.usedQty, row.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar
              page={usageResult.data?.pageNumber ?? usagePage}
              pageSize={usageResult.data?.pageSize ?? operationalPageSize}
              totalItems={usageResult.data?.totalCount ?? 0}
              itemLabel="dòng sử dụng"
              isPending={usageResult.isFetching}
              pageSizeOptions={standardPageSizeOptions}
              onPageSizeChange={(nextSize) => setNumberedPageSize(setUsagePage, setOperationalPageSize, nextSize)}
              onPageChange={(nextPage) => setNumberedPage(setUsagePage, nextPage)}
            />
          </SectionPanel>
          <SectionPanel
            title="Đối soát lifecycle theo dòng nhu cầu"
            icon={<ArrowLeftRight size={18} />}
            description="Không gộp theo tên nguyên liệu. Dòng legacy không có nguồn được giữ ở trạng thái cần đối soát."
          >
            <TableViewport ariaLabel="Bảng đối soát nguồn cung theo dòng nhu cầu">
              <table className="ipc-data-table min-w-[1300px]">
                <thead>
                  <tr>
                    <th>Nhu cầu nguồn</th>
                    <th>Nguyên liệu</th>
                    <th className="text-right">Cần</th>
                    <th className="text-right">PR/PO</th>
                    <th className="text-right">Đã nhập kho</th>
                    <th className="text-right">Đã xuất</th>
                    <th className="text-right">Bếp nhận</th>
                    <th className="text-right">Bổ sung<br />(YC/cấp/PR)</th>
                    <th className="text-right">Hoàn/Hao</th>
                    <th className="text-right">Delta</th>
                    <th>Kết quả đối soát</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationRows.length === 0 ? <EmptyRow colSpan={11} isError={reconciliationResult.isError} /> : reconciliationRows.map((row) => (
                    <tr key={row.materialRequestLineId}>
                      <td className={typography.code}>{row.materialRequestCode}</td>
                      <td>{row.ingredientName ?? row.ingredientId}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.demandQty, row.unitName ?? '')}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.purchaseRequestAllocatedQty, row.unitName ?? '')} / {formatQuantityWithUnit(row.purchaseOrderAllocatedQty, row.unitName ?? '')}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.postedAcceptedReceiptQty, row.unitName ?? '')}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.issuedQty, row.unitName ?? '')}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.kitchenAcknowledgedQty, row.unitName ?? '')}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.supplementalRequestedQty, row.unitName ?? '')} / {formatQuantityWithUnit(row.supplementalFulfilledQty, row.unitName ?? '')} / {formatQuantityWithUnit(row.supplementalPurchaseAllocatedQty, row.unitName ?? '')}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.returnedQty + row.wastedQty, row.unitName ?? '')}</td>
                      <td className="ipc-numeric-cell font-bold">{formatQuantityWithUnit(row.deltaQty, row.unitName ?? '')}</td>
                      <td className="ipc-badge-cell"><StatusBadge variant={reconciliationTone(row.disposition)}>{row.legacyLineageExceptionCount > 0 ? `${formatReconciliationDisposition(row.disposition)} · ${row.legacyLineageExceptionCount} dòng` : formatReconciliationDisposition(row.disposition)}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
          </SectionPanel>
          {reconciliationRows.some((row) => Array.isArray(row.legacyLineageDispositions)) && (
            <Suspense fallback={reportCapabilityFallback}>
              <LegacyLineageDispositionPanel rows={reconciliationRows} />
            </Suspense>
          )}
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="reports-audit" active={activeView === 'audit'}>
        <Suspense fallback={reportCapabilityFallback}>
          <ServiceRunReportPanel key={`${dateFrom}-${dateTo}-${shiftName}`} dateFrom={dateFrom} dateTo={dateTo} shiftName={shiftName} />
        </Suspense>
        <ReportQueryBoundary view={reportViews.audit}>
          <SectionPanel title={`${uiCopy.reports.audit} ${uiCopy.technical.bom.replace(/^Đ/, 'đ')}, tồn kho, số suất và chứng từ`} icon={<Database size={18} />}>
            <TableViewport className="ipc-reports-audit-shell" ariaLabel="Bảng audit thay đổi hệ thống">
              <table className="ipc-data-table ipc-reports-audit-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Mảng nghiệp vụ</th>
                    <th>Đối tượng</th>
                    <th>Giá trị cũ</th>
                    <th>Giá trị mới</th>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.length === 0 ? <EmptyRow colSpan={7} isError={auditResult.isError} /> : auditRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td>{formatDateTime(row.timestamp)}</td>
                      <td>{row.actor}</td>
                      <td>{row.businessArea}</td>
                      <td>{row.fieldAffected}</td>
                      <td><span className="ipc-reports-audit-value">{row.oldValue}</span></td>
                      <td><span className="ipc-reports-audit-value">{row.newValue}</span></td>
                      <td className="text-left"><span className="ipc-reports-audit-value">{row.reason}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
            <CursorPaginationBar
              page={auditCursors.length + 1}
              hasNext={auditResult.data?.hasNext ?? false}
              isPending={auditResult.isFetching}
              onPrevious={() => setAuditCursors((current) => current.slice(0, -1))}
              onNext={openNextAuditPage}
            />
          </SectionPanel>
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="reports-data-quality" active={activeView === 'data-quality'} fallback={reportCapabilityFallback}>
        <Suspense fallback={reportCapabilityFallback}><ReportsDataQualityPanel model={model} /></Suspense>
      </KeepAliveTabPanel>
      <ReconciliationWorkspace owner="reports" />
    </OperationalFrame>
  );
};

export default ReportsPage;
