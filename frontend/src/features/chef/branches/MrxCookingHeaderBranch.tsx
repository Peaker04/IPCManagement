import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { MRX_SHIFT_OPTIONS } from '../../../constants/mrxConstants';
import type { MrxBatchSummary, MrxKitchenCooking } from '../../../api/mrxApi';

export interface MrxCookingHeaderBranchProps {
  batches: MrxBatchSummary[];
  batchId: string;
  onSelectBatch: (id: string) => void;
  selectedShift: 'ALL' | 'MORNING' | 'AFTERNOON';
  onSelectShift: (shift: 'ALL' | 'MORNING' | 'AFTERNOON') => void;
  data: MrxKitchenCooking | null;
  onDownloadCsv: () => void;
  onDownloadXlsx: () => void;
  onPrint: () => void;
}

export function MrxCookingHeaderBranch({
  batches,
  batchId,
  onSelectBatch,
  selectedShift,
  onSelectShift,
  data,
  onDownloadCsv,
  onDownloadXlsx,
  onPrint,
}: MrxCookingHeaderBranchProps) {
  const batchOptions = batches.map((b) => ({
    value: b.batchId,
    label: `${b.customerCode || b.customerName || 'Khách hàng'} · ${b.status} · ${b.batchId.slice(0, 8)}`,
  }));

  const hasData = Boolean(data && data.rows.length > 0);

  return (
    <WorkspaceHeader
      title="Phiếu nấu theo lô"
      breadcrumb="Đối soát MRX · Bếp trưởng"
      contextSelectors={
        <>
          <Select
            aria-label="Chọn lô đối soát nấu"
            options={batches.length === 0 ? [{ value: '', label: '(Chưa có lô đối soát)' }] : batchOptions}
            value={batchId}
            disabled={batches.length === 0}
            onChange={(e) => onSelectBatch(e.target.value)}
            className="h-9 w-72 font-medium text-sm"
          />
          <Select
            aria-label="Lọc theo ca nấu"
            value={selectedShift}
            disabled={!data || batches.length === 0}
            onChange={(e) => onSelectShift(e.target.value as 'ALL' | 'MORNING' | 'AFTERNOON')}
            options={MRX_SHIFT_OPTIONS}
            className="h-9 w-40 font-medium text-sm"
          />
          <WorkspaceHeader.BadgeSlot variant="status">
            {data ? (
              <Badge
                variant="neutral"
                size="default"
                className="h-8 px-2.5 text-xs font-mono flex items-center shrink-0 whitespace-nowrap animate-in fade-in duration-150"
              >
                Phiên bản: v{data.sourceVersion}
              </Badge>
            ) : null}
          </WorkspaceHeader.BadgeSlot>
        </>
      }
      actions={
        <WorkspaceHeader.Actions>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasData}
            onClick={onDownloadCsv}
          >
            Tải CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasData}
            onClick={onDownloadXlsx}
          >
            Tải Excel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!hasData}
            onClick={onPrint}
          >
            In phiếu nấu
          </Button>
        </WorkspaceHeader.Actions>
      }
    />
  );
}
