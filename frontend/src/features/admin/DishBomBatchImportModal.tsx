import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Download, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { InlineBanner } from '../../components/ui/inline-banner';
import { bomApi, type BomImportPreviewResult } from '../../api/bomApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';
import type { CustomerOption } from '../../types';

const PRICE_TIERS = [25000, 30000, 34000];

export interface DishBomBatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
  initialPriceTier?: number;
  initialCustomerId?: string;
  initialTemplateType?: 'missing' | 'by-dish';
  missingDishesDiagnostics?: readonly string[] | string[];
}

export function DishBomBatchImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  initialPriceTier = 25000,
  initialCustomerId = '',
  initialTemplateType = 'by-dish',
  missingDishesDiagnostics,
}: DishBomBatchImportModalProps) {
  const isMissingMode = initialTemplateType === 'missing' || Boolean(missingDishesDiagnostics && missingDishesDiagnostics.length > 0);
  const [selectedPriceTier, setSelectedPriceTier] = useState<number>(initialPriceTier);
  const [scopeCustomer, setScopeCustomer] = useState<string>(initialCustomerId || 'GLOBAL');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BomImportPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    weeklyMenuApi.getCustomers()
      .then((items) => setCustomers(items || []))
      .catch(() => {});
  }, [isOpen]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setFeedback(null);
  };

  const handleDownloadTemplate = (templateType: 'missing' | 'by-dish' = 'by-dish') => {
    const custId = scopeCustomer !== 'GLOBAL' ? scopeCustomer : undefined;
    const url = bomApi.getBomTemplateUrl(selectedPriceTier, custId, templateType);
    const suffix = templateType === 'missing' ? 'cac-mon-thieu' : 'toan-bo';
    void downloadAuthenticatedFile(url, `bom-template-${selectedPriceTier}-${suffix}.xlsx`);
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('File', file);
      formData.append('PriceTier', String(selectedPriceTier));
      if (scopeCustomer !== 'GLOBAL') {
        formData.append('CustomerId', scopeCustomer);
      }
      formData.append('TemplateType', initialTemplateType || 'by-dish');

      const result = await bomApi.previewBomImport(formData);
      setPreview(result);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể phân tích file Excel BOM.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview?.canCommit) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('File', file);
      formData.append('PriceTier', String(selectedPriceTier));
      if (scopeCustomer !== 'GLOBAL') {
        formData.append('CustomerId', scopeCustomer);
      }
      formData.append('TemplateType', initialTemplateType || 'by-dish');

      const commitResult = await bomApi.commitBomImport(formData);
      setFeedback({
        type: 'success',
        message: `Đã nhập thành công ${commitResult.totalCommittedRows} dòng BOM (${commitResult.createdRows} tạo mới, ${commitResult.updatedRows} cập nhật) cho catalog.`,
      });
      setFile(null);
      setPreview(null);
      onImportSuccess?.();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể lưu định mức BOM hàng loạt.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isMissingMode ? 'Nhập định mức BOM cho các món còn thiếu' : 'Nhập định mức BOM hàng loạt từ file Excel'}
      description={isMissingMode ? 'Tải tệp mẫu Excel điền sẵn danh sách các món ăn chưa có định mức trong tuần để bổ sung nhanh.' : 'Tải lên tệp định mức BOM chuẩn theo mốc giá để định mức hàng loạt cho tất cả món ăn trong catalog.'}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => handleDownloadTemplate('missing')}
              className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold shadow-2xs"
            >
              <Download size={14} aria-hidden="true" />
              <span>Tải file Excel các món thiếu BOM</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDownloadTemplate('by-dish')}
              className="flex items-center gap-1.5 text-slate-700 hover:bg-slate-50"
            >
              <Download size={14} aria-hidden="true" />
              <span>Tải file mẫu toàn bộ</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Đóng
            </Button>
            {!preview ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isLoading || !file}
                onClick={() => void handlePreview()}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {isLoading ? 'Đang phân tích…' : 'Xem trước'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isLoading || !preview.canCommit}
                onClick={() => void handleCommit()}
                className="bg-emerald-700 text-white hover:bg-emerald-800 font-semibold"
              >
                {isLoading ? 'Đang lưu…' : 'Xác nhận nhập BOM hàng loạt'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-700">
        {feedback && (
          <InlineBanner variant={feedback.type} onClose={() => setFeedback(null)}>
            {feedback.message}
          </InlineBanner>
        )}

        {missingDishesDiagnostics && missingDishesDiagnostics.length > 0 && (
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded text-xs space-y-1">
            <span className="font-semibold text-amber-900 block">
              Các món đang thiếu định mức BOM cần bổ sung ({missingDishesDiagnostics.length} món):
            </span>
            <ul className="list-disc pl-4 text-amber-800 space-y-0.5">
              {missingDishesDiagnostics.map((d, idx) => (
                <li key={idx}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Form controls: 3 price tiers & Scope */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="block font-semibold text-slate-700 mb-1">
                Mốc giá suất ăn áp dụng (BOM Tier) <span className="text-rose-600">*</span>
              </span>
              <div className="flex gap-2" role="radiogroup" aria-label="Mốc giá BOM">
                {PRICE_TIERS.map((tier) => {
                  const isSelected = selectedPriceTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => { setSelectedPriceTier(tier); setPreview(null); }}
                      className={clsx(
                        'px-3 py-1.5 rounded border text-center transition-all cursor-pointer font-mono font-semibold',
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      )}
                    >
                      {tier.toLocaleString('vi-VN')} ₫
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block font-semibold text-slate-700 mb-1">
                Phạm vi áp dụng <span className="text-rose-600">*</span>
              </span>
              <Select
                aria-label="Phạm vi áp dụng BOM"
                value={scopeCustomer}
                onChange={(e) => { setScopeCustomer(e.target.value); setPreview(null); }}
                options={[
                  { value: 'GLOBAL', label: 'Dùng chung toàn hệ thống (Global)' },
                  ...customers.map((c) => ({ value: c.customerId, label: `Khách: ${c.customerCode} - ${c.customerName}` })),
                ]}
                className="h-8 text-xs font-medium w-60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bom-excel-file" className="block font-semibold text-slate-700 mb-1">
              File Excel định mức BOM (.xlsx) <span className="text-rose-600">*</span>
            </label>
            <input
              ref={fileInputRef}
              id="bom-excel-file"
              type="file"
              accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Chọn file Excel định mức BOM"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-white file:text-slate-700 file:border file:border-slate-300 hover:file:bg-slate-50 cursor-pointer border border-slate-200 rounded p-1 bg-white"
            />
          </div>
        </div>

        {/* Preview Results Analysis */}
        {preview && (
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white space-y-3 p-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <FileSpreadsheet size={16} className="text-blue-600" aria-hidden="true" />
                <span>Kết quả phân tích định mức BOM ({preview.totalRows} dòng quét)</span>
              </span>
              <Badge variant={preview.canCommit ? 'success' : 'danger'} size="sm">
                {preview.canCommit ? 'Hợp lệ để nhập' : 'Có lỗi cần sửa'}
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Tổng dòng</span>
                <strong className="font-mono text-sm text-slate-900">{preview.totalRows}</strong>
              </div>
              <div className="p-2 bg-emerald-50/50 rounded border border-emerald-100">
                <span className="text-[11px] text-emerald-700 block">Hợp lệ</span>
                <strong className="font-mono text-sm text-emerald-800">{preview.validRows}</strong>
              </div>
              <div className="p-2 bg-rose-50/50 rounded border border-rose-100">
                <span className="text-[11px] text-rose-700 block">Lỗi</span>
                <strong className="font-mono text-sm text-rose-800">{preview.errorRows}</strong>
              </div>
              <div className="p-2 bg-blue-50/50 rounded border border-blue-100">
                <span className="text-[11px] text-blue-700 block">Số món phủ BOM</span>
                <strong className="font-mono text-sm text-blue-800">
                  {new Set(preview.rows?.map((r) => r.dishCode) || []).size}
                </strong>
              </div>
            </div>

            {preview.warnings?.length > 0 && (
              <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900">
                <span className="font-semibold block mb-1 flex items-center gap-1">
                  <AlertTriangle size={13} aria-hidden="true" /> Cảnh báo:
                </span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {preview.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                </ul>
              </div>
            )}

            {preview.rows?.length > 0 && (
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5 w-12 text-center">Dòng</th>
                      <th className="py-2 px-2.5 w-24">Mã món</th>
                      <th className="py-2 px-2.5">Tên món</th>
                      <th className="py-2 px-2.5 w-24">Mã NL</th>
                      <th className="py-2 px-2.5">Tên nguyên liệu</th>
                      <th className="py-2 px-2 text-center w-14">ĐVT</th>
                      <th className="py-2 px-2.5 text-right w-24">Định mức</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.slice(0, 50).map((row) => (
                      <tr key={row.rowNumber} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 font-mono text-center text-slate-400">{row.rowNumber}</td>
                        <td className="py-1.5 px-2.5 font-mono font-medium">{row.dishCode}</td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900 truncate max-w-36">{row.dishName}</td>
                        <td className="py-1.5 px-2.5 font-mono"><IdentifierText value={row.ingredientCode} /></td>
                        <td className="py-1.5 px-2.5 text-slate-700 truncate max-w-36">{row.ingredientName}</td>
                        <td className="py-1.5 px-2 text-center font-mono">{row.unitCode}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                          <Num value={row.grossQtyPerServing} format="quantity" decimals={4} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
