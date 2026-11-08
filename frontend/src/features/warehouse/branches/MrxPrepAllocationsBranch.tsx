import { useMemo, useState } from 'react';
import { LocalFindBar } from '../../../components/workbench/LocalFindBar';
import { StateBoundary, type StateBoundaryProps } from '../../../components/workbench/StateBoundary';
import { normalizeSearchText } from '../../../utils/search';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import type { MrxPreparation } from '../../../api/mrxApi';

type PreparationLine = MrxPreparation['aggregatedLines'][number];
export type MrxFilteredPreparationLine = PreparationLine & { filteredRequired: number };

export interface MrxPrepAllocationsBranchProps {
  wholeWeek: boolean;
  stateBoundaryProps: Omit<StateBoundaryProps, 'children'>;
  data: MrxPreparation | null;
  activeSelectedBatchIds: string[];
  filteredAggregatedLines: MrxFilteredPreparationLine[];
  columns: ColumnDef<MrxFilteredPreparationLine>[];
}

export function MrxPrepAllocationsBranch({ wholeWeek, stateBoundaryProps, data, activeSelectedBatchIds, filteredAggregatedLines, columns }: MrxPrepAllocationsBranchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const query = normalizeSearchText(searchTerm);
  const visibleLines = useMemo(() => filteredAggregatedLines.filter(line =>
    [line.ingredientName, line.ingredientCode].some(value => normalizeSearchText(value).includes(query))
  ), [filteredAggregatedLines, query]);
  return <div className="flex-1 min-h-0 overflow-auto flex flex-col">
    <LocalFindBar label="Tìm nguyên liệu chuẩn bị" value={searchTerm} onChange={setSearchTerm}
      matched={data ? visibleLines.length : undefined} total={data ? filteredAggregatedLines.length : undefined}
      scope={`Bảng ${wholeWeek ? 'cả tuần' : 'ngày đã chọn'}; tìm kiếm không đổi Excel. Món ở trên, nguyên liệu theo NCC ở dưới trong cùng sheet.`} />
    <StateBoundary {...stateBoundaryProps}>
      <div className="flex-1 min-h-0">
        <DataGrid data={visibleLines} columns={columns} keyExtractor={row => `${row.ingredientId}:${row.canonicalUnitId}`}
          className="[&_tbody_td:first-child]:bg-white [&_tbody_tr:nth-child(even)>td:first-child]:bg-slate-50"
          emptyMessage={activeSelectedBatchIds.length === 0 ? 'Chọn ít nhất một lô để xem nguyên liệu cần chuẩn bị.' : query ? 'Không tìm thấy nguyên liệu trong các lô đã chọn.' : 'Không có nguyên liệu nào cần chuẩn bị cho các lô đã chọn.'} />
      </div>
    </StateBoundary>
  </div>;
}
