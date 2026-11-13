import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Num } from '../../components/ui/num';
import { executeSafeMutation } from '../../hooks/useOperationalRecovery';
import { ApiError } from '../../api/client';
import { mrxApi, type MrxDispositionCategory } from '../../api/mrxApi';
import { MRX_DISPOSITION_CATEGORY_LABELS } from '../../constants/mrxConstants';
import type { ReconciliationLineItem } from '../../api/reconciliationApi';

interface ReconciliationDispositionModalProps {
  selectedLine: ReconciliationLineItem | null;
  selectedLines?: ReconciliationLineItem[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  isCompleted: boolean;
}

export function ReconciliationDispositionModal({
  selectedLine,
  selectedLines,
  isOpen,
  onClose,
  onSaved,
  isCompleted,
}: ReconciliationDispositionModalProps) {
  const isBulk = Boolean(selectedLines && selectedLines.length > 1);
  const targetLines = isBulk ? selectedLines! : selectedLine ? [selectedLine] : [];
  const primaryLine = targetLines[0] || null;

  const [categories, setCategories] = useState<MrxDispositionCategory[]>([]);
  const [categoryError, setCategoryError] = useState<Error | null>(null);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [category, setCategory] = useState(primaryLine?.disposition?.category || 'ACCEPTED_VARIANCE');
  const [reason, setReason] = useState(primaryLine?.disposition?.reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [succeededLineIds, setSucceededLineIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!isOpen || isCompleted) return;
    let ignore = false;
    mrxApi.getDispositionCategories()
      .then((data) => {
        if (ignore) return;
        setCategories(data);
        setCategoryError(null);
        setCategory((current) => data.some((option) => option.value === current) ? current : data[0]?.value ?? '');
      })
      .catch((cause: unknown) => {
        if (!ignore) setCategoryError(cause instanceof Error ? cause : new Error('Không thể tải danh mục xử lý.'));
      });
    return () => { ignore = true; };
  }, [isOpen, isCompleted, categoryRetry]);

  const handleSave = async () => {
    if (isSubmitting || isCompleted || categoryError || !categories.some((option) => option.value === category) || targetLines.length === 0 || targetLines.some((line) => (line.issuedRequiredDifference ?? 0) <= 0) || !reason.trim()) return;
    setIsSubmitting(true);
    setError(null);

    let anySucceeded = succeededLineIds.size > 0;
    await executeSafeMutation({
      mutationFn: async () => {
        for (const line of targetLines) {
          const lineKey = line.dailyLineId || line.id;
          if (lineKey && !succeededLineIds.has(lineKey)) {
            if (line.dailyLineId) {
              await mrxApi.setDailyDisposition(line.dailyLineId, {
                category,
                reason: reason.trim(),
                expectedVersion: line.disposition?.version,
              });
            } else if (line.id) {
              await mrxApi.setLineDisposition(line.id, {
                category,
                reason: reason.trim(),
                expectedVersion: line.disposition?.version,
              });
            }
            anySucceeded = true;
            setSucceededLineIds((prev) => new Set(prev).add(lineKey));
          }
        }
        return true;
      },
      payload: { category, reason: reason.trim() },
      onSuccess: async () => {
        onClose();
        await onSaved();
      },
      onConflict: (err) => {
        setError(err);
        if (anySucceeded) void onSaved();
      },
      onError: (err) => {
        setError(err);
        if (anySucceeded) void onSaved();
      },
    });

    setIsSubmitting(false);
  };

