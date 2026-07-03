import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useCreateIngredientMutation,
  useGetIngredientsQuery,
  useGetUnitsQuery,
  useGetWarehousesQuery,
} from '@/features/projects/dishCatalogApi';
import { normalizeVietnamese } from '@/lib/utils';

interface CreateIngredientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (ingredientId: string) => void;
}

export function CreateIngredientDialog({ open, onOpenChange, initialName, onCreated }: CreateIngredientDialogProps) {
  const { data: units = [] } = useGetUnitsQuery();
  const { data: warehouses = [] } = useGetWarehousesQuery();
  const { data: existingIngredients = [] } = useGetIngredientsQuery();
  const [createIngredient, { isLoading }] = useCreateIngredientMutation();

  const [ingredientCode, setIngredientCode] = useState('');
  const [ingredientName, setIngredientName] = useState(initialName ?? '');
  const [unitId, setUnitId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [referencePrice, setReferencePrice] = useState('');
  const [isFreshDaily, setIsFreshDaily] = useState(false);
  const [error, setError] = useState('');
  const [wasOpen, setWasOpen] = useState(open);

  if (open && !wasOpen) {
    setWasOpen(true);
    setIngredientName(initialName ?? '');
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const duplicateMatch = useMemo(() => {
    const normalized = normalizeVietnamese(ingredientName);
    if (!normalized) return null;
    return existingIngredients.find((i) => normalizeVietnamese(i.ingredientName) === normalized) ?? null;
  }, [ingredientName, existingIngredients]);

  const resetAndClose = () => {
    setIngredientCode('');
    setIngredientName('');
    setUnitId('');
    setWarehouseId('');
    setReferencePrice('');
    setIsFreshDaily(false);
    setError('');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!ingredientCode.trim() || !ingredientName.trim() || !unitId || !warehouseId) {
      setError('Vui lòng nhập đầy đủ mã, tên, đơn vị tính và kho.');
      return;
    }
    setError('');
    try {
      const created = await createIngredient({
        ingredientCode: ingredientCode.trim(),
        ingredientName: ingredientName.trim(),
        unitId,
        warehouseId,
        referencePrice: Number(referencePrice) || 0,
        isFreshDaily,
      }).unwrap();
      onCreated(created.ingredientId);
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
          <DialogTitle>Thêm nguyên liệu mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {error && (
            <div className="rounded-md border border-[var(--ipc-danger)] bg-[var(--ipc-danger-soft)] p-2 text-sm text-[var(--ipc-danger)]">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Mã nguyên liệu *</label>
            <input className="ipc-input w-full" value={ingredientCode} onChange={(e) => setIngredientCode(e.target.value)} placeholder="VD: NL-001" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tên nguyên liệu *</label>
            <input className="ipc-input w-full" value={ingredientName} onChange={(e) => setIngredientName(e.target.value)} placeholder="VD: Rau muống" />
            {duplicateMatch && (
              <div className="mt-1 rounded-md border border-[var(--ipc-warning)] bg-[var(--ipc-warning-soft)] p-2 text-xs text-[var(--ipc-warning)]">
                ⚠ Đã có nguyên liệu tên gần giống: <strong>{duplicateMatch.ingredientName}</strong>. Kiểm tra lại trước khi tạo mới để tránh trùng lặp.
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Đơn vị tính *</label>
              <select className="ipc-input w-full" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {units.map((unit) => (
                  <option key={unit.unitId} value={unit.unitId}>{unit.unitName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Kho *</label>
              <select className="ipc-input w-full" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">-- Chọn --</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.warehouseId} value={warehouse.warehouseId}>{warehouse.warehouseName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Giá tham chiếu</label>
              <input type="number" className="ipc-input w-full" value={referencePrice} onChange={(e) => setReferencePrice(e.target.value)} placeholder="0" />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={isFreshDaily} onChange={(e) => setIsFreshDaily(e.target.checked)} />
              Nguyên liệu tươi hàng ngày
            </label>
          </div>
        </div>

        <DialogFooter>
          <button type="button" className="ipc-button ipc-button-ghost" onClick={resetAndClose}>Hủy</button>
          <button type="button" className="ipc-button ipc-button-primary" disabled={isLoading} onClick={handleSubmit}>
            {isLoading ? 'Đang lưu...' : 'Tạo nguyên liệu'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
