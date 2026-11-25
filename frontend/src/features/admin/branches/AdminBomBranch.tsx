import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUrlWorkbenchState } from '../../../hooks/useUrlWorkbenchState';
import { PaginationBar } from '../../../components/workbench/PaginationBar';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';
import { AlertTriangle, CheckCircle2, Download, Utensils, RefreshCw, Upload } from 'lucide-react';
import { StateBoundary } from '../../../components/workbench/StateBoundary';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { LocalFindBar } from '../../../components/workbench/LocalFindBar';
import { normalizeSearchText } from '../../../utils/search';
import { DishBomEditorModal } from '../../../components/workbench/DishBomEditorModal';
import { DishBomBatchImportModal } from '../../../components/workbench/DishBomBatchImportModal';
import { bomApi, type BomCoverageDish, type BomCoverageReport } from '../../../api/bomApi';
import { useSupportedPriceTiers } from '../../../hooks/useSupportedPriceTiers';
import { Select } from '../../../components/ui/select';
import { InlineBanner } from '../../../components/ui/inline-banner';
import { ActionGuard } from '../../../components/ui/action-guard';
import { useAuth } from '../../../store/useAuth';
import { serverStateCache } from '../../../store/serverStateCache';
import { invalidateMrxCaches } from '../../../api/mrxCacheInvalidation';
import { downloadAuthenticatedFile } from '../../../utils/fileDownload';
import { VietnameseDateInput } from '../../../components/ui/vietnamese-date-input';
import { isIsoDate, todayInBusinessTimezone } from '../../../utils/dates';

const CATALOG_WRITE_ROLES = ['Admin', 'ADMIN', 'Manager', 'MANAGER', 'Quản lý'];