  if (!primaryLine) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title={
        isBulk
          ? `Xử lý chênh lệch hàng loạt (${targetLines.length} dòng)`
          : isCompleted
          ? 'Chi tiết hướng xử lý'
          : 'Xử lý chênh lệch theo ngày'
      }
      description={
        isBulk
          ? `Áp dụng cùng kết luận và lý do giải trình cho ${targetLines.length} nguyên liệu có chênh lệch.`
          : `${primaryLine.materialName} (${primaryLine.materialCode})`
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            {isCompleted ? 'Đóng' : 'Quay lại'}
          </Button>
          {!isCompleted && (
            <Button
              variant="default"
              size="sm"
              disabled={isSubmitting || !reason.trim() || Boolean(categoryError) || !categories.some((option) => option.value === category)}
              onClick={() => void handleSave()}
            >
              {isSubmitting ? 'Đang lưu...' : isBulk ? `Xác nhận ${targetLines.length} dòng` : 'Lưu hướng xử lý'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        {categoryError && <InlineBanner variant="error" actionLabel="Tải lại danh mục" onAction={() => { setCategoryError(null); setCategoryRetry((value) => value + 1); }}>{categoryError.message}</InlineBanner>}
        {error && (
          <InlineBanner
            variant={error instanceof ApiError && error.status === 409 ? 'conflict' : 'error'}
            title={error instanceof ApiError && error.status === 409 ? 'Xung đột dữ liệu đồng thời' : undefined}
            actionLabel={error instanceof ApiError && error.status === 409 ? 'Tải lại dữ liệu mới nhất' : undefined}
            onAction={error instanceof ApiError && error.status === 409 ? async () => { setError(null); await onSaved(); } : undefined}
            onClose={() => setError(null)}
          >
            {error.message}
          </InlineBanner>
        )}

        {isBulk && succeededLineIds.size > 0 && <p role="status">Đã lưu {succeededLineIds.size}/{targetLines.length} dòng · Còn {targetLines.length - succeededLineIds.size} dòng.</p>}
        {isBulk ? (
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
            <span className="font-semibold text-slate-800 block">
              Danh sách {targetLines.length} nguyên liệu được áp dụng cùng giải trình:
            </span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {targetLines.map((l) => (
                <span key={l.dailyLineId || l.id || l.materialCode} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {l.materialName}: <strong className="font-mono">{l.issuedRequiredDifference != null && l.issuedRequiredDifference > 0 ? '+' : ''}<Num value={l.issuedRequiredDifference} format="plain" decimals={6} /> {l.unit}</strong>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Nhu cầu đã khóa:</span>
              <strong className="font-mono text-slate-800"><Num value={primaryLine.requiredQuantity} format="plain" decimals={6} /> {primaryLine.unit}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Đã xuất theo sổ:</span>
              <strong className="font-mono text-slate-800"><Num value={primaryLine.issuedQuantity} format="plain" decimals={6} /> {primaryLine.unit}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Chênh lệch:</span>
              <strong className={`font-mono ${primaryLine.issuedRequiredDifference === 0 ? 'text-slate-700' : 'text-amber-700 font-semibold'}`}>
                {primaryLine.issuedRequiredDifference != null && primaryLine.issuedRequiredDifference > 0 ? '+' : ''}
                <Num value={primaryLine.issuedRequiredDifference} format="plain" decimals={6} /> {primaryLine.unit}
              </strong>
            </div>
          </div>
        )}

        {primaryLine.notes.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1">Ghi chú từ Kho:</span>
            <ul className="text-xs space-y-1 pl-4 list-disc text-slate-600">
              {primaryLine.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {primaryLine.disposition && !isCompleted && (
          <div className="p-2.5 bg-blue-50/60 rounded border border-blue-200 text-xs text-blue-900 flex flex-col gap-1">
            <span className="font-semibold text-blue-800">Giải trình hiện tại (Phiên bản v{primaryLine.disposition.version ?? 1}):</span>
            <span className="text-slate-700">Lý do: <strong className="font-mono">{primaryLine.disposition.reason || '—'}</strong></span>
          </div>
        )}

        {isCompleted ? (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div>
              <span className="text-xs text-slate-500 block">Danh mục:</span>
              <span className="font-medium text-slate-900">{primaryLine.disposition?.category ? MRX_DISPOSITION_CATEGORY_LABELS[primaryLine.disposition.category] ?? 'Danh mục chưa xác định' : '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Lý do xử lý:</span>
              <p className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs font-mono text-slate-800">
                {primaryLine.disposition?.reason ?? '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div>
              <label htmlFor="disposition-category" className="text-xs font-semibold text-slate-700 block mb-1">
                Danh mục xử lý chênh lệch:
              </label>
              <Select
                id="disposition-category"
                aria-label="Danh mục xử lý chênh lệch"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={categories}
                className="w-full h-9 text-sm"
              />
            </div>
            <div>
              <label htmlFor="disposition-reason" className="text-xs font-semibold text-slate-700 block mb-1">
                Lý do xử lý chênh lệch:
              </label>
              <Input
                id="disposition-reason"
                aria-label="Lý do xử lý chênh lệch"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do kết luận hoặc hướng xử lý của Quản lý..."
                className="h-9 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Gợi ý lý do xử lý">
                {[
                  'Chấp nhận hao hụt thực tế',
                  'Điều chỉnh định lượng BOM kỳ tới',
                  'Đã xuất bù thực tế trong ca',
                  'Sai số đo lường lúc xuất kho',
                ].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setReason(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
