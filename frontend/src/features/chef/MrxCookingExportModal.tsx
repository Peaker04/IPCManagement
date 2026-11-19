import { useEffect, useState } from 'react';
import { mrxApi, type MrxBatchPage } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { toVietnameseDate } from '../../utils/dates';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';

interface Props {
  batchId: string;
  weekStartDate: string;
  initialShift: 'ALL' | 'MORNING' | 'AFTERNOON';
  onClose: () => void;
}

const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export function MrxCookingExportModal({ batchId, weekStartDate, initialShift, onClose }: Props) {
  const [selected, setSelected] = useState([batchId]);
  const [serviceDate, setServiceDate] = useState('');
  const [shift, setShift] = useState(initialShift);
  const [catalog, setCatalog] = useState<MrxBatchPage | null>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    void mrxApi.getBatchPage({ weekStartDate, pageNumber: page, pageSize: 50 })
      .then(result => {
        if (active) setCatalog(result);
      })
      .catch(cause => {
        if (active) setCatalogError(cause instanceof Error ? cause.message : 'Không thể tải danh sách lô.');
      })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [weekStartDate, page, retry]);
  const canDownload = !pending && !catalogError && selected.length > 0 && !downloading;
  const days = WEEKDAYS.map((label, offset) => {
    const date = new Date(`${weekStartDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const value = date.toISOString().slice(0, 10);
    return { value, label: `${label} · ${toVietnameseDate(value)}` };
  });

  async function download() {
    if (!canDownload) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadAuthenticatedFile(mrxApi.getScopedKitchenCookingExportUrl({
        weekStartDate, batchIds: selected, serviceDate: serviceDate || undefined, shift,
      }), `phieu-nau-${serviceDate || weekStartDate}.xlsx`, { showScopeErrors: true });
      onClose();
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : 'Không thể tải phiếu nấu.');
    } finally {
      setDownloading(false);
    }
  }

  return <Modal isOpen onClose={onClose} closeDisabled={downloading} title="Xuất phiếu nấu Excel"
    description={`Tuần ${toVietnameseDate(weekStartDate)} – ${toVietnameseDate(days[6].value)}`}
    footer={<><Button variant="outline" disabled={downloading} onClick={onClose}>Đóng</Button>
      <Button disabled={!canDownload} onClick={() => void download()}>{downloading ? 'Đang tải…' : `Tải Excel · ${selected.length} lô`}</Button></>}>
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Ngày phục vụ
          <Select aria-label="Ngày phục vụ" disabled={downloading} value={serviceDate}
            onChange={event => { setServiceDate(event.target.value); setDownloadError(null); }}
            options={[{ value: '', label: 'Cả tuần' }, ...days]} />
        </label>
        <label className="space-y-1 text-sm font-medium">Ca phục vụ
          <Select aria-label="Ca phục vụ" disabled={downloading} value={shift}
            onChange={event => { setShift(event.target.value as Props['initialShift']); setDownloadError(null); }}
            options={[{ value: 'ALL', label: 'Tất cả ca' }, { value: 'MORNING', label: 'Ca sáng' }, { value: 'AFTERNOON', label: 'Ca chiều' }]} />
        </label>
      </div>
      <fieldset className="min-w-0 space-y-1" disabled={pending || downloading}>
        <legend className="text-sm font-medium">Lô cần xuất</legend>
        {pending && <p role="status" className="text-sm">Đang tải danh sách lô…</p>}
        {!pending && !catalogError && catalog?.items.length === 0 && <p className="text-sm">Không có thêm lô trong tuần này.</p>}
        {!pending && !catalogError && catalog?.items.map(batch => <label key={batch.batchId}
          className="flex min-h-9 items-center gap-2 break-words text-sm">
          <input type="checkbox" checked={selected.includes(batch.batchId)} className="shrink-0"
            disabled={selected.length >= 100 && !selected.includes(batch.batchId)}
            onChange={event => {
              const checked = event.target.checked;
              setSelected(previous => checked ? [...previous, batch.batchId] : previous.filter(id => id !== batch.batchId));
              setDownloadError(null);
            }} />
          <span className="min-w-0">{batch.customerCode} · {batch.customerName}{batch.batchId === batchId ? ' (lô đang xem)' : ` (phiên bản ${batch.version})`}</span>
        </label>)}
      </fieldset>
      {catalog && catalog.totalPages > 1 && <PaginationBar label="Phân trang lô trong tuần" page={catalog.pageNumber} pageSize={50}
        totalPages={catalog.totalPages} totalCount={catalog.totalCount} hasPrev={catalog.hasPrev} hasNext={catalog.hasNext}
        pending={pending || downloading} onPageChange={next => { setPending(true); setPage(next); }} />}
      {catalogError && <InlineBanner variant="error" actionLabel="Thử lại"
        onAction={() => { setPending(true); setCatalogError(null); setRetry(value => value + 1); }}>{catalogError}</InlineBanner>}
      {downloadError && <InlineBanner variant="error">{downloadError}</InlineBanner>}
    </div>
  </Modal>;
}
