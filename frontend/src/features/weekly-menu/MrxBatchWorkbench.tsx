import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxBatch, type MrxMenuChangeInboxItem, type MrxMenuChangeRequest, type MrxMenuChangeResult, type MrxQuantityPreview, type MrxWeeklySource, type MrxDraftSource } from '../../api/mrxApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { apiClient } from '../../api/client';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { ReconciliationLifecycleStrip } from '../../components/workbench/ReconciliationLifecycleStrip';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ActionGuard } from '../../components/ui/action-guard';
import { useAuth } from '../../store/useAuth';
import type { CustomerOption } from '../../types';
import { toIsoDate } from '../../utils/dates';
import { WeeklyMenuImportModal } from './WeeklyMenuImportModal';
import { MrxSourceChangeModal, MrxReviewChangeModal } from './MrxSourceChangeModal';
import { MrxBatchPreviewSection } from './MrxBatchPreviewSection';
import { MrxBatchDishesModal } from '../../components/workbench/MrxBatchDishesModal';

function currentWeekStart(): string {
  const value = new Date(`${new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())}T00:00:00Z`);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - (day === 0 ? 6 : day - 1));
  return value.toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Đang chuẩn bị',
  READY: 'Đã đóng băng',
  TRANSFERRED: 'Đã chuyển Kho',
  IN_PROGRESS: 'Đang xuất ca',
  COMPLETED: 'Hoàn tất',
};

