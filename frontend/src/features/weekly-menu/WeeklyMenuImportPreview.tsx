import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { getMrxShiftLabel, MRX_SHIFT_OPTIONS } from '../../constants/mrxConstants';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { toVietnameseDate } from '../../utils/dates';
import type { WeeklyMenuImportResult } from '../../api/weeklyMenuApi';

type MenuRow = WeeklyMenuImportResult['rows'][number];
const columns: ColumnDef<MenuRow>[] = [
  { id: 'date', header: 'Ngày', cell: row => toVietnameseDate(row.serviceDate) },
  { id: 'shift', header: 'Ca', cell: row => MRX_SHIFT_OPTIONS.find(shift => shift.value === row.dbShiftName)?.label ?? 'Ca chưa nhận diện' },
  { id: 'variant', header: 'Mặn/Chay', cell: row => row.variant === 'savory' ? 'Mặn' : row.variant === 'vegetarian' ? 'Chay' : row.variant },
  { id: 'slot', header: 'Vị trí', cell: row => <span title={row.slotLabel}>{row.slotLabel}</span> },
  { id: 'dish', header: 'Món', cell: row => <span title={row.dishName}>{row.dishName}</span> },
  { id: 'source', header: 'Ô nguồn', cell: row => <span className="font-mono">{row.sourceColumn}{row.sourceRowNumber}</span> },
];

function PreviewSection({ rows, dates }: { rows: MenuRow[]; dates: string[] }) {
  const order = new Map<string, { sourceRow: number; label: string }>();
  const byDate = dates.map(date => {
    const occurrences = new Map<string, number>();
    return new Map(rows.filter(row => row.serviceDate === date).map(row => {
      const position = JSON.stringify([row.sourceRowNumber, row.slot]);
      const occurrence = occurrences.get(position) ?? 0;
      occurrences.set(position, occurrence + 1);
      const key = JSON.stringify([row.sourceRowNumber, row.slot, occurrence]);
      order.set(key, { sourceRow: row.sourceRowNumber, label: row.slotLabel });
      return [key, row] as const;
    }));
  });
  const keys = [...order.keys()].sort((left, right) => order.get(left)!.sourceRow - order.get(right)!.sourceRow);
  const covered = new Set<string>();
  const spanAt = (cells: Map<string, MenuRow>, index: number) => {
    const row = cells.get(keys[index]);
    if (!row) return 0;
    let span = 1;
    while (!row.isMergedContinuation && index + span < keys.length) {
      const next = cells.get(keys[index + span]);
      if (!next?.isMergedContinuation || next.sourceColumn !== row.sourceColumn || next.sourceRowNumber <= row.sourceRowNumber
        || next.sourceRowNumber >= row.sourceRowNumber + row.rowSpan || next.dishId !== row.dishId || next.dishName !== row.dishName) break;
      span += 1;
    }
    return span;
  };
  const first = rows[0];
  const variant = first.variant === 'savory' ? 'Mặn' : first.variant === 'vegetarian' ? 'Chay' : first.variant;
  return <tbody>
    <tr><th scope="rowgroup" colSpan={dates.length + 1} className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold">{getMrxShiftLabel(first.dbShiftName)} · {variant}</th></tr>
    {keys.map((key, rowIndex) => <tr key={key} className="h-10">
      <th scope="row" className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium">{order.get(key)!.label}</th>
      {byDate.map((cells, dateIndex) => {
        if (covered.has(`${dateIndex}:${rowIndex}`)) return null;
        const row = cells.get(key);
        if (!row) return <td key={dates[dateIndex]} className="border-b border-r border-slate-200 px-3 py-2 text-center text-slate-500">—</td>;
        const rowSpan = spanAt(cells, rowIndex);
        for (let offset = 1; offset < rowSpan; offset += 1) covered.add(`${dateIndex}:${rowIndex + offset}`);
        let colSpan = 1;
        while (row.dishId && dateIndex + colSpan < byDate.length) {
          const nextCells = byDate[dateIndex + colSpan];
          if (covered.has(`${dateIndex + colSpan}:${rowIndex}`) || spanAt(nextCells, rowIndex) !== rowSpan
            || !keys.slice(rowIndex, rowIndex + rowSpan).every(slot => {
              const current = cells.get(slot)!;
              const next = nextCells.get(slot);
              return Boolean(next && next.dishId === current.dishId && next.dishName === current.dishName && next.rowSpan === current.rowSpan && next.isMergedContinuation === current.isMergedContinuation);
            })) break;
          for (let offset = 0; offset < rowSpan; offset += 1) covered.add(`${dateIndex + colSpan}:${rowIndex + offset}`);
          colSpan += 1;
        }
        return <td key={dates[dateIndex]} rowSpan={rowSpan} colSpan={colSpan} className="border-b border-r border-slate-200 px-3 py-2 text-center align-middle"><span className="block break-words font-medium leading-5">{row.dishName}</span></td>;
      })}
    </tr>)}
  </tbody>;
}

