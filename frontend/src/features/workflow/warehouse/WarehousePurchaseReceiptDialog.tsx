import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type {
  PurchaseOrderDto,
  PurchaseOrderLineDto,
  WarehouseDto,
  WarehousePurchaseReceiptResult,
} from '../workflowApi';
import { useRecordWarehousePurchaseReceiptMutation } from '../workflowApi';

interface WarehousePurchaseReceiptDialogProps {
  open: boolean;
  order: PurchaseOrderDto;
  line: PurchaseOrderLineDto;
  warehouses: WarehouseDto[];
  week?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: WarehousePurchaseReceiptResult) => void;
}

interface ReceiptFormErrors {
  warehouseId?: string;
  receiptDate?: string;
  actualQuantity?: string;
  actualUnitPrice?: string;
  lotNumber?: string;
  manufactureDate?: string;
  expiryDate?: string;
  packageSnapshot?: string;
}

const createIdempotencyKey = () => {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `warehouse-purchase-receipt-${suffix}`;
};

const getMutationErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data?.message) {
      return String(data.message);
    }
  }

  return 'Chưa ghi nhận được phiếu nhập. Dữ liệu đã được giữ nguyên để bạn kiểm tra và thử lại.';
};

export function WarehousePurchaseReceiptDialog({
  open,
  order,
  line,
  warehouses,
  week,
  onOpenChange,
  onSuccess,
}: WarehousePurchaseReceiptDialogProps) {
  const remainingQuantity = Math.max(line.orderedQty - line.receivedQty, 0);
  const idempotencyKey = useRef(createIdempotencyKey());
  const [warehouseId, setWarehouseId] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [actualQuantity, setActualQuantity] = useState(String(remainingQuantity || ''));
  const [actualUnitPrice, setActualUnitPrice] = useState(String(line.unitPrice || ''));
  const [lotNumber, setLotNumber] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [includePackageSnapshot, setIncludePackageSnapshot] = useState(false);
  const [packageQuantity, setPackageQuantity] = useState('');
  const packageBaseUnitId = line.unitId;
  const [packagePolicyVersion, setPackagePolicyVersion] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [errors, setErrors] = useState<ReceiptFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [recordReceipt, { isLoading }] = useRecordWarehousePurchaseReceiptMutation();

  const validate = () => {
    const nextErrors: ReceiptFormErrors = {};
    const quantity = Number(actualQuantity);
    const unitPrice = Number(actualUnitPrice);
    const parsedPackageQuantity = Number(packageQuantity);

    if (!warehouseId) nextErrors.warehouseId = 'Chọn kho nhận hàng.';
    if (!receiptDate) nextErrors.receiptDate = 'Nhập ngày nhận hàng.';
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remainingQuantity) {
      nextErrors.actualQuantity = `Số lượng phải lớn hơn 0 và không vượt quá ${remainingQuantity} ${line.unitName}.`;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) nextErrors.actualUnitPrice = 'Đơn giá thực nhận phải lớn hơn 0.';
    if (line.lotNumberRequired && !lotNumber.trim()) nextErrors.lotNumber = 'Số lô là bằng chứng bắt buộc.';
    if (line.manufactureDateRequired && !manufactureDate) nextErrors.manufactureDate = 'Ngày sản xuất là bằng chứng bắt buộc.';
    if (line.expiryDateRequired && !expiryDate) nextErrors.expiryDate = 'Hạn sử dụng là bằng chứng bắt buộc.';
    if (manufactureDate && expiryDate && expiryDate < manufactureDate) {
      nextErrors.expiryDate = 'Hạn sử dụng không được trước ngày sản xuất.';
    }
    if (includePackageSnapshot && (
      !Number.isFinite(parsedPackageQuantity)
      || parsedPackageQuantity <= 0
      || !packagePolicyVersion.trim()
    )) {
      nextErrors.packageSnapshot = 'Nhập đủ số lượng quy đổi, đơn vị cơ sở và phiên bản chính sách đóng gói.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const requestClose = () => {
    if (!isLoading) onOpenChange(false);
  };

  const showConfirmation = () => {
    setSubmitError('');
    if (validate()) setIsConfirming(true);
  };

  const submitReceipt = async () => {
    if (!validate()) {
      setIsConfirming(false);
      return;
    }

    setSubmitError('');
    try {
      const result = await recordReceipt({
        week,
        data: {
          purchaseOrderId: order.purchaseOrderId,
          idempotencyKey: idempotencyKey.current,
          warehouseId,
          receiptDate,
          lines: [{
            purchaseOrderLineId: line.purchaseOrderLineId,
            actualQuantity: Number(actualQuantity),
            actualUnitId: line.unitId,
            actualUnitPrice: Number(actualUnitPrice),
            lotNumber: lotNumber.trim() || null,
            manufactureDate: manufactureDate || null,
            expiryDate: expiryDate || null,
            packageQuantity: includePackageSnapshot ? Number(packageQuantity) : null,
            packageBaseUnitId: includePackageSnapshot ? packageBaseUnitId.trim() : null,
            packagePolicyVersion: includePackageSnapshot ? packagePolicyVersion.trim() : null,
          }],
        },
      }).unwrap();
      onSuccess(result);
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) requestClose(); }}>
      <DialogContent
        className="max-w-2xl"
        aria-labelledby="purchase-receipt-title"
        aria-describedby="purchase-receipt-description"
      >
        <DialogHeader>
          <DialogTitle id="purchase-receipt-title">Ghi nhận nhập kho từ đơn mua</DialogTitle>
          <DialogDescription id="purchase-receipt-description">
            {order.purchaseOrderCode} · {order.supplierName} · {line.ingredientName}
          </DialogDescription>
        </DialogHeader>

        {line.blockerReason && (
          <div role="alert" className="flex gap-2 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{line.blockerReason}</span>
          </div>
        )}

        {submitError && (
          <div role="alert" className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-semibold">Chưa thể ghi nhận phiếu nhập</p>
            <p className="mt-1">{submitError}</p>
          </div>
        )}

        {isConfirming ? (
          <div className="grid gap-3 rounded-sm border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <CheckCircle2 className="size-4 text-teal-700" />
              Kiểm tra trước khi ghi nhận
            </div>
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[11rem_1fr]">
              <dt className="text-slate-500">Kho nhận</dt>
              <dd>{warehouses.find((warehouse) => warehouse.warehouseId === warehouseId)?.warehouseName}</dd>
              <dt className="text-slate-500">Ngày nhận</dt>
              <dd>{receiptDate}</dd>
              <dt className="text-slate-500">Số lượng thực nhận</dt>
              <dd>{actualQuantity} {line.unitName}</dd>
              <dt className="text-slate-500">Đơn giá thực nhận</dt>
              <dd>{Number(actualUnitPrice).toLocaleString('vi-VN')} đ/{line.unitName}</dd>
              <dt className="text-slate-500">Số lô</dt>
              <dd>{lotNumber || 'Không cung cấp'}</dd>
              {manufactureDate && <><dt className="text-slate-500">Ngày sản xuất</dt><dd>{manufactureDate}</dd></>}
              {expiryDate && <><dt className="text-slate-500">Hạn sử dụng</dt><dd>{expiryDate}</dd></>}
            </dl>
          </div>
        ) : (
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="purchase-receipt-warehouse">Kho nhận <span className="text-red-600">*</span></label>
              <select
                id="purchase-receipt-warehouse"
                className="ipc-select h-8 w-full"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                aria-invalid={Boolean(errors.warehouseId)}
                aria-describedby={errors.warehouseId ? 'purchase-receipt-warehouse-error' : undefined}
              >
                <option value="">Chọn kho nhận</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.warehouseId} value={warehouse.warehouseId}>{warehouse.warehouseName}</option>
                ))}
              </select>
              {errors.warehouseId && <p id="purchase-receipt-warehouse-error" className="text-xs text-red-700">{errors.warehouseId}</p>}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="purchase-receipt-date">Ngày nhận <span className="text-red-600">*</span></label>
              <Input id="purchase-receipt-date" type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} aria-invalid={Boolean(errors.receiptDate)} aria-describedby={errors.receiptDate ? 'purchase-receipt-date-error' : undefined} />
              {errors.receiptDate && <p id="purchase-receipt-date-error" className="text-xs text-red-700">{errors.receiptDate}</p>}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="purchase-receipt-quantity">Số lượng thực nhận <span className="text-red-600">*</span></label>
              <Input id="purchase-receipt-quantity" type="number" min="0.001" step="0.001" max={remainingQuantity} value={actualQuantity} onChange={(event) => setActualQuantity(event.target.value)} aria-invalid={Boolean(errors.actualQuantity)} aria-describedby="purchase-receipt-quantity-help purchase-receipt-quantity-error" />
              <p id="purchase-receipt-quantity-help" className="text-xs text-slate-500">Còn có thể nhận {remainingQuantity} {line.unitName}. Cho phép nhận một phần.</p>
              {errors.actualQuantity && <p id="purchase-receipt-quantity-error" className="text-xs text-red-700">{errors.actualQuantity}</p>}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="purchase-receipt-unit">Đơn vị nhận</label>
              <Input id="purchase-receipt-unit" value={line.unitName} readOnly />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="purchase-receipt-price">Đơn giá thực nhận <span className="text-red-600">*</span></label>
              <Input id="purchase-receipt-price" type="number" min="0.01" step="0.01" value={actualUnitPrice} onChange={(event) => setActualUnitPrice(event.target.value)} aria-invalid={Boolean(errors.actualUnitPrice)} aria-describedby={errors.actualUnitPrice ? 'purchase-receipt-price-error' : undefined} />
              {errors.actualUnitPrice && <p id="purchase-receipt-price-error" className="text-xs text-red-700">{errors.actualUnitPrice}</p>}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="purchase-receipt-lot">Số lô {line.lotNumberRequired && <span className="text-red-600">*</span>}</label>
              <Input id="purchase-receipt-lot" value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} aria-invalid={Boolean(errors.lotNumber)} aria-describedby={errors.lotNumber ? 'purchase-receipt-lot-error' : undefined} />
              {errors.lotNumber && <p id="purchase-receipt-lot-error" className="text-xs text-red-700">{errors.lotNumber}</p>}
            </div>
            {line.manufactureDateRequired && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor="purchase-receipt-manufacture">Ngày sản xuất <span className="text-red-600">*</span></label>
                <Input id="purchase-receipt-manufacture" type="date" value={manufactureDate} onChange={(event) => setManufactureDate(event.target.value)} aria-invalid={Boolean(errors.manufactureDate)} aria-describedby={errors.manufactureDate ? 'purchase-receipt-manufacture-error' : undefined} />
                {errors.manufactureDate && <p id="purchase-receipt-manufacture-error" className="text-xs text-red-700">{errors.manufactureDate}</p>}
              </div>
            )}
            {line.expiryDateRequired && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor="purchase-receipt-expiry">Hạn sử dụng <span className="text-red-600">*</span></label>
                <Input id="purchase-receipt-expiry" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} aria-invalid={Boolean(errors.expiryDate)} aria-describedby={errors.expiryDate ? 'purchase-receipt-expiry-error' : undefined} />
                {errors.expiryDate && <p id="purchase-receipt-expiry-error" className="text-xs text-red-700">{errors.expiryDate}</p>}
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={includePackageSnapshot} onChange={(event) => setIncludePackageSnapshot(event.target.checked)} />
                Ghi nhận ảnh chụp quy đổi đóng gói
              </label>
            </div>
            {includePackageSnapshot && (
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="purchase-receipt-package-quantity">Số lượng quy đổi</label>
                  <Input id="purchase-receipt-package-quantity" type="number" min="0.001" step="0.001" value={packageQuantity} onChange={(event) => setPackageQuantity(event.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="purchase-receipt-package-unit">Đơn vị cơ sở</label>
                  <Input id="purchase-receipt-package-unit" value={line.unitName} readOnly />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="purchase-receipt-package-policy">Phiên bản chính sách</label>
                  <Input id="purchase-receipt-package-policy" value={packagePolicyVersion} onChange={(event) => setPackagePolicyVersion(event.target.value)} />
                </div>
                {errors.packageSnapshot && <p className="text-xs text-red-700 sm:col-span-3">{errors.packageSnapshot}</p>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {isConfirming ? (
            <>
              <Button type="button" variant="outline" autoFocus disabled={isLoading} onClick={() => setIsConfirming(false)}>Quay lại chỉnh sửa</Button>
              <Button type="button" disabled={isLoading || Boolean(line.blockerReason)} onClick={() => void submitReceipt()}>
                {isLoading ? 'Đang lưu...' : 'Ghi nhận nhập kho'}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" autoFocus disabled={isLoading} onClick={requestClose}>Hủy</Button>
              <Button type="button" disabled={isLoading || Boolean(line.blockerReason)} onClick={showConfirmation}>Tiếp tục xác nhận</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