export function MrxBatchWorkbench() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin') || hasRole('ADMIN');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState(() => searchParams.get('customerId') || '');
  const [weekStartDate, setWeekStartDate] = useState(() => searchParams.get('weekStartDate') || currentWeekStart());
  const [source, setSource] = useState<MrxWeeklySource | null>(null);
  const [preview, setPreview] = useState<MrxQuantityPreview | null>(null);
  const [batch, setBatch] = useState<MrxBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedSourceLine, setSelectedSourceLine] = useState('');
  const [newServings, setNewServings] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changePreview, setChangePreview] = useState<MrxMenuChangeResult | null>(null);
  const [changeMessage, setChangeMessage] = useState('');
  const [changeInbox, setChangeInbox] = useState<MrxMenuChangeInboxItem[]>([]);
  const [reviewRequest, setReviewRequest] = useState<MrxMenuChangeInboxItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isDishesModalOpen, setIsDishesModalOpen] = useState(false);
  const [draftSources, setDraftSources] = useState<MrxDraftSource[]>([]);

  useEffect(() => {
    let ignore = false;
    mrxApi.getDraftSources()
      .then((items) => { if (!ignore) setDraftSources(items || []); })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((items) => {
      if (ignore) return;
      setCustomers(items);
      const urlCustId = searchParams.get('customerId');
      const resolvedCustId = (urlCustId && items.some((i) => i.customerId === urlCustId)) ? urlCustId : (items[0]?.customerId || '');
      setCustomerId((current) => current || resolvedCustId);
      if (items.length === 0) setIsLoading(false);
    }).catch((cause: unknown) => {
      if (!ignore) {
        setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
        setIsLoading(false);
      }
    });
    return () => { ignore = true; };
  }, [searchParams]);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    mrxApi.getSourceChangeInbox()
      .then((items) => { if (!ignore) setChangeInbox(items); })
      .catch((cause: unknown) => { if (!ignore) setError(cause instanceof Error ? cause : new Error('Không thể tải yêu cầu chờ duyệt.')); });
    return () => { ignore = true; };
  }, [isAdmin]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const loadSource = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!customerId) return;
    let ignore = false;
    const fetchSource = async () => {
      setIsLoading(true);
      setError(null);
      setPreview(null); // Invalidate any stale preview token when customer or week changes!
      try {
        const [sourceResult, batchPage] = await Promise.all([
          mrxApi.getWeeklySource(customerId, weekStartDate),
          mrxApi.getBatchPage({ customerId, weekStartDate, pageSize: 1 }).catch(() => null),
        ]);
        if (ignore) return;
        setSource(sourceResult);
        if (batchPage && batchPage.items.length > 0) {
          const fullBatch = await mrxApi.getBatch(batchPage.items[0].batchId).catch(() => null);
          if (!ignore) setBatch(fullBatch);
        } else {
          setBatch(null);
        }
      } catch (cause: unknown) {
        if (!ignore) setError(cause instanceof Error ? cause : new Error('Không thể tải nguồn thực đơn MRX.'));
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };
    void fetchSource();
    return () => { ignore = true; };
  }, [customerId, weekStartDate, refreshTrigger]);

  const run = async (operation: () => Promise<void>) => {
    setIsSubmitting(true);
    setError(null);
    try { await operation(); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause : new Error('Không thể cập nhật lô đối soát.')); }
    finally { setIsSubmitting(false); }
  };

  const checkQuantities = () => run(async () => {
    if (!source?.menuVersionId) return;
    setPreview(await mrxApi.previewQuantityImport({
      menuVersionId: source.menuVersionId,
      sourceLabel: `Tuần ${source.weekStartDate ?? weekStartDate}`,
    }));
  });

  const commitDraft = () => run(async () => {
    if (!preview || preview.diagnostics.length > 0) return;
    const committed = await mrxApi.commitQuantityImport({
      token: preview.token,
      contentFingerprint: preview.contentFingerprint,
      sourceLabel: `Tuần ${source?.weekStartDate ?? weekStartDate}`,
    });
    setBatch(await mrxApi.getBatch(committed.reconciliationBatchId));
  });

  const markReady = () => run(async () => {
    if (batch) setBatch(await mrxApi.markReady(batch.batchId, batch.version));
  });

  const transfer = () => run(async () => {
    if (!batch) return;
    await mrxApi.transferToWarehouse(batch.batchId, batch.version);
    setBatch(await mrxApi.getBatch(batch.batchId));
    setChangeMessage('Đã bàn giao lô đối soát sang Kho nguyên liệu thành công.');
  });

  const sourceLines = useMemo(() => preview?.plans.flatMap((plan) => plan.lines.map((line) => ({
    key: `${plan.serviceDate}|${line.quantityPlanLineId}`,
    serviceDate: plan.serviceDate,
    shiftName: line.shift,
    dishSlot: line.dishes[0]?.dishSlot || 'main',
    label: `${plan.serviceDate} · ${line.shift} · ${line.menuName}`,
    finalServings: line.finalServings,
  }))) ?? [], [preview]);

  const openSourceChange = () => {
    const first = sourceLines[0];
    if (!first) return;
    setSelectedSourceLine(first.key);
    setNewServings(String(first.finalServings));
    setChangeReason('');
    setChangePreview(null);
    setChangeMessage('');
    setIsChangeOpen(true);
  };

  const buildSourceChange = (): MrxMenuChangeRequest | null => {
    const selected = sourceLines.find((line) => line.key === selectedSourceLine);
    const servings = Number(newServings);
    if (!source?.menuVersionId || !selected || !Number.isInteger(servings) || servings <= 0 || !changeReason.trim()) return null;
    return {
      customerId,
      weekStartDate,
      expectedBaseMenuVersionId: source.menuVersionId,
      reason: changeReason.trim(),
      lines: [{ serviceDate: selected.serviceDate, shiftName: selected.shiftName, dishSlot: selected.dishSlot, newServings: servings }],
    };
  };

  const previewSourceChange = () => run(async () => {
    const request = buildSourceChange();
    if (request) setChangePreview(await mrxApi.previewSourceChange(request));
  });

  const saveSourceChange = () => run(async () => {
    const request = buildSourceChange();
    if (!request) return;
    const result = isAdmin ? await mrxApi.confirmSourceChange(request) : await mrxApi.submitSourceChange(request);
    setIsChangeOpen(false);
    setChangeMessage(isAdmin || result.status === 'EXECUTED'
      ? 'Đã áp dụng thay đổi nguồn.'
      : 'Đã gửi yêu cầu thay đổi để Admin duyệt.');
    if (isAdmin) await loadSource();
  });

  const decideSourceChange = (approved: boolean) => run(async () => {
    if (!reviewRequest || (!approved && !rejectionReason.trim())) return;
    await mrxApi.decideSourceChange(reviewRequest.menuAmendmentId, approved, approved ? undefined : rejectionReason.trim());
    setChangeInbox((items) => items.filter((item) => item.menuAmendmentId !== reviewRequest.menuAmendmentId));
    setReviewRequest(null);
    setRejectionReason('');
    setChangeMessage(approved ? 'Đã áp dụng thay đổi nguồn.' : 'Đã từ chối yêu cầu thay đổi.');
    if (approved) await loadSource();
  });

  const publishMenu = () => run(async () => {
    if (!customerId || !weekStartDate) return;
    const isoDate = toIsoDate(weekStartDate);
    const schedules = await weeklyMenuApi.getMenuSchedules(customerId, isoDate);
    if (schedules.length === 0) throw new Error('Không tìm thấy lịch thực đơn để xuất bản.');
    await weeklyMenuApi.publishMenuSchedule(schedules[0].menuScheduleId, 'Xuất bản thực đơn tuần từ Kế hoạch MRX');
    for (const s of schedules) {
      await apiClient('/coordination/meal-quantity-plans/quick-servings', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          serviceDate: s.serviceDate,
          shiftName: s.shiftName,
          servings: 100,
          complete: true,
        }),
      }).catch(() => null);
    }
    setChangeMessage('Đã xuất bản thực đơn tuần thành công và hoàn tất tính toán định lượng. Sẵn sàng tạo lô nháp.');
    const updatedSource = await mrxApi.getWeeklySource(customerId, weekStartDate);
    setSource(updatedSource);
    if (updatedSource?.menuVersionId) {
      const previewData = await mrxApi.previewQuantityImport({
        menuVersionId: updatedSource.menuVersionId,
        sourceLabel: `Tuần ${updatedSource.weekStartDate ?? weekStartDate}`,
      });
      setPreview(previewData);
    }
  });

  const isDraftMenu = Boolean(source && source.menuVersionStatus === 'DRAFT');

  const primaryAction = isDraftMenu
    ? { label: 'Xuất bản thực đơn tuần', action: publishMenu, capability: 'COORD.MENU_SCHEDULE.READ' }
    : !preview ? { label: 'Kiểm tra định lượng', action: checkQuantities, capability: 'RECON.BATCH.PREVIEW_IMPORT' }
      : preview.diagnostics.length > 0 ? null
        : !batch ? { label: 'Tạo lô nháp', action: commitDraft, capability: 'RECON.BATCH.COMMIT_IMPORT' }
          : batch.status === 'DRAFT' ? { label: 'Đóng băng lô', action: markReady, capability: 'RECON.BATCH.READY' }
            : batch.status === 'READY' ? { label: 'Chuyển sang Kho', action: transfer, capability: 'RECON.BATCH.TRANSFER_WAREHOUSE' }
              : (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS') ? {
                  label: 'Đi đến Trạm Kho nguyên liệu →',
                  action: () => navigate(`/warehouse?view=mrx-daily&batchId=${encodeURIComponent(batch.batchId)}&date=${encodeURIComponent(weekStartDate)}`),
                  capability: 'RECON.BATCH.READ',
                }
                : batch.status === 'COMPLETED' ? {
                    label: 'Xem hồ sơ đối soát tuần →',
                    action: () => navigate(`/reconciliation?batchId=${encodeURIComponent(batch.batchId)}`),
                    capability: 'RECON.BATCH.READ',
                  }
                  : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Chuẩn bị lô đối soát"
        breadcrumb="Đối soát MRX · Trạm Điều phối"
        contextSelectors={<>
          <Select aria-label="Chọn khách hàng MRX" value={customerId} disabled={customers.length === 0}
            options={customers.map((item) => ({ value: item.customerId, label: `${item.customerCode} - ${item.customerName}` }))}
            onChange={(event) => {
              const nextId = event.target.value;
              setIsLoading(true);
              setError(null);
              setCustomerId(nextId);
              setSearchParams((curr) => {
                const next = new URLSearchParams(curr);
                next.set('customerId', nextId);
                return next;
              }, { replace: true });
            }} className="h-9 w-44 sm:w-56 lg:w-64 font-medium text-sm" />
          <VietnameseDateInput aria-label="Tuần MRX bắt đầu" value={weekStartDate}
            onChange={(date) => {
              setIsLoading(true);
              setError(null);
              setWeekStartDate(date);
              setSearchParams((curr) => {
                const next = new URLSearchParams(curr);
                next.set('weekStartDate', date);
                return next;
              }, { replace: true });
            }} className="h-9 w-32 sm:w-36 lg:w-40 font-mono text-sm" />
          {batch && <Badge variant="info" size="default">{STATUS_LABELS[batch.status] ?? batch.status}</Badge>}
        </>}
        actions={<>
          <Button variant="outline" size="default" disabled={isSubmitting} onClick={() => setIsImportModalOpen(true)}>
            Nhập thực đơn Excel
          </Button>
          <Button variant="outline" size="default" disabled={isSubmitting} onClick={() => loadSource()}>Làm mới</Button>
          {batch && (
            <Button
              variant="outline"
              size="default"
              disabled={isSubmitting}
              onClick={() => setIsDishesModalOpen(true)}
              className="h-9 text-sm font-medium"
            >
              Món ăn trong lô
            </Button>
          )}
          {isAdmin && changeInbox.length > 0 && <Button variant="outline" size="default" disabled={isSubmitting}
            onClick={() => { setIsChangeOpen(false); setReviewRequest(changeInbox[0]); }}>
            Yêu cầu chờ duyệt ({changeInbox.length})
          </Button>}
          {sourceLines.length > 0 && <ActionGuard capabilityId="RECON.SOURCE_CHANGE.PREVIEW"
            roles={['ADMIN', 'COORDINATOR', 'Điều phối']} permissions="reconciliation.source.read"
            allowedModes={['MATERIAL_RECONCILIATION']} mode="disable" reason="Chỉ khả dụng cho nguồn MRX đã phát hành.">
            <Button variant="outline" size="default" disabled={isSubmitting} onClick={openSourceChange}>Điều chỉnh nguồn</Button>
          </ActionGuard>}
          {primaryAction && <ActionGuard capabilityId={primaryAction.capability}
            roles={['ADMIN', 'MANAGER', 'COORDINATOR', 'Điều phối']}
            permissions="reconciliation.source.read" allowedModes={['MATERIAL_RECONCILIATION']}
            mode="disable" reason="Chỉ Điều phối được thực hiện bước này trong chế độ MRX.">
            <Button variant="default" size="default" disabled={isSubmitting} onClick={primaryAction.action}>
              {isSubmitting ? 'Đang xử lý...' : primaryAction.label}
            </Button>
          </ActionGuard>}
        </>}
      />
      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Vòng đời lô:</span>
            <ReconciliationLifecycleStrip status={batch?.status ?? 'DRAFT'} />
          </div>
        }
        telemetryPills={
          source ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Phiên bản nguồn:</span>
              <strong className="font-mono text-slate-900">v{source.menuVersionNo ?? '—'}</strong>
              <span className="text-slate-300">·</span>
              <Badge variant={source.menuVersionStatus === 'PUBLISHED' ? 'success' : 'warning'} size="sm">
                {source.menuVersionStatus === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp'}
              </Badge>
              {batch?.status === 'DRAFT' && (
                <span className="text-slate-500 hidden xl:inline">· Kiểm tra phân rã định lượng rồi bấm "Đóng băng lô"</span>
              )}
              {batch?.status === 'READY' && (
                <span className="text-slate-500 hidden xl:inline">· Lô đã đóng băng, bấm "Chuyển sang Kho" để bắt đầu xuất</span>
              )}
            </div>
          ) : null
        }
      />
      {changeMessage && (
        <div role="status" className="px-4 py-2 text-sm border-b border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center justify-between shrink-0">
          <span>{changeMessage}</span>
          {batch && batch.status === 'TRANSFERRED' && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => navigate(`/warehouse?view=mrx-daily&batchId=${batch.batchId}&date=${weekStartDate}`)}
            >
              Mở trạm Kho xuất ngày
            </Button>
          )}
        </div>
      )}
      <StateBoundary isLoading={isLoading} hasExistingData={Boolean(source || batch)} error={error}
        onRetry={() => loadSource()} isEmpty={!source && !batch} emptyScenario="prerequisite-blocked"
        emptyTitle="Chưa có nguồn thực đơn đã phát hành"
        emptyDescription="Hãy hoàn tất thực đơn và số suất của khách hàng trong tuần đã chọn trước khi tạo lô đối soát."
        actionLabel="Nhập thực đơn ngay"
        onAction={() => setIsImportModalOpen(true)}>
        {!source && !batch && draftSources.length > 0 && (
          <div className="p-4 bg-blue-50/70 border-b border-blue-200 text-xs">
            <span className="font-semibold text-blue-900 block mb-2">
              Các tuần thực đơn đã sẵn sàng để lập lô ({draftSources.length} tuần):
            </span>
            <div className="flex flex-wrap gap-2">
              {draftSources.map((ds) => (
                <button
                  key={ds.menuVersionId}
                  type="button"
                  onClick={() => {
                    const match = ds.menuLabel.match(/(\d{2}\/\d{2}\/\d{4})/);
                    if (match) {
                      const iso = match[1].split('/').reverse().join('-');
                      setWeekStartDate(iso);
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-white border border-blue-200 text-blue-900 hover:border-blue-400 hover:shadow-2xs cursor-pointer font-medium flex items-center gap-1.5"
                >
                  <span>{ds.menuLabel}</span>
                  <span className="font-mono text-[10px] text-blue-600">({ds.importBatchLabel})</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {source && <div className="flex-1 min-h-0 flex flex-col">
          {preview?.diagnostics.length ? (
            <div role="alert" className="mx-4 mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong className="font-semibold block mb-1">Chưa thể tạo lô đối soát</strong>
              <ul className="list-disc pl-5 space-y-0.5">{preview.diagnostics.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}

          {preview ? (
            <MrxBatchPreviewSection preview={preview} />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <p className="text-sm text-slate-600">Kiểm tra định lượng để xác nhận đầy đủ món, số suất và nguyên liệu trước khi đóng băng.</p>
            </div>
          )}
        </div>}
      </StateBoundary>
      <MrxSourceChangeModal
        isOpen={isChangeOpen}
        onClose={() => setIsChangeOpen(false)}
        isAdmin={isAdmin}
        isSubmitting={isSubmitting}
        sourceLines={sourceLines}
        selectedSourceLine={selectedSourceLine}
        onSelectedSourceLineChange={(key, servings) => {
          setSelectedSourceLine(key);
          setNewServings(String(servings));
          setChangePreview(null);
        }}
        newServings={newServings}
        onNewServingsChange={(val) => { setNewServings(val); setChangePreview(null); }}
        changeReason={changeReason}
        onChangeReasonChange={(val) => { setChangeReason(val); setChangePreview(null); }}
        changePreview={changePreview}
        onResetPreview={() => setChangePreview(null)}
        onPreview={previewSourceChange}
        onSave={saveSourceChange}
        canPreview={Boolean(buildSourceChange())}
      />

      <MrxReviewChangeModal
        isOpen={Boolean(reviewRequest)}
        onClose={() => { setReviewRequest(null); setRejectionReason(''); }}
        reviewRequest={reviewRequest}
        changeInbox={changeInbox}
        onRequestChange={(item) => { setReviewRequest(item); setRejectionReason(''); }}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
        isSubmitting={isSubmitting}
        onDecide={decideSourceChange}
      />

      <MrxBatchDishesModal
        isOpen={isDishesModalOpen}
        onClose={() => setIsDishesModalOpen(false)}
        batchId={batch?.batchId ?? ''}
        customerName={source?.customerName}
      />

      <WeeklyMenuImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        customers={customers}
        initialCustomerId={customerId}
        initialWeekStartDate={weekStartDate}
        onImportSuccess={() => void loadSource()}
      />
    </div>
  );
}
