import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/common';
import type { PurchaseOrderDto, WarehouseDto, WarehousePurchaseReceiptResult } from '@/api/workflowApiTypes';
import { useRecordWarehousePurchaseReceiptMutation } from '@/api/warehouseApi';
import { useBatchReceiptCommandId } from './useBatchReceiptCommandId';

interface Props { open: boolean; order: PurchaseOrderDto; warehouses: WarehouseDto[]; week?: string; onOpenChange: (open: boolean) => void; onSuccess: (result: WarehousePurchaseReceiptResult) => void; }
type Field = 'warehouse' | 'receiptDate' | 'lotPrefix' | 'manufactureDate' | 'expiryDate';
const mutationMessage = (error: unknown) => error && typeof error === 'object' && 'data' in error ? String((error as { data?: { message?: unknown } }).data?.message ?? 'Chưa tạo được phiếu nhập theo đơn mua.') : 'Chưa tạo được phiếu nhập theo đơn mua.';

export function WarehouseBatchPurchaseReceiptDialog({ open, order, warehouses, week, onOpenChange, onSuccess }: Props) {
  const lines = useMemo(() => order.lines.filter((line) => line.receivedQty < line.orderedQty && !line.activeReceiptId && !line.blockerReason), [order.lines]);
  const requiresFreshDates = lines.some((line) => line.manufactureDateRequired || line.expiryDateRequired);
  const operationalWarehouse = warehouses.length === 1 ? warehouses[0] : undefined;
  const warehouseId = operationalWarehouse?.warehouseId ?? '';
  const [receiptDate, setReceiptDate] = useState('');
  const [lotPrefix, setLotPrefix] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [recordReceipt, { isLoading }] = useRecordWarehousePurchaseReceiptMutation();
  const idempotencyKey = useBatchReceiptCommandId();

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    if (!warehouseId) next.warehouse = 'Chưa xác định được kho vận hành.';
    if (!receiptDate) next.receiptDate = 'Chọn ngày nhận hàng.';
    if (!lotPrefix.trim()) next.lotPrefix = 'Nhập tiền tố số lô.';
    if (!lines.length) next.warehouse = 'Đơn mua không còn dòng đủ điều kiện nhận.';
    if (requiresFreshDates && !manufactureDate) next.manufactureDate = 'Chọn ngày sản xuất.';
    if (requiresFreshDates && !expiryDate) next.expiryDate = 'Chọn hạn sử dụng.';
    if (manufactureDate && expiryDate && expiryDate <= manufactureDate) next.expiryDate = 'Hạn sử dụng phải sau ngày sản xuất.';
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-batch-receipt-error="true"]')?.focus());
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      onSuccess(await recordReceipt({ week, data: {
        purchaseOrderId: order.purchaseOrderId, idempotencyKey, warehouseId, receiptDate,
        lines: lines.map((line, index) => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          actualQuantity: line.orderedQty - line.receivedQty,
          actualUnitId: line.unitId,
          actualUnitPrice: line.unitPrice,
          lotNumber: `${lotPrefix.trim()}-${String(index + 1).padStart(3, '0')}`,
          manufactureDate: line.manufactureDateRequired ? manufactureDate : null,
          expiryDate: line.expiryDateRequired ? expiryDate : null,
          packageQuantity: null, packageBaseUnitId: null, packagePolicyVersion: null,
        })),
      } }).unwrap());
    } catch (reason) {
      setError(mutationMessage(reason));
      setConfirming(false);
    }
  };

  const fieldError = (field: Field) => errors[field]
    ? <span id={`batch-receipt-${field}-error`} tabIndex={-1} data-batch-receipt-error="true" className="text-xs font-normal text-red-700">{errors[field]}</span>
    : null;

  return <Dialog open={open} onOpenChange={(next) => { if (!isLoading) onOpenChange(next); }}>
    <DialogContent size="lg" aria-describedby="batch-receipt-description">
      <DialogHeader><DialogTitle>Tạo phiếu nhập cho toàn bộ đơn mua</DialogTitle><DialogDescription id="batch-receipt-description">{order.purchaseOrderCode} · {lines.length} dòng nguồn còn lại. Mỗi dòng giữ nguyên mã nguồn, đơn vị, số lượng và đơn giá.</DialogDescription></DialogHeader>
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      {confirming ? <dl className="grid gap-2 rounded-sm border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-[10rem_1fr]"><dt>Kho nhận</dt><dd>{operationalWarehouse?.warehouseName}</dd><dt>Ngày nhận</dt><dd>{receiptDate}</dd><dt>Số dòng</dt><dd>{lines.length}</dd><dt>Tiền tố số lô</dt><dd>{lotPrefix}</dd>{requiresFreshDates && <><dt>Ngày sản xuất</dt><dd>{manufactureDate}</dd><dt>Hạn dùng</dt><dd>{expiryDate}</dd></>}</dl> :
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1 text-sm"><span className="font-semibold">Kho vận hành</span><p tabIndex={errors.warehouse ? -1 : undefined} data-batch-receipt-error={errors.warehouse ? 'true' : undefined} className="rounded-sm border border-slate-300 bg-slate-50 px-3 py-2">{operationalWarehouse?.warehouseName ?? 'Chưa xác định'}</p>{fieldError('warehouse')}</div>
          <label className="grid gap-1 text-sm font-semibold">Ngày nhận<Input aria-label="Ngày nhận toàn bộ đơn mua" type="date" value={receiptDate} aria-invalid={Boolean(errors.receiptDate) || undefined} aria-describedby={errors.receiptDate ? 'batch-receipt-receiptDate-error' : undefined} onChange={(event) => setReceiptDate(event.target.value)} />{fieldError('receiptDate')}</label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Tiền tố số lô<Input aria-label="Tiền tố số lô" value={lotPrefix} aria-invalid={Boolean(errors.lotPrefix) || undefined} aria-describedby={errors.lotPrefix ? 'batch-receipt-lotPrefix-error' : undefined} onChange={(event) => setLotPrefix(event.target.value)} placeholder="Ví dụ: LOT-20260810" />{fieldError('lotPrefix')}</label>
          {requiresFreshDates && <><label className="grid gap-1 text-sm font-semibold">Ngày sản xuất<Input aria-label="Ngày sản xuất toàn bộ đơn mua" type="date" value={manufactureDate} aria-invalid={Boolean(errors.manufactureDate) || undefined} aria-describedby={errors.manufactureDate ? 'batch-receipt-manufactureDate-error' : undefined} onChange={(event) => setManufactureDate(event.target.value)} />{fieldError('manufactureDate')}</label><label className="grid gap-1 text-sm font-semibold">Hạn sử dụng<Input aria-label="Hạn sử dụng toàn bộ đơn mua" type="date" value={expiryDate} aria-invalid={Boolean(errors.expiryDate) || undefined} aria-describedby={errors.expiryDate ? 'batch-receipt-expiryDate-error' : undefined} onChange={(event) => setExpiryDate(event.target.value)} />{fieldError('expiryDate')}</label></>}
        </div>}
      <DialogFooter>{confirming ? <><Button variant="outline" disabled={isLoading} onClick={() => setConfirming(false)}>Quay lại chỉnh sửa</Button><Button disabled={isLoading} onClick={() => void submit()}>{isLoading ? 'Đang lưu...' : 'Tạo phiếu nháp'}</Button></> : <><Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button disabled={isLoading} onClick={() => { if (validate()) setConfirming(true); }}>Tiếp tục xác nhận</Button></>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
