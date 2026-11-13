import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import type { MrxSourceDelta } from '../../../api/mrxApi';

export interface MrxDeltaTableBranchProps {
  items: readonly MrxSourceDelta[];
  columns: ColumnDef<MrxSourceDelta>[];
}

export function MrxDeltaTableBranch({ items, columns }: MrxDeltaTableBranchProps) {
  return (
    <DataGrid
      data={items}
      columns={columns}
      minWidth="min-w-[1440px]"
      keyExtractor={(delta) => delta.sourceDeltaId}
      emptyMessage="Không tìm thấy thay đổi phù hợp."
    />
  );
}
