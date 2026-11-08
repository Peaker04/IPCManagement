import { useCallback, useEffect, useRef, useState } from 'react';
import type { MrxMenuChangeInboxItem } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { MRX_SHIFT_OPTIONS } from '../../constants/mrxConstants';
import { toVietnameseDate } from '../../utils/dates';

interface MrxPendingRequestsPanelProps {
  requests: MrxMenuChangeInboxItem[];
  isSubmitting: boolean;
  onDecide: (amendmentId: string, approved: boolean, reason?: string) => boolean | void | Promise<boolean | void>;
  initialRequest?: MrxMenuChangeInboxItem | null;
  error?: Error | null;
  onRequestChange?: () => void;
  onClose?: () => void;
}

export function MrxPendingRequestsPanel({ requests, isSubmitting, onDecide, initialRequest = null, error, onRequestChange, onClose }: MrxPendingRequestsPanelProps) {
  const [selected, setSelected] = useState<MrxMenuChangeInboxItem | null>(initialRequest);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestTrigger = useRef<HTMLButtonElement | null>(null);
  const pending = isSubmitting || isDeciding;

  useEffect(() => { headingRef.current?.focus(); }, [selected]);

  const close = useCallback(() => {
    if (pending) return;
    setSelected(null);
    setDecision(null);
    setRejectionReason('');
    requestTrigger.current?.focus();
    onClose?.();
  }, [onClose, pending]);

  const decide = async () => {
    if (!selected || !decision || pending || (decision === 'reject' && !rejectionReason.trim())) return;
    setIsDeciding(true);
    try {
      const succeeded = await onDecide(selected.menuAmendmentId, decision === 'approve', decision === 'reject' ? rejectionReason.trim() : undefined);
      if (succeeded !== false) {
        setSelected(null);
        setDecision(null);
        setRejectionReason('');
        requestTrigger.current?.focus();
        onClose?.();
      }
    } finally { setIsDeciding(false); }
  };

  return (
    <section aria-label="Duyệt thay đổi nguồn MRX" className="flex h-full min-h-0 flex-col bg-white">
      {!selected ? requests.map((request) => (
        <Button key={request.menuAmendmentId} variant="outline" aria-label={`Xem yêu cầu ${request.customerName}`} onClick={(event) => { requestTrigger.current = event.currentTarget; setSelected(request); }}>
          {request.customerName} · {toVietnameseDate(request.weekStartDate)}
        </Button>
      )) : <>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400">Duyệt thay đổi nguồn MRX</h2>
            <p className="mt-1 text-xs text-slate-600">{selected.customerName} · tuần {toVietnameseDate(selected.weekStartDate)}</p>
          </div>
          <Button variant="outline" size="sm" disabled={pending} onClick={close}>Quay lại thực đơn</Button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-sm text-slate-700">
          {requests.length > 1 && <label className="block text-xs font-medium">Yêu cầu cần duyệt
            <Select aria-label="Yêu cầu nguồn cần duyệt" className="mt-1 w-full" disabled={pending} value={selected.menuAmendmentId}
              options={requests.map((request) => ({ value: request.menuAmendmentId, label: `${request.customerName} · ${toVietnameseDate(request.weekStartDate)} · ${request.reason}` }))}
              onChange={(event) => {
                const request = requests.find((item) => item.menuAmendmentId === event.target.value);
                if (!request || pending) return;
                setSelected(request); setRejectionReason(''); setDecision(null); onRequestChange?.();
              }} />
          </label>}
          {error && !decision && <InlineBanner variant="error">{error.message}</InlineBanner>}
          <p><strong>Lý do yêu cầu:</strong> {selected.reason}</p>
          <p className="text-xs text-slate-600">Nội dung đã gửi bên dưới được kiểm tra lại điều kiện áp dụng khi phê duyệt.</p>
          {selected.impactLines.length > 0 ? <table aria-label="Thay đổi nguồn đã gửi" className="w-full min-w-[880px] border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20 bg-slate-50 text-slate-700"><tr className="h-10">
              <th className="sticky left-0 z-30 border-b border-slate-200 bg-slate-50 px-3 text-left">Ngày / Ca</th>
              <th className="border-b border-slate-200 px-3 text-right">Mặn trước → sau</th>
              <th className="border-b border-slate-200 px-3 text-right">Chay trước → sau</th>
              <th className="border-b border-slate-200 px-3 text-right">Tổng suất trước → sau</th>
              <th className="border-b border-slate-200 px-3 text-left">Món ăn</th>
            </tr></thead>
            <tbody>{selected.impactLines.map((line) => <tr key={`${line.serviceDate}-${line.shiftName}-${line.dishSlot}`} className="h-10">
              <th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 text-left font-medium">{toVietnameseDate(line.serviceDate)} · {MRX_SHIFT_OPTIONS.find((shift) => shift.value === line.shiftName)?.label ?? 'Ca chưa nhận diện'}</th>
              <td className="border-b border-slate-100 px-3 text-right"><Num value={line.currentSavoryServings} /> → <Num value={line.newSavoryServings} /></td>
              <td className="border-b border-slate-100 px-3 text-right"><Num value={line.currentVegetarianServings} /> → <Num value={line.newVegetarianServings} /></td>
              <td className="border-b border-slate-100 px-3 text-right"><Num value={line.currentServings} /> → <Num value={line.newServings} /> suất</td>
              <td className="border-b border-slate-100 px-3">{line.oldDishId === line.newDishId ? 'Không đổi' : <details><summary className="cursor-pointer">Đổi món · xem định danh</summary><span className="block">Trước: <IdentifierText value={line.oldDishId} /></span><span className="block">Sau: <IdentifierText value={line.newDishId} /></span></details>}</td>
            </tr>)}</tbody>
          </table> : <p>Không có dòng thay đổi được lưu trong yêu cầu này.</p>}
          <p className="text-xs text-slate-600">Lô MRX bị ảnh hưởng: <Num value={selected.affectedReconciliationBatchIds.length} />. Các ô “—” là thông tin chưa được lưu, không phải số 0.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => setDecision('reject')}>Từ chối…</Button>
          <Button size="sm" disabled={pending} onClick={() => setDecision('approve')}>Phê duyệt thay đổi</Button>
        </div>
      </>}
      <Modal isOpen={Boolean(selected && decision)} onClose={() => { if (!pending) setDecision(null); }} isDirty={decision === 'reject' && Boolean(rejectionReason.trim()) && !pending}
        title={decision === 'reject' ? 'Từ chối yêu cầu thay đổi' : 'Phê duyệt yêu cầu thay đổi'}
        description={selected ? `${selected.customerName} · tuần ${toVietnameseDate(selected.weekStartDate)}` : undefined}
        footer={<>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => setDecision(null)}>Quay lại xem yêu cầu</Button>
          <Button size="sm" disabled={pending || (decision === 'reject' && !rejectionReason.trim())} loading={pending} onClick={() => void decide()}>{decision === 'reject' ? 'Xác nhận từ chối' : 'Xác nhận phê duyệt'}</Button>
        </>}>
        {error && <InlineBanner variant="error">{error.message}</InlineBanner>}
        {decision === 'reject' ? <label className="block text-sm font-medium text-slate-700">Lý do từ chối (bắt buộc)
          <Input aria-label="Lý do từ chối thay đổi nguồn" className="mt-1" disabled={pending} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
        </label> : <p>Áp dụng các thay đổi đã xem vào nguồn tuần. Ngày đã xuất kho không thể sửa.</p>}
      </Modal>
    </section>
  );
}
