import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Download, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Num } from '../ui/num';
import { IdentifierText } from '../ui/identifier-text';
import { InlineBanner } from '../ui/inline-banner';
import { bomApi, type BomImportPreviewResult } from '../../api/bomApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';
import type { CustomerOption } from '../../types';

import { useSupportedPriceTiers } from '../../hooks/useSupportedPriceTiers';

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
  initialPriceTier,
  initialCustomerId = '',
  initialTemplateType = 'by-dish',
  missingDishesDiagnostics,
}: DishBomBatchImportModalProps) {
  const isMissingMode = initialTemplateType === 'missing' || Boolean(missingDishesDiagnostics && missingDishesDiagnostics.length > 0);
  const { tiers, isLoading: isLoadingTiers, error: tierError, retry: retryTiers } = useSupportedPriceTiers(isOpen);
  const [chosenPriceTier, setSelectedPriceTier] = useState<number | undefined>(initialPriceTier);
  const selectedPriceTier = chosenPriceTier ?? tiers[0] ?? 0;
  const hasUsableTier = !isLoadingTiers && !tierError && tiers.includes(selectedPriceTier);
  const [scopeCustomer, setScopeCustomer] = useState<string>(initialCustomerId || 'GLOBAL');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BomImportPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [customerError, setCustomerError] = useState<Error | null>(null);
  const [customerRetry, setCustomerRetry] = useState(0);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const previewRequest = useRef(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    weeklyMenuApi.getCustomers()
      .then((items) => {
        if (ignore) return;
        setCustomers(items);
        setCustomerError(null);
      })
      .catch((cause: unknown) => {
        if (!ignore) setCustomerError(cause instanceof Error ? cause : new Error('Không thể tải khách hàng.'));
      })
      .finally(() => { if (!ignore) setIsLoadingCustomers(false); });
    return () => { ignore = true; previewRequest.current += 1; };
  }, [isOpen, customerRetry]);

  const invalidatePreview = () => {
    previewRequest.current += 1;
    setPreview(null);
    setFeedback(null);
    setIsLoading(false);
  };

  const close = () => {
    if (isCommitting) return;
    invalidatePreview();
    onClose();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isCommitting) return;
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    invalidatePreview();
  };

  const handleDownloadTemplate = async (templateType: 'missing' | 'by-dish' = 'by-dish') => {
    if (!hasUsableTier || isDownloading || isCommitting || isLoadingCustomers || customerError) return;
    setIsDownloading(true);
    setFeedback(null);
    try {
      const custId = scopeCustomer !== 'GLOBAL' ? scopeCustomer : undefined;
      const url = bomApi.getBomTemplateUrl(selectedPriceTier, custId, templateType);
      await downloadAuthenticatedFile(url);
    } catch (cause) { setFeedback({ type: 'error', message: cause instanceof Error ? cause.message : 'Không thể tải mẫu định lượng. Vui lòng thử lại.' }); }
    finally { setIsDownloading(false); }
  };

  const handlePreview = async () => {
    if (!hasUsableTier || !file || isLoading || isCommitting || isLoadingCustomers || customerError) return;
    const request = ++previewRequest.current;
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
      if (previewRequest.current === request) setPreview(result);
    } catch (err: unknown) {
      if (previewRequest.current !== request) return;
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể phân tích file Excel BOM.',
      });
    } finally {
      if (previewRequest.current === request) setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!hasUsableTier || !file || !preview?.canCommit || isCommitting || isLoadingCustomers || customerError) return;
    setIsCommitting(true);
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
        message: `Đã nhập thành công ${commitResult.createdRows + commitResult.updatedRows} dòng BOM (${commitResult.createdRows} tạo mới, ${commitResult.updatedRows} cập nhật) cho catalog.`,
      });
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImportSuccess?.();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể lưu định mức BOM hàng loạt.',
      });
    } finally {
      setIsCommitting(false);
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={isMissingMode ? 'Nhập định mức BOM cho các món còn thiếu' : 'Nhập định mức BOM hàng loạt từ file Excel'}
      description="Chọn phạm vi và tệp Excel, kiểm tra kết quả trước khi nhập."
      maxWidth="max-w-4xl"
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={isCommitting}>Đóng</Button>
            {!preview ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={!hasUsableTier || isLoading || !file || isLoadingCustomers || Boolean(customerError)}
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
                disabled={!hasUsableTier || isLoading || !preview.canCommit || isLoadingCustomers || Boolean(customerError)}
                onClick={() => void handleCommit()}
                className="bg-emerald-700 text-white hover:bg-emerald-800 font-semibold"
              >
                {isLoading ? 'Đang lưu…' : 'Xác nhận nhập BOM hàng loạt'}
              </Button>
            )}
        </>
      }
    >
      <div className="space-y-4 text-xs text-slate-700">
        {isLoadingTiers && <p role="status" className="sr-only">Đang tải mốc giá BOM…</p>}
        {tierError && <InlineBanner variant="error" actionLabel="Tải lại mốc giá" onAction={() => void retryTiers()}>{tierError.message}</InlineBanner>}
        {customerError && <InlineBanner variant="error" actionLabel="Tải lại khách hàng" onAction={() => { setIsLoadingCustomers(true); setCustomerRetry((value) => value + 1); }}>{customerError.message}</InlineBanner>}
        {isLoadingCustomers && <p role="status" className="sr-only">Đang tải phạm vi khách hàng…</p>}
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
                Mức giá suất ăn <span className="text-rose-600">*</span>
              </span>
              <div className="flex gap-2 min-h-8" role="radiogroup" aria-label="Mốc giá BOM" aria-busy={isLoadingTiers || undefined}>
                {tiers.map((tier) => {
                  const isSelected = selectedPriceTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isCommitting}
                      onClick={() => { if (isCommitting) return; setSelectedPriceTier(tier); invalidatePreview(); }}
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
                disabled={isCommitting || isLoadingCustomers || Boolean(customerError)}
                onChange={(e) => { if (isCommitting) return; setScopeCustomer(e.target.value); invalidatePreview(); }}
                options={[
                  { value: 'GLOBAL', label: 'Dùng chung toàn hệ thống' },
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
              disabled={isCommitting}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-white file:text-slate-700 file:border file:border-slate-300 hover:file:bg-slate-50 cursor-pointer border border-slate-200 rounded p-1 bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!hasUsableTier || isDownloading || isCommitting || isLoadingCustomers || Boolean(customerError)} onClick={() => void handleDownloadTemplate('missing')}>
              <Download size={14} aria-hidden="true" />Tải file Excel các món thiếu BOM
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!hasUsableTier || isDownloading || isCommitting || isLoadingCustomers || Boolean(customerError)} onClick={() => void handleDownloadTemplate('by-dish')}>Tải file mẫu toàn bộ</Button>
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

            <p className="text-xs text-slate-700">
              <Num value={preview.validRows} /> dòng hợp lệ · <Num value={preview.errorRows} /> dòng lỗi · <Num value={preview.totalRows} /> dòng đã kiểm tra
            </p>

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
              <div className="overflow-x-auto border border-slate-200 rounded">
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
                      <tr key={row.rowNumber} className="h-10 hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 font-mono text-center text-slate-400">{row.rowNumber}</td>
                        <td className="py-1.5 px-2.5 font-mono font-medium">{row.dishCode}</td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900 truncate max-w-36">{row.dishName}</td>
                        <td className="py-1.5 px-2.5 font-mono"><IdentifierText value={row.ingredientCode} /></td>
                        <td className="py-1.5 px-2.5 text-slate-700 truncate max-w-36">{row.ingredientName}</td>
                        <td className="py-1.5 px-2 text-center font-mono">{row.unitCode}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                          <Num value={row.grossQtyPerServing} format="quantity" decimals={6} />
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
