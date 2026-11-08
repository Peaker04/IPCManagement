import { useEffect, useRef, useState } from 'react';
import type { MrxMenuChangeResult } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Num } from '../../components/ui/num';
import { MRX_SHIFT_OPTIONS } from '../../constants/mrxConstants';
import { toVietnameseDate } from '../../utils/dates';

interface MrxSourceChangePanelProps {
  initialEntry?: boolean;
  previewResult: MrxMenuChangeResult | null;
  actorRole: string;
  changedLinesCount: number;
  reason: string;
  onReasonChange: (value: string) => void;
  onBack?: () => void;
  onPreview: () => void;
  onApply: () => boolean | void | Promise<boolean | void>;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  reloadRequired?: boolean;
  error?: Error | null;
}

export function MrxSourceChangePanel({ initialEntry = false, previewResult, actorRole, changedLinesCount, reason, onReasonChange, onBack, onPreview, onApply, onSubmit, isSubmitting, reloadRequired = false, error }: MrxSourceChangePanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const canApply = actorRole === 'ADMIN' || actorRole === 'MANAGER';
  const canSubmit = actorRole === 'COORDINATOR';
  const sourceLines = previewResult?.impactLines.filter((line) => !previewResult.lockedDates.includes(line.serviceDate)) ?? [];
  const sourceChanges = sourceLines.filter((line, index) => sourceLines.findIndex((other) => other.serviceDate === line.serviceDate && other.shiftName === line.shiftName) === index)
    .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate) || MRX_SHIFT_OPTIONS.findIndex((shift) => shift.value === left.shiftName) - MRX_SHIFT_OPTIONS.findIndex((shift) => shift.value === right.shiftName));
  const affectedDays = new Set([...sourceLines, ...(previewResult?.materialImpact ?? [])].map((item) => item.serviceDate)).size;
  const affectedMaterials = new Set(previewResult?.materialImpact.map((item) => item.ingredientCode) ?? []).size;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" aria-label="Ảnh hưởng thay đổi nguồn MRX">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400">{initialEntry ? 'Kiểm tra số suất' : 'Xem trước ảnh hưởng'}</h2>
          <p className="mt-1 text-xs text-slate-600">{initialEntry ? 'Số suất nhập lần đầu' : `${changedLinesCount} thay đổi`} · Chỉ áp dụng cho ngày chưa xuất kho.</p>
        </div>
        {onBack && <Button variant="outline" size="sm" disabled={isSubmitting} onClick={onBack}>Quay lại thực đơn</Button>}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {error && <InlineBanner variant="error">{error.message}</InlineBanner>}
        {previewResult?.lockedDates.length ? (
          <InlineBanner variant="warning">Ngày đã xuất kho, không thể sửa: {previewResult.lockedDates.map(toVietnameseDate).join(', ')}</InlineBanner>
        ) : null}
        {previewResult ? (
          <>
            <p className="text-sm text-slate-700">Nguồn thay đổi: <strong><Num value={affectedDays} /> ngày.</strong> {affectedMaterials > 0 ? <>Chênh lệch định lượng: <strong><Num value={affectedMaterials} /> nguyên liệu.</strong></> : 'Chưa ghi nhận chênh lệch nguyên liệu.'}</p>
            {sourceChanges.length > 0 && <section className="border-y border-slate-200">
              <h3 className="py-3 text-xs font-semibold text-slate-700">{initialEntry ? 'Số suất đề nghị theo ca' : 'Thay đổi thực đơn và số suất'} ({sourceChanges.length} ca)</h3>
              <table aria-label="Thay đổi số suất theo ca" className="w-full min-w-[880px] table-fixed border-separate border-spacing-0 text-xs">
                <thead className="sticky top-0 z-20 bg-slate-50 text-slate-700">
                  <tr className="h-11">
                    <th className="sticky left-0 z-30 w-28 border-b border-slate-200 bg-slate-50 px-3 text-left">Ngày</th>
                    <th className="w-32 border-b border-slate-200 px-3 text-left">Ca</th>
                    {!initialEntry && <th className="border-b border-slate-200 px-3 text-right">Mặn đã lưu</th>}
                    <th className="border-b border-slate-200 px-3 text-right">Mặn đề nghị</th>
                    {!initialEntry && <th className="border-b border-slate-200 px-3 text-right">Chay đã lưu</th>}
                    <th className="border-b border-slate-200 px-3 text-right">Chay đề nghị</th>
                    <th className="border-b border-slate-200 px-3 text-right">Món thay đổi</th>
                  </tr>
                </thead>
                <tbody>{sourceChanges.map((line) => {
                  const dishChanges = sourceLines.filter((item) => item.serviceDate === line.serviceDate && item.shiftName === line.shiftName && item.oldDishId !== item.newDishId).length;
                  return <tr key={`${line.serviceDate}-${line.shiftName}`} className="h-10">
                    <th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 text-left font-medium whitespace-nowrap">{toVietnameseDate(line.serviceDate)}</th>
                    <td className="border-b border-slate-100 px-3">{MRX_SHIFT_OPTIONS.find((shift) => shift.value === line.shiftName)?.label ?? 'Ca chưa nhận diện'}</td>
                    {!initialEntry && <td className="border-b border-slate-100 px-3 text-right">{line.currentSavoryServings == null ? 'Chưa nhập' : <Num value={line.currentSavoryServings} />}</td>}
                    <td className="border-b border-slate-100 px-3 text-right">{line.newSavoryServings == null ? 'Chưa nhập' : <Num value={line.newSavoryServings} />}</td>
                    {!initialEntry && <td className="border-b border-slate-100 px-3 text-right">{line.currentVegetarianServings == null ? 'Chưa nhập' : <Num value={line.currentVegetarianServings} />}</td>}
                    <td className="border-b border-slate-100 px-3 text-right">{line.newVegetarianServings == null ? 'Chưa nhập' : <Num value={line.newVegetarianServings} />}</td>
                    <td className="border-b border-slate-100 px-3 text-right">{dishChanges > 0 ? <Num value={dishChanges} /> : 'Không đổi'}</td>
                  </tr>;
                })}</tbody>
              </table>
            </section>}
            {previewResult.materialImpact.length > 0 && <section className="border-y border-slate-200">
              <h3 className="py-3 text-xs font-semibold text-slate-700">Chi tiết định lượng nguyên liệu ({previewResult.materialImpact.length})</h3>
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-xs">
                <thead className="sticky top-0 z-20 bg-slate-50 text-slate-700"><tr><th className="sticky left-0 z-30 h-10 border-b border-slate-200 bg-slate-50 px-3 text-left">Nguyên liệu</th><th className="h-10 border-b border-slate-200 px-3 text-left">Ngày</th><th className="h-10 border-b border-slate-200 px-3 text-left">ĐVT</th><th className="h-10 border-b border-slate-200 px-3 text-right">Trước</th><th className="h-10 border-b border-slate-200 px-3 text-right">Sau</th><th className="h-10 border-b border-slate-200 px-3 text-right">Chênh lệch</th></tr></thead>
                <tbody>{previewResult.materialImpact.map((item) => <tr key={`${item.serviceDate}-${item.ingredientCode}`} className="h-10"><th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 text-left font-medium">{item.ingredientName}</th><td className="border-b border-slate-100 px-3 whitespace-nowrap">{toVietnameseDate(item.serviceDate)}</td><td className="border-b border-slate-100 px-3">{item.unitName}</td><td className="border-b border-slate-100 px-3 text-right"><Num value={item.previousQuantity} /></td><td className="border-b border-slate-100 px-3 text-right"><Num value={item.newQuantity} /></td><td className="border-b border-slate-100 px-3 text-right"><Num value={item.newQuantity - item.previousQuantity} /></td></tr>)}</tbody>
              </table>
            </section>}
          </>
        ) : <p className="text-sm text-slate-600">Bấm “Xem ảnh hưởng” để kiểm tra định lượng trước khi gửi thay đổi. Bản nháp được giữ khi quay lại thực đơn.</p>}
        {(canApply || canSubmit) && (
          <label className="block max-w-2xl text-xs font-semibold text-slate-700">{initialEntry ? 'Ghi chú nhập suất (bắt buộc)' : 'Lý do thay đổi'}
            <Input aria-label="Lý do thay đổi nguồn" value={reason} disabled={isSubmitting} onChange={(event) => onReasonChange(event.target.value)} className="mt-1" />
          </label>
        )}
      </div>
      {(canApply || canSubmit) && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          {previewResult && !reason.trim() && <span className="mr-auto text-xs text-slate-600">Nhập lý do để {canSubmit ? 'gửi duyệt' : 'áp dụng'}.</span>}
          <Button variant={previewResult ? 'outline' : 'default'} size="sm" disabled={isSubmitting || changedLinesCount === 0} onClick={onPreview}>{isSubmitting && !previewResult ? 'Đang kiểm tra…' : previewResult ? 'Kiểm tra lại ảnh hưởng' : 'Xem ảnh hưởng'}</Button>
          {canApply && <Button variant={previewResult ? 'default' : 'outline'} size="sm" disabled={isSubmitting || !reason.trim() || !previewResult} onClick={() => setConfirmOpen(true)}>Áp dụng ngay</Button>}
          {canSubmit && <Button variant={previewResult ? 'default' : 'outline'} size="sm" disabled={isSubmitting || !reason.trim() || !previewResult} onClick={onSubmit}>{isSubmitting ? 'Đang gửi…' : 'Gửi duyệt'}</Button>}
        </div>
      )}
      <Modal isOpen={confirmOpen && !reloadRequired} closeDisabled={isSubmitting} onClose={() => { if (!isSubmitting) setConfirmOpen(false); }} title="Xác nhận áp dụng thay đổi" footer={<><Button variant="outline" size="sm" disabled={isSubmitting} onClick={() => setConfirmOpen(false)}>Quay lại</Button><Button size="sm" disabled={isSubmitting} onClick={async () => { if (await onApply() !== false) setConfirmOpen(false); }}>{isSubmitting ? 'Đang áp dụng…' : 'Xác nhận áp dụng'}</Button></>}>
        {error && <InlineBanner variant="error">{error.message}</InlineBanner>}
        <p className="text-sm text-slate-700">Áp dụng thay đổi cho {affectedDays} ngày, {affectedMaterials} nguyên liệu?</p>
      </Modal>
    </section>
  );
}
