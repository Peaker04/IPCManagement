import { useCallback, useState } from 'react';
import type { MrxMenuChangeInboxItem } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
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
  const [rejectionReason, setRejectionReason] = useState('');

  const close = useCallback(() => {
    setSelected(null);
    setRejectionReason('');
    onClose?.();
  }, [onClose]);

  return (
    <section aria-label="Yêu cầu thay đổi nguồn chờ duyệt" className="space-y-2">
      {!initialRequest && requests.map((request) => (
        <button
          key={request.menuAmendmentId}
          type="button"
          aria-label={`Xem yêu cầu ${request.customerName}`}
          onClick={() => setSelected(request)}
          className="w-full rounded border border-slate-200 bg-white p-3 text-left text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <strong className="block text-slate-900">{request.customerName} · {toVietnameseDate(request.weekStartDate)}</strong>
          <span className="mt-1 block text-slate-600">{request.reason}</span>
        </button>
      ))}

      <Modal
        isOpen={Boolean(selected)}
        onClose={close}
        title="Duyệt thay đổi nguồn MRX"
        description={selected ? `${selected.customerName} · tuần ${toVietnameseDate(selected.weekStartDate)}` : undefined}
        footer={<>
          <Button variant="outline" size="sm" disabled={isSubmitting || !rejectionReason.trim()} onClick={async () => {
            if (!selected) return;
            const succeeded = await onDecide(selected.menuAmendmentId, false, rejectionReason.trim());
            if (succeeded !== false) close();
          }}>Từ chối</Button>
          <Button size="sm" disabled={isSubmitting} onClick={async () => {
            if (!selected) return;
            const succeeded = await onDecide(selected.menuAmendmentId, true);
            if (succeeded !== false) close();
          }}>Phê duyệt thay đổi</Button>
        </>}
      >
        {selected && <div className="space-y-3 text-sm text-slate-700">
          {requests.length > 1 && <label className="block font-medium text-slate-700">Yêu cầu cần duyệt
            <Select
              aria-label="Yêu cầu nguồn cần duyệt"
              className="mt-1 w-full"
              value={selected.menuAmendmentId}
              options={requests.map((request) => ({ value: request.menuAmendmentId, label: `${request.customerName} · ${toVietnameseDate(request.weekStartDate)} · ${request.reason}` }))}
              onChange={(event) => {
                const request = requests.find((item) => item.menuAmendmentId === event.target.value);
                if (request) {
                  setSelected(request);
                  setRejectionReason('');
                  onRequestChange?.();
                }
              }}
            />
          </label>}
          {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-800">{error.message}</p>}
          <p><strong>Lý do yêu cầu:</strong> {selected.reason}</p>
          {selected.impactLines.map((line) => <p key={`${line.serviceDate}-${line.shiftName}-${line.dishSlot}`}>
            {toVietnameseDate(line.serviceDate)} · {line.shiftName}: <strong>{line.currentServings} → {line.newServings} suất</strong>
          </p>)}
          <p>Lô MRX bị ảnh hưởng: <strong>{selected.affectedReconciliationBatchIds.length}</strong></p>
          <label className="block font-medium text-slate-700">Lý do từ chối (bắt buộc khi từ chối)
            <Input aria-label="Lý do từ chối thay đổi nguồn" className="mt-1" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
          </label>
        </div>}
      </Modal>
    </section>
  );
}
