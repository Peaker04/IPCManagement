import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ActionGuard } from '../../components/ui/action-guard';
import { ApiError } from '../../api/client';
import { ReconciliationBlockerStrip } from './ReconciliationBlockerStrip';
import { ReconciliationReportTables } from './ReconciliationReportTables';
import { ReconciliationDispositionModal } from './ReconciliationDispositionModal';
import { ReconciliationQueueCards } from './ReconciliationQueueCards';
import { ReconciliationLifecycleStrip } from './ReconciliationLifecycleStrip';
import { ReconciliationLinesFilterToolbar, type LineStatusFilter } from './ReconciliationLinesFilterToolbar';
import { ReconciliationCompletionModal } from './ReconciliationCompletionModal';
import { useReconciliationColumns } from './reconciliationColumns';
import {
  reconciliationApi,
  type ReconciliationBatchSummary,
  type ReconciliationLineItem,
} from '../../api/reconciliationApi';
import {
  mrxApi,
  type MrxBatchSummary,
  type MrxOperationalSummary,
  type MrxVarianceRegisterReport,
  type MrxTransactionHistoryReport,
  type MrxAuditTrailReport,
  type MrxCompletedRegisterReport,
} from '../../api/mrxApi';
import { todayInBusinessTimezone } from '../../utils/dates';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';

function weekStartFor(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - (day === 0 ? 6 : day - 1));
  return value.toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Đang chuẩn bị',
  READY: 'Chờ Kho xuất',
  TRANSFERRED: 'Đã bàn giao kho',
  IN_PROGRESS: 'Đang đối chiếu',
  COMPLETED: 'Hoàn tất',
  WEEK_COMPLETE: 'Đủ điều kiện hoàn tất tuần',
  MATCHED: 'Khớp định mức',
  EXACT: 'Khớp',
  NEEDS_REVIEW: 'Cần giải trình',
  DISPOSED: 'Đã giải trình',
  UNDER_ISSUED: 'Chờ xuất đủ',
  OVER_ISSUED: 'Xuất vượt',
};

