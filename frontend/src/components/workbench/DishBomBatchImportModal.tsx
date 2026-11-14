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
import { VietnameseDateInput } from '../ui/vietnamese-date-input';
import { todayInBusinessTimezone, isIsoDate } from '../../utils/dates';

export interface DishBomBatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
  initialPriceTier?: number;
  initialCustomerId?: string;
  initialTemplateType?: 'missing' | 'by-dish';
  missingDishesDiagnostics?: readonly string[] | string[];
  mrxWeekStartDate?: string;
  mrxMenuVersionId?: string;
}

export function DishBomBatchImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  initialPriceTier,
  initialCustomerId = '',
  initialTemplateType = 'by-dish',
  missingDishesDiagnostics,
  mrxWeekStartDate,
  mrxMenuVersionId,
}: DishBomBatchImportModalProps) {
  const isMissingMode = initialTemplateType === 'missing' || Boolean(missingDishesDiagnostics && missingDishesDiagnostics.length > 0);
  const { tiers, isLoading: isLoadingTiers, error: tierError, retry: retryTiers } = useSupportedPriceTiers(isOpen);
  const [chosenPriceTier, setSelectedPriceTier] = useState<number | undefined>(initialPriceTier);
  const selectedPriceTier = chosenPriceTier ?? tiers[0] ?? 0;
  const hasUsableTier = !isLoadingTiers && !tierError && tiers.includes(selectedPriceTier);
  const [scopeCustomer, setScopeCustomer] = useState<string>(initialCustomerId || 'GLOBAL');
  const [effectiveDate, setEffectiveDate] = useState(() => todayInBusinessTimezone());
  const [dateError, setDateError] = useState<string | null>(null);
  const isCurrentMrxScope = Boolean(mrxWeekStartDate && mrxMenuVersionId && initialCustomerId && scopeCustomer === initialCustomerId);
  const generalDateReady = !dateError && isIsoDate(effectiveDate);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BomImportPreviewResult | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
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
    setPreviewPage(1);
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
    const contextual = templateType === 'missing' && isCurrentMrxScope;
    if (!hasUsableTier || isDownloading || isCommitting || isLoadingCustomers || customerError || (!contextual && !generalDateReady)) return;
    setIsDownloading(true);
    setFeedback(null);
    try {
      const custId = scopeCustomer !== 'GLOBAL' ? scopeCustomer : undefined;
      const url = bomApi.getBomTemplateUrl(selectedPriceTier, custId, contextual ? 'mrx-missing' : templateType,
        contextual ? { weekStartDate: mrxWeekStartDate, menuVersionId: mrxMenuVersionId } : { effectiveDate });
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

  const previewRows = preview?.errorRows ? preview.rows.filter(row => row.errors.length > 0) : preview?.rows ?? [];
  const previewPageCount = Math.max(1, Math.ceil(previewRows.length / 50));
  const visiblePreviewRows = previewRows.slice((previewPage - 1) * 50, previewPage * 50);

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
        {isMissingMode && <InlineBanner variant="info" title="Bổ sung BOM hàng loạt">
          Tải file các món thiếu BOM, điền nguyên liệu và định lượng/suất. Với nguyên liệu mới, để trống mã nguyên liệu, nhập tên và đơn vị; bản xem trước sẽ báo mã dự kiến tạo. Sửa file rồi tải lên lại để xem trước trước khi xác nhận. Sau khi nhập, quay lại kiểm tra nguồn MRX; không cần nhập lại file thực đơn.
        </InlineBanner>}
        {scopeCustomer !== 'GLOBAL' && <InlineBanner variant="info" title="BOM riêng của khách hàng">
          Khi có BOM riêng, hệ thống dùng toàn bộ công thức của khách hàng thay cho công thức dùng chung. Nếu cần điều chỉnh một nguyên liệu, hãy tải file toàn danh mục theo phạm vi và giữ các nguyên liệu còn lại trong file nhập.
        </InlineBanner>}
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
          <div className="space-y-1">
            <label htmlFor="bom-template-effective-date" className="block font-semibold text-slate-700">Ngày xét BOM toàn danh mục</label>
            <VietnameseDateInput id="bom-template-effective-date" aria-label="Ngày xét BOM toàn danh mục" value={effectiveDate}
              onChange={value => { setEffectiveDate(value); setDateError(null); }} onValidationChange={setDateError} error={Boolean(dateError)} />
            <p>Áp dụng khi tải file danh mục. File thiếu BOM của tuần MRX dùng ngày phục vụ của tuần đang xem.</p>
            {dateError && <InlineBanner variant="error">{dateError}</InlineBanner>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!hasUsableTier || isDownloading || isCommitting || isLoadingCustomers || Boolean(customerError) || (!isCurrentMrxScope && !generalDateReady)} onClick={() => void handleDownloadTemplate('missing')}>
              <Download size={14} aria-hidden="true" />{isCurrentMrxScope ? 'Tải Excel món thiếu của tuần MRX' : 'Tải Excel món thiếu theo phạm vi'}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!hasUsableTier || isDownloading || isCommitting || isLoadingCustomers || Boolean(customerError) || !generalDateReady} onClick={() => void handleDownloadTemplate('by-dish')}>Tải file toàn danh mục theo phạm vi</Button>
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
            {preview.errorRows > 0 && <p className="text-xs">Đang hiển thị các dòng lỗi để sửa trong file rồi xem trước lại.</p>}

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

            {preview.rows?.length > 0 && (<>
              <div data-testid="bom-preview-viewport" className="max-h-72 overflow-auto border border-slate-200 rounded">
                <table className="w-full min-w-[960px] table-fixed text-left text-xs border-collapse">
                  <thead className="border-b border-slate-200 text-slate-600">
                    <tr>
                      <th scope="col" className="sticky top-0 left-0 z-30 w-12 min-w-12 max-w-12 bg-slate-50 py-2 px-2.5 text-center">Dòng</th>
                      <th scope="col" className="sticky top-0 left-12 z-30 w-24 bg-slate-50 border-r border-slate-200 py-2 px-2.5">Mã món</th>
                      <th scope="col" className="sticky top-0 z-20 bg-slate-50 py-2 px-2.5">Tên món</th>
                      <th scope="col" className="sticky top-0 z-20 bg-slate-50 py-2 px-2.5 w-32">Mã NL</th>
                      <th scope="col" className="sticky top-0 z-20 bg-slate-50 py-2 px-2.5">Tên nguyên liệu</th>
                      <th scope="col" className="sticky top-0 z-20 bg-slate-50 py-2 px-2 text-center w-14">ĐVT</th>
                      <th scope="col" className="sticky top-0 z-20 bg-slate-50 py-2 px-2.5 text-right w-24">Định mức</th>
                      <th scope="col" className="sticky top-0 z-20 bg-slate-50 py-2 px-2.5">Kết quả kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiblePreviewRows.map((row) => (
                      <tr key={row.rowNumber} className="group h-10 hover:bg-slate-50">
                        <td className="sticky left-0 z-10 w-12 min-w-12 max-w-12 bg-white group-hover:bg-slate-50 py-1.5 px-2.5 font-mono text-center text-slate-400">{row.rowNumber}</td>
                        <td className="sticky left-12 z-10 w-24 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-1.5 px-2.5 font-mono font-medium">{row.dishCode}</td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900 max-w-36"><span className="block truncate" title={row.dishName}>{row.dishName}</span></td>
                        <td className="py-1.5 px-2.5 font-mono w-32"><IdentifierText value={row.ingredientCode} displayValue={row.ingredientCode.length > 11 ? `${row.ingredientCode.slice(0, 6)}…${row.ingredientCode.slice(-4)}` : row.ingredientCode} title={row.ingredientCode} className="whitespace-nowrap" /></td>
                        <td className="py-1.5 px-2.5 text-slate-700 max-w-36"><span className="block truncate" title={row.ingredientName}>{row.ingredientName}</span></td>
                        <td className="py-1.5 px-2 text-center font-mono">{row.unitCode}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                          <Num value={row.grossQtyPerServing} format="quantity" decimals={6} />
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span>{row.errors.length ? 'Lỗi' : row.warnings.length ? 'Cảnh báo' : 'Hợp lệ'}</span>
                          {[...row.errors, ...row.warnings].length > 0 && <ul className="list-disc pl-4">{[...row.errors, ...row.warnings].map((message, index) => <li key={index}>{message}</li>)}</ul>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewPageCount > 1 && <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" disabled={previewPage === 1} onClick={() => setPreviewPage(page => page - 1)}>Trang trước</Button>
                <span>Trang {previewPage}/{previewPageCount}</span>
                <Button type="button" variant="outline" size="sm" disabled={previewPage === previewPageCount} onClick={() => setPreviewPage(page => page + 1)}>Trang sau</Button>
              </div>}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
