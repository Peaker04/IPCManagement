import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mrxApi, type MrxSourceDelta } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { InlineBanner } from '../../components/ui/inline-banner';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { type ColumnDef } from '../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../utils/dates';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { MrxDeltaHeaderBranch } from './branches/MrxDeltaHeaderBranch';
import { MrxDeltaTableBranch } from './branches/MrxDeltaTableBranch';

export function MrxSourceDeltaWorkbench() {
  const navigate = useNavigate();

  const {
    data: items,
    stateProps,
    refetch: load,
  } = useWorkbenchQuery<readonly MrxSourceDelta[]>({
    scopeKey: 'mrx_source_deltas',
    cacheKey: 'mrx_source_deltas',
    snapshotKey: 'snapshot:mrx_source_deltas',
    queryFn: async () => (await mrxApi.getSourceDeltas()).items,
    isDatasetEmpty: (deltas) => !deltas || deltas.length === 0,
    emptyTitle: 'Không có thay đổi nguồn đang chờ',
    emptyDescription: 'Các thay đổi đã xử lý được lưu trữ đầy đủ trong lịch sử phiếu xuất, phiếu trả và biến động tồn kho.',
    emptyScenario: 'filter-empty',
  });

  const deltaItems = items ?? [];
  const [error, setError] = useState<Error | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDelta, setSelectedDelta] = useState<MrxSourceDelta | null>(null);
  const [actualQuantity, setActualQuantity] = useState<string>('');
  const [varianceReason, setVarianceReason] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await load(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openProcessModal = (delta: MrxSourceDelta) => {
    setSelectedDelta(delta);
    setActualQuantity(String(Math.abs(delta.deltaQuantity)));
    setVarianceReason('');
  };

  const hasDiscrepancy = selectedDelta !== null && Number(actualQuantity) !== Math.abs(selectedDelta.deltaQuantity);
  const canConfirm = !hasDiscrepancy || varianceReason.trim().length > 0;

  const handleExecute = async (delta: MrxSourceDelta) => {
    setProcessingId(delta.sourceDeltaId);
    setError(null);
    const qty = Number(actualQuantity) || Math.abs(delta.deltaQuantity);
    const reasonText = varianceReason.trim();
    try {
      if (delta.workKind === 'SUPPLEMENTAL_ISSUE') {
        const daily = await mrxApi.getWarehouseDaily(delta.batchId);
        const line = daily.dates.flatMap((day) => day.lines).find((item) => item.dailyLineId === delta.dailyLineId);
        if (!line) throw new Error('Không tìm thấy dòng định lượng theo ngày của delta.');
        await mrxApi.createIssue({
          commandId: crypto.randomUUID(),
          expectedVersion: daily.sourceVersion,
          issueDate: delta.serviceDate,
          reconciliationBatchId: delta.batchId,
          reconciliationSourceDeltaId: delta.sourceDeltaId,
          expectedSourceDeltaVersion: delta.version,
          isSupplemental: true,
          lines: [{
            reconciliationBatchLineId: line.batchLineId,
            reconciliationBatchDailyLineId: line.dailyLineId,
            ingredientId: delta.ingredientId,
            unitId: delta.canonicalUnitId,
            requestedQty: delta.deltaQuantity,
            issuedQty: qty,
            varianceReason: reasonText || 'Xuất bổ sung theo thay đổi nguồn đã duyệt',
          }],
        });
      } else {
        const issuePage = await mrxApi.getIssues(delta.batchId);
        const candidateLines = issuePage.items.flatMap((issue) => issue.lines.map((line) => ({ issue, line })))
          .filter(({ line }) =>
            line.reconciliationBatchDailyLineId === delta.dailyLineId &&
            line.ingredientId === delta.ingredientId &&
            line.issuedQty > 0
          );
        const source = candidateLines.find(({ line }) => line.issuedQty >= qty) || candidateLines[0];
        if (!source) throw new Error(`Chưa tìm thấy phiếu xuất gốc của nguyên liệu ${delta.ingredientName || delta.ingredientCode || ''} để hoàn trả.`);
        const created = await mrxApi.createReturn({
          commandId: crypto.randomUUID(),
          returnDate: delta.serviceDate,
          returnType: 'RETURN',
          issueId: source.issue.issueId,
          reconciliationSourceDeltaId: delta.sourceDeltaId,
          expectedSourceDeltaVersion: delta.version,
          reason: reasonText || 'Hoàn trả vật lý theo thay đổi nguồn đã duyệt',
          lines: [{
            sourceIssueLineId: source.line.issueLineId,
            ingredientId: delta.ingredientId,
            unitId: delta.canonicalUnitId,
            quantity: qty,
          }],
        });
        await mrxApi.confirmReturn(created.returnId, {
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          hasDiscrepancy,
          adjustedLines: [],
        });
      }

      setSuccessMessage(delta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'Đã tạo phiếu xuất bổ sung thành công.' : 'Đã tạo phiếu hoàn trả kho thành công.');
      setSelectedDelta(null);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Thao tác xử lý thay đổi nguồn thất bại.'));
    } finally {
      setProcessingId(null);
    }
  };

  const supplementalCount = useMemo(() => deltaItems.filter((d) => d.workKind === 'SUPPLEMENTAL_ISSUE').length, [deltaItems]);
  const returnCount = useMemo(() => deltaItems.filter((d) => d.workKind === 'RETURN').length, [deltaItems]);

  const columns = useMemo<ColumnDef<MrxSourceDelta>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu',
      width: '32%',
      cell: (delta) => {
        const name = delta.ingredientName ?? delta.ingredientCode ?? delta.ingredientId;
        return (
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-slate-900 text-sm truncate">{name}</span>
            {delta.ingredientCode && <IdentifierText value={delta.ingredientCode} />}
          </div>
        );
      },
    },
    {
      id: 'date',
      header: 'Ngày',
      width: '16%',
      cell: (delta) => <span className="font-mono text-xs">{toVietnameseDate(delta.serviceDate)}</span>,
    },
    {
      id: 'delta',
      header: 'Chênh lệch',
      width: '18%',
      align: 'right',
      cell: (delta) => (
        <Num
          value={delta.deltaQuantity}
          format="quantity"
          prefix={delta.deltaQuantity > 0 ? '+' : ''}
          suffix={delta.canonicalUnitName ? ` ${delta.canonicalUnitName}` : ''}
          className={delta.deltaQuantity > 0 ? 'text-amber-700 font-semibold' : 'text-blue-700 font-semibold'}
        />
      ),
    },
    {
      id: 'workKind',
      header: 'Công việc',
      width: '18%',
      cell: (delta) => (
        <Badge variant={delta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'warning' : 'info'} size="sm">
          {delta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'Xuất bổ sung' : 'Hoàn trả vật lý'}
        </Badge>
      ),
    },
    {
      id: 'action',
      header: 'Thao tác',
      width: '16%',
      align: 'right',
      cell: (delta) => {
        const name = delta.ingredientName ?? delta.ingredientCode ?? delta.ingredientId;
        return (
          <Button
            size="sm"
            disabled={processingId !== null}
            onClick={() => openProcessModal(delta)}
            aria-label={`${delta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'Xử lý xuất bổ sung' : 'Xử lý hoàn trả'} ${name}`}
          >
            {processingId === delta.sourceDeltaId ? 'Đang xử lý…' : 'Xử lý'}
          </Button>
        );
      },
    },
  ], [processingId]);

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxDeltaHeaderBranch
        onNavigateDaily={() => navigate('/warehouse?view=mrx-daily')}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      <TelemetrySubbar
        leftControls={
          <span className="text-xs font-semibold text-slate-700">Hàng đợi thay đổi nguồn cần kho xử lý</span>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Xuất bổ sung:</span>
              <strong className="text-amber-700 font-mono">{supplementalCount}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Hoàn trả:</span>
              <strong className="text-blue-700 font-mono">{returnCount}</strong>
            </span>
          </>
        }
      />

      {successMessage && (
        <InlineBanner variant="success" onClose={() => setSuccessMessage(null)} className="shrink-0">
          {successMessage}
        </InlineBanner>
      )}

      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          error={stateProps.error || error}
          onRetry={() => void load(true)}
          onResolveConflict={() => void load(true)}
          actionLabel="Đi đến Trạm xuất kho theo ngày →"
          onAction={() => navigate('/warehouse?view=mrx-daily')}
        >
          <MrxDeltaTableBranch
            items={deltaItems}
            columns={columns}
            selectedDelta={selectedDelta}
            onCloseModal={() => setSelectedDelta(null)}
            processingId={processingId}
            actualQuantity={actualQuantity}
            onChangeActualQuantity={setActualQuantity}
            varianceReason={varianceReason}
            onChangeVarianceReason={setVarianceReason}
            hasDiscrepancy={hasDiscrepancy}
            canConfirm={canConfirm}
            onExecute={handleExecute}
          />
        </StateBoundary>
      </WorkspaceFrame.Body>
    </WorkspaceFrame.Root>
  );
}