export function ReconciliationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin') || hasRole('ADMIN');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerCode, setCustomerCode] = useState('');
  const [batches, setBatches] = useState<MrxBatchSummary[]>([]);

  const [internalBatchId, setInternalBatchId] = useState('');
  const [internalDate, setInternalDate] = useState(todayInBusinessTimezone);
  const batchId = searchParams.get('batchId') || internalBatchId;
  const serviceDate = searchParams.get('date') || internalDate;

  const setBatchId = useCallback((id: string) => {
    setInternalBatchId(id);
  }, []);

  const setServiceDate = useCallback((date: string) => {
    setInternalDate(date);
  }, []);

  const [data, setData] = useState<ReconciliationBatchSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDispositionLine, setSelectedDispositionLine] = useState<ReconciliationLineItem | null>(null);

  const viewParam = searchParams.get('view');
  const activeReportTab: 'lines' | 'variances' | 'transactions' | 'audit' | 'completed' =
    viewParam === 'variances' || viewParam === 'transactions' || viewParam === 'audit' || viewParam === 'completed'
      ? viewParam
      : 'lines';

  const [variancesReport, setVariancesReport] = useState<MrxVarianceRegisterReport | null>(null);
  const [transactionsReport, setTransactionsReport] = useState<MrxTransactionHistoryReport | null>(null);
  const [auditReport, setAuditReport] = useState<MrxAuditTrailReport | null>(null);
  const [completedReport, setCompletedReport] = useState<MrxCompletedRegisterReport | null>(null);
  const [operationalSummary, setOperationalSummary] = useState<MrxOperationalSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lineStatusFilter, setLineStatusFilter] = useState<LineStatusFilter>('ALL');

  const needsReviewCount = useMemo(() => (data?.lines ?? []).filter((l) => (l.issuedRequiredDifference ?? 0) !== 0 && !l.disposition).length, [data]);
  const disposedCount = useMemo(() => (data?.lines ?? []).filter((l) => Boolean(l.disposition)).length, [data]);
  const matchedCount = useMemo(() => (data?.lines ?? []).filter((l) => l.issuedRequiredDifference === 0).length, [data]);

  const filteredLines = useMemo(() => {
    if (!data?.lines) return [];
    return data.lines.filter((line) => {
      if (lineStatusFilter === 'NEEDS_REVIEW') {
        if ((line.issuedRequiredDifference ?? 0) === 0 || Boolean(line.disposition)) return false;
      } else if (lineStatusFilter === 'DISPOSED') {
        if (!line.disposition) return false;
      } else if (lineStatusFilter === 'MATCHED') {
        if (line.issuedRequiredDifference !== 0) return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const nameMatch = line.materialName?.toLowerCase().includes(query);
        const codeMatch = line.materialCode?.toLowerCase().includes(query);
        if (!nameMatch && !codeMatch) return false;
      }

      return true;
    });
  }, [data, lineStatusFilter, searchTerm]);

  useEffect(() => {
    let ignore = false;
    mrxApi.getOperationalSummary()
      .then((summary) => { if (!ignore) setOperationalSummary(summary); })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (activeReportTab === 'completed') {
      mrxApi.getCompletedRegister()
        .then(setCompletedReport)
        .catch(() => setCompletedReport(null));
      return;
    }
    if (!batchId) return;
    if (activeReportTab === 'variances') {
      mrxApi.getVarianceRegister(batchId, weekStartFor(serviceDate))
        .then(setVariancesReport)
        .catch(() => setVariancesReport(null));
    } else if (activeReportTab === 'transactions') {
      mrxApi.getTransactionsHistory(batchId)
        .then(setTransactionsReport)
        .catch(() => setTransactionsReport(null));
    } else if (activeReportTab === 'audit') {
      mrxApi.getAuditTrail(batchId)
        .then(setAuditReport)
        .catch(() => setAuditReport(null));
    }
  }, [batchId, activeReportTab, serviceDate]);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi
      .getCustomers()
      .then((list) => {
        if (ignore) return;
        setCustomers(list);
        setCustomerCode((current) => current || list[0]?.customerCode || '');
      })
      .catch((cause: unknown) => {
        if (!ignore) setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
      });
    return () => {
      ignore = true;
    };
  }, []);

  const loadData = async (id = batchId, date = serviceDate) => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setData(await reconciliationApi.getReconciliationSummary(id, date));
    } catch (cause: unknown) {
      setData(null);
      setError(cause instanceof Error ? cause : new Error('Không thể tải lô đối soát nguyên liệu.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const customerId = customers.find((customer) => customer.customerCode === customerCode)?.customerId;
    if (!customerId) return;
    let ignore = false;
    mrxApi.getBatchPage({ customerId, weekStartDate: weekStartFor(serviceDate), pageSize: 100 })
      .then((page) => {
        if (ignore) return;
        setBatches(page.items);
        const selected = batchId || page.items[0]?.batchId || '';
        setBatchId(selected);
        if (!selected) {
          setData(null);
          setIsLoading(false);
        }
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          if (selected) next.set('batchId', selected); else next.delete('batchId');
          return next;
        }, { replace: true });
      })
      .catch((cause: unknown) => {
        if (!ignore) setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách lô đối soát.'));
      });
    return () => { ignore = true; };
  }, [batchId, customerCode, customers, serviceDate, setSearchParams, setBatchId]);

  useEffect(() => {
    if (!batchId) return;
    let ignore = false;
    reconciliationApi.getReconciliationSummary(batchId, serviceDate)
      .then((result) => {
        if (!ignore) {
          setData(result);
          if (result.customerCode && !customerCode) {
            setCustomerCode(result.customerCode);
          }
        }
      })
      .catch((cause: unknown) => {
        if (ignore) return;
        setData(null);
        setError(cause instanceof Error ? cause : new Error('Không thể tải lô đối soát nguyên liệu.'));
      })
      .finally(() => { if (!ignore) setIsLoading(false); });
    return () => { ignore = true; };
  }, [batchId, serviceDate, customerCode]);

  const canComplete = data?.status === 'IN_PROGRESS' && data.weeklyStatus === 'WEEK_COMPLETE';

  const handleComplete = async () => {
    if (!data || !canComplete) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      const completed = await reconciliationApi.completeReconciliation(data.batchId, data.version);
      setData(completed);
      setMutationError(null);
      setIsCompleteOpen(false);
    } catch (cause: unknown) {
      setMutationError(cause instanceof Error ? cause : new Error('Không thể hoàn tất lô đối soát.'));
      setIsCompleteOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const customerOptions = customers.map((customer) => ({
    value: customer.customerCode,
    label: `${customer.customerCode} - ${customer.customerName}`,
  }));

  const batchOptions = batches.map((batch) => ({
    value: batch.batchId,
    label: `${batch.customerCode || batch.customerName || 'Khách hàng'} · ${batch.status} · ${batch.batchId.slice(0, 8)}`,
  }));

  const isCompleted = data?.status === 'COMPLETED';
  const columns = useReconciliationColumns({
    statusLabels: STATUS_LABELS,
    isCompleted,
    onSelectDispositionLine: setSelectedDispositionLine,
  });

  const isForbidden = error instanceof ApiError && error.status === 403;
  const isModeConflict = error instanceof ApiError && error.status === 409 && (
    error.message.includes('chế độ') || error.message.includes('Đối chiếu') || error.message.includes('MRX') || error.message.includes('DEFAULT')
  );
  const isConflict = error instanceof ApiError && error.status === 409 && !isModeConflict;
  const displayedError = isForbidden || isConflict || isModeConflict ? null : error;

  const selectBatch = (b?: MrxBatchSummary) => {
    if (!b) return;
    setBatchId(b.batchId);
    setSearchParams((curr) => { const next = new URLSearchParams(curr); next.set('batchId', b.batchId); return next; });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Đối soát nguyên liệu"
        breadcrumb="Đối soát MRX · Bàn điều khiển Giám sát"
        contextSelectors={
          <>
            <Select
              aria-label="Chọn khách hàng đối soát"
              options={customerOptions}
              value={customerCode}
              onChange={(event) => {
                setIsLoading(true);
                setError(null);
                setBatchId('');
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.delete('batchId');
                  return next;
                });
                setCustomerCode(event.target.value);
              }}
              className="h-9 w-64 font-medium text-sm"
              disabled={customers.length === 0}
            />
            <Select
              aria-label="Chọn lô đối soát"
              options={batchOptions}
              value={batchId}
              onChange={(event) => {
                const selected = event.target.value;
                setIsLoading(true);
                setError(null);
                setBatchId(selected);
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set('batchId', selected);
                  return next;
                });
              }}
              className="h-9 w-72 font-medium text-sm"
              disabled={batches.length === 0}
            />
            <VietnameseDateInput
              aria-label="Ngày đối soát"
              value={serviceDate}
              onChange={(date) => {
                const currentWeek = weekStartFor(serviceDate);
                const nextWeek = weekStartFor(date);
                setIsLoading(true);
                setError(null);
                if (currentWeek !== nextWeek) {
                  setBatchId('');
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current);
                    next.delete('batchId');
                    return next;
                  });
                }
                setServiceDate(date);
              }}
              className="h-9 w-40 font-mono text-sm"
            />
            <Badge variant={data?.status === 'COMPLETED' ? 'success' : 'info'} size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              {data ? STATUS_LABELS[data.status] || data.status : 'Chưa chọn lô'}
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="default" onClick={() => loadData()} className="h-9 text-sm font-medium">
              Làm mới
            </Button>
            {canComplete ? (
              <ActionGuard
                capabilityId="RECON.BATCH.COMPLETE"
                roles={['ADMIN', 'MANAGER', 'Quản lý']}
                permissions={['ReconciliationWriteAccess', 'reconciliation.complete', 'reconciliation.read']}
                allowedModes={['MATERIAL_RECONCILIATION']}
                mode="disable"
                reason="Chỉ khả dụng trong chế độ đối soát nguyên liệu."
              >
                <Button variant="default" size="default" onClick={() => setIsCompleteOpen(true)} className="h-9 text-sm font-medium">
                  Chốt đối soát tuần
                </Button>
              </ActionGuard>
            ) : data && data.status === 'IN_PROGRESS' ? (
              <span className="text-xs text-slate-500 font-medium">
                {needsReviewCount > 0
                  ? `Còn ${needsReviewCount} dòng chênh lệch cần xử lý`
                  : 'Chờ hoàn tất xuất kho các ngày'}
              </span>
            ) : null}
          </>
        }
      />

      {/* Blocker Resolution Strip (Rule UXR-02 & BR-GLOBAL-04) */}
      {data && data.status === 'IN_PROGRESS' && data.weeklyStatus !== 'WEEK_COMPLETE' && (
        <ReconciliationBlockerStrip
          needsReviewCount={needsReviewCount}
          onFilterNeedsReview={() => setLineStatusFilter('NEEDS_REVIEW')}
          onNavigateWarehouse={() => navigate(`/warehouse?view=mrx-daily&batchId=${data.batchId}`)}
        />
      )}

      {/* 5 Operational Queue Metric Cards (Rule D7 / Control Tower) */}
      <ReconciliationQueueCards
        operationalSummary={operationalSummary}
        onNavigateBatchPrep={() => {
          if (isAdmin || hasRole('Coordinator') || hasRole('COORDINATOR') || hasRole('Điều phối')) {
            navigate('/weekly-menu?view=mrx-batch');
          } else {
            setSearchParams((curr) => {
              const next = new URLSearchParams(curr);
              next.set('view', 'audit');
              return next;
            });
          }
        }}
        onFilterAwaitingWarehouse={() => selectBatch(batches.find((b) => b.status === 'READY' || b.status === 'TRANSFERRED'))}
        onNavigateDeltas={() => {
          if (isAdmin || hasRole('WarehouseStaff') || hasRole('Thủ kho')) navigate('/warehouse?view=mrx-issues');
          else setSearchParams((curr) => { const next = new URLSearchParams(curr); next.set('view', 'transactions'); return next; });
        }}
        onFilterVariances={() => setSearchParams((curr) => { const next = new URLSearchParams(curr); next.set('view', 'variances'); return next; })}
        onFilterReadyCompletion={() => selectBatch(batches.find((b) => b.status === 'IN_PROGRESS'))}
      />

      <TelemetrySubbar
        leftControls={<ReconciliationLifecycleStrip status={data?.status} />}
        telemetryPills={data ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Phiên bản lô:</span>
              <strong className="text-slate-900 font-mono">{data.version}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Trạng thái tuần:</span>
              <strong className="text-slate-900">{STATUS_LABELS[data.weeklyStatus || ''] || data.weeklyStatus || '—'}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Dòng ngày:</span>
              <strong className="text-slate-900 font-mono">{data.lines.length}</strong>
            </span>
          </>
        ) : null}
      />

      {mutationError instanceof ApiError && (mutationError.status === 403 || mutationError.status === 409) && (
        <div role="alert" className="px-4 py-2 text-sm border-b bg-rose-50 text-rose-800 border-rose-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            <strong>{mutationError.status === 409 ? 'Xung đột dữ liệu đồng thời' : 'Không có quyền thực hiện thao tác'}</strong>
            <span className="ml-2">{mutationError.message}</span>
          </div>
          {mutationError.status === 409 && <Button variant="outline" size="xs" onClick={() => { setMutationError(null); loadData(); }}>Tải lại dữ liệu mới nhất</Button>}
        </div>
      )}
      {mutationError && (!(mutationError instanceof ApiError) || (mutationError.status !== 403 && mutationError.status !== 409)) && (
        <div role="alert" className="px-4 py-2 text-sm border-b bg-rose-50 text-rose-800 border-rose-200 shrink-0">{mutationError.message}</div>
      )}

      <StateBoundary
        isLoading={isLoading}
        isFetching={isLoading}
        loadingGeometry={{ kind: 'table', columns: 8, rows: 10, columnWidths: ['16%', '28%', '10%', '14%', '14%', '14%', '14%', '14%'] }}
        hasExistingData={activeReportTab === 'lines' ? Boolean(data && data.lines.length > 0) : true}
        error={displayedError}
        isForbidden={isForbidden}
        isModeConflict={isModeConflict}
        modeConflictMessage={isAdmin ? 'Hệ thống đang vận hành ở Chế độ Mặc định (DEFAULT). Theo nguyên tắc an toàn DOM-MODE-1, phân hệ Đối soát chỉ hoạt động khi kích hoạt Chế độ MRX trong phần Thiết lập nâng cao.' : 'Phân hệ Đối soát chỉ hoạt động trong Chế độ MRX. Vui lòng liên hệ Quản trị viên (Admin) để kích hoạt chế độ này.'}
        onSwitchMode={isAdmin ? () => navigate('/settings/advanced?view=mode') : undefined}
        isConflict={isConflict}
        conflictDetails={error?.message}
        onResolveConflict={() => loadData()}
        onRetry={() => loadData()}
        isPartial={Boolean(data && data.lines.length === 0 && data.status !== 'COMPLETED')}
        partialMessage="Backend chỉ trả phạm vi vận hành hoặc chưa có daily review cho ngày đã chọn."
        isEmpty={activeReportTab === 'lines' ? (!data || data.lines.length === 0) : false}
        emptyScenario="prerequisite-blocked"
        emptyTitle="Chưa có dữ liệu đối soát cho ngày đã chọn"
        emptyDescription="Chưa có kế hoạch định lượng nguyên liệu cho khách hàng và ngày đã chọn, hoặc vai trò hiện tại chỉ được xem phạm vi vận hành."
      >
        {activeReportTab === 'lines' && data && (
          <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
            <ReconciliationLinesFilterToolbar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={lineStatusFilter}
              onStatusFilterChange={setLineStatusFilter}
              totalCount={data.lines.length}
              needsReviewCount={needsReviewCount}
              disposedCount={disposedCount}
              matchedCount={matchedCount}
            />
            <DataGrid data={filteredLines} columns={columns} keyExtractor={(row) => row.dailyLineId || row.id} />
          </div>
        )}

        {activeReportTab !== 'lines' && (
          <ReconciliationReportTables
            activeTab={activeReportTab}
            batchId={batchId}
            variancesReport={variancesReport}
            transactionsReport={transactionsReport}
            auditReport={auditReport}
            completedReport={completedReport}
          />
        )}
      </StateBoundary>

      <ReconciliationCompletionModal
        isOpen={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        data={data}
        customerCode={customerCode}
        isSubmitting={isSubmitting}
        onConfirm={handleComplete}
        statusLabels={STATUS_LABELS}
      />

      <ReconciliationDispositionModal
        key={selectedDispositionLine?.dailyLineId ?? 'empty'}
        selectedLine={selectedDispositionLine}
        isOpen={Boolean(selectedDispositionLine)}
        onClose={() => setSelectedDispositionLine(null)}
        onSaved={loadData}
        isCompleted={data?.status === 'COMPLETED'}
      />
    </div>
  );
}
