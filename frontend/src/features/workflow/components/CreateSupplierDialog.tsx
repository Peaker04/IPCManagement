import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateSupplierMutation, useGetSuppliersQuery } from '@/features/workflow';
import { normalizeVietnamese } from '@/lib/utils';

interface CreateSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (supplierId: string) => void;
}

export function CreateSupplierDialog({ open, onOpenChange, initialName, onCreated }: CreateSupplierDialogProps) {
  const [createSupplier, { isLoading }] = useCreateSupplierMutation();
  const { data: existingSuppliers = [] } = useGetSuppliersQuery();

  const [supplierCode, setSupplierCode] = useState('');
  const [supplierName, setSupplierName] = useState(initialName ?? '');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [wasOpen, setWasOpen] = useState(open);

  if (open && !wasOpen) {
    setWasOpen(true);
    setSupplierName(initialName ?? '');
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const duplicateMatch = useMemo(() => {
    const normalized = normalizeVietnamese(supplierName);
    if (!normalized) return null;
    return existingSuppliers.find((s) => normalizeVietnamese(s.supplierName) === normalized) ?? null;
  }, [supplierName, existingSuppliers]);

  const resetAndClose = () => {
    setSupplierCode('');
    setSupplierName('');
    setContactName('');
    setPhone('');
    setAddress('');
    setError('');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!supplierCode.trim() || !supplierName.trim()) {
      setError('Vui lòng nhập đầy đủ mã và tên nhà cung cấp.');
      return;
    }
    setError('');
    try {
      const created = await createSupplier({
        supplierCode: supplierCode.trim(),
        supplierName: supplierName.trim(),
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      }).unwrap();
      onCreated(created.supplierId);
      resetAndClose();
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      setError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : resetAndClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm nhà cung cấp mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {error && (
            <div className="rounded-md border border-[var(--ipc-danger)] bg-[var(--ipc-danger-soft)] p-2 text-sm text-[var(--ipc-danger)]">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Mã nhà cung cấp *</label>
            <input className="ipc-input w-full" value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} placeholder="VD: NCC-001" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tên nhà cung cấp *</label>
            <input className="ipc-input w-full" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="VD: Rau sạch Đà Lạt" />
            {duplicateMatch && (
              <div className="mt-1 rounded-md border border-[var(--ipc-warning)] bg-[var(--ipc-warning-soft)] p-2 text-xs text-[var(--ipc-warning)]">
                ⚠ Đã có nhà cung cấp tên gần giống: <strong>{duplicateMatch.supplierName}</strong>. Kiểm tra lại trước khi tạo mới để tránh trùng lặp.
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Người liên hệ</label>
            <input className="ipc-input w-full" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Số điện thoại</label>
              <input className="ipc-input w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Địa chỉ</label>
              <input className="ipc-input w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <button type="button" className="ipc-button ipc-button-ghost" onClick={resetAndClose}>Hủy</button>
          <button type="button" className="ipc-button ipc-button-primary" disabled={isLoading} onClick={handleSubmit}>
            {isLoading ? 'Đang lưu...' : 'Tạo nhà cung cấp'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
