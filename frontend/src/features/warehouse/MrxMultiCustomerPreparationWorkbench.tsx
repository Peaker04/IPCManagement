import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxPreparation } from '../../api/mrxApi';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { toVietnameseDate, todayInBusinessTimezone } from '../../utils/dates';
import { type ColumnDef } from '../../components/workbench/DataGrid';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { MrxPrepHeaderBranch } from './branches/MrxPrepHeaderBranch';
import { MrxPrepAllocationsBranch } from './branches/MrxPrepAllocationsBranch';

interface MrxMultiCustomerPreparationWorkbenchProps {
  serviceDate: string;
}

export function MrxMultiCustomerPreparationWorkbench({ serviceDate }: MrxMultiCustomerPreparationWorkbenchProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionScope = workspaceSessionStore.getScope();
  const urlDate = searchParams.get('date');
  const initialDate = serviceDate || urlDate || sessionScope.serviceDate || todayInBusinessTimezone();
  const [activeDate, setActiveDate] = useState(() => initialDate);

  const {
    data,
    stateProps,
    refetch: load,
  } = useWorkbenchQuery<MrxPreparation>({
    scopeKey: 'mrx_preparation',
    cacheKey: `mrx_preparation_${activeDate}`,
    snapshotKey: 'snapshot:mrx_preparation',
    scopeId: activeDate,
    queryFn: () => mrxApi.getPreparation(activeDate),
    isDatasetEmpty: (res) => !res || res.batches.length === 0,
    emptyTitle: 'Không có lô đối soát cho ngày đã chọn',
    emptyDescription: 'Các lô đối soát cần được Điều phối chuyển sang Kho ở trạng thái Sẵn sàng xuất kho.',
    emptyScenario: 'filter-empty',
  });

  const [selectedBatchIds, setSelectedBatchIds] = useState<string[] | null>(null);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [successGroupId, setSuccessGroupId] = useState<string | null>(null);

  const activeSelectedBatchIds = useMemo(() => {
    if (selectedBatchIds !== null) return selectedBatchIds;
    return data?.batches.filter((b) => b.isApplicable && !b.hasExistingIssue).map((b) => b.batchId) ?? [];
  }, [data, selectedBatchIds]);

  const activeBatches = useMemo(
    () => data?.batches.filter((b) => activeSelectedBatchIds.includes(b.batchId)) ?? [],
    [data, activeSelectedBatchIds]
  );

  const filteredAggregatedLines = useMemo(() => {
    if (!data || !data.aggregatedLines) return [];
    return data.aggregatedLines
      .map((line) => {
        const filteredAllocs = line.allocations.filter((a) => activeSelectedBatchIds.includes(a.batchId));
        return {
          ...line,
          allocations: filteredAllocs,
          filteredRequired: filteredAllocs.reduce((sum, a) => sum + a.requiredQuantity, 0),
          filteredRemaining: filteredAllocs.reduce((sum, a) => sum + a.remainingQuantity, 0),
        };
      })
      .filter((l) => l.filteredRequired > 0);
  }, [data, activeSelectedBatchIds]);

  const toggleBatch = (batchId: string) => {
    setSelectedBatchIds((prev) => {
      const current = prev !== null ? prev : activeSelectedBatchIds;
      return current.includes(batchId)
        ? current.filter((id) => id !== batchId)
        : [...current, batchId];
    });
  };

  const columns = useMemo<ColumnDef<typeof filteredAggregatedLines[number]>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu',
      width: '28%',
      cell: (line) => {
        const name = line.ingredientName ?? line.ingredientCode ?? line.ingredientId;
        return (
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-slate-900 text-sm truncate">{name}</span>
            {line.ingredientCode && <IdentifierText value={line.ingredientCode} />}
          </div>
        );
      },
    },
    {
      id: 'required',
      header: 'Tổng cần chuẩn bị',
      width: '20%',
      align: 'right',
      cell: (line) => (
        <Num
          value={line.filteredRequired}
          format="quantity"
          suffix={line.canonicalUnitName ? ` ${line.canonicalUnitName}` : ''}
          className="font-bold text-slate-900"
        />
      ),
    },
    {
      id: 'allocations',
      header: 'Phân bổ theo khách hàng',
      width: '52%',
      cell: (line) => (
        <div className="flex flex-wrap gap-1.5 py-1">
          {line.allocations.map((alloc) => (
            <span
              key={alloc.dailyLineId}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200 font-mono"
            >
              <span className="font-sans font-medium text-slate-900">{alloc.customerName ?? alloc.customerCode ?? 'Khách'}:</span>
              <span>{alloc.requiredQuantity} {line.canonicalUnitName ?? ''}</span>
            </span>
          ))}
        </div>
      ),
    },
  ], [filteredAggregatedLines]);

  const canSubmit = activeBatches.length > 0 && !issuing && activeBatches.every((b) => b.isApplicable && !b.hasExistingIssue);

  const submitCoordinatedIssue = async () => {
    if (!data || !canSubmit) return;
    setIssuing(true);
    setActionError(null);
    setSuccessGroupId(null);
    try {
      const batchesRequest = activeBatches.map((b) => {
        const batchLines = data.aggregatedLines
          .flatMap((l) => l.allocations)
          .filter((a) => a.batchId === b.batchId);
        return {
          reconciliationBatchId: b.batchId,
          expectedVersion: b.batchVersion,
          lines: batchLines.map((a) => {
            const parentLine = data.aggregatedLines.find((l) => l.allocations.some((al) => al.dailyLineId === a.dailyLineId))!;
            return {
              reconciliationBatchLineId: a.batchLineId,
              reconciliationBatchDailyLineId: a.dailyLineId,
              ingredientId: parentLine.ingredientId,
              unitId: parentLine.canonicalUnitId,
              requestedQty: a.requiredQuantity,
              issuedQty: a.requiredQuantity,
            };
          }),
        };
      });

      const result = await mrxApi.issueCoordinated({
        commandId: crypto.randomUUID(),
        serviceDate: activeDate,
        batches: batchesRequest,
      });

      setSuccessGroupId(result.preparationGroupId);
      await load();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause : new Error('Không thể thực hiện xuất kho phối hợp.'));
    } finally {
      setIssuing(false);
    }
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxPrepHeaderBranch
        activeDate={activeDate}
        onSelectDate={(newDate) => {
          setActiveDate(newDate);
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('date', newDate);
            return next;
          }, { replace: true });
        }}
        hasData={Boolean(data && data.aggregatedLines.length > 0)}
        canIssueBatchGroup={canSubmit}
        activeBatchesCount={activeBatches.length}
        issuing={issuing}
        onDownloadXlsx={() => {
          const url = mrxApi.getPreparationWorkbookExportUrl({
            serviceDate: activeDate,
            batchIds: activeSelectedBatchIds,
            supplierName: supplierFilter.trim() || undefined,
          });
          window.open(url, '_blank');
        }}
        onIssueBatchGroup={submitCoordinatedIssue}
      />

      <TelemetrySubbar
        leftControls={
          <span className="text-xs font-semibold text-slate-700">Tổng hợp nguyên liệu ngày {toVietnameseDate(activeDate)}</span>
        }
        telemetryPills={data ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Lô chọn:</span>
              <strong className="text-slate-900 font-mono">{activeBatches.length}/{data.batches.length}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Nguyên liệu tổng:</span>
              <strong className="text-slate-900 font-mono">{filteredAggregatedLines.length}</strong>
            </span>
          </>
        ) : null}
      />

      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          error={stateProps.error || actionError}
          onRetry={() => void load(true)}
          actionLabel="Chuyển sang Trạm xuất kho ngày →"
          onAction={() => navigate(`/warehouse?view=mrx-daily&date=${activeDate}`)}
        >
          <MrxPrepAllocationsBranch
            data={data}
            activeDate={activeDate}
            activeSelectedBatchIds={activeSelectedBatchIds}
            onToggleBatch={toggleBatch}
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
            filteredAggregatedLines={filteredAggregatedLines}
            columns={columns}
            successGroupId={successGroupId}
            onClearSuccessGroup={() => setSuccessGroupId(null)}
            onNavigateDaily={() => navigate(`/warehouse?view=mrx-daily&date=${activeDate}`)}
          />
        </StateBoundary>
      </WorkspaceFrame.Body>
    </WorkspaceFrame.Root>
  );
}
