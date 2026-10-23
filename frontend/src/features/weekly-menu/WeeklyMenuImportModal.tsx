import { useState, useRef, type ChangeEvent } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { apiClient } from '../../api/client';
import { toIsoDate } from '../../utils/dates';
import type { CustomerOption } from '../../types';
import type { paths } from '../../shared/api/contracts/schema';

type ImportResult = paths['/api/coordination/weekly-menu/import/preview']['post']['responses']['200']['content']['application/json']['data'];

interface WeeklyMenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerOption[];
  initialCustomerId?: string;
  initialWeekStartDate?: string;
  onImportSuccess: () => void;
}

export function WeeklyMenuImportModal({
  isOpen,
  onClose,
  customers,
  initialCustomerId = '',
  initialWeekStartDate = '',
  onImportSuccess,
}: WeeklyMenuImportModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || customers[0]?.customerId || '');
  const [weekStartDate, setWeekStartDate] = useState(initialWeekStartDate);
  const [priceTier, setPriceTier] = useState('');
  const [autoPublish, setAutoPublish] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreviewResult(null);
    setError(null);
  };

  const handleDownloadTemplate = () => {
    const url = weeklyMenuApi.getWeeklyMenuTemplateUrl(selectedCustomerId, toIsoDate(weekStartDate));
    window.open(url, '_blank');
  };

  const handlePreview = async () => {
    if (!file || !selectedCustomerId || !weekStartDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const isoDate = toIsoDate(weekStartDate);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('customerId', selectedCustomerId);
      formData.append('weekStartDate', isoDate);
      if (priceTier) formData.append('priceTierAmount', priceTier);

      const result = await weeklyMenuApi.previewWeeklyMenuImport(formData);
      setPreviewResult(result);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể phân tích file thực đơn.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !selectedCustomerId || !weekStartDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const isoDate = toIsoDate(weekStartDate);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('customerId', selectedCustomerId);
      formData.append('weekStartDate', isoDate);
      if (priceTier) formData.append('priceTierAmount', priceTier);
      if (previewResult?.previewToken) formData.append('previewToken', previewResult.previewToken);

      await weeklyMenuApi.commitWeeklyMenuImport(formData);

      if (autoPublish) {
        try {
          const schedules = await weeklyMenuApi.getMenuSchedules(selectedCustomerId, isoDate);
          if (schedules.length > 0) {
            await weeklyMenuApi.publishMenuSchedule(schedules[0].menuScheduleId, 'Tự động xuất bản sau khi nhập');
            for (const s of schedules) {
              await apiClient('/coordination/meal-quantity-plans/quick-servings', {
                method: 'POST',
                body: JSON.stringify({
                  customerId: selectedCustomerId,
                  serviceDate: s.serviceDate,
                  shiftName: s.shiftName,
                  servings: 100,
                  complete: true,
                }),
              }).catch(() => null);
            }
          }
        } catch {
          // ignore publish warning, commit already succeeded
        }
      }

      onClose();
      onImportSuccess();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu thực đơn tuần.');
    } finally {
      setIsLoading(false);
    }
  };

  const customerOptions = customers.map((c) => ({
    value: c.customerId,
    label: `${c.customerCode} - ${c.customerName}`,
  }));

  const validationIssues = previewResult?.validation?.issues ?? [];
  const hasErrors = validationIssues.some((issue) => issue.severity === 'ERROR');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nhập thực đơn tuần từ file Excel"
      description="Tải lên file Excel thực đơn 7 ngày của khách hàng để bắt đầu quy trình kế hoạch và đối soát."
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
          >
            Tải file mẫu Excel
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Hủy
            </Button>
            {!previewResult ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isLoading || !file || !selectedCustomerId || !weekStartDate}
                onClick={() => void handlePreview()}
              >
                {isLoading ? 'Đang phân tích…' : 'Xem trước'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isLoading || hasErrors}
                onClick={() => void handleCommit()}
              >
                {isLoading ? 'Đang lưu…' : 'Xác nhận nhập'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-slate-700 py-1">
        {error && (
          <div role="alert" className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="import-customer-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Khách hàng <span className="text-rose-600">*</span>
            </label>
            <Select
              id="import-customer-select"
              aria-label="Chọn khách hàng nhập thực đơn"
              options={customerOptions}
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setPreviewResult(null);
              }}
              className="w-full h-9 text-sm"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tuần bắt đầu (Thứ Hai) <span className="text-rose-600">*</span>
            </label>
            <VietnameseDateInput
              aria-label="Tuần bắt đầu nhập"
              value={weekStartDate}
              onChange={(date) => {
                setWeekStartDate(date);
                setPreviewResult(null);
              }}
              className="w-full h-9 font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="price-tier-input" className="block text-xs font-semibold text-slate-700 mb-1">
            Mức giá suất ăn dự kiến (VNĐ)
          </label>
          <Input
            id="price-tier-input"
            type="number"
            step="1000"
            aria-label="Mức giá suất ăn"
            value={priceTier}
            onChange={(e) => setPriceTier(e.target.value)}
            className="w-full h-9 text-sm font-mono"
            placeholder="25000"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            File Excel thực đơn (.xlsx) <span className="text-rose-600">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Chọn file Excel thực đơn"
            onChange={handleFileChange}
            className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-slate-200 rounded p-1"
          />
        </div>

        <div className="pt-1">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Tự động xuất bản thực đơn sau khi nhập (Để sẵn sàng lập lô MRX)</span>
          </label>
        </div>

        {previewResult && (
          <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-800 border-b border-slate-200 pb-1.5">
              <span>Kết quả phân tích file</span>
              <Badge variant={hasErrors ? 'danger' : 'success'} size="sm">
                {hasErrors ? 'Có lỗi cần sửa' : 'Hợp lệ để nhập'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>Khách hàng: <strong>{previewResult.customerName}</strong></div>
              <div>Số dòng quét: <strong>{previewResult.rows?.length ?? 0}</strong></div>
              <div>Tuần: <strong>{previewResult.weekStartDate}</strong> đến <strong>{previewResult.weekEndDate}</strong></div>
              <div>Cảnh báo: <strong>{previewResult.warnings?.length ?? 0}</strong></div>
            </div>

            {validationIssues.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <span className="font-semibold block mb-1">Cảnh báo / Lỗi:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                  {validationIssues.map((issue, idx) => (
                    <li key={idx} className={issue.severity === 'ERROR' ? 'text-rose-700 font-medium' : 'text-amber-700'}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
