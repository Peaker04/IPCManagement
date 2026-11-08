import { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InlineBanner } from '../../components/ui/inline-banner';
import { customerApi } from '../../api/customerApi';

export interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCustomerModal({ isOpen, onClose, onCreated }: CreateCustomerModalProps) {
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCustomerCode('');
    setCustomerName('');
    setNote('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const cleanCode = customerCode.trim().toUpperCase();
    const cleanName = customerName.trim();
    if (!cleanCode || !cleanName) {
      setError('Vui lòng nhập đầy đủ mã và tên khách hàng.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await customerApi.createCustomerContract({
        customerCode: cleanCode,
        customerName: cleanName,
        note: note.trim() || undefined,
        isActive: true,
      });
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tạo khách hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      isDirty={Boolean(customerCode || customerName || note)}
      closeDisabled={isSubmitting}
      onClose={() => { reset(); onClose(); }}
      title="Thêm khách hàng mới"
      maxWidth="max-w-xl"
      footer={(requestClose) => (
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={requestClose} disabled={isSubmitting}>Hủy bỏ</Button>
          <Button variant="default" size="sm" disabled={isSubmitting || !customerCode.trim() || !customerName.trim()}
            onClick={handleSubmit}>
            {isSubmitting ? 'Đang tạo…' : 'Tạo khách hàng'}
          </Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && <InlineBanner variant="error" onClose={() => setError(null)}>{error}</InlineBanner>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="customer-code" className="block font-semibold text-slate-700 mb-1">
              Mã khách hàng <span className="text-rose-600">*</span>
            </label>
            <Input id="customer-code" aria-label="Mã khách hàng" placeholder="VD: FOX, VCS, DAV..."
              value={customerCode} onChange={(e) => setCustomerCode(e.target.value.toUpperCase())}
              className="h-9 text-xs font-mono uppercase" required disabled={isSubmitting} />
          </div>
          <div>
            <label htmlFor="customer-name" className="block font-semibold text-slate-700 mb-1">
              Tên khách hàng / Công ty <span className="text-rose-600">*</span>
            </label>
            <Input id="customer-name" aria-label="Tên khách hàng" placeholder="Tên doanh nghiệp"
              value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              className="h-9 text-xs" required disabled={isSubmitting} />
          </div>
        </div>
        <div>
          <label htmlFor="customer-note" className="block font-semibold text-slate-700 mb-1">Ghi chú</label>
          <Input id="customer-note" aria-label="Ghi chú khách hàng" placeholder="Địa điểm giao nhận, yêu cầu phục vụ..."
            value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-xs" disabled={isSubmitting} />
        </div>
      </form>
    </Modal>
  );
}
