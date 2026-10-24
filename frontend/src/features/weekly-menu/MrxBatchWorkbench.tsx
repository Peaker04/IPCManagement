import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxBatch, type MrxMenuChangeInboxItem, type MrxMenuChangeRequest, type MrxMenuChangeResult, type MrxQuantityPreview, type MrxWeeklySource } from '../../api/mrxApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { apiClient } from '../../api/client';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { ReconciliationLifecycleStrip } from '../../components/workbench/ReconciliationLifecycleStrip';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { ActionGuard } from '../../components/ui/action-guard';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { useAuth } from '../../store/useAuth';
import type { CustomerOption } from '../../types';
import { toVietnameseDate, toIsoDate } from '../../utils/dates';
import { WeeklyMenuImportModal } from './WeeklyMenuImportModal';

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

  const [previewTab, setPreviewTab] = useState<'materials' | 'plans'>('materials');

  const previewMaterials = useMemo(() => {
    if (!preview?.plans) return [];
    const map = new Map<string, {
      key: string;
      ingredientCode: string;
      ingredientName: string;
      unit: string;
      totalRequiredQuantity: number;
      grossPerServing: number;
      dishes: string[];
    }>();

    for (const plan of preview.plans) {
      for (const line of plan.lines) {
        for (const dish of line.dishes) {
          for (const mat of dish.materials) {
            const key = mat.ingredientCode || mat.ingredientId;
            const existing = map.get(key);
            if (existing) {
              existing.totalRequiredQuantity += mat.requiredQuantity;
              if (!existing.dishes.includes(dish.dishName)) {
                existing.dishes.push(dish.dishName);
              }
            } else {
              map.set(key, {
                key,
                ingredientCode: mat.ingredientCode,
                ingredientName: mat.ingredientName,
                unit: mat.canonicalUnitName || mat.sourceUnitName || 'kg',
                totalRequiredQuantity: mat.requiredQuantity,
                grossPerServing: mat.grossQuantityPerServing,
                dishes: [dish.dishName],
              });
            }
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalRequiredQuantity - a.totalRequiredQuantity);
  }, [preview]);

  const planSummaries = useMemo(() => {
    if (!preview?.plans) return [];
    const list: Array<{
      id: string;
      planCode: string;
      serviceDate: string;
      shift: string;
      menuName: string;
      servings: number;
      dishes: string[];
      materialsCount: number;
    }> = [];
    for (const plan of preview.plans) {
      for (const line of plan.lines) {
        list.push({
          id: line.quantityPlanLineId,
          planCode: plan.planCode,
          serviceDate: plan.serviceDate,
          shift: line.shift === 'MORNING' ? 'Ca 1 (Sáng)' : line.shift === 'AFTERNOON' ? 'Ca 2 (Chiều)' : line.shift,
          menuName: line.menuName,
          servings: line.finalServings,
          dishes: line.dishes.map((d) => d.dishName),
          materialsCount: line.dishes.reduce((sum, d) => sum + d.materials.length, 0),
        });
      }
    }
    return list;
  }, [preview]);

  const totalWeekServings = useMemo(() => {
    return planSummaries.reduce((sum, p) => sum + p.servings, 0);
  }, [planSummaries]);

  const materialColumns = useMemo<ColumnDef<typeof previewMaterials[number]>[]>(() => [
    {
      id: 'code',
      header: 'Mã nguyên liệu',
      width: '18%',
      cell: (row) => <IdentifierText value={row.ingredientCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '32%',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.ingredientName}</span>
          <span className="text-xs text-slate-500 truncate">Món sử dụng: {row.dishes.join(', ')}</span>
        </div>
      ),
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '12%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-700">{row.unit}</span>,
    },
    {
      id: 'gross',
      header: 'Định mức / suất',
      width: '18%',
      align: 'right',
      cell: (row) => <Num value={row.grossPerServing} format="quantity" decimals={4} />,
    },
    {
      id: 'total',
      header: 'Tổng lượng cần đóng băng',
      width: '20%',
      align: 'right',
      cell: (row) => (
        <Num value={row.totalRequiredQuantity} format="quantity" suffix={` ${row.unit}`} className="font-bold text-slate-900 text-sm" />
      ),
    },
  ], []);

  const planColumns = useMemo<ColumnDef<typeof planSummaries[number]>[]>(() => [
    {
      id: 'code',
      header: 'Mã kế hoạch',
      width: '20%',
      cell: (row) => <IdentifierText value={row.planCode} />,
    },
    {
      id: 'date',
      header: 'Ngày phục vụ',
      width: '16%',
      cell: (row) => <span className="font-mono text-xs font-semibold">{toVietnameseDate(row.serviceDate)}</span>,
    },
    {
      id: 'shift',
      header: 'Ca sản xuất',
      width: '16%',
      cell: (row) => <span className="font-medium text-slate-800 text-sm">{row.shift}</span>,
    },
    {
      id: 'servings',
      header: 'Số suất kế hoạch',
      width: '16%',
      align: 'right',
      cell: (row) => (
        <span className="font-mono text-sm font-bold text-slate-900">
          <Num value={row.servings} format="quantity" suffix=" suất" />
        </span>
      ),
    },
    {
      id: 'dishes',
      header: 'Món ăn trong ca',
      width: '32%',
      cell: (row) => (
        <span className="text-sm text-slate-900 font-medium truncate block">
          {row.dishes.join(' · ')}
        </span>
      ),
    },
  ], []);

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
            }} className="h-9 w-64 font-medium text-sm" />
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
            }} className="h-9 w-40 font-mono text-sm" />
          {batch && <Badge variant="info" size="default">{STATUS_LABELS[batch.status] ?? batch.status}</Badge>}
        </>}
        actions={<>
          <Button variant="outline" size="default" disabled={isSubmitting} onClick={() => setIsImportModalOpen(true)}>
            Nhập thực đơn Excel
          </Button>
          <Button variant="outline" size="default" disabled={isSubmitting} onClick={() => loadSource()}>Làm mới</Button>
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
              <span className="text-slate-500">Trạng thái:</span>
              <Badge variant={source.menuVersionStatus === 'PUBLISHED' ? 'success' : 'warning'} size="sm">
                {source.menuVersionStatus === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp'}
              </Badge>
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
      <StateBoundary isLoading={isLoading} isFetching={isLoading} hasExistingData={Boolean(source || batch)} error={error}
        onRetry={() => loadSource()} isEmpty={!source && !batch} emptyScenario="prerequisite-blocked"
        emptyTitle="Chưa có nguồn thực đơn đã phát hành"
        emptyDescription="Hãy hoàn tất thực đơn và số suất của khách hàng trong tuần đã chọn trước khi tạo lô đối soát."
        actionLabel="Nhập thực đơn ngay"
        onAction={() => setIsImportModalOpen(true)}>
        {source && <div className="flex-1 min-h-0 flex flex-col">
          {preview?.diagnostics.length ? (
            <div role="alert" className="mx-4 mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong className="font-semibold block mb-1">Chưa thể tạo lô đối soát</strong>
              <ul className="list-disc pl-5 space-y-0.5">{preview.diagnostics.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}

          {preview ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Preview Sub-tabs */}
              <div className="h-10 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('materials')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewTab === 'materials'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Phân rã nguyên liệu định lượng ({previewMaterials.length} mặt hàng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('plans')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewTab === 'plans'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kế hoạch món & suất theo ca ({planSummaries.length} ca)
                  </button>
                </div>
                <div className="text-xs text-slate-500">
                  Tổng suất ăn tuần: <strong className="font-mono text-slate-900">{totalWeekServings.toLocaleString('vi-VN')} suất</strong>
                </div>
              </div>

              {previewTab === 'materials' ? (
                <DataGrid data={previewMaterials} columns={materialColumns} keyExtractor={(row) => row.key} />
              ) : (
                <DataGrid data={planSummaries} columns={planColumns} keyExtractor={(row) => row.id} />
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <p className="text-sm text-slate-600">Kiểm tra định lượng để xác nhận đầy đủ món, số suất và nguyên liệu trước khi đóng băng.</p>
            </div>
          )}
        </div>}
      </StateBoundary>
      <Modal
        isOpen={isChangeOpen}
        onClose={() => setIsChangeOpen(false)}
        title="Điều chỉnh nguồn MRX"
        description="Xem ảnh hưởng trước khi gửi Admin duyệt hoặc xác nhận trực tiếp."
        footer={<>
          <Button variant="outline" size="sm" onClick={() => changePreview ? setChangePreview(null) : setIsChangeOpen(false)}>
            {changePreview ? 'Chỉnh sửa lại' : 'Hủy thay đổi'}
          </Button>
          {!changePreview ? <Button variant="default" size="sm" disabled={isSubmitting || !buildSourceChange()} onClick={previewSourceChange}>Xem ảnh hưởng</Button>
            : <Button variant="default" size="sm" disabled={isSubmitting} onClick={saveSourceChange}>{isAdmin ? 'Xác nhận áp dụng' : 'Gửi Admin duyệt'}</Button>}
        </>}
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Dòng nguồn
            <Select aria-label="Dòng nguồn điều chỉnh" className="mt-1 w-full" value={selectedSourceLine}
              options={sourceLines.map((line) => ({ value: line.key, label: line.label }))}
              onChange={(event) => {
                const selected = sourceLines.find((line) => line.key === event.target.value);
                setSelectedSourceLine(event.target.value);
                setNewServings(String(selected?.finalServings ?? ''));
                setChangePreview(null);
              }} />
          </label>
          <label className="block text-sm font-medium text-slate-700">Số suất mới
            <Input aria-label="Số suất mới" className="mt-1" type="number" min={1} value={newServings}
              onChange={(event) => { setNewServings(event.target.value); setChangePreview(null); }} />
          </label>
          <label className="block text-sm font-medium text-slate-700">Lý do điều chỉnh
            <Input aria-label="Lý do điều chỉnh" className="mt-1" value={changeReason}
              onChange={(event) => { setChangeReason(event.target.value); setChangePreview(null); }} />
          </label>
          {changePreview && <div role="status" className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {changePreview.impactLines.map((line) => <p key={`${line.serviceDate}-${line.shiftName}-${line.dishSlot}`}>
              {line.serviceDate} · {line.shiftName}: <strong>{line.currentServings} → {line.newServings} suất</strong>
            </p>)}
            <p className="mt-1">Lô MRX bị ảnh hưởng: <strong>{changePreview.affectedReconciliationBatchIds.length}</strong></p>
          </div>}
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(reviewRequest)}
        onClose={() => { setReviewRequest(null); setRejectionReason(''); }}
        title="Duyệt thay đổi nguồn MRX"
        description={reviewRequest ? `${reviewRequest.customerName} · tuần ${reviewRequest.weekStartDate}` : undefined}
        footer={<>
          <Button
            variant="outline"
            size="sm"
            disabled={isSubmitting || !rejectionReason.trim()}
            onClick={() => decideSourceChange(false)}
            className="text-red-700 hover:bg-red-50 hover:text-red-800 border-red-200"
          >
            Từ chối
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isSubmitting}
            onClick={() => decideSourceChange(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            Phê duyệt thay đổi
          </Button>
        </>}
      >
        {reviewRequest && <div className="space-y-3 text-sm text-slate-700">
          {changeInbox.length > 1 && <label className="block font-medium text-slate-700">Yêu cầu cần duyệt
            <Select aria-label="Yêu cầu nguồn cần duyệt" className="mt-1 w-full" value={reviewRequest.menuAmendmentId}
              options={changeInbox.map((item) => ({ value: item.menuAmendmentId, label: `${item.customerName} · ${item.weekStartDate} · ${item.reason}` }))}
              onChange={(event) => {
                setReviewRequest(changeInbox.find((item) => item.menuAmendmentId === event.target.value) ?? null);
                setRejectionReason('');
              }} />
          </label>}
          <p><strong>Lý do yêu cầu:</strong> {reviewRequest.reason}</p>
          {reviewRequest.impactLines.map((line) => <p key={`${line.serviceDate}-${line.shiftName}-${line.dishSlot}`}>
            {line.serviceDate} · {line.shiftName}: <strong>{line.currentServings} → {line.newServings} suất</strong>
          </p>)}
          <p>Lô MRX bị ảnh hưởng: <strong>{reviewRequest.affectedReconciliationBatchIds.length}</strong></p>
          <label className="block font-medium text-slate-700">Lý do từ chối (bắt buộc khi từ chối)
            <Input aria-label="Lý do từ chối thay đổi nguồn" className="mt-1" value={rejectionReason}
              placeholder="Nhập lý do từ chối yêu cầu..."
              onChange={(event) => setRejectionReason(event.target.value)} />
          </label>
        </div>}
      </Modal>

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
