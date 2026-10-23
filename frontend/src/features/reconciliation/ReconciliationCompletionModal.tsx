import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import type { ReconciliationBatchSummary } from '../../api/reconciliationApi';

interface ReconciliationCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReconciliationBatchSummary | null;
  customerCode: string;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
  statusLabels: Record<string, string>;
}

export function ReconciliationCompletionModal({
  isOpen,
  onClose,
  data,
  customerCode,
  isSubmitting,
  onConfirm,
  statusLabels,
}: ReconciliationCompletionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận hoàn tất lô đối soát tuần"
      description={`Lô ${data?.batchId || ''} · phiên bản v${data?.version ?? '—'}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Quay lại</Button>
          <Button variant="default" size="sm" disabled={isSubmitting} onClick={() => void onConfirm()}>
            {isSubmitting ? 'Đang hoàn tất...' : 'Xác nhận khóa chốt tuần'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700 py-1">
        <p className="leading-relaxed">
          Thao tác này sẽ đóng sổ và khóa bất biến toàn bộ định mức và số lượng xuất kho của tuần phục vụ.
        </p>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
          <div>Khách hàng: <strong>{data?.customerName || customerCode}</strong></div>
          <div>Tổng số dòng nguyên liệu: <strong>{data?.lines.length ?? 0} dòng</strong></div>
          <div>Trạng thái tuần: <strong>{statusLabels[data?.weeklyStatus || ''] || data?.weeklyStatus || 'WEEK_COMPLETE'}</strong></div>
        </div>
        <p className="text-xs text-slate-500">
          Dữ liệu sau khi chốt sẽ chuyển sang trạng thái Hoàn tất vĩnh viễn và sẵn sàng xuất báo cáo cho Kế toán giá thành.
        </p>
      </div>
    </Modal>
  );
}
