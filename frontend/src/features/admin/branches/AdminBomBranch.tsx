import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUrlWorkbenchState } from '../../../hooks/useUrlWorkbenchState';
import { PaginationBar } from '../../../components/workbench/PaginationBar';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';
import { AlertTriangle, CheckCircle2, Utensils, RefreshCw, Upload } from 'lucide-react';
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

const CATALOG_WRITE_ROLES = ['Admin', 'ADMIN', 'Manager', 'MANAGER', 'Quản lý'];

export function AdminBomBranch() {
  const { q: searchQuery, setQ: setSearchQuery, page, pageSize, setPage, setPageSize, filters, setFilter } = useUrlWorkbenchState();
  const { tiers, isLoading: tiersLoading, error: tiersError, retry: retryTiers } = useSupportedPriceTiers();
  const selectedTier = filters.bomPriceTier ? Number(filters.bomPriceTier) : undefined;
  const tierValid = selectedTier === undefined || tiers.includes(selectedTier);
  const tierSuffix = selectedTier === undefined ? '' : `:${selectedTier}`;
  const { hasRole } = useAuth();
  const canManage = hasRole(CATALOG_WRITE_ROLES);
  const coverageQuery = useWorkbenchQuery<BomCoverageReport>({
    scopeKey: `admin_bom_coverage${tierSuffix}`,
    cacheKey: `admin_data_bom_coverage${tierSuffix}`,
    enabled: selectedTier === undefined || (!tiersLoading && !tiersError && tierValid),
    queryFn: (_, signal) => bomApi.getBomCoverage(selectedTier, signal),
  });
  const report = coverageQuery.stateProps.isPreviousData || !tierValid ||
    (coverageQuery.data?.priceTier ?? undefined) !== selectedTier ? null : coverageQuery.data;
  const { isLoading: queryLoading, error, isFetching } = coverageQuery.stateProps;
  const isLoading = queryLoading || (isFetching && !report) || (Boolean(selectedTier) && tiersLoading);
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

  const loadData = () => coverageQuery.refetch(true);
  const afterSaved = () => {
    serverStateCache.deletePrefix('admin_data_bom_coverage');
    serverStateCache.deletePrefix('snapshot:admin_bom_coverage');
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

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {/* Zone 2: Telemetry Subbar with 4 KPI items */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Độ phủ định mức BOM:</span>
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

      {tiersError && <InlineBanner variant="error" actionLabel="Tải lại mốc giá" onAction={() => void retryTiers()}>{tiersError.message}</InlineBanner>}
      {!tiersLoading && !tiersError && !tierValid && <InlineBanner variant="error">Mốc giá BOM không hợp lệ. Vui lòng chọn lại mốc giá.</InlineBanner>}
      <LocalFindBar label="Tìm kiếm món ăn" value={searchQuery} onChange={setSearchQuery}
        matched={report ? filteredDishes.length : undefined} total={report ? dishes.length : undefined}
        clearLabel="Xóa tìm kiếm BOM" scope="Trong báo cáo BOM đã tải; không đổi phạm vi nhập BOM."
        searchTrailing={
          <div className="w-44 shrink-0">
            <Select id="bom-overview-tier" aria-label="Lọc mốc giá BOM" className="text-xs"
              value={selectedTier ?? ''} disabled={tiersLoading || Boolean(tiersError)}
              onChange={event => setFilter('bomPriceTier', event.target.value)}
              options={[{ value: '', label: 'Tất cả mốc giá' }, ...tiers.map(tier => ({ value: String(tier), label: `${tier.toLocaleString('vi-VN')} ₫` }))]} />
          </div>
        }>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Lọc theo trạng thái BOM">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả ({report ? totalCount : '—'})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('MISSING')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'MISSING'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle size={12} aria-hidden="true" />
            <span>Món thiếu BOM ({report ? missingCount : '—'})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETE')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'COMPLETE'
                ? 'bg-emerald-700 text-white font-bold'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 size={12} aria-hidden="true" />
            <span>Đã đủ định mức ({report ? completeCount : '—'})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionGuard capabilityId="CAT.BOM.IMPORT" roles={CATALOG_WRITE_ROLES}>
          <Button
            variant="default"
            size="sm"
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
        </div>
      </LocalFindBar>

      {/* Main DataGrid */}
      <div className="flex-1 min-h-0 flex flex-col">
        <StateBoundary
          isLoading={isLoading}
          isFetching={isFetching}
          hasExistingData={Boolean(report)}
          error={error}
          onRetry={() => void loadData()}
          isEmpty={!isLoading && !error && filteredDishes.length === 0}
          emptyScenario={searchQuery.trim() || statusFilter !== 'ALL' ? 'filter-empty' : 'true-empty'}
          onResetFilters={clearFilters}
          actionLabel={searchQuery.trim() || statusFilter !== 'ALL' ? 'Xóa bộ lọc (Xem tất cả)' : undefined}
          onAction={clearFilters}
          emptyTitle={statusFilter === 'MISSING' ? 'Đã hoàn tất định mức BOM' : 'Không tìm thấy món ăn'}
          emptyDescription="Không có món phù hợp bộ lọc."
          contextDomain="catalog"
        >
          <DataGrid
            key={`${statusFilter}:${searchQuery}:${currentPage}:${pageSize}`}
            data={pageDishes}
            columns={columns}
            keyExtractor={(row) => row.dishId}
            minWidth="min-w-[900px]"
          />
        </StateBoundary>
      </div>

      <PaginationBar label="Phân trang định mức BOM" page={currentPage} pageSize={pageSize}
        totalCount={report ? filteredDishes.length : undefined} totalPages={report ? totalPages : undefined}
        hasPrev={currentPage > 1} hasNext={currentPage < totalPages} pending={isLoading || isFetching}
        onPageChange={setPage} onPageSizeChange={setPageSize} />

      {/* BOM Editor Modal */}
      <DishBomEditorModal
        key={`${editingDish?.dishId}-${Boolean(editingDish?.readOnly)}`}
        readOnly={editingDish?.readOnly || !canManage}
        initialPriceTier={selectedTier}
        isOpen={Boolean(editingDish)}
        onClose={() => setEditingDish(null)}
        dish={editingDish}
        onSaved={afterSaved}
      />

      <DishBomBatchImportModal
        isOpen={isBatchImportOpen && canManage}
        onClose={() => setIsBatchImportOpen(false)}
        onImportSuccess={afterSaved}
      />
    </div>
  );
}
