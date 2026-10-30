import { Checkbox } from '../../../components/ui/checkbox';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../../utils/dates';
import type { MrxPreparation } from '../../../api/mrxApi';

export interface MrxPrepAllocationsBranchProps {
  data: MrxPreparation | null;
  activeDate: string;
  activeSelectedBatchIds: string[];
  onToggleBatch: (batchId: string) => void;
  supplierFilter: string;
  onSupplierFilterChange: (val: string) => void;
  filteredAggregatedLines: any[];
  columns: ColumnDef<any>[];
  successGroupId: string | null;
  onClearSuccessGroup: () => void;
  onNavigateDaily: () => void;
}

export function MrxPrepAllocationsBranch({
  data,
  activeDate,
  activeSelectedBatchIds,
  onToggleBatch,
  supplierFilter,
  onSupplierFilterChange,
  filteredAggregatedLines,
  columns,
  successGroupId,
  onClearSuccessGroup,
  onNavigateDaily,
}: MrxPrepAllocationsBranchProps) {
  return (
    <div className="flex-1 min-h-0 overflow-auto flex flex-col">
      {successGroupId && (
        <div role="status" className="px-4 py-2.5 text-sm bg-emerald-50 text-emerald-800 border-b border-emerald-200 flex items-center justify-between">
          <span>Đã xuất kho phối hợp thành công. Mã nhóm chuẩn bị: <strong className="font-mono">{successGroupId}</strong></span>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="default"
              onClick={onNavigateDaily}
            >
              Xem phiếu xuất theo ngày →
            </Button>
            <Button size="xs" variant="outline" onClick={onClearSuccessGroup}>Đóng</Button>
          </div>
        </div>
      )}

      {/* Batches selector and supplier filter bar */}
      <section aria-label="Bộ lọc chuẩn bị nguyên liệu" className="p-3 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs shrink-0 space-y-2 sticky top-0 z-20">
        <div>
          <h2 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1.5">
            Các khách hàng có lịch ngày {toVietnameseDate(activeDate)}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data?.batches.map((b) => (
              <label
                key={b.batchId}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition-colors ${
                  activeSelectedBatchIds.includes(b.batchId)
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-medium'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Checkbox
                  checked={activeSelectedBatchIds.includes(b.batchId)}
                  onChange={() => onToggleBatch(b.batchId)}
                  disabled={!b.isApplicable || b.hasExistingIssue}
                />
                <span>{b.customerName ?? b.customerCode ?? b.customerId}</span>
                <Badge variant={b.hasExistingIssue ? 'success' : b.isApplicable ? 'neutral' : 'warning'} size="sm">
                  {b.hasExistingIssue ? 'Đã xuất' : b.isApplicable ? 'Chờ xuất' : 'Chưa chuyển kho'}
                </Badge>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
          <Input
            aria-label="Lọc theo tên nhà cung cấp"
            placeholder="Tìm theo nhà cung cấp hoặc nguyên liệu..."
            value={supplierFilter}
            onChange={(e) => onSupplierFilterChange(e.target.value)}
            className="h-8 text-xs max-w-sm"
          />
          {supplierFilter && (
            <Button size="xs" variant="ghost" onClick={() => onSupplierFilterChange('')}>
              Xóa lọc
            </Button>
          )}
        </div>
      </section>

      <div className="flex-1 min-h-0">
        <DataGrid
          data={filteredAggregatedLines}
          columns={columns}
          keyExtractor={(row) => row.ingredientId}
          emptyMessage="Không có nguyên liệu nào cần chuẩn bị cho ngày đã chọn."
        />
      </div>
    </div>
  );
}
