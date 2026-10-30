import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { ReconciliationLifecycleStrip } from '../../components/workbench/ReconciliationLifecycleStrip';
import { ActionGuard } from '../../components/ui/action-guard';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { InlineBanner } from '../../components/ui/inline-banner';
import { weekStartFor } from '../../utils/dates';
import { WeeklyMenuImportModal } from './WeeklyMenuImportModal';
import { WeeklyScheduleEditorModal } from './WeeklyScheduleEditorModal';
import { weeklyMenuApi, type WeeklyMenuData } from '../../api/weeklyMenuApi';
import { MrxSourceChangeModal, MrxReviewChangeModal } from './MrxSourceChangeModal';
import { MrxBatchPreviewSection } from './MrxBatchPreviewSection';
import { MrxBatchDishesModal } from '../../components/workbench/MrxBatchDishesModal';
import { DishBomBatchImportModal } from '../admin/DishBomBatchImportModal';
import { MrxBatchHeaderBranch } from './branches/MrxBatchHeaderBranch';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { useMrxBatchWorkspace } from './hooks/useMrxBatchWorkspace';
import { MRX_STATUS_LABELS } from '../../constants/mrxConstants';

const STATUS_LABELS: Record<string, string> = {
  ...MRX_STATUS_LABELS,
  DRAFT: 'Đang chuẩn bị',
  READY: 'Đã đóng băng',
  TRANSFERRED: 'Đã chuyển Kho',
  IN_PROGRESS: 'Đang xuất ca',
  COMPLETED: 'Hoàn tất',
};

