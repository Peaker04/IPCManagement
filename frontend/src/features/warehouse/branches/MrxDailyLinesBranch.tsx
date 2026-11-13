import { useMemo, useState } from 'react';
import { MrxQuantityInput } from '../MrxQuantityInput';
import { LocalFindBar } from '../../../components/workbench/LocalFindBar';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { formatVietnameseDateTime } from '../../../utils/dates';
import { normalizeQuantity } from '../mrxQuantity';

import { normalizeSearchText as searchText } from '../../../utils/search';

export interface MrxDailyLinesBranchProps {
  isWeeklyAll: boolean;
  weeklyAggregateLines: Array<{
    id: string;
    ingredientCode: string;
    ingredientName: string;
    unitName: string;
    requiredQuantity: number;
    issuedQuantity: number | null;
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
    quantityStatus: string;
    issuedQuantity?: number | null;
    remainingQuantity?: number | null;
  }>;
  quantities: Record<string, string>;
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reasons: Record<string, string>;
  setReasons: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hasInitialIssue: boolean;
  readOnly?: boolean;
  lastRevisionAt?: string | null;
  lastRevisionByName?: string | null;
  lastRevisionByRole?: string | null;
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
  readOnly = false,
  lastRevisionAt,
  lastRevisionByName,
  lastRevisionByRole,
}: MrxDailyLinesBranchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const query = searchText(searchTerm);

  const filteredLines = useMemo(() => {
    if (!query) return lines;
    return lines.filter(
      (line) => searchText(line.ingredientName).includes(query) || searchText(line.ingredientCode).includes(query)
    );
  }, [lines, query]);

  const filteredWeeklyLines = useMemo(() => {
    if (!query) return weeklyAggregateLines;
    return weeklyAggregateLines.filter(
      (line) => searchText(line.ingredientName).includes(query) || searchText(line.ingredientCode).includes(query)
    );
  }, [weeklyAggregateLines, query]);

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
    { id: 'required', header: 'Tổng nhu cầu tuần', width: '18%', minWidth: '120px', align: 'right', cell: (line) => <Num value={line.requiredQuantity} format="plain" decimals={6} suffix={` ${line.unitName}`} className="font-bold text-slate-900 text-sm" /> },
    { id: 'issued', header: 'Tổng đã xuất thực tế', width: '18%', minWidth: '120px', align: 'right', cell: (line) => <Num value={line.issuedQuantity} format="plain" decimals={6} suffix={` ${line.unitName}`} className="font-mono text-sm" /> },
    { id: 'remaining', header: 'Còn lại phải xuất', width: '20%', minWidth: '120px', align: 'right', cell: (line) => <Num value={line.remainingQuantity} format="plain" decimals={6} suffix={` ${line.unitName}`} className={line.remainingQuantity > 0 ? 'text-amber-700 font-bold font-mono text-sm' : 'text-slate-600 font-mono text-sm'} /> },
  ], []);

  const columns = useMemo<ColumnDef<typeof lines[number]>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu thực phẩm',
      width: '30%',
      minWidth: '220px',
      cell: (line) => (
        <div className="flex items-center gap-2 truncate max-[1100px]:flex-col max-[1100px]:items-start max-[1100px]:gap-0">
          <span className="font-semibold text-slate-900 text-sm truncate max-[1100px]:leading-4" title={line.ingredientName ?? undefined}>{line.ingredientName}</span>
          {line.ingredientCode && <IdentifierText value={line.ingredientCode} className="max-[1100px]:py-0 max-[1100px]:leading-4" />}
        </div>
      ),
    },
    {
      id: 'required',
      header: 'Nhu cầu ca',
      width: '16%',
      minWidth: '120px',
      align: 'right',
      cell: (line) => <span className="inline-flex max-w-full flex-wrap items-baseline justify-end gap-x-1"><Num value={line.requiredQuantity} format="plain" decimals={6} />{' '}<span className="whitespace-normal break-words text-xs">{line.canonicalUnitName}</span></span>,
    },
    {
      id: 'issued',
      header: 'Thực xuất cửa kho',
      width: '20%',
      minWidth: '140px',
      align: 'right',
      cell: (line) => (
        <MrxQuantityInput
          label={`Số lượng thực xuất ${line.ingredientName ?? line.ingredientCode ?? line.ingredientId}`}
          value={quantities[line.dailyLineId] ?? (line.issuedQuantity != null ? String(line.issuedQuantity) : '')}
          disabled={hasInitialIssue || readOnly}
          onChange={(canonical) => setQuantities((current) => ({ ...current, [line.dailyLineId]: canonical }))}
        />
      ),
    },
    {
      id: 'reason',
      header: 'Lý do chênh lệch (nếu vượt)',
      width: '20%',
      minWidth: '150px',
      cell: (line) => {
        const issued = normalizeQuantity(Number(quantities[line.dailyLineId]));
        const isOver = issued > line.requiredQuantity;
        return (
          <Input
            aria-label={`Lý do chênh lệch ${line.ingredientName ?? line.ingredientCode ?? line.ingredientId}`}
            placeholder={isOver ? 'Bắt buộc nhập lý do xuất vượt...' : 'Ghi chú (nếu có)...'}
            value={reasons[line.dailyLineId] ?? ''}
            disabled={hasInitialIssue || readOnly}
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
        if (hasInitialIssue || readOnly) {
          if (line.quantityStatus === 'UNTOUCHED') return <Badge variant="neutral" size="sm">Chưa xuất</Badge>;
          if (line.quantityStatus === 'EXACT') return <Badge variant="success" size="sm">Đã xuất đủ</Badge>;
          if (line.quantityStatus === 'UNDER_ISSUED') return <Badge variant="warning" size="sm">Đã xuất thiếu</Badge>;
          if (line.quantityStatus === 'OVER_ISSUED') return <Badge variant="info" size="sm">Đã xuất vượt</Badge>;
          return <Badge variant="neutral" size="sm">Chưa xác định</Badge>;
        }
        const val = quantities[line.dailyLineId];
        if (val === undefined || val === '') return <Badge variant="neutral" size="sm">Chưa nhập</Badge>;
        const numVal = normalizeQuantity(Number(val)), req = line.requiredQuantity;
        if (numVal === req) return <Badge variant="success" size="sm">Dự kiến xuất đủ</Badge>;
        return <Badge variant={numVal < req ? 'warning' : 'info'} size="sm">{numVal < req ? 'Dự kiến xuất thiếu' : 'Dự kiến xuất vượt'}</Badge>;
      },
    },
  ], [hasInitialIssue, readOnly, quantities, reasons, setQuantities, setReasons]);

  const searchToolbar = (
    <LocalFindBar label="Tìm kiếm nguyên liệu xuất kho" value={searchTerm} onChange={setSearchTerm}
      matched={isWeeklyAll ? filteredWeeklyLines.length : filteredLines.length}
      total={isWeeklyAll ? weeklyAggregateLines.length : lines.length}
      clearLabel="Xóa tìm trong phiếu"
      scope={`${isWeeklyAll ? 'Tìm trong tổng hợp tuần' : 'Tìm trong phiếu ngày'}; không đổi phạm vi phiếu.`}>
      {!isWeeklyAll && lastRevisionAt && (
        <div role="status" className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-slate-700 bg-blue-50/70 border border-blue-200 px-2.5 py-1 rounded">
          <strong className="font-semibold text-slate-900">Định lượng đã được điều chỉnh</strong>
          <span className="text-slate-300">·</span>
          <span>
            Lúc {formatVietnameseDateTime(lastRevisionAt)}{lastRevisionByName ? ` bởi ${lastRevisionByName}${lastRevisionByRole ? ` (${lastRevisionByRole})` : ''}` : ''}.
          </span>
        </div>
      )}
    </LocalFindBar>
  );

  if (isWeeklyAll) {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        {searchToolbar}
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
      {searchToolbar}
      <DataGrid
        data={filteredLines}
        columns={columns}
        keyExtractor={(line) => line.dailyLineId}
        emptyMessage={searchTerm.trim() ? "Không tìm thấy nguyên liệu nào khớp với từ khóa." : "Không có nguyên liệu nào cần xuất kho cho ngày đã chọn."}
      />
    </div>
  );
}
