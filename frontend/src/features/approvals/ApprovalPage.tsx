import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUrlWorkbenchState } from '../../hooks/useUrlWorkbenchState';
import { useOperationalRecovery, executeSafeMutation } from '../../hooks/useOperationalRecovery';
import { FileCheck } from 'lucide-react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { SplitView } from '../../components/workbench/SplitView';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Tabs } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { InlineBanner } from '../../components/ui/inline-banner';
import { ActionGuard } from '../../components/ui/action-guard';
import { serverStateCache } from '../../store/serverStateCache';
import {
  approvalsApi,
  type ApprovalInboxItem,
  type ApprovalHistoryItem,
} from '../../api/approvalsApi';

import { formatVietnameseDateTime } from '../../utils/dates';
import { ApiError } from '../../api/client';

export function ApprovalPage() {
  const { filters, setFilter, selectedId, setSelectedId } = useUrlWorkbenchState();
  const selectedType = filters.type || 'ALL';
  const selectedItemId = selectedId || null;
  const setSelectedType = (type: string) => setFilter('type', type);
  const setSelectedItemId = (id: string | null) => setSelectedId(id);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetcher = useCallback(async (f: { type: string }) => {
    const resp = await approvalsApi.getInbox(f.type);
    setHasLoadedOnce(true);
    serverStateCache.set('snapshot:approvals', {
      selectedType: f.type,
      selectedItemId: selectedItemId || resp[0]?.inboxItemId || null,
      items: resp,
    });
    return resp;
  }, [selectedItemId]);

  const recovery = useOperationalRecovery<ApprovalInboxItem[], { type: string }>({
    queryKey: `approval_inbox_${selectedType}`,
    fetcher,
    initialFilters: { type: selectedType },
    defaultFilters: { type: 'ALL' },
    onResetFilters: () => setSelectedType('ALL'),
  });

  // Sync external URL filter with recovery filter
  const { setFilters } = recovery;
  useEffect(() => {
    setFilters({ type: selectedType });
  }, [selectedType, setFilters]);

  const items = recovery.data || [];
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadData = async () => {
    await recovery.refetch();
  };

  const openConfirmModal = (decision: 'APPROVE' | 'REJECT') => {
    setValidationError(null);
    setMutationError(null);
    setConfirmAction(decision);
  };

  const handleExecuteDecision = async () => {
    if (!selectedItem || !confirmAction) return;
    if (confirmAction === 'REJECT' && !decisionReason.trim()) {
      setValidationError('Vui lòng nhập lý do từ chối hồ sơ (bắt buộc theo BR-GLOBAL-03)');
      return;
    }
    setIsSubmitting(true);
    setValidationError(null);
    const finalReason = decisionReason.trim() || (confirmAction === 'APPROVE' ? 'Phê duyệt hồ sơ theo thẩm quyền' : '');

    await executeSafeMutation({
      mutationFn: async (payload: { targetType: string; targetId: string; decision: 'APPROVE' | 'REJECT'; reason: string }) => {
        return approvalsApi.decide(payload.targetType, payload.targetId, payload.decision, payload.reason);
      },
      payload: {
        targetType: selectedItem.targetType,
        targetId: selectedItem.targetId,
        decision: confirmAction,
        reason: finalReason,
      },
      onSuccess: async () => {
        const actionName = confirmAction === 'APPROVE' ? 'phê duyệt' : 'từ chối';
        const targetCode = selectedItem.targetCode;
        setDecisionReason('');
        setMutationError(null);
        setConfirmAction(null);
        await recovery.refetch();
        setActionBanner({
          type: 'success',
          text: `Đã ${actionName} yêu cầu ${targetCode} thành công!`,
        });
        setTimeout(() => setActionBanner(null), 5000);
      },
      onConflict: (err) => {
        setMutationError(err);
        setConfirmAction(null);
      },
      onError: (err) => {
        setMutationError(err);
      },
    });

    setIsSubmitting(false);
  };

  const filteredItems = useMemo(() => {
    if (selectedType === 'ALL') return items;
    return items.filter((i) => i.targetType === selectedType);
  }, [items, selectedType]);

  const selectedItem = items.find((i) => i.inboxItemId === selectedItemId) || filteredItems[0] || null;

  useEffect(() => {
    if (!selectedItem?.targetId || !selectedItem?.targetType) return;
    let ignore = false;
    approvalsApi.getHistory(selectedItem.targetType, selectedItem.targetId)
      .then((res) => {
        if (!ignore) setHistory(res || []);
      })
      .catch(() => {
        if (!ignore) setHistory([]);
      });
    return () => { ignore = true; };
  }, [selectedItem?.targetId, selectedItem?.targetType]);

  const TYPE_OPTIONS = [
    { value: 'ALL', label: 'Tất cả loại yêu cầu' },
    { value: 'material-demand', label: 'Nhu cầu nguyên liệu' },
    { value: 'purchase-order', label: 'Đơn mua hàng PO' },
    { value: 'warehouse-receipt', label: 'Phiếu nhập kho' },
  ];

  const TAB_ITEMS = [
    { id: 'ALL', label: 'Tất cả yêu cầu', count: items.length },
    { id: 'material-demand', label: 'Nhu cầu nguyên liệu', count: items.filter((i) => i.targetType === 'material-demand').length },
    { id: 'purchase-order', label: 'Đơn mua hàng PO', count: items.filter((i) => i.targetType === 'purchase-order').length },
    { id: 'warehouse-receipt', label: 'Phiếu nhập kho', count: items.filter((i) => i.targetType === 'warehouse-receipt').length },
  ];

  const columns: ColumnDef<ApprovalInboxItem>[] = [
    {
      id: 'targetCode',
      header: 'Mã đối tượng',
      width: '15%',
      minWidth: '95px',
      cell: (row) => <IdentifierText value={row.targetCode} />,
    },
    {
      id: 'title',
      header: 'Tiêu đề yêu cầu phê duyệt',
      width: '28%',
      minWidth: '150px',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.title}</span>
          <span className="text-xs text-slate-400">{row.itemType} · {row.source}</span>
        </div>
      ),
    },
    {
      id: 'submittedBy',
      header: 'Người gửi',
      width: '14%',
      minWidth: '85px',
      cell: (row) => <span className="text-slate-700 text-sm truncate block">{row.submittedBy}</span>,
    },
    {
      id: 'sla',
      header: 'Hạn SLA',
      width: '11%',
      minWidth: '65px',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{formatVietnameseDateTime(row.slaDeadline)}</span>,
    },
    {
      id: 'total',
      header: 'Quy mô',
      width: '18%',
      minWidth: '100px',
      align: 'right',
      cell: (row) => (
        row.totalValue != null ? (
          <Num value={row.totalValue} format="currency" className="font-bold text-slate-900 text-sm" />
        ) : row.totalQuantity != null ? (
          <Num value={row.totalQuantity} format="quantity" suffix=" kg" className="font-bold text-slate-900 text-sm" />
        ) : (
          <span>—</span>
        )
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '14%',
      minWidth: '85px',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'}
          size="sm"
          className="whitespace-nowrap"
        >
          {row.status === 'PENDING' ? 'Chờ duyệt' : row.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Hàng đợi phê duyệt"
        breadcrumb="Phê duyệt · Quy trình vận hành"
        contextSelectors={
          <>
            <Select
              aria-label="Lọc loại yêu cầu phê duyệt"
              options={TYPE_OPTIONS}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-9 w-64 font-medium text-sm"
            />
            <Badge variant="warning" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              {filteredItems.length} yêu cầu chờ xử lý
            </Badge>
          </>
        }
        actions={
          <Button
            variant="outline"
            size="default"
            onClick={() => loadData()}
            className="h-9 text-sm font-medium"
          >
            Làm mới
          </Button>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={TAB_ITEMS}
            activeId={selectedType}
            onChange={(id) => setSelectedType(id)}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Chờ duyệt:</span>
              <strong className="text-slate-900 font-mono font-bold">{filteredItems.length} hồ sơ</strong>
            </span>
          </>
        }
      />

      {mutationError && confirmAction === null && (
        <InlineBanner
          variant={mutationError instanceof ApiError && mutationError.status === 409 ? 'conflict' : 'error'}
          title={mutationError instanceof ApiError && mutationError.status === 409 ? 'Xung đột dữ liệu đồng thời' : 'Không có quyền thực hiện thao tác'}
          actionLabel={mutationError instanceof ApiError && mutationError.status === 409 ? 'Tải lại dữ liệu mới nhất' : undefined}
          onAction={mutationError instanceof ApiError && mutationError.status === 409 ? () => { setMutationError(null); void loadData(); } : undefined}
          onClose={() => setMutationError(null)}
          className="shrink-0"
        >
          {mutationError.message}
        </InlineBanner>
      )}

      {actionBanner && (
        <InlineBanner
          variant={actionBanner.type === 'success' ? 'success' : 'error'}
          onClose={() => setActionBanner(null)}
          className="shrink-0"
        >
          {actionBanner.text}
        </InlineBanner>
      )}

      {/* Zone 3: SplitView (Master 7 cols Queue | Detail 5 cols Decision Drawer) */}
      <StateBoundary
        isLoading={recovery.isLoading && !hasLoadedOnce}
        isFetching={recovery.isFetching && hasLoadedOnce}
        hasExistingData={hasLoadedOnce}
        error={recovery.error}
        onRetry={recovery.handleRetry}
        isEmpty={!recovery.isLoading && filteredItems.length === 0}
        emptyScenario={selectedType !== 'ALL' ? 'filter-empty' : 'true-empty'}
        onResetFilters={() => setSelectedType('ALL')}
        actionLabel={selectedType !== 'ALL' ? 'Xóa bộ lọc (Xem tất cả hồ sơ)' : 'Làm mới hàng đợi'}
        onAction={selectedType !== 'ALL' ? () => setSelectedType('ALL') : recovery.handleRetry}
        contextDomain="approvals"
      >
        <SplitView
          masterWidthClass="w-7/12 2xl:w-8/12"
          master={
            <DataGrid<ApprovalInboxItem>
              data={filteredItems}
              columns={columns}
              keyExtractor={(row) => row.inboxItemId}
              selectedKey={selectedItem?.inboxItemId}
              onRowClick={(row) => setSelectedItemId(row.inboxItemId)}
              minWidth="min-w-[580px]"
            />
          }
          detail={
            selectedItem ? (
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                <div className="h-10 px-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Chi tiết hồ sơ phê duyệt
                  </span>
                  <Badge variant="warning" size="sm">
                    {selectedItem.targetCode}
                  </Badge>
                </div>

                <div className="p-4 space-y-4 flex-1 overflow-auto text-sm text-slate-800">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">{selectedItem.title}</h3>
                    <p className="text-xs text-slate-500">
                      Nguồn: {selectedItem.source} · Người lập: {selectedItem.submittedBy} ({formatVietnameseDateTime(selectedItem.submittedAt)})
                    </p>
                  </div>

                  <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mã chứng từ:</span>
                      <strong className="text-slate-900">{selectedItem.targetCode}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hạn xử lý (SLA):</span>
                      <strong className="text-rose-700 font-bold">{formatVietnameseDateTime(selectedItem.slaDeadline)}</strong>
                    </div>
                    {selectedItem.supplierName && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nhà cung cấp:</span>
                        <strong className="text-slate-900">{selectedItem.supplierName}</strong>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 font-medium">
                      <span className="text-slate-600">Tổng quy mô:</span>
                      <strong className="text-slate-900 text-sm">
                        {selectedItem.totalValue != null
                          ? <Num value={selectedItem.totalValue} format="currency" />
                          : selectedItem.totalQuantity != null
                            ? <Num value={selectedItem.totalQuantity} format="quantity" suffix=" kg" />
                            : '—'}
                      </strong>
                    </div>
                  </div>

                  {selectedItem.materials && selectedItem.materials.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Danh sách vật tư đính kèm ({selectedItem.materials.length} mặt hàng)
                      </h4>
                      <div className="rounded border border-slate-200 divide-y divide-slate-100 text-xs">
                        {selectedItem.materials.map((m, idx) => (
                          <div key={idx} className="flex justify-between px-3 py-2">
                            <span className="font-medium text-slate-900">{m.name}</span>
                            <span className="font-mono text-slate-700">
                              <Num value={m.quantity} format="quantity" suffix={` ${m.unit === 'Kilogram' || m.unit === 'Kilograms' ? 'kg' : m.unit}`} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {history.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Lịch sử phê duyệt & xử lý ({history.length} sự kiện)
                      </h4>
                      <div className="rounded border border-slate-200 divide-y divide-slate-100 text-xs">
                        {history.map((h) => (
                          <div key={h.historyId} className="p-2.5 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">{h.actorName}</span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {formatVietnameseDateTime(h.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge variant={h.action === 'APPROVED' ? 'success' : h.action === 'REJECTED' ? 'danger' : 'neutral'} size="sm">
                                {h.action === 'APPROVED' ? 'Đã duyệt' : h.action === 'REJECTED' ? 'Đã từ chối' : h.action}
                              </Badge>
                              {h.comment && <span className="text-slate-600 truncate">{h.comment}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 pt-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Ghi chú / Căn cứ phê duyệt
                    </label>
                    <Input
                      placeholder="Nhập căn cứ chấp thuận hoặc lý do từ chối hồ sơ..."
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="h-12 px-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
                  <ActionGuard capabilityId="APPR.DECISION" roles={['ADMIN', 'MANAGER', 'QUAN_LY_THU_MUA', 'QUAN_LY_SAN_XUAT']}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => openConfirmModal('REJECT')}
                      className="text-red-600 hover:bg-red-50 border-red-200"
                    >
                      Từ chối hồ sơ
                    </Button>
                  </ActionGuard>
                  <ActionGuard capabilityId="APPR.DECISION" roles={['ADMIN', 'MANAGER', 'QUAN_LY_THU_MUA', 'QUAN_LY_SAN_XUAT']}>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => openConfirmModal('APPROVE')}
                      className="font-semibold text-xs shadow-2xs"
                    >
                      {isSubmitting ? 'Đang duyệt...' : 'Phê duyệt hồ sơ'}
                    </Button>
                  </ActionGuard>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5 text-slate-400"
                >
                  <FileCheck size={20} strokeWidth={1.75} />
                </div>
                <p className="text-xs text-slate-500">Chọn một hồ sơ bên trái để xem nội dung thẩm định</p>
              </div>
            )
          }
        />
      </StateBoundary>

      <Modal
        isOpen={confirmAction !== null}
        onClose={() => {
          if (!isSubmitting) {
            setConfirmAction(null);
            setValidationError(null);
          }
        }}
        isDirty={decisionReason.trim().length > 0}
        title={confirmAction === 'APPROVE' ? 'Xác nhận phê duyệt yêu cầu' : 'Xác nhận từ chối yêu cầu'}
        description={selectedItem ? `${selectedItem.targetCode} · ${selectedItem.title}` : undefined}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => {
                setConfirmAction(null);
                setValidationError(null);
              }}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={isSubmitting}
              onClick={handleExecuteDecision}
              className={confirmAction === 'REJECT' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            >
              {isSubmitting
                ? 'Đang xử lý...'
                : confirmAction === 'APPROVE'
                ? 'Xác nhận phê duyệt'
                : 'Xác nhận từ chối'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          {mutationError && (
            <InlineBanner variant="error" onClose={() => setMutationError(null)}>
              {mutationError.message}
            </InlineBanner>
          )}
          {confirmAction === 'APPROVE' ? (
            <p>
              Bạn có chắc chắn muốn phê duyệt hồ sơ{' '}
              <strong className="text-slate-900 font-mono">{selectedItem?.targetCode}</strong> không? Hành động này sẽ
              cập nhật trạng thái hồ sơ sang <strong className="text-emerald-700">Đã duyệt (APPROVED)</strong> và cho phép
              các bước tiếp theo trong quy trình vận hành.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-slate-600">
                Theo quy chuẩn <strong className="text-slate-900">BR-GLOBAL-03</strong>, việc từ chối yêu cầu bắt buộc phải
                ghi rõ căn cứ / lý do:
              </p>
              <Input
                placeholder="Nhập lý do từ chối hồ sơ (bắt buộc)..."
                value={decisionReason}
                onChange={(e) => {
                  setDecisionReason(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className={`h-9 ${validationError ? 'border-red-500' : ''}`}
                autoFocus
              />
              {validationError && (
                <p className="text-xs text-red-600 font-medium">{validationError}</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
