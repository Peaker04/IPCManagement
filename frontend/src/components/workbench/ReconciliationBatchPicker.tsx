import { useEffect, useState } from 'react';
import { mrxApi, type MrxBatchPage, type MrxBatchSummary } from '../../api/mrxApi';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { VietnameseDateInput } from '../ui/vietnamese-date-input';
import { InlineBanner } from '../../components/ui/inline-banner';
import { IdentifierText } from '../../components/ui/identifier-text';
import { DataGrid } from '../../components/workbench/DataGrid';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { businessMonthRange, toVietnameseDate } from '../../utils/dates';
import { MRX_STATUS_LABELS } from '../../constants/mrxConstants';

interface Props {
  customerId?: string;
  month?: string;
  selectedBatchId: string;
  onClose: () => void;
  onSelect: (batch: MrxBatchSummary) => void;
}

/** Paged batch history; selecting a row never changes scope until the parent accepts it. */
export function ReconciliationBatchPicker({ customerId, month, selectedBatchId, onClose, onSelect }: Props) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState({ customerCode: '', weekFrom: '', weekTo: '', batchId: '' });
  const [filters, setFilters] = useState({ customerCode: '', weekFrom: '', weekTo: '', batchId: '' });
  const [filterError, setFilterError] = useState('');
  const key = JSON.stringify([customerId, month, filters, page, attempt]);
  const [result, setResult] = useState<{ key: string; data?: MrxBatchPage; error?: Error }>();
  const pending = result?.key !== key;
  const error = !pending ? result?.error : undefined;
  const data = result?.data;
  useEffect(() => {
    let active = true;
    mrxApi.getBatchPage({ ...(customerId ? { customerId } : {}), ...(month ? businessMonthRange(month) : {
      ...(filters.customerCode ? { customerCode: filters.customerCode } : {}),
      ...(filters.weekFrom ? { weekFrom: filters.weekFrom } : {}), ...(filters.weekTo ? { weekTo: filters.weekTo } : {}),
      ...(filters.batchId ? { batchId: filters.batchId } : {}),
    }), pageNumber: page, pageSize: 25 }).then(data => {
      if (active) setResult({ key, data });
    }).catch((cause: unknown) => {
      if (active) setResult(previous => ({ key, data: previous?.data, error: cause instanceof Error ? cause : new Error('Không thể tải danh sách lô.') }));
    });
    return () => { active = false; };
  }, [customerId, month, filters, page, key]);
  const applyFilters = () => {
    if (draft.weekFrom && draft.weekTo && draft.weekFrom > draft.weekTo) {
      setFilterError('Tuần từ không được sau tuần đến.');
      return;
    }
    if (draft.batchId.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.batchId.trim())) {
      setFilterError('Mã lô phải là mã đầy đủ dạng UUID.');
      return;
    }
    setFilterError('');
    setPage(1);
    setFilters({ ...draft, customerCode: draft.customerCode.trim().toUpperCase(), batchId: draft.batchId.trim() });
  };
  return <Modal isOpen onClose={onClose} title={month ? 'Danh sách lô trong tháng' : 'Tìm lô cũ'} maxWidth="max-w-3xl"
    description={month ? `Tuần bắt đầu trong tháng ${month.slice(5)}/${month.slice(0, 4)}` : undefined}
    bodyClassName="p-0 flex flex-col min-h-0 overflow-hidden">
    {!month && <form className="flex shrink-0 flex-wrap items-end gap-2 border-b border-slate-200 px-4 py-2" onSubmit={event => { event.preventDefault(); applyFilters(); }}>
      <label className="w-28 text-xs text-slate-700">Mã khách hàng<Input placeholder="VD: ANV" value={draft.customerCode} onChange={event => setDraft(value => ({ ...value, customerCode: event.target.value }))} /></label>
      <div className="text-xs text-slate-700"><span className="block">Tuần từ</span><VietnameseDateInput aria-label="Tuần từ" value={draft.weekFrom} onChange={weekFrom => setDraft(value => ({ ...value, weekFrom }))} /></div>
      <div className="text-xs text-slate-700"><span className="block">Tuần đến</span><VietnameseDateInput aria-label="Tuần đến" value={draft.weekTo} onChange={weekTo => setDraft(value => ({ ...value, weekTo }))} /></div>
      <label className="min-w-32 flex-1 text-xs text-slate-700">Mã lô đối soát<Input placeholder="Dán mã đầy đủ" value={draft.batchId} onChange={event => setDraft(value => ({ ...value, batchId: event.target.value }))} /></label>
      <Button type="submit">Tìm lô</Button>
      {filterError && <p role="alert" className="basis-full text-xs text-red-700">{filterError}</p>}
    </form>}
    {error ? <InlineBanner variant="error" actionLabel="Tải lại danh sách lô" onAction={() => setAttempt(value => value + 1)}>{error.message}</InlineBanner> : <>
      {pending && <span role="status" className="sr-only">Đang tải danh sách lô…</span>}
      <DataGrid data={data?.items ?? []} keyExtractor={row => row.batchId} selectedKey={selectedBatchId} minWidth="min-w-[36rem]"
        emptyMessage={pending ? 'Đang tải danh sách lô…' : month ? 'Không có lô trong tháng đã chọn.' : 'Không tìm thấy lô.'}
        columns={[
          { id: 'customer', header: 'Khách hàng', width: '110px', cell: row => <span title={row.customerName}>{row.customerCode || row.customerName || row.customerId}</span> },
          { id: 'week', header: 'Tuần bắt đầu', cell: row => <span className="tabular-nums">{toVietnameseDate(row.weekStartDate)} <span className="text-xs text-slate-600" aria-label={`Phiên bản ${row.version}`}>v{row.version}</span></span> },
          { id: 'reference', header: 'Mã lô', width: '120px', cell: row => <IdentifierText value={row.batchId} displayValue={row.batchId.length > 12 ? row.batchId.slice(0, 8) : row.batchId} /> },
          { id: 'status', header: 'Trạng thái', cell: row => MRX_STATUS_LABELS[row.status] || row.status },
          { id: 'choose', header: <span className="sr-only">Chọn lô</span>, width: '100px', align: 'right', cell: row => row.batchId === selectedBatchId
            ? <span className="text-xs font-medium text-slate-700">Đang xem</span>
            : <Button variant="outline" size="sm" disabled={pending} aria-label={`Xem lô ${row.batchId}`} onClick={() => onSelect(row)}>Xem lô</Button> },
        ]} />
    </>}
    <PaginationBar label={month ? 'Phân trang lô trong tháng' : 'Phân trang lịch sử lô'} hideVisibleLabel placement="toolbar" page={data?.pageNumber ?? page} pageSize={25} totalCount={data?.totalCount} totalPages={data?.totalPages}
      hasPrev={data?.hasPrev ?? false} hasNext={data?.hasNext ?? false} pending={pending || Boolean(error)} onPageChange={setPage} />
  </Modal>;
}
