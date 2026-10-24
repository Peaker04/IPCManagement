import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import type { MrxMenuChangeInboxItem, MrxMenuChangeResult } from '../../api/mrxApi';

export interface SourceLineOption {
  key: string;
  label: string;
  serviceDate: string;
  shiftName: string;
  dishSlot: string;
  finalServings: number;
}

interface MrxSourceChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  isSubmitting: boolean;
  sourceLines: SourceLineOption[];
  selectedSourceLine: string;
  onSelectedSourceLineChange: (key: string, finalServings: number) => void;
  newServings: string;
  onNewServingsChange: (val: string) => void;
  changeReason: string;
  onChangeReasonChange: (val: string) => void;
  changePreview: MrxMenuChangeResult | null;
  onResetPreview: () => void;
  onPreview: () => void;
  onSave: () => void;
  canPreview: boolean;
}

export function MrxSourceChangeModal({
  isOpen,
  onClose,
  isAdmin,
  isSubmitting,
  sourceLines,
  selectedSourceLine,
  onSelectedSourceLineChange,
  newServings,
  onNewServingsChange,
  changeReason,
  onChangeReasonChange,
  changePreview,
  onResetPreview,
  onPreview,
  onSave,
  canPreview,
}: MrxSourceChangeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Điều chỉnh nguồn MRX"
      description="Xem ảnh hưởng trước khi gửi Admin duyệt hoặc xác nhận trực tiếp."
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (changePreview ? onResetPreview() : onClose())}
          >
            {changePreview ? 'Chỉnh sửa lại' : 'Hủy thay đổi'}
          </Button>
          {!changePreview ? (
            <Button
              variant="default"
              size="sm"
              disabled={isSubmitting || !canPreview}
              onClick={onPreview}
            >
              Xem ảnh hưởng
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              disabled={isSubmitting}
              onClick={onSave}
            >
              {isAdmin ? 'Xác nhận áp dụng' : 'Gửi Admin duyệt'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Dòng nguồn
          <Select
            aria-label="Dòng nguồn điều chỉnh"
            className="mt-1 w-full"
            value={selectedSourceLine}
            options={sourceLines.map((line) => ({ value: line.key, label: line.label }))}
            onChange={(event) => {
              const selected = sourceLines.find((line) => line.key === event.target.value);
              onSelectedSourceLineChange(event.target.value, selected?.finalServings ?? 0);
            }}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Số suất mới
          <Input
            aria-label="Số suất mới"
            className="mt-1"
            type="number"
            min={1}
            value={newServings}
            onChange={(event) => onNewServingsChange(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Lý do điều chỉnh
          <Input
            aria-label="Lý do điều chỉnh"
            className="mt-1"
            value={changeReason}
            onChange={(event) => onChangeReasonChange(event.target.value)}
          />
        </label>
        {changePreview && (
          <div role="status" className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {changePreview.impactLines.map((line) => (
              <p key={`${line.serviceDate}-${line.shiftName}-${line.dishSlot}`}>
                {line.serviceDate} · {line.shiftName}: <strong>{line.currentServings} → {line.newServings} suất</strong>
              </p>
            ))}
            <p className="mt-1">
              Lô MRX bị ảnh hưởng: <strong>{changePreview.affectedReconciliationBatchIds.length}</strong>
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

interface MrxReviewChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewRequest: MrxMenuChangeInboxItem | null;
  changeInbox: MrxMenuChangeInboxItem[];
  onRequestChange: (item: MrxMenuChangeInboxItem) => void;
  rejectionReason: string;
  onRejectionReasonChange: (val: string) => void;
  isSubmitting: boolean;
  onDecide: (approved: boolean) => void;
}

export function MrxReviewChangeModal({
  isOpen,
  onClose,
  reviewRequest,
  changeInbox,
  onRequestChange,
  rejectionReason,
  onRejectionReasonChange,
  isSubmitting,
  onDecide,
}: MrxReviewChangeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duyệt thay đổi nguồn MRX"
      description={reviewRequest ? `${reviewRequest.customerName} · tuần ${reviewRequest.weekStartDate}` : undefined}
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={isSubmitting || !rejectionReason.trim()}
            onClick={() => onDecide(false)}
            className="text-red-700 hover:bg-red-50 hover:text-red-800 border-red-200"
          >
            Từ chối
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isSubmitting}
            onClick={() => onDecide(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            Phê duyệt thay đổi
          </Button>
        </>
      }
    >
      {reviewRequest && (
        <div className="space-y-3 text-sm text-slate-700">
          {changeInbox.length > 1 && (
            <label className="block font-medium text-slate-700">
              Yêu cầu cần duyệt
              <Select
                aria-label="Yêu cầu nguồn cần duyệt"
                className="mt-1 w-full"
                value={reviewRequest.menuAmendmentId}
                options={changeInbox.map((item) => ({
                  value: item.menuAmendmentId,
                  label: `${item.customerName} · ${item.weekStartDate} · ${item.reason}`,
                }))}
                onChange={(event) => {
                  const found = changeInbox.find((item) => item.menuAmendmentId === event.target.value);
                  if (found) onRequestChange(found);
                }}
              />
            </label>
          )}
          <p><strong>Lý do yêu cầu:</strong> {reviewRequest.reason}</p>
          {reviewRequest.impactLines.map((line) => (
            <p key={`${line.serviceDate}-${line.shiftName}-${line.dishSlot}`}>
              {line.serviceDate} · {line.shiftName}: <strong>{line.currentServings} → {line.newServings} suất</strong>
            </p>
          ))}
          <p>Lô MRX bị ảnh hưởng: <strong>{reviewRequest.affectedReconciliationBatchIds.length}</strong></p>
          <label className="block font-medium text-slate-700">
            Lý do từ chối (bắt buộc khi từ chối)
            <Input
              aria-label="Lý do từ chối thay đổi nguồn"
              className="mt-1"
              value={rejectionReason}
              placeholder="Nhập lý do từ chối yêu cầu..."
              onChange={(event) => onRejectionReasonChange(event.target.value)}
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
