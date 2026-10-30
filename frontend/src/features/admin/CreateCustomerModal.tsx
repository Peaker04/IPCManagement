import { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InlineBanner } from '../../components/ui/inline-banner';
import { customerApi } from '../../api/customerApi';
import { useAuth } from '../../store/useAuth';

const PRICE_TIERS = [25000, 30000, 34000];

export interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCustomerModal({
  isOpen,
  onClose,
  onCreated,
}: CreateCustomerModalProps) {
  const { operationalMode } = useAuth();
  const isMrxMode = operationalMode === 'MATERIAL_RECONCILIATION';
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedPriceTier, setSelectedPriceTier] = useState<number>(25000);
  const [shifts, setShifts] = useState<string[]>(['MORNING', 'AFTERNOON']);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleShift = (shiftName: string) => {
    setShifts((prev) =>
      prev.includes(shiftName) ? prev.filter((s) => s !== shiftName) : [...prev, shiftName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = customerCode.trim().toUpperCase();
    const cleanName = customerName.trim();
    if (!cleanCode || !cleanName) {
      setError('Vui lòng nhập đầy đủ mã và tên khách hàng.');
      return;
    }
    if (shifts.length === 0) {
      setError('Vui lòng chọn ít nhất một ca hoạt động.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await customerApi.createCustomerContract({
        customerCode: cleanCode,
        customerName: cleanName,
        defaultMenuPrice: selectedPriceTier,
        defaultBomRatePercent: 100,
        shiftNames: shifts,
        activeWeekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
        note: note.trim() || undefined,
        isActive: true,
      });

      // Reset
      setCustomerCode('');
      setCustomerName('');
      setNote('');
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
      onClose={onClose}
      title="Thêm khách hàng & Kích hoạt hợp đồng mới"
      description="Cấu hình khách hàng mới cho việc lập thực đơn tuần và đối soát nguyên liệu."
      maxWidth="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isSubmitting || isMrxMode || !customerCode.trim() || !customerName.trim()}
            onClick={handleSubmit}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            {isSubmitting ? 'Đang khởi tạo…' : 'Tạo khách hàng & Hợp đồng'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {isMrxMode && (
          <InlineBanner variant="info">
            Bạn đang ở chế độ Đối soát MRX. Hợp đồng khách hàng là dữ liệu quản trị gốc (DOM-MODE-1). Để khởi tạo khách hàng mới, vui lòng chuyển sang Chế độ Vận hành Mặc định (Default).
          </InlineBanner>
        )}

        {error && (
          <InlineBanner variant="error" onClose={() => setError(null)}>
            {error}
          </InlineBanner>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="customer-code" className="block font-semibold text-slate-700 mb-1">
              Mã khách hàng <span className="text-rose-600">*</span>
            </label>
            <Input
              id="customer-code"
              aria-label="Mã khách hàng"
              placeholder="VD: FOX, VCS, DAV..."
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value.toUpperCase())}
              className="h-8 text-xs font-mono font-bold uppercase"
              required
            />
          </div>

          <div>
            <label htmlFor="customer-name" className="block font-semibold text-slate-700 mb-1">
              Tên khách hàng / Công ty <span className="text-rose-600">*</span>
            </label>
            <Input
              id="customer-name"
              aria-label="Tên khách hàng"
              placeholder="VD: Tập đoàn Foxconn..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-8 text-xs font-medium"
              required
            />
          </div>
        </div>

        {/* 3 Price Tiers Segmented Selection */}
        <div>
          <span className="block font-semibold text-slate-700 mb-1.5">
            Mốc giá suất ăn hợp đồng chuẩn (BOM Tier) <span className="text-rose-600">*</span>
          </span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Mốc giá suất ăn">
            {PRICE_TIERS.map((tier) => {
              const isSelected = selectedPriceTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedPriceTier(tier)}
                  className={`p-2.5 rounded border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-mono">{tier.toLocaleString('vi-VN')} ₫</span>
                  <span className={`block text-[11px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    Tier {tier / 1000}k chuẩn
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Operational Shifts */}
        <div>
          <span className="block font-semibold text-slate-700 mb-1.5">
            Các ca phục vụ trong ngày <span className="text-rose-600">*</span>
          </span>
          <div className="flex gap-2">
            {[
              { id: 'MORNING', label: 'Ca 1 (Sáng)' },
              { id: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
            ].map((s) => {
              const isChecked = shifts.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleShift(s.id)}
                  className={`px-3 py-1.5 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {isChecked ? '✓ ' : ''}{s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="customer-note" className="block font-semibold text-slate-700 mb-1">
            Ghi chú hợp đồng
          </label>
          <Input
            id="customer-note"
            aria-label="Ghi chú hợp đồng"
            placeholder="Ghi chú điều khoản phục vụ, địa điểm giao nhận..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-8 text-xs font-medium"
          />
        </div>
      </form>
    </Modal>
  );
}
