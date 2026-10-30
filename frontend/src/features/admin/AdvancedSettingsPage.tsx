import { useState } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { SplitView } from '../../components/workbench/SplitView';
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
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; status?: number } | null>(null);
  const [modeReason, setModeReason] = useState('');

  const handleSaveMode = async () => {
    setIsSaving(true);
    try {
      await setOperationalMode(selectedMode, modeReason.trim() || undefined);
      setFeedback({ type: 'success', message: `Đã chuyển chế độ vận hành sang ${selectedMode === 'DEFAULT' ? 'Mặc định' : 'Đối soát nguyên liệu'}.` });
      setSelectedModeOverride(null);
      setIsConfirmOpen(false);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chuyển đổi chế độ thất bại.', status: err instanceof ApiError ? err.status : undefined });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      <WorkspaceHeader
        title="Cấu hình hệ thống & Vận hành"
        breadcrumb="Hệ thống · Cấu hình vận hành"
        contextSelectors={
          <WorkspaceHeader.BadgeSlot variant="mode">
            <Badge
              variant={operationalMode === 'MATERIAL_RECONCILIATION' ? 'warning' : 'neutral'}
              size="default"
              className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap animate-in fade-in duration-150"
            >
              Chế độ hiện tại: {operationalMode === 'MATERIAL_RECONCILIATION' ? 'Đối soát MRX' : 'Mặc định (DEFAULT)'}
            </Badge>
          </WorkspaceHeader.BadgeSlot>
        }
        actions={
          <WorkspaceHeader.Actions>
            <Button variant="outline" size="default" onClick={() => setSelectedModeOverride('DEFAULT')} className="h-9 text-sm font-medium">
              Khôi phục mặc định
            </Button>
            <ActionGuard capabilityId="SYS.MODE.CHANGE" roles="ADMIN" permissions="AdminAccess">
              <Button
                variant="default"
                size="default"
                disabled={isSaving || selectedMode === operationalMode}
                onClick={() => setIsConfirmOpen(true)}
                className="h-9 text-sm font-medium"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu cấu hình hệ thống'}
              </Button>
            </ActionGuard>
          </WorkspaceHeader.Actions>
        }
      />

      {feedback && (
        <InlineBanner
          variant={feedback.type === 'error' ? (feedback.status === 409 ? 'conflict' : 'error') : 'success'}
          actionLabel={feedback.status === 409 ? 'Tải lại dữ liệu mới nhất' : undefined}
          onAction={feedback.status === 409 ? () => { setFeedback(null); void reloadOperationalMode(); } : undefined}
          onClose={() => setFeedback(null)}
          className="shrink-0"
        >
          {feedback.message}
        </InlineBanner>
      )}

      <TelemetrySubbar
        leftControls={<span className="text-xs font-semibold text-slate-700">Đang xem: Chế độ vận hành</span>}
        telemetryPills={<span className="text-xs text-slate-500">Chế độ được xác thực và bảo vệ bằng phiên bản đồng thời.</span>}
      />

      <WorkspaceFrame.Body>
        <SplitView
          masterWidthClass="w-7/12"
          master={
            <div className="flex-1 min-h-0 flex flex-col p-6 space-y-6 overflow-auto bg-white">
              <div className="space-y-4 max-w-xl">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Thiết lập Chế độ Vận hành</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Hệ thống phân tách giữa quy trình điều hành suất ăn thông thường và quy trình đối chiếu số liệu nguyên liệu.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedMode === 'DEFAULT' ? 'border-slate-900 bg-slate-50/80 shadow-2xs' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="opMode" checked={selectedMode === 'DEFAULT'} onChange={() => setSelectedModeOverride('DEFAULT')} className="mt-1 h-4 w-4 text-slate-900 accent-slate-900" />
                    <span>
                      <span className="font-semibold text-slate-900 text-sm block">1. Chế độ Mặc định (DEFAULT)</span>
                      <span className="text-xs text-slate-500 leading-relaxed block mt-0.5">Dành cho thực đơn, suất ăn, nhu cầu BOM, KHSX, thu mua, kho và bàn giao Bếp thường nhật.</span>
                    </span>
                  </label>

                  <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedMode === 'MATERIAL_RECONCILIATION' ? 'border-amber-600 bg-amber-50/30 shadow-2xs' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="opMode" checked={selectedMode === 'MATERIAL_RECONCILIATION'} onChange={() => setSelectedModeOverride('MATERIAL_RECONCILIATION')} className="mt-1 h-4 w-4 text-amber-600 accent-amber-600" />
                    <span>
                      <span className="font-semibold text-slate-900 text-sm block">2. Chế độ Đối soát Nguyên liệu (MATERIAL_RECONCILIATION)</span>
                      <span className="text-xs text-slate-500 leading-relaxed block mt-0.5">Dành cho nguồn đóng băng, xuất kho theo ngày, phiếu nấu, actuals, disposition và hoàn tất lô MRX.</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          }
          detail={
            <div className="flex-1 min-h-0 flex flex-col p-6 space-y-4 bg-slate-50/40 text-xs text-slate-700 overflow-auto">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">Quy tắc phân tách quy trình</h4>
              <div className="rounded border border-slate-200 bg-white p-4 space-y-2 text-xs leading-relaxed text-slate-600">
                <p><strong>Phân tách chế độ</strong>: Danh mục món ăn và kho vật lý dùng chung, nhưng quy trình chứng từ, phiếu xuất và kiểm toán được xử lý độc lập.</p>
                <p>Thanh điều hướng hiển thị các trạm làm việc phù hợp với chế độ đang kích hoạt.</p>
              </div>
            </div>
          }
        />
      </WorkspaceFrame.Body>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => { if (!isSaving) setIsConfirmOpen(false); }}
        title="Xác nhận chuyển chế độ vận hành"
        description="Thao tác ảnh hưởng phạm vi chức năng được phép trên toàn hệ thống."
        footer={
          <>
            <Button variant="outline" size="sm" disabled={isSaving} onClick={() => setIsConfirmOpen(false)}>Tiếp tục kiểm tra</Button>
            <Button variant="default" size="sm" disabled={isSaving || (operationalModeReasonRequired && !modeReason.trim())} onClick={handleSaveMode}>
              {isSaving ? 'Đang xử lý...' : 'Xác nhận chuyển chế độ'}
            </Button>
          </>
        }
      >
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