export function MrxBatchWorkbench() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editorMenuData, setEditorMenuData] = useState<WeeklyMenuData | null>(null);
  const [isBatchBomModalOpen, setIsBatchBomModalOpen] = useState(false);

  const {
    isAdmin,
    customers,
    customerId,
    setCustomerId,
    weekStartDate,
    setWeekStartDate,
    source,
    batch,
    preview,
    stateProps,
    isSubmitting,
    actionError,
    setActionError,
    changeMessage,
    setChangeMessage,
    changeInbox,
    reviewRequest,
    setReviewRequest,
    rejectionReason,
    setRejectionReason,
    isChangeOpen,
    setIsChangeOpen,
    isImportModalOpen,
    setIsImportModalOpen,
    isDishesModalOpen,
    setIsDishesModalOpen,
    isRefreshing,
    handleRefresh,
    openSourceChange,
    sourceLines,
    selectedSourceLine,
    setSelectedSourceLine,
    newServings,
    setNewServings,
    changeReason,
    setChangeReason,
    changePreview,
    setChangePreview,
    buildSourceChange,
    previewSourceChange,
    saveSourceChange,
    decideSourceChange,
    loadSource,
    checkQuantities,
    primaryAction,
  } = useMrxBatchWorkspace();

  const handleOpenEditor = async () => {
    const cust = customers.find((c) => c.customerId === customerId);
    if (!cust?.customerCode || !weekStartDate) return;
    try {
      const data = await weeklyMenuApi.getWeeklyMenuData(cust.customerCode, weekStartDate);
      setEditorMenuData(data);
      setIsEditorModalOpen(true);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err : new Error('Không thể tải dữ liệu lịch thực đơn tuần.'));
    }
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxBatchHeaderBranch
        customers={customers}
        customerId={customerId}
        onSelectCustomer={(nextId) => {
          if (nextId === customerId) return;
          setActionError(null);
          const matched = customers.find((c) => c.customerId === nextId);
          setCustomerId(nextId);
          workspaceSessionStore.setScope({
            customerId: nextId,
            customerCode: matched?.customerCode || '',
            customerName: matched?.customerName || '',
          });
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('customerId', nextId);
            return next;
          }, { replace: true });
        }}
        weekStartDate={weekStartDate}
        onSelectWeekStartDate={(date) => {
          const monday = weekStartFor(date);
          if (monday === weekStartDate) return;
          setActionError(null);
          setWeekStartDate(monday);
          workspaceSessionStore.setScope({ weekStartDate: monday, serviceDate: monday });
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('weekStartDate', monday);
            return next;
          }, { replace: true });
        }}
        batch={batch}
        source={source}
        statusLabels={STATUS_LABELS}
        isSubmitting={isSubmitting}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        primaryAction={primaryAction}
      />

      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Vòng đời lô:</span>
            {batch ? (
              <ReconciliationLifecycleStrip status={batch.status} />
            ) : (
              <span className="text-xs font-medium text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Chưa khởi tạo lô đối soát
              </span>
            )}
          </div>
        }
        telemetryPills={
          source ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Phiên bản nguồn:</span>
              <strong className="font-mono text-slate-900">v{source.menuVersionNo ?? '—'}</strong>
              <span className="text-slate-300">·</span>
              <Badge
                variant={
                  source.menuVersionStatus === 'PUBLISHED' || source.menuVersionStatus === 'ACTIVE'
                    ? 'success'
                    : 'warning'
                }
                size="sm"
              >
                {source.menuVersionStatus === 'PUBLISHED' || source.menuVersionStatus === 'ACTIVE'
                  ? 'Đã xuất bản'
                  : 'Bản nháp'}
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
        rightActions={
          <div className="flex items-center gap-1.5">
            {source && (
              <Button
                variant="outline"
                size="xs"
                disabled={isSubmitting || Boolean(batch && batch.status !== 'DRAFT')}
                onClick={handleOpenEditor}
                aria-label="Chỉnh sửa lịch tuần"
                title={
                  batch && batch.status !== 'DRAFT'
                    ? 'Lô đối soát đã bàn giao sang Kho / Đang đối chiếu. Mọi thay đổi số suất ăn phải thực hiện qua chức năng "Điều chỉnh nguồn MRX".'
                    : undefined
                }
                className="h-7 text-xs font-medium"
              >
                <span className="hidden 2xl:inline">Chỉnh sửa lịch tuần</span>
                <span className="2xl:hidden">Sửa lịch tuần</span>
              </Button>
            )}
            {batch && (
              <Button
                variant="outline"
                size="xs"
                disabled={isSubmitting}
                onClick={() => setIsDishesModalOpen(true)}
                aria-label="Món ăn trong lô"
                className="h-7 text-xs font-medium"
              >
                <span className="hidden 2xl:inline">Món ăn trong lô</span>
                <span className="2xl:hidden">Món trong lô</span>
              </Button>
            )}
            {source && (source.menuVersionStatus === 'PUBLISHED' || source.menuVersionStatus === 'ACTIVE') && (
              <Button
                variant="outline"
                size="xs"
                disabled={isSubmitting}
                onClick={() => setIsImportModalOpen(true)}
                aria-label="Nhập thực đơn Excel"
                className="h-7 text-xs font-medium"
              >
                <span className="hidden 2xl:inline">Nhập thực đơn Excel</span>
                <span className="2xl:hidden">Nhập Excel</span>
              </Button>
            )}
            {sourceLines.length > 0 && (
              <ActionGuard
                capabilityId="RECON.SOURCE_CHANGE.PREVIEW"
                roles={['ADMIN', 'COORDINATOR', 'Điều phối']}
                permissions="reconciliation.source.read"
                allowedModes={['MATERIAL_RECONCILIATION']}
                mode="disable"
                reason="Chỉ khả dụng cho nguồn MRX đã phát hành."
              >
                <Button
                  variant="outline"
                  size="xs"
                  disabled={isSubmitting}
                  onClick={openSourceChange}
                  aria-label="Điều chỉnh nguồn"
                  className="h-7 text-xs font-medium"
                >
                  <span className="hidden 2xl:inline">Điều chỉnh nguồn</span>
                  <span className="2xl:hidden">Đổi nguồn</span>
                </Button>
              </ActionGuard>
            )}
            {isAdmin && changeInbox.length > 0 && (
              <Button
                variant="outline"
                size="xs"
                disabled={isSubmitting}
                onClick={() => {
                  setIsChangeOpen(false);
                  setReviewRequest(changeInbox[0]);
                }}
                className="h-7 text-xs font-medium"
              >
                Yêu cầu chờ duyệt ({changeInbox.length})
              </Button>
            )}
          </div>
        }
      />

      {changeMessage && (
        <InlineBanner
          variant="success"
          title="Thành công"
          onClose={() => setChangeMessage('')}
          className="shrink-0 rounded-none border-x-0"
        >
          <div className="flex items-center justify-between w-full">
            <span>{changeMessage}</span>
            {batch && (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/warehouse?view=mrx-daily&batchId=${batch.batchId}&date=${weekStartDate}`)}
              >
                Mở trạm Kho xuất ngày
              </Button>
            )}
          </div>
        </InlineBanner>
      )}

      {actionError && (
        <InlineBanner
          variant="error"
          title="Lỗi thao tác"
          onClose={() => setActionError(null)}
          className="shrink-0 rounded-none border-x-0"
        >
          {actionError.message}
        </InlineBanner>
      )}

      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          onRetry={() => loadSource(true)}
          loadingVariant="matrix"
          actionLabel="Nhập thực đơn Excel ngay"
          onAction={() => setIsImportModalOpen(true)}
        >
          {source && (
            <div className="flex-1 min-h-0 flex flex-col">
              {preview?.diagnostics.length ? (
                <div role="alert" className="mx-4 mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="flex items-center justify-between mb-1.5">
                    <strong className="font-semibold block">Chưa thể tạo lô đối soát</strong>
                    <span className="text-xs text-amber-800 font-medium">Cần bổ sung định mức nguyên liệu</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {preview.diagnostics.map((item, idx) => (
                      <li key={idx} className="text-xs">
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2.5 pt-2 border-t border-amber-200/80 flex items-center justify-between">
                    <span className="text-xs text-amber-800">
                      Vào mục <strong>Quản trị dữ liệu · Định mức BOM</strong> để bổ sung định mức cho các món trên.
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => setIsBatchBomModalOpen(true)}
                        className="text-xs bg-amber-700 text-white hover:bg-amber-800 font-semibold"
                      >
                        Nhập BOM Excel cho các món thiếu
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => navigate('/admin-data?view=bom')}
                        className="text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                      >
                        Mở quản lý định mức BOM →
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {preview ? (
                <MrxBatchPreviewSection
                  preview={preview}
                  customerCode={source?.customerCode}
                  customerName={source?.customerName}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-700">Kiểm tra định lượng để xác nhận đầy đủ món, số suất và nguyên liệu trước khi đóng băng.</p>
                  <Button
                    variant="default"
                    size="default"
                    disabled={isSubmitting}
                    onClick={checkQuantities}
                    className="shadow-sm font-medium"
                  >
                    Kiểm tra định lượng ngay
                  </Button>
                </div>
              )}
            </div>
          )}
        </StateBoundary>
      </WorkspaceFrame.Body>

      <WeeklyMenuImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        customers={customers}
        initialCustomerId={customerId}
        initialWeekStartDate={weekStartDate}
        onImportSuccess={() => loadSource(true)}
      />

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
        onNewServingsChange={(val) => {
          setNewServings(val);
          setChangePreview(null);
        }}
        changeReason={changeReason}
        onChangeReasonChange={(val) => {
          setChangeReason(val);
          setChangePreview(null);
        }}
        changePreview={changePreview}
        onResetPreview={() => setChangePreview(null)}
        onPreview={previewSourceChange}
        onSave={saveSourceChange}
        canPreview={Boolean(buildSourceChange())}
      />

      <MrxReviewChangeModal
        isOpen={Boolean(reviewRequest)}
        onClose={() => {
          setReviewRequest(null);
          setRejectionReason('');
        }}
        reviewRequest={reviewRequest}
        changeInbox={changeInbox}
        onRequestChange={(item) => {
          setReviewRequest(item);
          setRejectionReason('');
        }}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
        isSubmitting={isSubmitting}
        onDecide={decideSourceChange}
      />

      <MrxBatchDishesModal
        isOpen={isDishesModalOpen}
        onClose={() => setIsDishesModalOpen(false)}
        batchId={batch?.batchId || ''}
        customerName={customers.find((c) => c.customerId === customerId)?.customerName || ''}
      />

      {editorMenuData && (
        <WeeklyScheduleEditorModal
          isOpen={isEditorModalOpen}
          onClose={() => setIsEditorModalOpen(false)}
          data={editorMenuData}
          onSaveSuccess={() => {
            setIsEditorModalOpen(false);
            void loadSource(true);
          }}
        />
      )}

      <DishBomBatchImportModal
        isOpen={isBatchBomModalOpen}
        onClose={() => setIsBatchBomModalOpen(false)}
        initialCustomerId={customerId}
        initialTemplateType="missing"
        missingDishesDiagnostics={preview?.diagnostics}
        onImportSuccess={() => void loadSource(true)}
      />
    </WorkspaceFrame.Root>
  );
}
