import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import type { MrxSourceDelta } from '../../../api/mrxApi';

export interface MrxDeltaTableBranchProps {
  items: readonly MrxSourceDelta[];
  columns: ColumnDef<MrxSourceDelta>[];
}

export function MrxDeltaTableBranch({ items, columns }: MrxDeltaTableBranchProps) {
  return <DataGrid data={items} columns={columns} keyExtractor={(delta) => delta.sourceDeltaId} />;
}
