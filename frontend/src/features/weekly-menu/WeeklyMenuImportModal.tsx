import { PaginationBar } from '../../components/workbench/PaginationBar';
import { WorkbenchSkeleton } from '../../components/workbench/WorkbenchSkeleton';
import { useDeferredSkeleton } from '../../hooks/useDeferredSkeleton';
import { useState, useRef, useEffect } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { InlineBanner } from '../../components/ui/inline-banner';
import { ApiError } from '../../api/client';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { weeklyMenuApi, type WeeklyMenuImportHistoryItem, type WeeklyMenuImportSnapshot } from '../../api/weeklyMenuApi';
import { isWeekStartDate, toIsoDate, toVietnameseDate } from '../../utils/dates';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';
import type { CustomerOption } from '../../types';
import { useSupportedPriceTiers } from '../../hooks/useSupportedPriceTiers';
import { useWeeklyMenuImportItems } from './hooks/useWeeklyMenuImportItems';
import { WeeklyMenuImportPreview } from './WeeklyMenuImportPreview';
import { getMrxDishSlotLabel, getMrxShiftLabel } from '../../constants/mrxConstants';

interface WeeklyMenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerOption[];
  initialCustomerId?: string;
  initialWeekStartDate?: string;
  initialScopeIntent?: 'current-week' | 'new-week';
  currentWeekStartDate?: string;
  mrxActorRole?: 'ADMIN' | 'MANAGER' | 'COORDINATOR' | 'WAREHOUSE';
  onImportSuccess: (scope?: { customerId: string; weekStartDate: string }) => void;
}

