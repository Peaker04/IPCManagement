import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { VietnameseDateInput } from '../../../components/ui/vietnamese-date-input';
import { Button } from '../../../components/ui/button';

export interface MrxPrepHeaderBranchProps {
  activeDate: string;
  onSelectDate: (date: string) => void;
  hasData: boolean;
  canIssueBatchGroup: boolean;
  activeBatchesCount: number;
  issuing: boolean;
  onDownloadXlsx: () => void;
  onIssueBatchGroup: () => void;
}

export function MrxPrepHeaderBranch({
  activeDate,
  onSelectDate,
  hasData,
  canIssueBatchGroup,
  activeBatchesCount,
  issuing,
  onDownloadXlsx,
  onIssueBatchGroup,
}: MrxPrepHeaderBranchProps) {
  return (
    <WorkspaceHeader
      title="Chuẩn bị nguyên liệu phối hợp đa khách hàng"
      breadcrumb="Đối soát MRX · Trạm Kho nguyên liệu"
      contextSelectors={
        <VietnameseDateInput
          aria-label="Ngày chuẩn bị"
          value={activeDate}
          onChange={onSelectDate}
          className="h-9 w-40 font-mono text-sm"
        />
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasData}
            onClick={onDownloadXlsx}
          >
            Xuất Excel chuẩn bị
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!canIssueBatchGroup || issuing}
            onClick={onIssueBatchGroup}
          >
            {issuing ? 'Đang xuất…' : `Xác nhận xuất phối hợp (${activeBatchesCount} lô)`}
          </Button>
        </div>
      }
    />
  );
}
