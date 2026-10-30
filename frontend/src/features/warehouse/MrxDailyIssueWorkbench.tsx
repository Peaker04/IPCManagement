import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { Boxes } from 'lucide-react';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { DocumentCodeCell } from '../../components/workbench/DocumentCodeCell';
import { weekStartFor, toVietnameseDate } from '../../utils/dates';
import { MrxSupplementalIssueModal } from './MrxSupplementalIssueModal';
import { ReconciliationIssueDetailModal } from '../../components/workbench/ReconciliationIssueDetailModal';
import { MrxDailyDateTabsBranch } from './branches/MrxDailyDateTabsBranch';
import { MrxDailyHeaderBranch } from './branches/MrxDailyHeaderBranch';
import { MrxDailyLinesBranch } from './branches/MrxDailyLinesBranch';
import { serverStateCache } from '../../store/serverStateCache';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { useMrxDailyWorkspace } from './hooks/useMrxDailyWorkspace';
import type { MrxWarehouseDaily, MrxIssuePage } from '../../api/mrxApi';

interface MrxDailyIssueWorkbenchProps {
  batchId?: string;
  serviceDate?: string;
}

export function MrxDailyIssueWorkbench({
  batchId: propBatchId = '',
  serviceDate: propServiceDate = '',
}: MrxDailyIssueWorkbenchProps) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const {
    batches,
    activeBatchId,
    setActiveBatchId,
    activeDate,
    setActiveDate,
    isWeeklyAll,
    daily,
    day,
    history,
    lines,
    weeklyAggregateLines,
    hasInitialIssue,
    isLegacyMissing,
    stateProps,
    load,
    quantities,
    setQuantities,
    reasons,
    setReasons,
    saving,
    mutationError,
    setMutationError,
    isSupplementalOpen,
    setIsSupplementalOpen,
    suppMaterialId,
    setSuppMaterialId,
    suppQuantity,
    setSuppQuantity,
    suppReason,
    setSuppReason,
    isSubmittingSupp,
    suppError,
    setSuppError,
    inspectedIssueId,
    setInspectedIssueId,
    handleFillAll,
    canSubmit,
    submit,
    handleSupplementalSubmit,
  } = useMrxDailyWorkspace({ batchId: propBatchId, serviceDate: propServiceDate });

  const [activeTab, setActiveTab] = useState<'demand' | 'history'>('demand');

  const historyColumns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'code',
      header: 'Mã phiếu xuất',
      width: '24%',
      minWidth: '220px',
      cell: (row) => <DocumentCodeCell code={row.issueCode} onOpenDetail={setInspectedIssueId} />,
    },
    {
      id: 'date',
      header: 'Ngày xuất',
      width: '18%',
      minWidth: '120px',
      cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.issueDate)}</span>,
    },
    {
      id: 'shift',
      header: 'Ca',
      width: '16%',
      minWidth: '100px',
      cell: (row) => <span className="text-xs font-medium">{row.shiftName || '—'}</span>,
    },
    {
      id: 'items',
      header: 'Số mặt hàng',
      width: '18%',
      minWidth: '110px',
      align: 'right',
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.lines?.length ?? 0} mặt hàng</span>,
    },
    {
      id: 'actor',
      header: 'Thủ kho xuất',
      width: '24%',
      minWidth: '140px',
      cell: (row) => <span className="text-xs text-slate-700">{row.issuedByName || 'Thủ kho'}</span>,
    },
  ], [setInspectedIssueId]);

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxDailyHeaderBranch
        batches={batches}
        activeBatchId={activeBatchId}
        onSelectBatch={(newId) => {
          const b = batches.find((item) => item.batchId === newId);
          setActiveBatchId(newId);
          if (b) {
            workspaceSessionStore.setScope({
              batchId: newId,
              customerId: b.customerId,
              customerCode: b.customerCode || '',
              customerName: b.customerName || '',
              weekStartDate: b.weekStartDate || '',
            });
          }
          const cachedForNew = serverStateCache.get<{ daily: MrxWarehouseDaily | null; history: MrxIssuePage | null }>(`mrx_daily_${newId}`)?.data;
          const newDate = cachedForNew?.daily?.dates[0]?.serviceDate || b?.weekStartDate || activeDate;
          setActiveDate(newDate);
          serverStateCache.set('snapshot:mrx_daily', { activeBatchId: newId, activeDate: newDate, daily: cachedForNew?.daily || null, history: cachedForNew?.history || null });
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('batchId', newId);
            next.set('date', newDate);
            return next;
          }, { replace: true });
        }}
        activeDate={activeDate}
        onSelectDate={(newDate) => {
          setActiveDate(newDate);
          serverStateCache.set('snapshot:mrx_daily', { activeBatchId, activeDate: newDate, daily, history });
          workspaceSessionStore.setScope({ serviceDate: newDate, weekStartDate: weekStartFor(newDate) });
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('date', newDate);
            return next;
          }, { replace: true });
        }}
        onNavigatePreparation={() => navigate(`/warehouse?view=mrx-preparation&date=${activeDate}`)}
        onNavigateTransactions={() => navigate('/reconciliation?view=transactions')}
        isWeeklyAll={isWeeklyAll}
        hasInitialIssue={hasInitialIssue}
        onOpenSupplemental={() => {
          setSuppMaterialId(lines[0]?.dailyLineId || '');
          setSuppQuantity('');
          setSuppReason('');
          setSuppError(null);
          setIsSupplementalOpen(true);
        }}
        onFillAll={handleFillAll}
        onSubmit={submit}
        canSubmit={canSubmit}
        saving={saving}
        linesCount={lines.length}
      />

      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded">
              <button
                type="button"
                onClick={() => setActiveTab('demand')}
                className={clsx('px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-colors', activeTab === 'demand' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900')}
              >
                Định lượng xuất ca
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={clsx('px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-colors', activeTab === 'history' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900')}
              >
                Lịch sử phiếu ({history?.items?.length ?? 0})
              </button>
            </div>
            {activeTab === 'demand' && (
              <MrxDailyDateTabsBranch
                dates={daily?.dates}
                activeDate={activeDate}
                onSelectDate={(newDate) => {
                  setActiveDate(newDate);
                  setSearchParams((curr) => {
                    const next = new URLSearchParams(curr);
                    next.set('date', newDate);
                    return next;
                  }, { replace: true });
                }}
                isWeeklyAll={isWeeklyAll}
              />
            )}
          </div>
        }
        telemetryPills={
          isWeeklyAll ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Mã lô:</span>
              <strong className="font-mono text-slate-900">{daily?.batchId ? daily.batchId.slice(0, 8) : '—'}</strong>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">Tổng nguyên liệu:</span>
              <strong className="font-mono text-slate-900">{weeklyAggregateLines.length}</strong>
            </div>
          ) : (
            day && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Phiên bản:</span>
                <strong className="font-mono text-slate-900">v{daily?.sourceVersion ?? '—'}</strong>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Mặt hàng ca:</span>
                <strong className="font-mono text-slate-900">{lines.length}</strong>
              </div>
            )
          )
        }
      />

      {mutationError && (
        <div role="alert" className="p-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex justify-between items-center">
          <span>{mutationError.message}</span>
          <button type="button" onClick={() => setMutationError(null)} className="font-bold underline ml-2">Đóng</button>
        </div>
      )}

      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          onRetry={() => load(true)}
          loadingVariant="table"
          emptyIcon={Boxes}
          isEmpty={stateProps.isEmpty || isLegacyMissing}
          emptyTitle={isLegacyMissing ? "Lô đối soát chưa có phân rã định lượng theo ngày" : (!isWeeklyAll && lines.length === 0 ? "Không có định lượng cần xuất cho ngày đã chọn" : stateProps.emptyTitle)}
          emptyDescription={isLegacyMissing ? "Lô đối soát này được tạo từ phiên bản trước khi áp dụng tính năng phân rã theo ngày. Vui lòng chọn lô đối soát khác trong danh sách phía trên." : (!isWeeklyAll && lines.length === 0 ? "Ngày này không phát sinh định mức nguyên liệu cần xuất kho." : stateProps.emptyDescription)}
          isPartial={isLegacyMissing}
          partialMessage="Lô này thiếu liên kết định lượng ca chi tiết từ hệ thống thực đơn gốc. Chỉ có thể xem danh mục tổng hợp."
          actionLabel={isLegacyMissing ? 'Xem màn hình Điều phối lô' : (!activeBatchId || batches.length === 0 ? 'Xem tiến độ tại Bàn điều hành' : undefined)}
          onAction={isLegacyMissing ? () => navigate(`/weekly-menu?view=mrx-batch&batchId=${activeBatchId}`) : (!activeBatchId || batches.length === 0 ? () => navigate('/') : undefined)}
        >
          {activeTab === 'demand' ? (
            <div className="flex-1 min-h-0 flex flex-col bg-white">
              <MrxDailyLinesBranch
                isWeeklyAll={isWeeklyAll}
                weeklyAggregateLines={weeklyAggregateLines}
                lines={lines}
                quantities={quantities}
                setQuantities={setQuantities}
                reasons={reasons}
                setReasons={setReasons}
                hasInitialIssue={hasInitialIssue}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col bg-white">
              <DataGrid
                data={history?.items ?? []}
                columns={historyColumns}
                keyExtractor={(row) => row.issueId}
                emptyMessage="Chưa có phiếu xuất kho nào cho lô này."
              />
            </div>
          )}
        </StateBoundary>
      </WorkspaceFrame.Body>

      <MrxSupplementalIssueModal
        isOpen={isSupplementalOpen}
        onClose={() => setIsSupplementalOpen(false)}
        activeBatchId={activeBatchId}
        activeDate={activeDate}
        lines={lines}
        suppMaterialId={suppMaterialId}
        onSuppMaterialIdChange={setSuppMaterialId}
        suppQuantity={suppQuantity}
        onSuppQuantityChange={setSuppQuantity}
        suppReason={suppReason}
        onSuppReasonChange={setSuppReason}
        suppError={suppError}
        isSubmittingSupp={isSubmittingSupp}
        onSubmit={handleSupplementalSubmit}
      />

      <ReconciliationIssueDetailModal
        isOpen={Boolean(inspectedIssueId)}
        onClose={() => setInspectedIssueId(null)}
        issueId={inspectedIssueId}
      />
    </WorkspaceFrame.Root>
  );
}
