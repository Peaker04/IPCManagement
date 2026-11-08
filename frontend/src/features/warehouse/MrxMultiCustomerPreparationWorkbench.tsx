import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxPreparation } from '../../api/mrxApi';
import { InlineBanner } from '../../components/ui/inline-banner';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';
import { isIsoDate, isServiceDate, todayInBusinessTimezone, weekStartFor } from '../../utils/dates';
import { type ColumnDef } from '../../components/workbench/DataGrid';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { MrxPrepHeaderBranch } from './branches/MrxPrepHeaderBranch';
import { MrxPrepAllocationsBranch, type MrxFilteredPreparationLine } from './branches/MrxPrepAllocationsBranch';
import { MrxPrepCustomerSelector } from './branches/MrxPrepCustomerSelector';

interface MrxMultiCustomerPreparationWorkbenchProps {
  serviceDate: string;
}

export function MrxMultiCustomerPreparationWorkbench({ serviceDate }: MrxMultiCustomerPreparationWorkbenchProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionScope = workspaceSessionStore.getScope();
  const explicitUrlDate = searchParams.get('date');
  const rawDate = [explicitUrlDate, serviceDate, sessionScope.serviceDate].find(isIsoDate) || todayInBusinessTimezone();
  const activeDate = !explicitUrlDate && !isServiceDate(rawDate) ? weekStartFor(rawDate) : rawDate;
  const wholeWeek = searchParams.get('range') !== 'day';
  const scopeDate = wholeWeek ? weekStartFor(activeDate) : activeDate;
  const selectionScope = `${wholeWeek ? 'week' : 'day'}:${scopeDate}`;
  const [selection, setSelection] = useState<{ scope: string; ids: string[] } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const preparationQuery = useWorkbenchQuery<MrxPreparation>({
    scopeKey: 'mrx_preparation',
    cacheKey: `mrx_preparation_${wholeWeek ? 'week' : 'day'}_${scopeDate}`,
    snapshotKey: `snapshot:mrx_preparation_${wholeWeek ? 'week' : 'day'}`,
    scopeId: scopeDate,
    queryFn: (_, signal) => isServiceDate(scopeDate)
      ? mrxApi.getPreparation(scopeDate, undefined, wholeWeek, signal)
      : Promise.reject(new Error('Tuần chuẩn bị chỉ từ Thứ Hai đến Thứ Bảy. Chọn ngày khác hoặc xem cả tuần.')),
    isDatasetEmpty: res => !res || res.batches.length === 0,
    emptyTitle: 'Không có lô đối soát trong phạm vi đã chọn',
    emptyDescription: 'Chọn ngày hoặc tuần có nguồn định lượng đã đóng băng để tổng hợp và xuất Excel.',
    emptyScenario: 'filter-empty',
  });
  const { data: preparationData, stateProps, refetch } = preparationQuery;
  const currentData = preparationData?.serviceDate === scopeDate && !stateProps.isPreviousData ? preparationData : null;
  // Keep previous rows only under the busy boundary; export always requires the current scope.
  const data = preparationData;
  const activeSelectedBatchIds = useMemo(() => selection && (selection.scope === selectionScope || stateProps.isPreviousData) ? selection.ids : data?.batches.map(batch => batch.batchId) ?? [], [data, selection, selectionScope, stateProps.isPreviousData]);
  const activeBatches = useMemo(() => data?.batches.filter(batch => activeSelectedBatchIds.includes(batch.batchId)) ?? [], [data, activeSelectedBatchIds]);
  const lines = useMemo<MrxFilteredPreparationLine[]>(() => (data?.aggregatedLines ?? []).map(line => {
    const allocations = line.allocations.filter(allocation => activeSelectedBatchIds.includes(allocation.batchId));
    return { ...line, allocations, filteredRequired: allocations.reduce((sum, allocation) => sum + allocation.requiredQuantity, 0) };
  }).filter(line => line.filteredRequired > 0), [data, activeSelectedBatchIds]);
  const columns = useMemo<ColumnDef<MrxFilteredPreparationLine>[]>(() => [
    { id: 'ingredient', header: 'Nguyên liệu', width: activeBatches.length > 1 ? '320px' : undefined, cell: line => <div className="min-w-0 py-1 flex flex-wrap items-center gap-x-2"><span className="text-sm font-semibold text-slate-900 break-words">{line.ingredientName}</span>{line.ingredientCode && <IdentifierText value={line.ingredientCode} />}</div> },
    { id: 'required', header: 'Cần chuẩn bị', width: '200px', align: 'right', cell: line => <Num value={line.filteredRequired} format="plain" decimals={6} suffix={` ${line.canonicalUnitName ?? ''}`} className="font-semibold text-slate-900" /> },
    ...(activeBatches.length > 1 ? activeBatches.map(batch => ({
      id: batch.batchId,
      header: <span className="whitespace-normal break-words line-clamp-2" title={batch.customerName || batch.customerCode || 'Khách hàng'}>{batch.customerCode || batch.customerName || 'Khách hàng'}{activeBatches.filter(other => other.customerId === batch.customerId).length > 1 ? ` · Lô ${activeBatches.indexOf(batch) + 1}` : ''}</span>,
      width: '200px',
      align: 'right' as const,
      cell: (line: MrxFilteredPreparationLine) => <Num value={line.allocations.filter(allocation => allocation.batchId === batch.batchId).reduce((sum, allocation) => sum + allocation.requiredQuantity, 0)} format="plain" decimals={6} suffix={` ${line.canonicalUnitName ?? ''}`} />,
    })) : []),
  ], [activeBatches]);
  const scopeReady = Boolean(currentData && !stateProps.error && !stateProps.isFetching);
  const canExport = scopeReady && activeBatches.length > 0 && lines.length > 0 && !downloading;
  const toggleBatch = (batchId: string) => {
    if (downloading || !scopeReady) return;
    setSelection({ scope: selectionScope, ids: activeSelectedBatchIds.includes(batchId)
      ? activeSelectedBatchIds.filter(id => id !== batchId) : [...activeSelectedBatchIds, batchId] });
  };
  const download = async () => {
    if (!canExport) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadAuthenticatedFile(mrxApi.getPreparationWorkbookExportUrl({
        ...(wholeWeek ? { weekStartDate: scopeDate } : { serviceDate: scopeDate }),
        batchIds: activeSelectedBatchIds, includeMenus: true, isSupplemental: false,
      }), `chuan-bi-${wholeWeek ? 'tuan' : 'ngay'}-${scopeDate}.xlsx`);
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : 'Không thể tải Excel chuẩn bị. Vui lòng thử lại.');
    } finally { setDownloading(false); }
  };
  return <WorkspaceFrame.Root className="select-text">
    <MrxPrepHeaderBranch activeDate={scopeDate} wholeWeek={wholeWeek} scopeLocked={downloading}
      onScopeChange={(date, week) => {
        if (downloading || (date === scopeDate && week === wholeWeek)) return;
        setDownloadError(null);
        setSearchParams(current => {
          const next = new URLSearchParams(current);
          next.set('date', date);
          next.set('range', week ? 'week' : 'day');
          return next;
        }, { replace: true });
      }}
      canExport={canExport} downloading={downloading} onDownload={() => void download()}
      customerSelector={<MrxPrepCustomerSelector batches={data?.batches ?? []} selectedBatchIds={activeSelectedBatchIds} scopeLocked={downloading || !scopeReady} onToggleBatch={toggleBatch} />} />
    {downloadError && <InlineBanner variant="error">{downloadError}</InlineBanner>}
    <span role="status" className="sr-only">{stateProps.isPreviousData ? 'Đang tải phạm vi mới; số liệu đang hiển thị thuộc phạm vi trước.' : ''}</span>
    <WorkspaceFrame.Body>
      <MrxPrepAllocationsBranch stateBoundaryProps={{ ...stateProps,
        notFoundAsEmpty: false, onRetry: () => void refetch(true),
      }} data={data} activeSelectedBatchIds={activeSelectedBatchIds} filteredAggregatedLines={lines} columns={columns} wholeWeek={wholeWeek} />
    </WorkspaceFrame.Body>
  </WorkspaceFrame.Root>;
}