export function WeeklyMenuImportPreview({ result, priceTierAmount }: { result: WeeklyMenuImportResult; priceTierAmount: number | null }) {
  const [page, setPage] = useState(1);
  const [showSource, setShowSource] = useState(false);
  const hasErrors = result.validation.hasCriticalErrors || !result.validation.isValid;
  const days = result.mrxDayOutcomes ?? [];
  const rows = [...result.rows].sort((left, right) => left.serviceDate.localeCompare(right.serviceDate)
    || left.dbShiftName.localeCompare(right.dbShiftName) || left.variant.localeCompare(right.variant) || left.sourceRowNumber - right.sourceRowNumber);
  const dates = [...new Set([...result.detectedLayout.dayColumns.map(column => column.serviceDate), ...rows.map(row => row.serviceDate)])].sort();
  const sections = new Map<string, MenuRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.dbShiftName, row.variant, row.sourceSection]);
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(row);
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));
  const activePage = Math.min(page, pageCount);
  return (
    <section className="rounded border border-slate-200 p-3 space-y-3 text-xs" aria-label="Kết quả phân tích file">
      <div className="flex items-center justify-between gap-2">
        <strong>Kết quả phân tích file</strong>
        <Badge variant={hasErrors ? 'danger' : 'success'} size="sm">{hasErrors ? 'Có lỗi cần sửa' : 'Hợp lệ để nhập'}</Badge>
      </div>
      <div role="status" className="space-y-1">
        <p>Khách hàng: <strong>{result.customerName}</strong> · Tuần {toVietnameseDate(result.weekStartDate ?? '')}</p>
        <p>Số dòng quét: {result.detectedLayout.rowsScanned} · Sheet: {result.detectedLayout.sheetName} · Mốc giá đã chọn: {priceTierAmount === null ? 'Chưa chọn' : <Num value={priceTierAmount} format="currency" />}</p>
      </div>
      <p className="text-slate-600">Đây là nội dung thực đơn, chưa xác nhận đủ BOM hoặc số suất Mặn/Chay. Bước kiểm tra định lượng sẽ xác nhận các điều kiện đó.</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Thực đơn tuần</h3>
        <Button variant="ghost" size="sm" aria-pressed={showSource} onClick={() => setShowSource(current => !current)}>{showSource ? 'Xem thực đơn' : 'Chi tiết nguồn'}</Button>
      </div>
      <div role="region" aria-label="Thực đơn xem trước" className="min-w-0">
        {showSource ? <>
          <DataGrid data={rows.slice((activePage - 1) * 50, activePage * 50)} columns={columns} keyExtractor={(row, index) => `${row.sourceColumn}-${row.sourceRowNumber}-${index}`} minWidth="min-w-200" emptyMessage="Không có dòng thực đơn để xem trước." />
          {pageCount > 1 && <PaginationBar label="Ô nguồn file Excel" page={activePage} pageSize={50} totalCount={rows.length} totalPages={pageCount} hasPrev={activePage > 1} hasNext={activePage < pageCount} onPageChange={setPage} placement="toolbar" />}
        </> : rows.length ? <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-240 table-fixed border-separate border-spacing-0 text-sm" aria-label="Thực đơn tuần xem trước">
            <thead className="sticky top-0 z-20 bg-slate-50"><tr>
              <th scope="col" className="sticky left-0 z-30 w-40 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs">Loại món</th>
              {dates.map(date => <th scope="col" key={date} className="min-w-32 border-b border-r border-slate-200 px-3 py-2 text-center text-xs">{toVietnameseDate(date)}</th>)}
            </tr></thead>
            {[...sections.entries()].map(([key, sectionRows]) => <PreviewSection key={key} rows={sectionRows} dates={dates} />)}
          </table>
        </div> : <p>Không có dòng thực đơn để xem trước.</p>}
      </div>
      {days.length > 0 && <table className="w-full text-left text-xs"><caption className="text-left font-semibold">Đối chiếu nguồn MRX</caption><tbody>{days.map(day => (
        <tr key={day.serviceDate} className="h-9 border-b border-slate-100"><td className="p-2">{toVietnameseDate(day.serviceDate)}</td><td className="p-2">{day.outcome === 'CHANGED' ? 'Thay đổi' : day.outcome === 'UNCHANGED' ? 'Không đổi' : day.outcome === 'LOCKED_IDENTICAL' ? 'Đã xuất kho – giống, bỏ qua' : day.outcome === 'LOCKED_CONFLICT' ? 'Đã xuất kho – khác, bị chặn' : day.outcome}</td></tr>
      ))}</tbody></table>}
      {days.some(day => day.outcome === 'LOCKED_CONFLICT') && <p role="alert">Không thể lưu vì file thay đổi ngày đã xuất kho.</p>}
      {(result.validation.issues.length > 0 || result.warnings.length > 0) && <ul className="list-disc pl-4 space-y-1">
        {result.validation.issues.map((issue, index) => <li key={`issue-${index}`}>{issue.message}{issue.sheetName ? ` · ${issue.sheetName}` : ''}{issue.cell ? ` · ${issue.cell}` : ''}</li>)}
        {result.warnings.map((warning, index) => <li key={`warning-${index}`}>{warning}</li>)}
      </ul>}
    </section>
  );
}
