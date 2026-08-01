import { AlertTriangle, ClipboardList, Search, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ExceptionLane,
  PaginationBar,
  SectionPanel,
  StatusBadge,
  TableViewport,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/lib/routeConfig';
import { formatCurrency, formatDateOnly, formatPercent, formatQuantityWithUnit, formatUnit } from '@/lib/formatters';
import { uiCopy } from '@/lib/uiCopy';
import { Input } from '@/components/ui/input';
import { ReportEmptyRow as EmptyRow } from './ReportEmptyRow';
import { ReportQueryBoundary } from './ReportQueryBoundary';
import {
  pricePageSizeOptions,
  standardPageSizeOptions,
  type PriceSubView,
  type ReportsPageModel,
} from './useReportsPageModel';

interface ReportsPricePanelProps {
  model: ReportsPageModel;
}

export function ReportsPricePanel({ model }: ReportsPricePanelProps) {
  const {
    activePriceView,
    dishGroupPage,
    periodPage,
    priceAggregatePageSize,
    pricePage,
    pricePageSize,
    priceSearch,
    priceSubView,
    priceVarianceByDishGroupResult,
    priceVarianceByDishGroupRows,
    priceVarianceByPeriodResult,
    priceVarianceByPeriodRows,
    priceVarianceBySupplierResult,
    priceVarianceBySupplierRows,
    priceVarianceResult,
    priceVarianceRows,
    resetReportPages,
    selectedWarning,
    setDishGroupPage,
    setNumberedPage,
    setNumberedPageSize,
    setPeriodPage,
    setPriceAggregatePageSize,
    setPricePage,
    setPricePageSize,
    setPriceSearch,
    setRequestedPriceSubView,
    setSupplierPage,
    startViewTransition,
    supplierPage,
    updateSearchState,
    visiblePriceSubViewTabs,
    warningItems,
  } = model;
  const warningQueue = warningItems.map((item) => ({
    title: item.name,
    description: `Tăng ${formatPercent(item.change)} tại ${item.supplier}. Giá hiện tại ${formatCurrency(item.priceCurrent)}/${formatUnit(item.unit)}.`,
    action: (
      <div className="ipc-report-warning-actions">
        <Link className="ipc-button ipc-button-warning ipc-button-bounded" to={ROUTES.PURCHASING}>Thu mua xử lí</Link>
        <Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.APPROVALS}>Gửi quản lí duyệt</Link>
      </div>
    ),
    tone: 'danger' as const,
  }));

  return (
    <div id="reports-price-panel" role="tabpanel" aria-labelledby="reports-price-tab" className="flex flex-col gap-4">
      {priceSubView === 'lines' && activePriceView.phase === 'ready' && (
        <ExceptionLane
          title="Hàng đợi cảnh báo giá"
          items={warningQueue}
          empty="Không có nguyên liệu vượt ngưỡng trong kỳ này."
          className="h-[145px] overflow-y-auto"
        />
      )}

      <ViewSwitcher
        compact
        ariaLabel="Chọn cách phân tích biến động giá"
        tabs={visiblePriceSubViewTabs.map((tab) => ({ id: `price-sub-${tab.id}`, label: tab.label }))}
        activeTab={`price-sub-${priceSubView}`}
        onTabChange={(id) => {
          const nextSubView = id.replace('price-sub-', '') as PriceSubView;
          startViewTransition(() => {
            setRequestedPriceSubView(nextSubView);
            resetReportPages();
            updateSearchState({ subview: nextSubView, page: undefined, pageSize: undefined });
          });
        }}
      />

      <div id={`price-sub-${priceSubView}-panel`} role="tabpanel" aria-labelledby={`price-sub-${priceSubView}-tab`} className="min-w-0">
      <ReportQueryBoundary view={activePriceView}>
      {priceSubView === 'supplier' && (
        <SectionPanel title="Biến động giá theo nhà cung cấp" icon={<ClipboardList size={18} color="var(--ipc-slate-600)" />}>
          <TableViewport ariaLabel="Bảng biến động giá theo nhà cung cấp">
            <table className="ipc-data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Nguyên liệu</th>
                  <th>Nhà cung cấp</th>
                  <th>Số lần nhập</th>
                  <th>Giá TB</th>
                  <th>Giá thấp nhất</th>
                  <th>Giá cao nhất</th>
                  <th>Giá tham chiếu</th>
                  <th>% biến động</th>
                  <th>Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {priceVarianceBySupplierRows.length === 0 ? (
                  <EmptyRow colSpan={9} isError={priceVarianceBySupplierResult.isError} />
                ) : (
                  priceVarianceBySupplierRows.map((row) => (
                    <tr key={`${row.ingredientId}-${row.supplierId}`} className={row.isWarning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                      <td>{row.ingredientName}</td>
                      <td>{row.supplierName}</td>
                      <td className="ipc-numeric-cell">{row.receiptCount}</td>
                      <td className="ipc-numeric-cell">{formatCurrency(row.avgUnitPrice)}</td>
                      <td className="ipc-numeric-cell">{formatCurrency(row.minUnitPrice)}</td>
                      <td className="ipc-numeric-cell">{formatCurrency(row.maxUnitPrice)}</td>
                      <td className="ipc-numeric-cell">{formatCurrency(row.referencePrice)}</td>
                      <td className="ipc-numeric-cell">{formatPercent(row.variancePercent)}</td>
                      <td className="ipc-badge-cell">
                        {row.isWarning ? (
                          <StatusBadge variant="danger" className="ipc-table-badge ipc-table-badge--status">Vượt ngưỡng</StatusBadge>
                        ) : (
                          <StatusBadge variant="success" className="ipc-table-badge ipc-table-badge--status">Ổn định</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            page={priceVarianceBySupplierResult.data?.pageNumber ?? supplierPage}
            pageSize={priceVarianceBySupplierResult.data?.pageSize ?? priceAggregatePageSize}
            totalItems={priceVarianceBySupplierResult.data?.totalCount ?? 0}
            itemLabel="nhà cung cấp"
            isPending={priceVarianceBySupplierResult.isFetching}
            pageSizeOptions={standardPageSizeOptions}
            onPageSizeChange={(nextSize) => setNumberedPageSize(setSupplierPage, setPriceAggregatePageSize, nextSize)}
            onPageChange={(nextPage) => setNumberedPage(setSupplierPage, nextPage)}
          />
        </SectionPanel>
      )}

      {priceSubView === 'period' && (
        <SectionPanel title="Biến động giá theo thời gian (theo tháng)" icon={<ClipboardList size={18} color="var(--ipc-slate-600)" />}>
          <TableViewport ariaLabel="Bảng biến động giá theo thời gian">
            <table className="ipc-data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Nguyên liệu</th>
                  <th>Tháng</th>
                  <th>Giá TB</th>
                  <th>% so với tham chiếu</th>
                  <th>% so với tháng trước</th>
                  <th>Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {priceVarianceByPeriodRows.length === 0 ? (
                  <EmptyRow colSpan={6} isError={priceVarianceByPeriodResult.isError} />
                ) : (
                  priceVarianceByPeriodRows.map((row) => (
                    <tr key={`${row.ingredientId}-${row.periodLabel}`} className={row.isWarning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                      <td>{row.ingredientName}</td>
                      <td>{row.periodLabel}</td>
                      <td className="ipc-numeric-cell">{formatCurrency(row.avgUnitPrice)}</td>
                      <td className="ipc-numeric-cell">{formatPercent(row.variancePercentVsReference)}</td>
                      <td className="ipc-numeric-cell">
                        {row.variancePercentVsPreviousPeriod == null ? '—' : formatPercent(row.variancePercentVsPreviousPeriod)}
                      </td>
                      <td className="ipc-badge-cell">
                        {row.isWarning ? (
                          <StatusBadge variant="danger" className="ipc-table-badge ipc-table-badge--status">Vượt ngưỡng</StatusBadge>
                        ) : (
                          <StatusBadge variant="success" className="ipc-table-badge ipc-table-badge--status">Ổn định</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            page={priceVarianceByPeriodResult.data?.pageNumber ?? periodPage}
            pageSize={priceVarianceByPeriodResult.data?.pageSize ?? priceAggregatePageSize}
            totalItems={priceVarianceByPeriodResult.data?.totalCount ?? 0}
            itemLabel="kỳ báo cáo"
            isPending={priceVarianceByPeriodResult.isFetching}
            pageSizeOptions={standardPageSizeOptions}
            onPageSizeChange={(nextSize) => setNumberedPageSize(setPeriodPage, setPriceAggregatePageSize, nextSize)}
            onPageChange={(nextPage) => setNumberedPage(setPeriodPage, nextPage)}
          />
        </SectionPanel>
      )}

      {priceSubView === 'dishGroup' && (
        <SectionPanel title={`Biến động giá theo nhóm món (có trọng số theo ${uiCopy.technical.bom.replace(/^Đ/, 'đ')})`} icon={<ClipboardList size={18} color="var(--ipc-slate-600)" />}>
          <TableViewport ariaLabel="Bảng biến động giá theo nhóm món">
            <table className="ipc-data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Nhóm món</th>
                  <th>Số nguyên liệu</th>
                  <th>Số NL vượt ngưỡng</th>
                  <th>% biến động (có trọng số)</th>
                  <th>Nguyên liệu ảnh hưởng nhiều nhất</th>
                </tr>
              </thead>
              <tbody>
                {priceVarianceByDishGroupRows.length === 0 ? (
                  <EmptyRow colSpan={5} isError={priceVarianceByDishGroupResult.isError} />
                ) : (
                  priceVarianceByDishGroupRows.map((row) => (
                    <tr key={row.dishGroup} className={row.warningIngredientCount > 0 ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                      <td>{row.dishGroup}</td>
                      <td className="ipc-numeric-cell">{row.ingredientCount}</td>
                      <td className="ipc-numeric-cell">{row.warningIngredientCount}</td>
                      <td className="ipc-numeric-cell">{formatPercent(row.weightedAvgVariancePercent)}</td>
                      <td className="text-left">
                        {row.topIngredients.map((ingredient) => `${ingredient.ingredientName} (${formatPercent(ingredient.variancePercent)})`).join(', ')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            page={priceVarianceByDishGroupResult.data?.pageNumber ?? dishGroupPage}
            pageSize={priceVarianceByDishGroupResult.data?.pageSize ?? priceAggregatePageSize}
            totalItems={priceVarianceByDishGroupResult.data?.totalCount ?? 0}
            itemLabel="nhóm món"
            isPending={priceVarianceByDishGroupResult.isFetching}
            pageSizeOptions={standardPageSizeOptions}
            onPageSizeChange={(nextSize) => setNumberedPageSize(setDishGroupPage, setPriceAggregatePageSize, nextSize)}
            onPageChange={(nextPage) => setNumberedPage(setDishGroupPage, nextPage)}
          />
        </SectionPanel>
      )}

      {priceSubView === 'lines' && (
        <SectionPanel title="Bảng biến động giá nguyên liệu" icon={<ClipboardList size={18} color="var(--ipc-slate-600)" />}>
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <label className="grid max-w-xl gap-1 text-xs font-semibold text-slate-600" htmlFor="price-variance-search">
              Tìm theo nguyên liệu, nhà cung cấp hoặc mã phiếu nhập
              <span className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="price-variance-search"
                  type="search"
                  value={priceSearch}
                  onChange={(event) => setPriceSearch(event.target.value)}
                  placeholder="Ví dụ: Bún, SUP-001, PN-20260729..."
                  className="h-9 bg-white pl-9"
                />
              </span>
            </label>
          </div>
          <TableViewport ariaLabel="Bảng biến động giá nguyên liệu" className="ipc-report-table-shell">
            <table className="ipc-data-table ipc-report-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Tên nguyên liệu</th>
                  <th>Phiếu nhập</th>
                  <th>Ngày nhập</th>
                  <th>Số lượng</th>
                  <th>ĐV</th>
                  <th>Giá tham chiếu</th>
                  <th>Giá nhập</th>
                  <th>Thay đổi</th>
                  <th>Đánh giá</th>
                  <th>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {priceVarianceRows.length === 0 ? (
                  <EmptyRow colSpan={10} isError={priceVarianceResult.isError} />
                ) : (
                  priceVarianceRows.map((item, index) => (
                    <tr key={`${item.id}-${pricePage}-${index}`} className={item.warning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                      <td className={item.warning ? 'ipc-report-material-cell is-warning' : 'ipc-report-material-cell'}>
                        <span className="ipc-report-material">
                          {item.warning ? <AlertTriangle size={14} className="text-[var(--ipc-danger)]" /> : <TrendingUp size={14} color="var(--ipc-slate-600)" />}
                          <span className="ipc-report-material-copy">
                            <span>{item.name}</span>
                            <span className="text-xs font-normal text-slate-400">{item.supplier}</span>
                          </span>
                        </span>
                      </td>
                      <td>{item.receiptCode}</td>
                      <td>{formatDateOnly(item.receiptDate)}</td>
                      <td className="ipc-numeric-cell">{formatQuantityWithUnit(item.quantity, item.unit)}</td>
                      <td>{formatUnit(item.unit)}</td>
                      <td className="ipc-numeric-cell">{formatCurrency(item.pricePrev)}</td>
                      <td className="ipc-numeric-cell font-bold">{formatCurrency(item.priceCurrent)}</td>
                      <td className={item.warning ? 'ipc-numeric-cell font-bold text-[var(--ipc-danger)]' : item.change > 0 ? 'ipc-numeric-cell font-bold text-[var(--ipc-warning)]' : 'ipc-numeric-cell text-slate-600'}>
                        <span className="inline-flex items-center gap-1 justify-end w-full">
                          {item.change > 0 && <span className="inline-block text-[10px] text-inherit">▲</span>}
                          {item.change > 0 ? `+${formatPercent(item.change)}` : '0%'}
                        </span>
                      </td>
                      <td className="ipc-badge-cell">
                        {item.warning ? (
                          <StatusBadge variant="danger" className="ipc-table-badge ipc-table-badge--status">Vượt ngưỡng</StatusBadge>
                        ) : item.change > 0 ? (
                          <StatusBadge variant="warning" className="ipc-table-badge ipc-table-badge--status">Theo dõi</StatusBadge>
                        ) : (
                          <StatusBadge variant="success" className="ipc-table-badge ipc-table-badge--status">Ổn định</StatusBadge>
                        )}
                      </td>
                      <td className="ipc-report-action-cell">
                        {item.warning ? 'Thu mua xử lí, duyệt nếu vẫn vượt ngưỡng' : 'Theo dõi kỳ kế'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            page={priceVarianceResult.data?.pageNumber ?? pricePage}
            pageSize={priceVarianceResult.data?.pageSize ?? pricePageSize}
            totalItems={priceVarianceResult.data?.totalCount ?? 0}
            itemLabel="dòng giá"
            isPending={priceVarianceResult.isFetching}
            pageSizeOptions={pricePageSizeOptions}
            onPageSizeChange={(nextSize) => setNumberedPageSize(setPricePage, setPricePageSize, nextSize)}
            onPageChange={(nextPage) => setNumberedPage(setPricePage, nextPage)}
          />
        </SectionPanel>
      )}

      {priceSubView === 'lines' && selectedWarning && (
        <div className="ipc-split-detail-strip ipc-report-warning-detail">
          <div className="ipc-split-detail-label mb-3">Tác động vận hành — {selectedWarning.name}</div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="ipc-report-warning-card min-w-[240px] flex-1 rounded-md border border-[var(--ipc-danger)] bg-[var(--ipc-danger-soft)] p-3 text-sm text-[var(--ipc-danger)]">
              <div className="font-bold text-[14px]">Vượt ngưỡng {formatPercent(selectedWarning.change)}</div>
              <div className="mt-1 leading-5">
                Giá tăng từ {formatCurrency(selectedWarning.pricePrev)} lên {formatCurrency(selectedWarning.priceCurrent)}/{formatUnit(selectedWarning.unit)}.
              </div>
            </div>
            <div className="ipc-report-warning-card rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 min-w-[240px] flex-1">
              <div className="font-bold text-slate-900 text-[14px]">Hành động đề xuất</div>
              <p className="mt-1 leading-5 text-slate-500">
                Thu mua kiểm tra nhà cung cấp thay thế, sau đó gửi quản lí duyệt nếu giá vẫn vượt ngưỡng.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="ipc-button ipc-button-warning ipc-button-bounded shadow-sm" to={ROUTES.PURCHASING}>Mở thu mua</Link>
                <Link className="ipc-button ipc-button-ghost ipc-button-bounded shadow-sm" to={ROUTES.APPROVALS}>Mở duyệt vận hành</Link>
              </div>
            </div>
          </div>
        </div>
      )}
      </ReportQueryBoundary>
      </div>
    </div>
  );
}