export function AdminBomBranch() {
  const { q: searchQuery, setQ: setSearchQuery, page, pageSize, setPage, setPageSize, filters, setFilter } = useUrlWorkbenchState();
  const { tiers, isLoading: tiersLoading, error: tiersError, retry: retryTiers } = useSupportedPriceTiers();
  const selectedTier = filters.bomPriceTier ? Number(filters.bomPriceTier) : undefined;
  const tierValid = selectedTier === undefined || tiers.includes(selectedTier);
  const { hasRole, operationalMode } = useAuth();
  const mrxShared = operationalMode === 'MATERIAL_RECONCILIATION';
  const [inspectionDate, setInspectionDate] = useState(todayInBusinessTimezone);
  const [inspectionDateError, setInspectionDateError] = useState<string | null>(null);
  const inspectionDateReady = !mrxShared || (!inspectionDateError && isIsoDate(inspectionDate));
  const coverageScope = mrxShared ? `mrx:${inspectionDate}:${selectedTier ?? ''}` : `default:${selectedTier ?? ''}`;
  const tierLabel = selectedTier === undefined ? '' : ` · ${selectedTier.toLocaleString('vi-VN')} ₫`;
  const canManage = hasRole(CATALOG_WRITE_ROLES);
  const coverageQuery = useWorkbenchQuery<BomCoverageReport>({
    scopeKey: `admin_bom_coverage:${coverageScope}`,
    cacheKey: `admin_data_bom_coverage:${coverageScope}`,
    enabled: inspectionDateReady && (selectedTier === undefined || (!tiersLoading && !tiersError && tierValid)),
    queryFn: (_, signal) => bomApi.getBomCoverage(selectedTier, signal, mrxShared ? inspectionDate : undefined),
  });
  const { isLoading: queryLoading, error, isFetching } = coverageQuery.stateProps;
  const report = !inspectionDateReady || !tierValid
    || (error && (coverageQuery.stateProps.isPreviousData || (coverageQuery.data?.priceTier ?? undefined) !== selectedTier))
    ? null
    : coverageQuery.data;
  const isPreviousReport = Boolean(report && !error && (coverageQuery.stateProps.isPreviousData || (report.priceTier ?? undefined) !== selectedTier));
  const isBomBusy = mrxShared && (queryLoading || isFetching || isPreviousReport);
  const isLoading = !report && (queryLoading || isFetching || (Boolean(selectedTier) && tiersLoading));
  const statusFilter = filters.bomStatus === 'MISSING' || filters.bomStatus === 'COMPLETE' ? filters.bomStatus : 'ALL';
  const setStatusFilter = (value: 'ALL' | 'MISSING' | 'COMPLETE') => setFilter('bomStatus', value);
  const [, setSearchParams] = useSearchParams();
  const clearFilters = () => setSearchParams(current => {
    const next = new URLSearchParams(current);
    next.delete('q');
    next.delete('bomStatus');
    next.set('page', '1');
    return next;
  }, { replace: true });
  const [editingDish, setEditingDish] = useState<{ dishId: string; dishCode: string; dishName: string; readOnly?: boolean } | null>(null);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportAll = async () => {
    if (selectedTier === undefined || !tierValid || !inspectionDateReady || exportPending || isBomBusy || error) return;
    setExportPending(true);
    setExportError(null);
    try {
      await downloadAuthenticatedFile(bomApi.getBomTemplateUrl(selectedTier, undefined, 'all',
        { effectiveDate: inspectionDate, mrxShared: true }));
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'Không thể tải BOM. Vui lòng thử lại.');
    } finally {
      setExportPending(false);
    }
  };

  const loadData = () => coverageQuery.refetch(true);
  const afterSaved = () => {
    serverStateCache.deletePrefix('admin_data_bom_coverage');
    serverStateCache.deletePrefix('snapshot:admin_bom_coverage');
    invalidateMrxCaches();
    void loadData();
  };

  const dishes = useMemo(() => report?.dishes || [], [report]);

  const filteredDishes = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    return dishes.filter((dish) => {
      if (statusFilter === 'MISSING' && dish.hasBom) return false;
      if (statusFilter === 'COMPLETE' && !dish.hasBom) return false;
      if (q) {
        return [dish.dishName, dish.dishCode, dish.dishType].some(value => normalizeSearchText(value).includes(q));
      }
      return true;
    });
  }, [dishes, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredDishes.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const pageDishes = filteredDishes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns = useMemo<ColumnDef<BomCoverageDish>[]>(() => [
    {
      id: 'code',
      header: 'Mã món',
      width: '18%',
      minWidth: '130px',
      cell: (row) => <IdentifierText value={row.dishCode} />,
    },
    {
      id: 'name',
      header: 'Tên món ăn tiêu chuẩn',
      width: '26%',
      minWidth: '220px',
      cell: (row) => <Button variant="link" className="text-left text-sm font-semibold"
        onClick={() => setEditingDish({ dishId: row.dishId, dishCode: row.dishCode, dishName: row.dishName, readOnly: true })}>{row.dishName}</Button>,
    },
    {
      id: 'type',
      header: 'Phân loại',
      width: '15%',
      minWidth: '110px',
      cell: (row) => <span className="text-slate-600 text-xs">{row.dishType || '—'}</span>,
    },
    {
      id: 'lines',
      header: 'Số dòng BOM',
      width: '12%',
      minWidth: '95px',
      align: 'center',
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {row.bomLineCount} nguyên liệu
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái BOM',
      width: '13%',
      minWidth: '110px',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.hasBom ? 'success' : 'warning'} size="sm">
          {row.hasBom ? 'Đã có BOM' : 'Chưa có BOM'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      width: '16%',
      minWidth: '140px',
      align: 'center',
      cell: (row) => (
        <ActionGuard capabilityId="CAT.BOM.UPDATE" roles={CATALOG_WRITE_ROLES}>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setEditingDish({ dishId: row.dishId, dishCode: row.dishCode, dishName: row.dishName })}
          className="h-7 text-xs font-medium"
        >
          Chỉnh sửa BOM
        </Button>
        </ActionGuard>
      ),
    },
  ], []);

  const totalCount = report?.totalDishes ?? dishes.length;
  const completeCount = report?.completeDishes ?? dishes.filter((d) => d.hasBom).length;
  const missingCount = report?.missingBomDishes ?? dishes.filter((d) => !d.hasBom).length;
  const totalBomLines = report?.totalBomLines ?? dishes.reduce((sum, d) => sum + d.bomLineCount, 0);

  const scopeControls = (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <div className="w-44 max-w-full shrink-0">
        <Select id="bom-overview-tier" aria-label="Lọc mốc giá BOM" className="text-xs"
          value={selectedTier ?? ''} disabled={tiersLoading || Boolean(tiersError) || exportPending}
          onChange={event => setFilter('bomPriceTier', event.target.value)}
          options={[{ value: '', label: 'Tất cả mốc giá' }, ...tiers.map(tier => ({ value: String(tier), label: `${tier.toLocaleString('vi-VN')} ₫` }))]} />
      </div>
      {mrxShared && <div className="flex flex-wrap items-center gap-2 text-xs">
        <label htmlFor="bom-inspection-date">Ngày xét BOM</label>
        <VietnameseDateInput id="bom-inspection-date" value={inspectionDate} onChange={setInspectionDate}
          onValidationChange={setInspectionDateError} error={!inspectionDateReady} disabled={exportPending} required />
      </div>}
    </div>
  );
  const statusControls = (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Lọc theo trạng thái BOM">
      <button
        type="button"
        aria-pressed={statusFilter === 'ALL'}
        onClick={() => setStatusFilter('ALL')}
        className={`px-3 py-1 rounded border text-xs font-semibold transition-colors cursor-pointer ${
          statusFilter === 'ALL'
            ? 'bg-slate-900 border-slate-900 text-white'
            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
        }`}
      >
        Tất cả ({report ? totalCount : '—'})
      </button>
      <button
        type="button"
        aria-pressed={statusFilter === 'MISSING'}
        onClick={() => setStatusFilter('MISSING')}
        className={`px-3 py-1 rounded border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
          statusFilter === 'MISSING'
            ? 'bg-amber-600 border-amber-600 text-white'
            : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
        }`}
      >
        <AlertTriangle size={12} aria-hidden="true" />
        <span>Món thiếu BOM ({report ? missingCount : '—'})</span>
      </button>
      <button
        type="button"
        aria-pressed={statusFilter === 'COMPLETE'}
        onClick={() => setStatusFilter('COMPLETE')}
        className={`px-3 py-1 rounded border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
          statusFilter === 'COMPLETE'
            ? 'bg-emerald-700 border-emerald-700 text-white'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
        }`}
      >
        <CheckCircle2 size={12} aria-hidden="true" />
        <span>Đã đủ định mức ({report ? completeCount : '—'})</span>
      </button>
    </div>
  );
  const actions = (
    <div className={mrxShared ? "flex flex-wrap items-center gap-2 xl:ms-auto" : "flex flex-wrap items-center gap-2"}>
      {mrxShared && <Button
        variant="outline" size="sm"
        disabled={selectedTier === undefined || !tierValid || !inspectionDateReady || tiersLoading || Boolean(tiersError) || isBomBusy || Boolean(error) || exportPending}
        title={selectedTier === undefined ? 'Chọn mốc giá để xuất toàn bộ BOM' : undefined}
        onClick={() => void exportAll()}
      >
        <Download size={14} aria-hidden="true" />
        {exportPending ? 'Đang xuất…' : `Xuất toàn bộ BOM${tierLabel}`}
      </Button>}
      <ActionGuard capabilityId="CAT.BOM.IMPORT" roles={CATALOG_WRITE_ROLES}>
        <Button
          variant="default"
          size="sm"
          disabled={!inspectionDateReady || isBomBusy}
          onClick={() => setIsBatchImportOpen(true)}
          className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
        >
          <Upload size={13} aria-hidden="true" />
          <span>Nhập BOM Excel</span>
        </Button>
      </ActionGuard>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void loadData()}
        disabled={isLoading || isFetching}
        className="h-8 px-2.5 text-xs flex items-center gap-1"
      >
        <RefreshCw size={13} className={isLoading || isFetching ? 'animate-spin' : ''} aria-hidden="true" />
        <span>Làm mới</span>
      </Button>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {!mrxShared && (
        <div className="min-h-11 px-4 py-1.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">{isPreviousReport ? 'Kết quả trước:' : 'Độ phủ BOM:'}</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Utensils size={14} className="text-slate-500" aria-hidden="true" />
              <strong className="font-mono">{report ? totalCount : '—'}</strong> món ăn
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={13} aria-hidden="true" />
              <strong className="font-mono">{report ? completeCount : '—'}</strong> món hoàn tất
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-amber-700 flex items-center gap-1">
              <AlertTriangle size={13} aria-hidden="true" />
              <strong className="font-mono">{report ? missingCount : '—'}</strong> món thiếu BOM
            </span>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Tổng cộng <strong>{report ? totalBomLines : '—'}</strong> dòng định mức đang áp dụng
          </div>
        </div>
      )}

      {tiersError && <InlineBanner variant="error" actionLabel="Tải lại mốc giá" onAction={() => void retryTiers()}>{tiersError.message}</InlineBanner>}
      {exportError && <InlineBanner variant="error" onClose={() => setExportError(null)}>{exportError}</InlineBanner>}
      {!tiersLoading && !tiersError && !tierValid && <InlineBanner variant="error">Mốc giá BOM không hợp lệ. Vui lòng chọn lại mốc giá.</InlineBanner>}
      <LocalFindBar label="Tìm kiếm món ăn" value={searchQuery} onChange={setSearchQuery}
        matched={report ? filteredDishes.length : undefined} total={report ? dishes.length : undefined}
        clearLabel="Xóa tìm kiếm BOM" scope="Trong báo cáo BOM đã tải; không đổi phạm vi nhập BOM."
        searchTrailing={mrxShared ? undefined : scopeControls}>
        {mrxShared ? scopeControls : <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {statusControls}
          {actions}
        </div>}
      </LocalFindBar>
      {mrxShared && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
          {statusControls}
          <span className="text-xs text-slate-600">{isPreviousReport && 'Kết quả trước · '}{report ? totalBomLines : '—'} dòng BOM dùng chung có hiệu lực</span>
          {actions}
        </div>
      )}

      {/* Main DataGrid */}
      <div className="flex-1 min-h-0 flex flex-col">
        {inspectionDateReady && !(tiersError && !report) && <StateBoundary
          isLoading={isLoading}
          isFetching={isFetching}
          isPreviousData={isPreviousReport}
          hasExistingData={Boolean(report)}
          recoverableNoticePlacement={mrxShared ? 'bottom' : 'top'}
          error={error}
          onRetry={() => void loadData()}
          isEmpty={!isPreviousReport && !isLoading && !error && dishes.length === 0 && !searchQuery.trim() && statusFilter === 'ALL'}
          emptyScenario="true-empty"
          emptyTitle="Không tìm thấy món ăn"
          emptyDescription="Không có món phù hợp bộ lọc."
          contextDomain="catalog"
        >
          <DataGrid
            data={pageDishes}
            columns={columns}
            keyExtractor={(row) => row.dishId}
            minWidth="min-w-[900px]"
            emptyState={
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-slate-900">
                  {statusFilter === 'MISSING' ? 'Đã hoàn tất định mức BOM' : 'Không tìm thấy món ăn'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">Không có món phù hợp bộ lọc.</p>
                {(searchQuery.trim() || statusFilter !== 'ALL') && (
                  <div className="pt-1">
                    <Button type="button" variant="outline" size="xs" onClick={clearFilters}>
                      Xóa bộ lọc (Xem tất cả)
                    </Button>
                  </div>
                )}
              </div>
            }
          />
        </StateBoundary>}
      </div>

      <PaginationBar label="Phân trang định mức BOM" page={currentPage} pageSize={pageSize}
        totalCount={report ? filteredDishes.length : undefined} totalPages={report ? totalPages : undefined}
        hasPrev={currentPage > 1} hasNext={currentPage < totalPages} pending={isLoading || isFetching}
        onPageChange={setPage} onPageSizeChange={setPageSize} />

      {/* BOM Editor Modal */}
      <DishBomEditorModal
        key={`${operationalMode}:${editingDish?.dishId}-${Boolean(editingDish?.readOnly)}`}
        mrxShared={mrxShared}
        readOnly={editingDish?.readOnly || !canManage}
        initialPriceTier={selectedTier}
        isOpen={Boolean(editingDish)}
        onClose={() => setEditingDish(null)}
        dish={editingDish}
        onSaved={afterSaved}
      />

      <DishBomBatchImportModal
        key={`${operationalMode}:${selectedTier ?? ''}`}
        isOpen={isBatchImportOpen && canManage}
        mrxShared={mrxShared}
        initialPriceTier={mrxShared ? selectedTier : undefined}
        catalogInspectionDate={mrxShared ? inspectionDate : undefined}
        onClose={() => setIsBatchImportOpen(false)}
        onImportSuccess={afterSaved}
      />
    </div>
  );
}
