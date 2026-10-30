import { useEffect, useMemo, useState } from 'react';
import { Search, AlertTriangle, CheckCircle2, Utensils, RefreshCw, Upload } from 'lucide-react';
import { StateBoundary } from '../../../components/workbench/StateBoundary';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { DishBomEditorModal } from '../DishBomEditorModal';
import { DishBomBatchImportModal } from '../DishBomBatchImportModal';
import { bomApi, type BomCoverageDish, type BomCoverageReport } from '../../../api/bomApi';

export function AdminBomBranch() {
  const [report, setReport] = useState<BomCoverageReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MISSING' | 'COMPLETE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDish, setEditingDish] = useState<{ dishId: string; dishCode: string; dishName: string } | null>(null);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await bomApi.getBomCoverage();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể tải báo cáo độ phủ BOM.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const dishes = useMemo(() => report?.dishes || [], [report]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      if (statusFilter === 'MISSING' && dish.hasBom) return false;
      if (statusFilter === 'COMPLETE' && !dish.hasBom) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          dish.dishName.toLowerCase().includes(q) ||
          dish.dishCode.toLowerCase().includes(q) ||
          (dish.dishType && dish.dishType.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [dishes, statusFilter, searchQuery]);

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
      width: '32%',
      minWidth: '220px',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.dishName}</span>,
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
      width: '10%',
      minWidth: '100px',
      align: 'center',
      cell: (row) => (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setEditingDish({ dishId: row.dishId, dishCode: row.dishCode, dishName: row.dishName })}
          className="h-7 text-xs font-medium"
        >
          Chỉnh sửa BOM
        </Button>
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
      <div className="h-11 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-500">Độ phủ định mức BOM:</span>
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Utensils size={14} className="text-slate-500" aria-hidden="true" />
            <strong className="font-mono">{totalCount}</strong> món ăn
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 size={13} aria-hidden="true" />
            <strong className="font-mono">{completeCount}</strong> món hoàn tất
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-amber-700 flex items-center gap-1">
            <AlertTriangle size={13} aria-hidden="true" />
            <strong className="font-mono">{missingCount}</strong> món thiếu BOM
          </span>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Tổng cộng <strong>{totalBomLines}</strong> dòng định mức đang áp dụng
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2" role="toolbar" aria-label="Lọc theo trạng thái BOM">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả ({totalCount})
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
            <span>Món thiếu BOM ({missingCount})</span>
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
            <span>Đã đủ định mức ({completeCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
            <Input
              aria-label="Tìm kiếm món ăn"
              placeholder="Tìm theo tên, mã món..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs font-medium"
            />
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsBatchImportOpen(true)}
            className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
          >
            <Upload size={13} aria-hidden="true" />
            <span>Nhập BOM Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="h-8 px-2.5 text-xs flex items-center gap-1"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Main DataGrid */}
      <div className="flex-1 min-h-0 flex flex-col">
        <StateBoundary
          isLoading={isLoading}
          error={error}
          onRetry={() => void loadData()}
          isEmpty={!isLoading && !error && filteredDishes.length === 0}
          emptyScenario={searchQuery.trim() || statusFilter !== 'ALL' ? 'filter-empty' : 'true-empty'}
          onResetFilters={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
          actionLabel={searchQuery.trim() || statusFilter !== 'ALL' ? 'Xóa bộ lọc (Xem tất cả)' : undefined}
          onAction={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
          emptyTitle={statusFilter === 'MISSING' ? 'Đã hoàn tất định mức BOM' : 'Không tìm thấy món ăn'}
          emptyDescription={statusFilter === 'MISSING' ? 'Tuyệt vời! Toàn bộ món ăn trong catalog đều đã có định mức BOM đầy đủ.' : 'Không tìm thấy món ăn nào phù hợp với từ khóa hoặc bộ lọc.'}
          contextDomain="catalog"
        >
          <DataGrid
            data={filteredDishes}
            columns={columns}
            keyExtractor={(row) => row.dishId}
            minWidth="min-w-[800px]"
          />
        </StateBoundary>
      </div>

      {/* BOM Editor Modal */}
      <DishBomEditorModal
        isOpen={Boolean(editingDish)}
        onClose={() => setEditingDish(null)}
        dish={editingDish}
        onSaved={() => void loadData()}
      />

      <DishBomBatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        onImportSuccess={() => void loadData()}
      />
    </div>
  );
}
