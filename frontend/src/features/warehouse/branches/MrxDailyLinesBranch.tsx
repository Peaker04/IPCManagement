import { useMemo, useState } from 'react';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';

export interface MrxDailyLinesBranchProps {
  isWeeklyAll: boolean;
  weeklyAggregateLines: Array<{
    id: string;
    ingredientCode: string;
    ingredientName: string;
    unitName: string;
    requiredQuantity: number;
    issuedQuantity: number;
    remainingQuantity: number;
  }>;
  lines: Array<{
    batchLineId: string;
    dailyLineId: string;
    ingredientId: string;
    ingredientCode?: string | null;
    ingredientName?: string | null;
    canonicalUnitId: string;
    canonicalUnitName?: string | null;
    requiredQuantity: number;
    issuedQuantity?: number | null;
    remainingQuantity?: number | null;
  }>;
  quantities: Record<string, string>;
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reasons: Record<string, string>;
  setReasons: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hasInitialIssue: boolean;
}

export function MrxDailyLinesBranch({
  isWeeklyAll,
  weeklyAggregateLines,
  lines,
  quantities,
  setQuantities,
  reasons,
  setReasons,
  hasInitialIssue,
}: MrxDailyLinesBranchProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLines = useMemo(() => {
    if (!searchTerm.trim()) return lines;
    const q = searchTerm.trim().toLowerCase();
    return lines.filter(
      (l) => l.ingredientName?.toLowerCase().includes(q) || l.ingredientCode?.toLowerCase().includes(q)
    );
  }, [lines, searchTerm]);

  const filteredWeeklyLines = useMemo(() => {
    if (!searchTerm.trim()) return weeklyAggregateLines;
    const q = searchTerm.trim().toLowerCase();
    return weeklyAggregateLines.filter(
      (l) => l.ingredientName?.toLowerCase().includes(q) || l.ingredientCode?.toLowerCase().includes(q)
    );
  }, [weeklyAggregateLines, searchTerm]);

  const weeklyColumns = useMemo<ColumnDef<typeof weeklyAggregateLines[number]>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu thực phẩm',
      width: '34%',
      minWidth: '220px',
      cell: (line) => (
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-slate-900 text-sm truncate">{line.ingredientName}</span>
          {line.ingredientCode && <IdentifierText value={line.ingredientCode} />}
        </div>
      ),
    },
    { id: 'unit', header: 'ĐVT', width: '10%', minWidth: '70px', align: 'center', cell: (line) => <span className="font-mono text-xs text-slate-700">{line.unitName}</span> },
    { id: 'required', header: 'Tổng nhu cầu tuần', width: '18%', minWidth: '120px', align: 'right', cell: (line) => <Num value={line.requiredQuantity} format="quantity" suffix={` ${line.unitName}`} className="font-bold text-slate-900 text-sm" /> },
    { id: 'issued', header: 'Tổng đã xuất thực tế', width: '18%', minWidth: '120px', align: 'right', cell: (line) => <Num value={line.issuedQuantity} format="quantity" suffix={` ${line.unitName}`} className="font-mono text-sm" /> },
    { id: 'remaining', header: 'Còn lại phải xuất', width: '20%', minWidth: '120px', align: 'right', cell: (line) => <Num value={line.remainingQuantity} format="quantity" suffix={` ${line.unitName}`} className={line.remainingQuantity > 0 ? 'text-amber-700 font-bold font-mono text-sm' : 'text-slate-600 font-mono text-sm'} /> },
  ], []);

  const columns = useMemo<ColumnDef<typeof lines[number]>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu thực phẩm',
      width: '30%',
      minWidth: '220px',
      cell: (line) => (
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-slate-900 text-sm truncate">{line.ingredientName}</span>
          {line.ingredientCode && <IdentifierText value={line.ingredientCode} />}
        </div>
      ),
    },
    {
      id: 'required',
      header: 'Nhu cầu ca',
      width: '16%',
      minWidth: '120px',
      align: 'right',
      cell: (line) => <Num value={line.requiredQuantity} format="quantity" suffix={line.canonicalUnitName ? ` ${line.canonicalUnitName}` : ''} />,
    },
    {
      id: 'issued',
      header: 'Thực xuất cửa kho',
      width: '20%',
      minWidth: '140px',
      cell: (line) => (
        <Input
          type="number"
          min="0.000001"
          step="any"
          aria-label={`Số lượng thực xuất ${line.ingredientName ?? line.ingredientCode ?? line.ingredientId}`}
          value={quantities[line.dailyLineId] ?? (line.issuedQuantity != null ? String(line.issuedQuantity) : '')}
          disabled={hasInitialIssue}
          onChange={(e) => setQuantities((current) => ({ ...current, [line.dailyLineId]: e.target.value }))}
          className="h-8 font-mono text-sm"
        />
      ),
    },
    {
      id: 'reason',
      header: 'Lý do chênh lệch (nếu vượt)',
      width: '20%',
      minWidth: '150px',
      cell: (line) => {
        const issued = Number(quantities[line.dailyLineId]);
        const isOver = issued > line.requiredQuantity;
        return (
          <Input
            aria-label={`Lý do chênh lệch ${line.ingredientName ?? line.ingredientCode ?? line.ingredientId}`}
            placeholder={isOver ? 'Bắt buộc nhập lý do xuất vượt...' : 'Ghi chú (nếu có)...'}
            value={reasons[line.dailyLineId] ?? ''}
            disabled={hasInitialIssue}
            onChange={(e) => setReasons((current) => ({ ...current, [line.dailyLineId]: e.target.value }))}
            className={`h-8 text-xs ${isOver && !reasons[line.dailyLineId]?.trim() ? 'border-amber-400 bg-amber-50/40' : ''}`}
          />
        );
      },
    },
    {
      id: 'status',
      header: 'Trạng thái nghiệp vụ',
      width: '14%',
      minWidth: '110px',
      align: 'center',
      cell: (line) => {
        if (hasInitialIssue) {
          const issued = line.issuedQuantity ?? 0, req = line.requiredQuantity;
          if (issued === req) return <Badge variant="success" size="sm">Đã xuất đủ</Badge>;
          return <Badge variant={issued < req ? 'warning' : 'info'} size="sm">{issued < req ? 'Đã xuất thiếu' : 'Đã xuất vượt'}</Badge>;
        }
        const val = quantities[line.dailyLineId];
        if (val === undefined || val === '') return <Badge variant="neutral" size="sm">Chưa nhập</Badge>;
        const numVal = Number(val), req = line.requiredQuantity;
        if (numVal === req) return <Badge variant="success" size="sm">Dự kiến xuất đủ</Badge>;
        return <Badge variant={numVal < req ? 'warning' : 'info'} size="sm">{numVal < req ? 'Dự kiến xuất thiếu' : 'Dự kiến xuất vượt'}</Badge>;
      },
    },
  ], [hasInitialIssue, quantities, reasons, setQuantities, setReasons]);

  if (isWeeklyAll) {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Input
              type="search"
              aria-label="Tìm kiếm nguyên liệu xuất kho"
              placeholder="Tìm tên, mã nguyên liệu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-xs w-60"
            />
            {searchTerm.trim() && (
              <span className="text-xs text-slate-500 font-mono">
                Khớp {filteredWeeklyLines.length}/{weeklyAggregateLines.length} mặt hàng
              </span>
            )}
          </div>
        </div>
        <DataGrid
          data={filteredWeeklyLines}
          columns={weeklyColumns}
          keyExtractor={(row) => row.id}
          emptyMessage={searchTerm.trim() ? "Không tìm thấy nguyên liệu nào khớp với từ khóa." : "Tuần đối soát này chưa có nguyên liệu nào được phân bổ."}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Input
            type="search"
            aria-label="Tìm kiếm nguyên liệu xuất kho"
            placeholder="Tìm tên, mã nguyên liệu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-xs w-60"
          />
          {searchTerm.trim() && (
            <span className="text-xs text-slate-500 font-mono">
              Khớp {filteredLines.length}/{lines.length} mặt hàng
            </span>
          )}
        </div>
      </div>
      <DataGrid
        data={filteredLines}
        columns={columns}
        keyExtractor={(line) => line.dailyLineId}
        emptyMessage={searchTerm.trim() ? "Không tìm thấy nguyên liệu nào khớp với từ khóa." : "Không có nguyên liệu nào cần xuất kho cho ngày đã chọn."}
      />
    </div>
  );
}
