import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { InlineBanner } from '../../components/ui/inline-banner';
import type { ReconciliationBatchSummary } from '../../api/reconciliationApi';

interface ReconciliationCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReconciliationBatchSummary | null;
  customerCode: string;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
  statusLabels: Record<string, string>;
  error?: Error | null;
  needsReviewCount?: number;
  onViewNeedsReview?: () => void;
}

export function ReconciliationCompletionModal({
  isOpen,
  onClose,
  data,
  customerCode,
  isSubmitting,
  onConfirm,
  statusLabels,
  error,
  needsReviewCount,
  onViewNeedsReview,
}: ReconciliationCompletionModalProps) {
  const isBlocked = (needsReviewCount != null && needsReviewCount > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận hoàn tất lô đối soát tuần"
      description={`Lô ${data?.batchId || ''} · phiên bản v${data?.version ?? '—'}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Quay lại</Button>
          <Button
            variant="default"
            size="sm"
            loading={isSubmitting}
            loadingText="Đang hoàn tất..."
            disabled={isSubmitting}
            onClick={() => void onConfirm()}
          >
            Xác nhận khóa chốt tuần
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700 py-1">
        {error && (
          <InlineBanner variant="error">
            {error.message}
          </InlineBanner>
        )}

        {isBlocked && (
          <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-900 text-xs space-y-2">
            <div className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Còn {needsReviewCount} dòng chênh lệch chưa có quyết định xử lý</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Quy chuẩn đối soát bắt buộc toàn bộ các dòng có sai lệch xuất - nhu cầu phải được giải trình và lưu hướng xử lý trước khi thực hiện khóa sổ tuần.
            </p>
            {onViewNeedsReview && (
              <Button
                variant="outline"
                size="xs"
                onClick={onViewNeedsReview}
                className="bg-white text-amber-900 border-amber-300 hover:bg-amber-100 font-medium"
              >
                Lọc xem {needsReviewCount} dòng cần giải trình ngay
              </Button>
            )}
          </div>
        )}

        <p className="leading-relaxed">
          Thao tác này sẽ đóng sổ và khóa bất biến toàn bộ định mức và số lượng xuất kho của tuần phục vụ.
        </p>
        <div aria-label="Thông tin xác nhận khóa chốt tuần" className="rounded border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
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
