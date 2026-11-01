import { useEffect, useRef, useState } from 'react';
import type { MrxMenuChangeResult } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Num } from '../../components/ui/num';
import { toVietnameseDate } from '../../utils/dates';

interface MrxSourceChangePanelProps {
  previewResult: MrxMenuChangeResult | null;
  actorRole: string;
  changedLinesCount: number;
  reason: string;
  onReasonChange: (value: string) => void;
  onPreview: () => void;
  onApply: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  error?: Error | null;
}

export function MrxSourceChangePanel({ previewResult, actorRole, changedLinesCount, reason, onReasonChange, onPreview, onApply, onSubmit, isSubmitting, error }: MrxSourceChangePanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const canApply = actorRole === 'ADMIN' || actorRole === 'MANAGER';
  const canSubmit = actorRole === 'COORDINATOR';
  const affectedDays = new Set(previewResult?.materialImpact.map((item) => item.serviceDate) ?? []).size;
  const affectedMaterials = new Set(previewResult?.materialImpact.map((item) => item.ingredientCode) ?? []).size;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Ảnh hưởng thay đổi nguồn MRX">
      <div className="border-b border-slate-200 bg-white p-3">
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-slate-900 outline-none">Xem trước ảnh hưởng</h2>
        <p className="mt-1 text-xs text-slate-600">Chỉ các ngày chưa xuất kho được đưa vào yêu cầu.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-3">
        {error && <InlineBanner variant="error">{error.message}</InlineBanner>}
        {previewResult?.lockedDates.length ? (
          <InlineBanner variant="warning">Ngày đã xuất kho, không thể sửa: {previewResult.lockedDates.map(toVietnameseDate).join(', ')}</InlineBanner>
        ) : null}
        {previewResult ? (
          <div className="overflow-hidden rounded border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-700"><tr><th className="p-2 text-left">Ngày</th><th className="p-2 text-left">Nguyên liệu</th><th className="p-2 text-left">ĐVT</th><th className="p-2 text-right">Trước</th><th className="p-2 text-right">Sau</th><th className="p-2 text-right">Chênh lệch</th></tr></thead>
              <tbody>{previewResult.materialImpact.map((item) => <tr key={`${item.serviceDate}-${item.ingredientCode}`} className="border-t border-slate-100"><td className="p-2">{toVietnameseDate(item.serviceDate)}</td><td className="p-2">{item.ingredientName}</td><td className="p-2">{item.unitName}</td><td className="p-2 text-right"><Num value={item.previousQuantity} /></td><td className="p-2 text-right"><Num value={item.newQuantity} /></td><td className="p-2 text-right"><Num value={item.newQuantity - item.previousQuantity} /></td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="text-xs text-slate-500">Chọn thay đổi rồi xem trước để kiểm tra định lượng.</p>}
        {(canApply || canSubmit) && (
          <label className="block text-xs font-semibold text-slate-700">Lý do thay đổi
            <Input aria-label="Lý do thay đổi nguồn" value={reason} onChange={(event) => onReasonChange(event.target.value)} className="mt-1" />
          </label>
        )}
      </div>
      {(canApply || canSubmit) && (
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white p-3">
          <Button variant="outline" size="sm" disabled={isSubmitting || changedLinesCount === 0} onClick={onPreview}>Xem ảnh hưởng</Button>
          {canApply && <Button size="sm" disabled={isSubmitting || !reason.trim() || !previewResult} onClick={() => setConfirmOpen(true)}>Áp dụng ngay</Button>}
          {canSubmit && <Button size="sm" disabled={isSubmitting || !reason.trim() || !previewResult} onClick={onSubmit}>Gửi duyệt</Button>}
        </div>
      )}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Xác nhận áp dụng thay đổi" footer={<><Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Quay lại</Button><Button size="sm" onClick={async () => { await onApply(); setConfirmOpen(false); }}>Xác nhận áp dụng</Button></>}>
        <p className="text-sm text-slate-700">Áp dụng thay đổi cho {affectedDays} ngày, {affectedMaterials} nguyên liệu?</p>
      </Modal>
    </section>
  );
}
