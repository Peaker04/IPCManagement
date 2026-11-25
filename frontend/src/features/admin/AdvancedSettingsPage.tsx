import { useState } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { InlineBanner } from '../../components/ui/inline-banner';
import { ActionGuard } from '../../components/ui/action-guard';
import { useAuth } from '../../store/useAuth';
import type { OperationalMode } from '../../types';
import { ApiError } from '../../api/client';

export function AdvancedSettingsPage() {
  const {
    operationalMode,
    operationalModeVersion,
    operationalModeReasonRequired,
    reloadOperationalMode,
    setOperationalMode,
  } = useAuth();
  const [selectedModeOverride, setSelectedModeOverride] = useState<OperationalMode | null>(null);
  const selectedMode = selectedModeOverride ?? operationalMode;
  const [pending, setPending] = useState<'save' | 'reload' | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmationError, setConfirmationError] = useState<{ message: string; needsReload: boolean } | null>(null);
  const [modeReason, setModeReason] = useState('');
  const canConfirm = !pending && !confirmationError?.needsReload && selectedMode !== operationalMode
    && (!operationalModeReasonRequired || Boolean(modeReason.trim()));

  const handleSaveMode = async () => {
    if (!canConfirm) return;
    setPending('save');
    setConfirmationError(null);
    setSuccessMessage('');
    try {
      await setOperationalMode(selectedMode, modeReason.trim() || undefined);
      setSuccessMessage(`Đã chuyển chế độ vận hành sang ${selectedMode === 'DEFAULT' ? 'Mặc định' : 'Đối soát nguyên liệu'}.`);
      setSelectedModeOverride(null);
      setModeReason('');
      setIsConfirmOpen(false);
    } catch (err) {
      setConfirmationError({ message: err instanceof Error ? err.message : 'Chuyển đổi chế độ thất bại.', needsReload: err instanceof ApiError && err.status === 409 });
    } finally {
      setPending(null);
    }
  };

  const handleReloadMode = async () => {
    setPending('reload');
    try {
      await reloadOperationalMode();
      setConfirmationError(null);
    } catch (err) {
      setConfirmationError({ message: err instanceof Error ? err.message : 'Không thể tải chế độ vận hành.', needsReload: true });
    } finally {
      setPending(null);
    }
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      <WorkspaceHeader
        responsive
        title="Cấu hình hệ thống & Vận hành"
        breadcrumb="Hệ thống · Cấu hình vận hành"
        contextSelectors={
          <WorkspaceHeader.BadgeSlot variant="mode">
            <Badge
              variant={operationalMode === 'MATERIAL_RECONCILIATION' ? 'warning' : 'neutral'}
              size="default"
              className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap"
            >
              Chế độ hiện tại: {operationalMode === 'MATERIAL_RECONCILIATION' ? 'Đối soát MRX' : 'Mặc định'}
            </Badge>
          </WorkspaceHeader.BadgeSlot>
        }
        actions={
          <WorkspaceHeader.Actions>
            <ActionGuard capabilityId="SYS.MODE.CHANGE" roles="ADMIN" permissions="AdminAccess">
              <Button
                variant="default"
                size="default"
                disabled={Boolean(pending) || selectedMode === operationalMode}
                onClick={() => setIsConfirmOpen(true)}
                className="h-9 text-sm font-medium"
              >
                Chuyển chế độ
              </Button>
            </ActionGuard>
          </WorkspaceHeader.Actions>
        }
      />

      <WorkspaceFrame.Body className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {successMessage && (
          <InlineBanner variant="success" onClose={() => setSuccessMessage('')} className="shrink-0">
            {successMessage}
          </InlineBanner>
        )}

        <fieldset className="min-w-0 max-w-xl space-y-3 p-4 sm:p-6">
          <legend className="sr-only">Chọn chế độ vận hành</legend>
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedMode === 'DEFAULT' ? 'border-slate-900 bg-slate-50/80 shadow-2xs' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" name="opMode" checked={selectedMode === 'DEFAULT'} onChange={() => setSelectedModeOverride('DEFAULT')} className="mt-1 h-4 w-4 text-slate-900 accent-slate-900" />
            <span>
              <span className="font-semibold text-slate-900 text-sm block">Chế độ Mặc định</span>
              <span className="text-xs text-slate-500 leading-relaxed block mt-0.5">Lập thực đơn, kế hoạch sản xuất, thu mua, xuất nhập kho và bàn giao nguyên liệu cho Bếp.</span>
            </span>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedMode === 'MATERIAL_RECONCILIATION' ? 'border-amber-600 bg-amber-50/30 shadow-2xs' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" name="opMode" checked={selectedMode === 'MATERIAL_RECONCILIATION'} onChange={() => setSelectedModeOverride('MATERIAL_RECONCILIATION')} className="mt-1 h-4 w-4 text-amber-600 accent-amber-600" />
            <span>
              <span className="font-semibold text-slate-900 text-sm block">Chế độ Đối soát nguyên liệu</span>
              <span className="text-xs text-slate-500 leading-relaxed block mt-0.5">Đóng băng nguồn, xuất kho theo ngày, lập phiếu nấu, xử lý chênh lệch và chốt lô đối soát.</span>
            </span>
          </label>
        </fieldset>
      </WorkspaceFrame.Body>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => { if (!pending) setIsConfirmOpen(false); }}
        title="Xác nhận chuyển chế độ vận hành"
        description={`Chuyển sang ${selectedMode === 'DEFAULT' ? 'Mặc định' : 'Đối soát nguyên liệu'} sẽ đổi phạm vi công việc trên toàn hệ thống. Chứng từ và nhật ký lưu riêng theo chế độ.`}
        footer={
          <>
            <Button variant="outline" size="sm" disabled={Boolean(pending)} onClick={() => setIsConfirmOpen(false)}>Quay lại</Button>
            <Button variant="default" size="sm" disabled={!canConfirm} onClick={handleSaveMode}>
              {pending === 'save' ? 'Đang xử lý...' : 'Xác nhận chuyển chế độ'}
            </Button>
          </>
        }
      >
        {confirmationError && <InlineBanner variant={confirmationError.needsReload ? 'conflict' : 'error'}
          actionLabel={confirmationError.needsReload && !pending ? 'Tải lại dữ liệu mới nhất' : undefined}
          onAction={handleReloadMode}>
          {pending === 'reload' ? 'Đang tải phiên bản mới nhất…' : confirmationError.message}
        </InlineBanner>}
        {!confirmationError && selectedMode === operationalMode && <InlineBanner variant="info">
          Chế độ đã chọn đang được áp dụng trên máy chủ.
        </InlineBanner>}
        {operationalModeReasonRequired ? (
          <div className="space-y-2">
            <label htmlFor="mode-change-reason" className="text-sm font-medium text-slate-700">Lý do chuyển chế độ</label>
            <Input id="mode-change-reason" value={modeReason} onChange={(event) => setModeReason(event.target.value)} />
            <p className="text-xs text-slate-500">Bắt buộc nhập lý do vì hệ thống ghi nhận công việc đang xử lý. Phiên bản: {operationalModeVersion ?? 'chưa tải'}.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-700">Hãy kiểm tra lại phạm vi trước khi tiếp tục. Hành động sẽ được thực hiện ngay sau xác nhận.</p>
        )}
      </Modal>
    </WorkspaceFrame.Root>
  );
}