export function WeeklyMenuImportModal({
  isOpen,
  onClose,
  customers = [],
  initialCustomerId = '',
  initialWeekStartDate = '',
  initialScopeIntent,
  currentWeekStartDate = '',
  mrxActorRole,
  onImportSuccess,
}: WeeklyMenuImportModalProps) {
  const { tiers, isLoading: isLoadingTiers, error: tierError, retry: retryTiers } = useSupportedPriceTiers(isOpen);
  const imports = useWeeklyMenuImportItems({ customerId: initialCustomerId || customers[0]?.customerId || '', weekStartDate: initialWeekStartDate, scopeIntent: initialScopeIntent }, tierError || isLoadingTiers ? [] : tiers);
  const [selectedItemId, setSelectedItemId] = useState('');
  const item = imports.items.find(candidate => candidate.id === selectedItemId) ?? imports.items[0];
  const selectedCustomerId = item.customerId;
  const weekStartDate = item.weekStartDate;
  const previewResult = item.preview;
  const hasValidWeek = !item.dateError && isWeekStartDate(weekStartDate);
  const fileInput = useRef<HTMLInputElement>(null);
  const replacementInput = useRef<HTMLInputElement>(null);
  const weekContextId = `import-week-context-${item.id}`;
  const weekContext = item.dateError ? null : item.weekMode === 'current'
    ? 'Khách hàng và tuần đang xem được giữ cố định. Chọn tuần khác để nhập phạm vi mới.' : item.draftMatch?.status === 'matched'
    ? `Đang dùng bản nháp tuần ${toVietnameseDate(weekStartDate)}`
    : item.draftMatch?.status === 'loading' ? 'Đang kiểm tra bản nháp…'
    : item.draftMatch?.status === 'ambiguous' ? 'Chọn bản nháp phù hợp hoặc đổi tuần để nhập cho tuần mới.'
    : item.draftMatch?.status === 'error' ? item.draftMatch.error
    : 'Chọn tuần bắt đầu vào Thứ Hai.';
  const [autoPublish, setAutoPublish] = useState(true);
  const isLoading = imports.isCommitting || imports.pendingPreviews > 0;
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'upload' | 'history'>('upload');
  const [historyState, setHistoryState] = useState<{ customerId: string; page: number; items: WeeklyMenuImportHistoryItem[]; totalCount: number; error: string | null } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRetry, setHistoryRetry] = useState(0);
  const history = historyState?.customerId === selectedCustomerId ? historyState : null;
  const historyPending = !history || history.page !== historyPage;
  const showHistorySkeleton = useDeferredSkeleton(historyPending && !history);
  const historyItems = history?.items ?? [];
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [confirmRollbackId, setConfirmRollbackId] = useState<string | null>(null);
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null);
  const [historySnapshot, setHistorySnapshot] = useState<WeeklyMenuImportSnapshot | null>(null);
  const [historySnapshotMessage, setHistorySnapshotMessage] = useState<string | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotVersionId, setSnapshotVersionId] = useState('');
  const snapshotRequest = useRef(0);
  const notified = useRef(false);
  useEffect(() => {
    if (imports.results.length !== 1 || imports.isCommitting || imports.publicationWarning || notified.current) return;
    notified.current = true;
    onClose();
    onImportSuccess({ customerId: imports.results[0].customerId, weekStartDate: imports.results[0].weekStartDate! });
  }, [imports.results, imports.isCommitting, imports.publicationWarning, onClose, onImportSuccess]);

  // Load history when tab is switched to history
  useEffect(() => {
    if (activeModalTab !== 'history' || !isOpen) return;
    let ignore = false;
    weeklyMenuApi.getImportHistory(selectedCustomerId, historyPage, 20)
      .then((res) => {
        if (!ignore) setHistoryState({ customerId: selectedCustomerId, page: historyPage, items: res.items, totalCount: res.totalCount, error: null });
      })
      .catch((cause: unknown) => { if (!ignore) setHistoryState({ customerId: selectedCustomerId, page: historyPage, items: [], totalCount: 0, error: cause instanceof Error ? cause.message : 'Không thể tải lịch sử nhập.' }); });
    return () => { ignore = true; snapshotRequest.current += 1; };
  }, [activeModalTab, selectedCustomerId, historyPage, isOpen, historyRetry]);

  const executeRollback = async (menuVersionId: string) => {
    if (isRollingBack || isLoading) return;
    setIsRollingBack(true);
    setError(null);
    setConfirmRollbackId(null);
    try {
      const res = await weeklyMenuApi.rollbackImport(menuVersionId);
      setRollbackSuccess(`Đã hủy phiên nhập thành công (gỡ bỏ ${res.menuSchedulesRemoved} lịch thực đơn).`);
      // Reload history
      const historyRes = await weeklyMenuApi.getImportHistory(selectedCustomerId, historyPage, 20);
      setHistoryState({ customerId: selectedCustomerId, page: historyPage, items: historyRes.items, totalCount: historyRes.totalCount, error: null });
      onImportSuccess();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể hủy phiên nhập.');
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleRollback = (menuVersionId: string) => {
    setConfirmRollbackId(menuVersionId);
  };

  const showImportSnapshot = async (menuVersionId: string) => {
    const request = ++snapshotRequest.current;
    setSnapshotVersionId(menuVersionId);
    setIsLoadingSnapshot(true);
    setHistorySnapshotMessage(null);
    setSnapshotError(null);
    try {
      const snapshot = await weeklyMenuApi.getImportSnapshot(menuVersionId);
      if (request === snapshotRequest.current) setHistorySnapshot(snapshot);
    } catch (cause) {
      if (request !== snapshotRequest.current) return;
      setHistorySnapshot(null);
      if (cause instanceof ApiError && cause.status === 404) setHistorySnapshotMessage('Không có dữ liệu nguồn được lưu cho phiên nhập này.');
      else setSnapshotError(cause instanceof Error ? cause.message : 'Không thể tải nguồn đã lưu.');
    } finally {
      if (request === snapshotRequest.current) setIsLoadingSnapshot(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!hasValidWeek || isDownloading) return;
    setIsDownloading(true);
    setError(null);
    try {
      const url = weeklyMenuApi.getWeeklyMenuTemplateUrl(selectedCustomerId, toIsoDate(weekStartDate));
      await downloadAuthenticatedFile(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải mẫu thực đơn. Vui lòng thử lại.'); }
    finally { setIsDownloading(false); }
  };

  const openResult = (customerId: string, weekStartDate: string) => {
    if (isLoading || isRollingBack || notified.current) return;
    notified.current = true;
    onClose();
    onImportSuccess({ customerId, weekStartDate });
  };

  const clearSnapshot = () => {
    snapshotRequest.current += 1;
    setHistorySnapshot(null);
    setHistorySnapshotMessage(null);
    setSnapshotError(null);
    setIsLoadingSnapshot(false);
  };

  const customerOptions = customers.map((c) => ({
    value: c.customerId,
    label: `${c.customerCode} - ${c.customerName}`,
  }));

  const mrxDayOutcomes = previewResult?.mrxDayOutcomes ?? [];
  const isMrxReimport = mrxDayOutcomes.length > 0;
  const commitLabel = isMrxReimport && mrxActorRole === 'COORDINATOR'
    ? 'Gửi duyệt'
    : isMrxReimport && (mrxActorRole === 'ADMIN' || mrxActorRole === 'MANAGER')
      ? 'Áp dụng ngay'
      : 'Xác nhận nhập';

  return (
    <Modal
      isOpen={isOpen}
      isDirty={!imports.results.length && imports.items.some(candidate => candidate.file || candidate.priceTierAmount !== null || candidate.dateError)}
      closeDisabled={isLoading || isRollingBack}
      onClose={() => {
        if (isLoading || isRollingBack) return;
        clearSnapshot();
        if (imports.results.length && !notified.current) { notified.current = true; onImportSuccess(); }
        onClose();
      }}
      title="Nhập thực đơn tuần từ file Excel"
      description="Kiểm tra khách hàng, tuần và mức giá trước khi nhập. Nhập nhiều file sẽ lưu bản nháp."
      maxWidth="max-w-5xl"
      className={activeModalTab === 'history' ? 'mrx-import-history-frame' : undefined}
      footer={(requestClose) => (
        <div className="flex items-center justify-between w-full">
          {activeModalTab === 'upload' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadTemplate()}
              disabled={isDownloading || !selectedCustomerId || !hasValidWeek}
            >
              Tải file mẫu Excel
            </Button>
          ) : (
            <span className="text-xs text-slate-500">Các phiên đã chốt đối soát không thể hủy</span>
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={isLoading || isRollingBack}>
              Đóng
            </Button>
            {activeModalTab === 'upload' && !imports.results.length && (
              <>
                {imports.hasAllPreviews && <Button variant="outline" size="sm" disabled={imports.isCommitting || item.isPreviewing || !imports.validScope(item)} onClick={() => void imports.previewItem(item.id)}>Xem trước lại</Button>}
                {imports.hasAllPreviews ? (
                  <Button type="button" variant="default" size="sm" disabled={!imports.canCommit || isRollingBack} onClick={() => void imports.commitItems(autoPublish)}>
                    {imports.isCommitting ? 'Đang lưu…' : imports.items.length > 1 ? 'Xác nhận nhập nhóm' : commitLabel}
                  </Button>
                ) : (
                  <Button type="button" variant="default" size="sm" disabled={imports.isCommitting || isRollingBack || item.isPreviewing || !imports.validScope(item)} onClick={() => void imports.previewItem(item.id)}>
                    {item.isPreviewing ? 'Đang phân tích…' : 'Xem trước'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    >
      <div className="space-y-4 text-sm text-slate-700 py-1">
        {/* Tab switcher */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            disabled={isLoading || isRollingBack}
            onClick={() => { setActiveModalTab('upload'); setError(null); clearSnapshot(); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              activeModalTab === 'upload'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Nhập file Excel
          </button>
          <button
            type="button"
            disabled={isLoading || isRollingBack}
            onClick={() => { setActiveModalTab('history'); setError(null); clearSnapshot(); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              activeModalTab === 'history'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Lịch sử nhập ({history && !history.error ? history.totalCount : '—'})
          </button>
        </div>

        {rollbackSuccess && (
          <InlineBanner variant="success" onClose={() => setRollbackSuccess(null)}>
            {rollbackSuccess}
          </InlineBanner>
        )}

        {(error || (activeModalTab === 'upload' && (imports.error || item.error))) && (
          <InlineBanner variant="error">{error || imports.error || item.error}</InlineBanner>
        )}

        {activeModalTab === 'history' ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Có thể hủy phiên nhập khi lô chưa chốt đối soát.
            </p>
            <div className="mrx-import-history-table border border-slate-200 rounded overflow-x-auto" aria-busy={historyPending || undefined} data-loading-phase={showHistorySkeleton ? 'visible' : 'reserved'}>
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-2.5">Phiên bản / File</th>
                    <th className="p-2.5">Tuần bắt đầu</th>
                    <th className="p-2.5">Thời gian tải</th>
                    <th className="p-2.5 text-right">Dòng hợp lệ</th>
                    <th className="p-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {!history ? <>
                    <tr><td colSpan={5}><span role="status" className="sr-only">Đang tải lịch sử nhập…</span></td></tr>
                    {Array.from({ length: 5 }, (_, row) => <tr key={row} data-skeleton-mark aria-hidden="true"><td colSpan={5} className="h-10 bg-slate-50" /></tr>)}
                  </> : history.error ? <tr><td colSpan={5} className="p-3">
                    <InlineBanner variant="error" actionLabel="Tải lại lịch sử" onAction={() => { setHistoryState(null); setHistoryRetry((value) => value + 1); clearSnapshot(); }}>{history.error}</InlineBanner>
                  </td></tr> : historyItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                        Chưa có lịch sử nhập cho khách hàng này.
                      </td>
                    </tr>
                  ) : (
                    historyItems.map((item) => (
                      <tr key={item.menuVersionId} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-medium text-slate-900">
                          <span className="font-bold">v{item.versionNo}</span>
                          <span className="block text-slate-500 font-mono text-xs break-words">
                            {item.sourceFileName || 'weekly-menu.xlsx'}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-700">
                          {toVietnameseDate(item.weekStartDate)}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="p-2.5 text-right font-mono tabular-nums font-bold text-slate-800">
                          {item.successRowCount}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={isLoadingSnapshot || historyPending}
                              onClick={() => void showImportSnapshot(item.menuVersionId)}
                            >
                              Xem nguồn
                            </Button>
                            {item.canRollback ? (
                              confirmRollbackId === item.menuVersionId ? (
                                <>
                                  <Button
                                    variant="destructive"
                                    size="xs"
                                    disabled={isRollingBack || historyPending}
                                    onClick={() => void executeRollback(item.menuVersionId)}
                                    className="h-7 px-2 text-xs"
                                  >
                                    Xác nhận hủy
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    disabled={isRollingBack}
                                    onClick={() => setConfirmRollbackId(null)}
                                    className="h-7 px-1.5 text-xs"
                                  >
                                    Quay lại
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  disabled={isRollingBack || historyPending}
                                  onClick={() => handleRollback(item.menuVersionId)}
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                >
                                  Hủy phiên
                                </Button>
                              )
                            ) : (
                              <span className="text-slate-400 italic text-xs">Không thể hủy</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {history && !history.error && <PaginationBar label="Phân trang lịch sử nhập" hideVisibleLabel page={history.page} pageSize={20} totalCount={history.totalCount} pending={historyPending}
              totalPages={Math.max(1, Math.ceil(history.totalCount / 20))} hasPrev={historyPage > 1}
              hasNext={historyPage * 20 < history.totalCount} onPageChange={page => { clearSnapshot(); setHistoryPage(page); }} placement="toolbar" />}
            {(isLoadingSnapshot || historySnapshotMessage || historySnapshot || snapshotError) && (
              <div className="border border-slate-200 rounded p-3" aria-live="polite" aria-busy={isLoadingSnapshot || undefined}>
                {isLoadingSnapshot && historySnapshot && <span className="sr-only">Đang tải nguồn khác; nội dung đang hiển thị thuộc lần xem trước.</span>}
                {isLoadingSnapshot && !historySnapshot ? (
                  <WorkbenchSkeleton geometry={{ kind: 'table', columns: 3, rows: 5 }} />
                ) : snapshotError ? (
                  <InlineBanner variant="error" actionLabel="Tải lại nguồn" onAction={() => void showImportSnapshot(snapshotVersionId)}>{snapshotError}</InlineBanner>
                ) : historySnapshotMessage ? (
                  <p className="text-xs text-slate-600">{historySnapshotMessage}</p>
                ) : historySnapshot ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-800">
                      Nguồn chuẩn hóa tuần {toVietnameseDate(historySnapshot.weekStartDate)}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-slate-500">
                          <tr><th className="py-1">Ngày</th><th>Ca / Nhóm món</th><th>Món</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {historySnapshot.rows.map((row) => (
                            <tr key={`${row.serviceDate}-${row.shiftName}-${row.sourceOrder}-${row.dishSlot}`}>
                              <td className="py-1 font-mono">{toVietnameseDate(row.serviceDate)}</td>
                              <td>{getMrxShiftLabel(row.shiftName)} · {getMrxDishSlotLabel(row.dishSlot)}</td>
                              <td>{row.dishName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : imports.results.length > 0 ? (
          <div className="space-y-3" role="status">
            {imports.publicationWarning && <InlineBanner variant="warning">{imports.publicationWarning}</InlineBanner>}
            <p className="font-semibold">Đã nhận kết quả nhập cho {imports.results.length} phạm vi. {mrxActorRole ? 'Chọn tuần cần mở hoặc đóng để giữ phạm vi đang xem.' : 'Đóng để làm mới phạm vi đang xem.'}</p>
            {imports.results.map((result, index) => <div key={`${result.customerId}-${result.weekStartDate}`} className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 rounded p-3">
              <span>{result.customerName} · {toVietnameseDate(result.weekStartDate ?? '')} · Mốc giá đã chọn: {imports.items[index].priceTierAmount?.toLocaleString('vi-VN')} ₫</span>
              {mrxActorRole && <Button variant="outline" size="sm" disabled={isLoading || isRollingBack} onClick={() => openResult(result.customerId, result.weekStartDate!)}>Mở tuần {result.customerName} {toVietnameseDate(result.weekStartDate ?? '')}</Button>}
            </div>)}
          </div>
        ) : (
          <>
            {isLoadingTiers && <p role="status" className="sr-only">Đang tải mốc giá BOM…</p>}
            {tierError && <InlineBanner variant="error" actionLabel="Tải lại mốc giá" onAction={() => void retryTiers()}>{tierError.message}</InlineBanner>}
            {imports.duplicateScope && <InlineBanner variant="warning">Mỗi khách hàng và tuần chỉ được có một file trong nhóm.</InlineBanner>}
            {imports.items.length > 1 && <p className="text-xs">Nhập nhóm chỉ lưu bản nháp, không tự động công bố. Muốn cập nhật tuần đã có lô, hãy nhập từng file và xem trước các ngày được phép thay đổi.</p>}
            <div className="space-y-2" aria-label="Các file nhập">
              {imports.items.filter(candidate => candidate.file).map(candidate => <div key={candidate.id} className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" aria-pressed={candidate.id === item.id} onClick={() => setSelectedItemId(candidate.id)}>{candidate.file!.name}</Button>
                <span className="text-xs">{candidate.dateError ? 'Ngày chưa hợp lệ' : candidate.preview ? 'Đã xem trước' : candidate.isPreviewing ? 'Đang phân tích…' : 'Chưa xem trước'}</span>
                <Button variant="ghost" size="sm" disabled={imports.isCommitting || isRollingBack} onClick={() => imports.removeItem(candidate.id)}>Bỏ file {candidate.file!.name}</Button>
              </div>)}
            </div>
            {mrxActorRole && initialScopeIntent && isWeekStartDate(currentWeekStartDate) && initialCustomerId && <div>
              <label htmlFor="import-scope-intent" className="block text-xs font-semibold mb-1">Phạm vi của file đang chọn</label>
              <Select id="import-scope-intent" aria-label="Phạm vi nhập Excel" value={item.weekMode === 'current' ? 'current-week' : 'new-week'}
                disabled={isLoading || isRollingBack || imports.results.length > 0}
                options={[{ value: 'current-week', label: 'Tuần đang xem' }, { value: 'new-week', label: 'Chọn tuần khác' }]}
                onChange={event => { imports.setScopeIntent(item.id, event.target.value === 'current-week' ? 'current-week' : 'new-week', { customerId: initialCustomerId, weekStartDate: currentWeekStartDate }); clearSnapshot(); }} />
            </div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                if (imports.isCommitting || isRollingBack) return;
                imports.updateItem(item.id, { customerId: e.target.value });
                setHistoryPage(1);
                clearSnapshot();
              }}
              className="w-full h-9 text-sm"
              disabled={imports.isCommitting || isRollingBack || item.weekMode === 'current'}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tuần bắt đầu (Thứ Hai) <span className="text-rose-600">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
            <VietnameseDateInput
              aria-label="Tuần bắt đầu nhập"
              aria-describedby={weekContextId}
              readOnly={item.weekMode === 'saved' || item.weekMode === 'current'}
              required
              isDateAllowed={isWeekStartDate}
              validationMessage="Ngày bắt đầu tuần phải là Thứ Hai."
              key={item.id}
              error={Boolean(item.dateError)}
              onValidationChange={(message) => { if (item.weekMode === 'manual' || item.weekMode === 'entry') imports.updateItem(item.id, { dateError: message }); }}
              value={weekStartDate}
              disabled={imports.isCommitting || isRollingBack}
              onChange={(date) => imports.updateItem(item.id, { weekStartDate: date })}
              className="w-full h-9 font-mono text-sm"
            />
            {item.weekMode === 'saved' && <Button variant="ghost" size="sm" disabled={imports.isCommitting || isRollingBack} onClick={() => imports.enableWeekChange(item.id)}>Đổi tuần</Button>}
            </div>
            <div id={weekContextId} className="min-h-5 text-xs text-slate-600" aria-live="polite">
              {weekContext}
              {item.draftMatch?.status === 'error' && <Button variant="link" size="sm" onClick={() => imports.loadDraftPage(item.id)}>Thử lại bản nháp</Button>}
            </div>
            {item.draftMatch?.status === 'ambiguous' && <>
              <Select aria-label="Chọn tuần bản nháp" value="" options={[{ value: '', label: 'Chọn tuần đã lưu…' }, ...item.draftMatch.items.map(draft => ({ value: draft.menuVersionId, label: `${toVietnameseDate(draft.weekStartDate)} · v${draft.versionNo}` }))]} onChange={event => imports.chooseDraft(item.id, event.target.value)} />
              <PaginationBar label="Bản nháp phù hợp" page={item.draftPage} pageSize={10} totalCount={item.draftMatch.totalCount} totalPages={Math.ceil(item.draftMatch.totalCount / 10)} hasPrev={item.draftPage > 1} hasNext={item.draftPage * 10 < item.draftMatch.totalCount} onPageChange={page => imports.loadDraftPage(item.id, page)} placement="toolbar" />
            </>}
          </div>
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-700 mb-1.5">
            Mức giá suất ăn <span className="text-rose-600">*</span>
          </span>
          <div className="grid grid-cols-3 gap-2 min-h-9" role="radiogroup" aria-label="Mốc giá suất ăn" aria-busy={isLoadingTiers || undefined}>
            {tiers.map((tier) => {
              const isSelected = item.priceTierAmount === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={imports.isCommitting || isRollingBack || isLoadingTiers || Boolean(tierError)}
                  onClick={() => imports.updateItem(item.id, { priceTierAmount: tier })}
                  className={`p-2 rounded border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-xs font-mono">{tier.toLocaleString('vi-VN')} ₫</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            File Excel thực đơn (.xlsx) <span className="text-rose-600">*</span>
          </label>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Chọn file Excel thực đơn"
            onChange={(event) => { imports.addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }}
            disabled={imports.isCommitting || isRollingBack}
            className="sr-only"
          />
          <Button variant="outline" size="sm" disabled={imports.isCommitting || isRollingBack} onClick={() => fileInput.current?.click()}>Chọn file Excel</Button>
        </div>

        {item.file && <div className="text-xs">
          <input ref={replacementInput} className="sr-only" type="file" accept=".xlsx" aria-label="Thay file đang chọn" disabled={imports.isCommitting || isRollingBack} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) imports.updateItem(item.id, { file });
            event.target.value = '';
          }} />
          <Button variant="ghost" size="sm" disabled={imports.isCommitting || isRollingBack} onClick={() => replacementInput.current?.click()}>Thay file đang chọn</Button>
        </div>}

        {!isMrxReimport && <div className="pt-1">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <Checkbox
              checked={imports.items.length === 1 && autoPublish}
              disabled={isLoading || isRollingBack || imports.items.length > 1}
              onChange={(e) => setAutoPublish(e.target.checked)}
            />
            <span>Tự động xuất bản thực đơn sau khi nhập (Để sẵn sàng lập lô MRX)</span>
          </label>
        </div>}

        {previewResult && <>
          <p role="status" className="text-xs text-slate-700">{imports.items.length > 1 ? 'Xác nhận sẽ lưu các file thành bản nháp.'
            : isMrxReimport ? mrxActorRole === 'COORDINATOR' ? 'Xác nhận sẽ gửi thay đổi nguồn để duyệt; các ngày đã xuất kho không được sửa.' : 'Xác nhận sẽ áp dụng các ngày được phép thay đổi vào lô hiện tại.'
              : autoPublish ? 'Xác nhận sẽ lưu và xuất bản thực đơn để lập lô đối soát.' : 'Xác nhận sẽ chỉ lưu thực đơn thành bản nháp.'}</p>
          <WeeklyMenuImportPreview key={`${item.id}-${previewResult.previewToken ?? item.revision}`} result={previewResult} priceTierAmount={item.priceTierAmount} />
        </>}
      </>
    )}
  </div>
</Modal>
  );
}
