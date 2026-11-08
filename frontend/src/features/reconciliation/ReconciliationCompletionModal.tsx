import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { InlineBanner } from '../../components/ui/inline-banner';
import { toVietnameseDate } from '../../utils/dates';
import type { ReconciliationBatchSummary } from '../../api/reconciliationApi';

interface ReconciliationCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReconciliationBatchSummary | null;
  customerCode: string;
  weekStartDate?: string;
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
  weekStartDate,
  isSubmitting,
  onConfirm,
  statusLabels,
  error,
  needsReviewCount,
  onViewNeedsReview,
}: ReconciliationCompletionModalProps) {
  const week = data?.weekStartDate || weekStartDate;
  const isBlocked = (needsReviewCount != null && needsReviewCount > 0);
  const canConfirm = Boolean(data && data.status === 'IN_PROGRESS' && data.weeklyStatus === 'WEEK_COMPLETE' && !isBlocked);
  const weeklyStatusLabel = data?.weeklyStatus ? statusLabels[data.weeklyStatus] ?? 'Trạng thái chưa nhận diện' : 'Chưa xác định';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isSubmitting) onClose(); }}
      title="Xác nhận hoàn tất lô đối soát tuần"
      description={week ? `Tuần bắt đầu ${toVietnameseDate(week)}` : 'Chưa xác định tuần đối soát'}
      footer={
        <>
          <Button variant="outline" size="sm" disabled={isSubmitting} onClick={onClose}>Quay lại</Button>
          <Button
            variant="default"
            size="sm"
            loading={isSubmitting}
            loadingText="Đang hoàn tất..."
            disabled={isSubmitting || !canConfirm}
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
          <InlineBanner variant="warning" actionLabel={onViewNeedsReview ? 'Xem dòng cần xử lý' : undefined} onAction={onViewNeedsReview}>
            Còn {needsReviewCount} dòng chênh lệch chưa có quyết định xử lý. Xem lại các dòng này trước khi chốt tuần.
          </InlineBanner>
        )}

        <p className="leading-relaxed">
          Sau khi chốt, lô chuyển sang Hoàn tất. Bạn không thể sửa nguồn hoặc xuất bổ sung vào lô này.
        </p>
        <div aria-label="Thông tin xác nhận khóa chốt tuần" className="rounded border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
          <div>Khách hàng: <strong>{data?.customerName || customerCode}</strong></div>
          <div>Trạng thái tuần: <strong>{weeklyStatusLabel}</strong></div>
        </div>
        {!canConfirm && !isBlocked && <InlineBanner variant="warning">Chưa đủ điều kiện chốt tuần. Đóng hộp thoại và kiểm tra tiến độ xuất kho của lô.</InlineBanner>}
      </div>
    </Modal>
  );
}
