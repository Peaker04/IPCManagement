import { useEffect, useRef } from 'react';
import { AlertTriangle, ClipboardList, Search, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  KeepAliveTabPanel,
  PaginationBar,
  SectionPanel,
  StatusBadge,
  TableViewport,
} from '@/components/common';
import { ExceptionLane } from '@/components/common/ExceptionLane';
import { ROUTES } from '@/lib/routeConfig';
import { formatCurrency, formatDateOnly, formatPercent, formatQuantityWithUnit, formatUnit } from '@/lib/formatters';
import { uiCopy } from '@/lib/uiCopy';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const warningDetailRef = useRef<HTMLDivElement>(null);
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
    selectWarning,
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

  useEffect(() => {
    if (selectedWarning) warningDetailRef.current?.focus();
  }, [selectedWarning]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
        <label className="text-xs font-semibold text-slate-600" htmlFor="price-analysis-view">Góc nhìn phân tích</label>
        <Select value={priceSubView} onValueChange={(value) => {
          const nextSubView = value as PriceSubView;
          startViewTransition(() => {
            setRequestedPriceSubView(nextSubView);
            resetReportPages();
            updateSearchState({ subview: nextSubView, page: undefined, pageSize: undefined });
          });
        }}>
          <SelectTrigger id="price-analysis-view" className="h-8 w-full max-w-xs text-xs" aria-label="Góc nhìn phân tích biến động giá">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visiblePriceSubViewTabs.map((tab) => <SelectItem key={tab.id} value={tab.id}>{tab.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <KeepAliveTabPanel id="price-sub-lines" active={priceSubView === 'lines'} className="flex flex-col gap-4">
        {priceSubView === 'lines' && (
          <ExceptionLane
            title="Hàng đợi cảnh báo giá"
            items={activePriceView.phase === 'ready' ? warningQueue : []}
            empty={activePriceView.phase === 'loading'
              ? 'Đang tải cảnh báo giá…'
              : activePriceView.phase === 'error' || activePriceView.phase === 'forbidden'
                ? 'Chưa thể tải hàng đợi cảnh báo giá.'
                : 'Không có nguyên liệu vượt ngưỡng trong kỳ này.'}
            className="h-[145px] overflow-y-auto"
            scrollLabel="Hàng đợi cảnh báo giá có thể cuộn"
          />
        )}

        <ReportQueryBoundary view={activePriceView}>
          <SectionPanel
            title="Bảng biến động giá nguyên liệu"
            icon={<ClipboardList size={18} color="var(--ipc-slate-600)" />}
            description="Theo dõi sự thay đổi giữa giá nhập thực tế và giá tham chiếu của từng nguyên liệu."
            actions={
              <div className="relative w-64 max-w-full">
                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="price-variance-search"
                  type="search"
                  value={priceSearch}
                  onChange={(event) => setPriceSearch(event.target.value)}
                  placeholder="Tìm nguyên liệu, NCC, mã phiếu..."
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-300 focus:bg-white"
                  aria-label="Tìm theo nguyên liệu, nhà cung cấp hoặc mã phiếu nhập"
                />
              </div>
            }
          >
            <TableViewport ariaLabel="Bảng biến động giá nguyên liệu" className="ipc-report-table-shell">
              <table className="ipc-erp-grid-table w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className="text-left">Tên nguyên liệu</th>
                    <th className="text-left">Nguồn nhập</th>
                    <th className="text-right">Số lượng</th>
                    <th className="text-right">Giá tham chiếu</th>
                    <th className="text-right">Giá nhập</th>
                    <th className="text-right">Biến động</th>
                  </tr>
                </thead>
                <tbody>
                  {priceVarianceRows.length === 0 ? (
                    <EmptyRow colSpan={6} isError={priceVarianceResult.isError} />
                  ) : (
                    priceVarianceRows.map((item, index) => (
                      <tr key={`${item.id}-${pricePage}-${index}`}>
                        <td className="text-left">
                          <span className="flex items-center gap-2">
                            {item.warning ? <AlertTriangle size={14} className="text-red-600 shrink-0" /> : <TrendingUp size={14} className="text-slate-500 shrink-0" />}
                            <span>
                              <span className="block font-medium text-slate-900">{item.name}</span>
                              <span className="block text-xs text-slate-500">{item.supplier}</span>
                            </span>
                          </span>
                        </td>
                        <td className="text-left">
                          <div className="font-medium text-slate-800">{item.receiptCode}</div>
                          <div className="text-xs text-slate-500">{formatDateOnly(item.receiptDate)}</div>
                        </td>
                        <td className="text-right tabular-nums">{formatQuantityWithUnit(item.quantity, item.unit)}</td>
                        <td className="text-right tabular-nums text-slate-600">{formatCurrency(item.pricePrev)}</td>
                        <td className="text-right tabular-nums font-semibold text-slate-900">{formatCurrency(item.priceCurrent)}</td>
                        <td className="text-right">
                          <span className={item.warning ? 'inline-flex w-full items-center justify-end gap-1 font-bold text-red-600 tabular-nums' : item.change > 0 ? 'inline-flex w-full items-center justify-end gap-1 font-bold text-amber-600 tabular-nums' : 'inline-flex w-full items-center justify-end gap-1 text-slate-600 tabular-nums'}>
                            {item.change > 0 && <span className="inline-block text-xs text-inherit">▲</span>}
                            {item.change > 0 ? `+${formatPercent(item.change)}` : '0%'}
                          </span>
                          <div className="mt-1 flex items-center justify-end gap-2">
                            {item.warning ? (
                              <StatusBadge variant="danger" size="sm">Vượt ngưỡng</StatusBadge>
                            ) : item.change > 0 ? (
                              <StatusBadge variant="warning" size="sm">Theo dõi</StatusBadge>
                            ) : (
                              <StatusBadge variant="success" size="sm">Ổn định</StatusBadge>
                            )}
                            {item.warning && (
                            <button
                              type="button"
                              className="whitespace-nowrap text-xs font-semibold text-red-600 underline underline-offset-2"
                              style={{ overflowWrap: 'normal' }}
                              aria-controls="reports-price-warning-detail"
                              aria-expanded={selectedWarning?.id === item.id}
                              aria-label={`Xem đề xuất xử lý cho ${item.name}`}
                              onClick={() => selectWarning(selectedWarning?.id === item.id ? null : item.id)}
                            >
                              Xem đề xuất
                            </button>
                            )}
                          </div>
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

          {selectedWarning && (
            <div ref={warningDetailRef} id="reports-price-warning-detail" role="region" aria-label={`Đề xuất xử lý cho ${selectedWarning.name}`} tabIndex={-1} className="ipc-split-detail-strip ipc-report-warning-detail">
              <div className="ipc-split-detail-label mb-3">Tác động vận hành — {selectedWarning.name}</div>
              <div className="flex flex-wrap items-start gap-4">
                <div className="ipc-report-warning-card min-w-[240px] flex-1 rounded-md border border-[var(--ipc-danger)] bg-[var(--ipc-danger-soft)] p-3 text-sm text-[var(--ipc-danger)]">
                  <div className="text-body font-bold">Vượt ngưỡng {formatPercent(selectedWarning.change)}</div>
                  <div className="mt-1 leading-5">
                    Giá tăng từ {formatCurrency(selectedWarning.pricePrev)} lên {formatCurrency(selectedWarning.priceCurrent)}/{formatUnit(selectedWarning.unit)}.
                  </div>
                </div>
                <div className="ipc-report-warning-card rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 min-w-[240px] flex-1">
                  <div className="text-body font-bold text-slate-900">Hành động đề xuất</div>
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
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="price-sub-supplier" active={priceSubView === 'supplier'}>
        <ReportQueryBoundary view={activePriceView}>
          <SectionPanel
            title="Biến động giá theo nhà cung cấp"
            icon={<ClipboardList size={18} color="var(--ipc-slate-600)" />}
            description="So sánh đơn giá nhập giữa các nhà cung cấp khác nhau cho cùng một loại nguyên liệu."
          >
            <TableViewport ariaLabel="Bảng biến động giá theo nhà cung cấp">
              <table className="ipc-erp-grid-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className="text-left">Nguyên liệu / Nhà cung cấp</th>
                    <th className="text-right">Số lần nhập</th>
                    <th className="text-right">Giá TB</th>
                    <th className="text-right">Khoảng giá</th>
                    <th className="text-right">Giá tham chiếu</th>
                    <th className="text-right">Biến động</th>
                  </tr>
                </thead>
                <tbody>
                  {priceVarianceBySupplierRows.length === 0 ? (
                    <EmptyRow colSpan={6} isError={priceVarianceBySupplierResult.isError} />
                  ) : (
                    priceVarianceBySupplierRows.map((row) => (
                      <tr key={`${row.ingredientId}-${row.supplierId}`}>
                        <td className="text-left"><div className="font-medium text-slate-900">{row.ingredientName}</div><div className="text-xs text-slate-500">{row.supplierName}</div></td>
                        <td className="text-right tabular-nums">{row.receiptCount}</td>
                        <td className="text-right tabular-nums font-semibold">{formatCurrency(row.avgUnitPrice)}</td>
                        <td className="text-right tabular-nums"><div>{formatCurrency(row.minUnitPrice)}</div><div className="text-xs text-slate-500">đến {formatCurrency(row.maxUnitPrice)}</div></td>
                        <td className="text-right tabular-nums text-slate-600">{formatCurrency(row.referencePrice)}</td>
                        <td className="text-right"><div className="tabular-nums font-semibold">{formatPercent(row.variancePercent)}</div><div className="mt-1 flex justify-end">
                          {row.isWarning ? (
                            <StatusBadge variant="danger" size="sm">Vượt ngưỡng</StatusBadge>
                          ) : (
                            <StatusBadge variant="success" size="sm">Ổn định</StatusBadge>
                          )}
                        </div></td>
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
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="price-sub-period" active={priceSubView === 'period'}>
        <ReportQueryBoundary view={activePriceView}>
          <SectionPanel
            title="Biến động giá theo thời gian (theo tháng)"
            icon={<ClipboardList size={18} color="var(--ipc-slate-600)" />}
            description="Báo cáo xu hướng biến động giá nguyên liệu qua các tháng phục vụ."
          >
            <TableViewport ariaLabel="Bảng biến động giá theo thời gian">
              <table className="ipc-erp-grid-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className="text-left">Nguyên liệu</th>
                    <th className="text-center">Tháng</th>
                    <th className="text-right">Giá TB</th>
                    <th className="text-right">% so với tham chiếu</th>
                    <th className="text-right">% so với tháng trước</th>
                    <th className="text-center">Đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  {priceVarianceByPeriodRows.length === 0 ? (
                    <EmptyRow colSpan={6} isError={priceVarianceByPeriodResult.isError} />
                  ) : (
                    priceVarianceByPeriodRows.map((row) => (
                      <tr key={`${row.ingredientId}-${row.periodLabel}`}>
                        <td className="text-left font-medium text-slate-900">{row.ingredientName}</td>
                        <td className="text-center text-slate-700">{row.periodLabel}</td>
                        <td className="text-right tabular-nums font-semibold">{formatCurrency(row.avgUnitPrice)}</td>
                        <td className="text-right tabular-nums">{formatPercent(row.variancePercentVsReference)}</td>
                        <td className="text-right tabular-nums">
                          {row.variancePercentVsPreviousPeriod == null ? '—' : formatPercent(row.variancePercentVsPreviousPeriod)}
                        </td>
                        <td className="text-center">
                          {row.isWarning ? (
                            <StatusBadge variant="danger" size="sm">Vượt ngưỡng</StatusBadge>
                          ) : (
                            <StatusBadge variant="success" size="sm">Ổn định</StatusBadge>
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
        </ReportQueryBoundary>
      </KeepAliveTabPanel>

      <KeepAliveTabPanel id="price-sub-dishGroup" active={priceSubView === 'dishGroup'}>
        <ReportQueryBoundary view={activePriceView}>
          <SectionPanel title={`Biến động giá theo nhóm món (có trọng số theo ${uiCopy.technical.bom.replace(/^Đ/, 'đ')})`} icon={<ClipboardList size={18} color="var(--ipc-slate-600)" />}>
            <TableViewport ariaLabel="Bảng biến động giá theo nhóm món">
              <table className="ipc-erp-grid-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className="text-left">Nhóm món</th>
                    <th className="text-right">Số nguyên liệu</th>
                    <th className="text-right">Số NL vượt ngưỡng</th>
                    <th className="text-right">% biến động (có trọng số)</th>
                    <th className="text-left">Nguyên liệu ảnh hưởng nhiều nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {priceVarianceByDishGroupRows.length === 0 ? (
                    <EmptyRow colSpan={5} isError={priceVarianceByDishGroupResult.isError} />
                  ) : (
                    priceVarianceByDishGroupRows.map((row) => (
                      <tr key={row.dishGroup}>
                        <td className="text-left font-medium text-slate-900">{row.dishGroup}</td>
                        <td className="text-right tabular-nums">{row.ingredientCount}</td>
                        <td className="text-right tabular-nums text-red-600 font-semibold">{row.warningIngredientCount}</td>
                        <td className="text-right tabular-nums font-semibold">{formatPercent(row.weightedAvgVariancePercent)}</td>
                        <td className="text-left text-slate-700">
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
        </ReportQueryBoundary>
      </KeepAliveTabPanel>
    </div>
  );
}
