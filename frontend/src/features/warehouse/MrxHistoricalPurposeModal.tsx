import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { mrxHistoricalPurposeApi, type MrxHistoricalPurposeCandidate, type MrxHistoricalPurposeDetail, type MrxHistoricalPurposeRequest } from '../../api/mrxHistoricalPurposeApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Modal } from '../../components/ui/modal';
import { Num } from '../../components/ui/num';
import { Select } from '../../components/ui/select';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { getDraftStorageKey } from '../../hooks/useClientDraftPersistence';
import { useAuth } from '../../store/useAuth';
import { formatVietnameseDate } from '../../utils/dates';

interface Props {
  batchId: string;
  date: string;
  onClose: () => void;
}

type Pending = { version: number | null; request: MrxHistoricalPurposeRequest };
type Split = { target: string; quantity: string };
const initialSplit = [{ target: '', quantity: '' }];
const toMicro = (quantity: number) => Math.round(quantity * 1_000_000);
const parseQuantity = (value: string) => Number(value.replace(',', '.'));

export function MrxHistoricalPurposeModal({ batchId, date, onClose }: Props) {
  const { user, canNavigate, operationalModeVersion } = useAuth();
  const storageKey = getDraftStorageKey(`mrx_historical_purpose_${batchId}_${date}`, user?.userId);
  const [pending, setPending] = useState<Pending | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Pending | null;
      return value?.request.batchId === batchId && value.request.serviceDate === date ? value : null;
    } catch { return null; }
  });
  const [candidates, setCandidates] = useState<readonly MrxHistoricalPurposeCandidate[] | null>(null);
  const [readError, setReadError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [split, setSplit] = useState<Split[]>(initialSplit);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<MrxHistoricalPurposeDetail | null>(null);
  const [writeError, setWriteError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const direct = user?.isAdminFullAccess || user?.roleCode?.toUpperCase() === 'ADMIN';
  const candidate = candidates?.find(row => row.issueLineId === selectedId);
  const scopeChanged = pending !== null && pending.version !== operationalModeVersion;

  useEffect(() => {
    let active = true;
    void mrxHistoricalPurposeApi.candidates(batchId, date).then(rows => {
      if (active) { setCandidates(rows); setReadError(null); }
    }).catch((error: unknown) => {
      if (active) setReadError(error instanceof Error ? error : new Error('Không tải được chứng từ.'));
    });
    return () => { active = false; };
  }, [batchId, date, attempt]);

  const options = [{ value: '', label: 'Chọn mục đích' }, { value: 'BASELINE_SHORTAGE', label: 'Bù nhu cầu gốc' },
    { value: 'UNPLANNED_EXTRA', label: 'Cấp ngoài nhu cầu' }, ...(candidate?.demands ?? []).map(row => ({
      value: row.demandMaterialId, label: `Nhu cầu PS-${row.demandId.slice(0, 8).toUpperCase()}`,
    }))];
  const total = split.reduce((sum, row) => sum + (Number.isFinite(parseQuantity(row.quantity)) ? toMicro(parseQuantity(row.quantity)) : 0), 0);
  const valid = Boolean(candidate && !candidate.pendingProposalId && total === toMicro(candidate.unallocatedQuantity)
    && (candidate.returnedQuantity === 0 || split.length === 1) && new Set(split.map(row => row.target)).size === split.length
    && split.every(row => row.target && /^\d+(?:[.,]\d{1,6})?$/.test(row.quantity) && parseQuantity(row.quantity) > 0)
    && reason.trim());
  const updateRow = (index: number, patch: Partial<Split>) => setSplit(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const submit = async () => {
    if (sending.current || scopeChanged || (!pending && (!candidate || !valid))) return;
    const command = pending ?? { version: operationalModeVersion, request: {
      commandId: crypto.randomUUID(), batchId, serviceDate: date, issueLineId: candidate!.issueLineId,
      expectedBatchVersion: candidate!.batchVersion, reason: reason.trim(),
      allocations: split.map(row => {
        const demand = candidate!.demands.find(item => item.demandMaterialId === row.target);
        return { purpose: demand ? 'APPROVED_EXTRA_DEMAND' : row.target,
          quantity: parseQuantity(row.quantity), demandMaterialId: demand?.demandMaterialId, expectedDemandVersion: demand?.version };
      }),
    } };
    try { localStorage.setItem(storageKey, JSON.stringify(command)); }
    catch { setWriteError(new Error('Chưa lưu được mã lệnh khôi phục. Hãy kiểm tra bộ nhớ trình duyệt.')); return; }
    sending.current = true;
    setBusy(true); setPending(command); setWriteError(null);
    const clearPending = () => {
      setPending(null);
      try { localStorage.removeItem(storageKey); } catch { /* A replay still checks the original receipt. */ }
    };
    try {
      const acknowledgement = await mrxHistoricalPurposeApi.propose(command.request);
      clearPending(); setResult(acknowledgement);
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.code !== 'SESSION_CHANGED')
        clearPending();
      setWriteError(error instanceof Error ? error : new Error('Chưa xác định được kết quả phân bổ.'));
    } finally { sending.current = false; setBusy(false); }
  };

  return <Modal isOpen onClose={onClose} title="Phân bổ phiếu xuất lịch sử" description={formatVietnameseDate(date)}
    closeDisabled={busy} isDirty={!result && !pending && Boolean(reason.trim() || split.some(row => row.quantity))}
    footer={close => <><Button variant="outline" disabled={busy} onClick={close}>Đóng</Button>
      {!result && <Button disabled={busy || scopeChanged || (!pending && !valid)} loading={busy} onClick={() => void submit()}>
        {pending ? 'Kiểm tra lệnh đã gửi' : direct ? 'Xác nhận phân bổ' : 'Gửi đề xuất phân bổ'}
      </Button>}
    </>}>
    <div className="space-y-3 text-sm">
      {result ? <InlineBanner variant="success" title={result.status === 'APPLIED' ? 'Đã áp dụng phân bổ' : 'Đã gửi đề xuất phân bổ'}>
        <p>{result.issueCode} · {result.ingredientName}</p>
        {canNavigate('/approvals') && <Link to={`/approvals?targetType=mrx-historical-purpose&targetId=${result.proposalId}${result.status === 'APPLIED' ? '&state=PROCESSED' : ''}`}>Xem hồ sơ tại Duyệt vận hành</Link>}
      </InlineBanner> : pending ? <InlineBanner variant="warning" title="Chưa xác định kết quả phân bổ">
        {scopeChanged ? 'Phiên bản chế độ đã đổi. Hồ sơ đã gửi cần được đối chiếu trước khi tiếp tục.'
          : 'Dùng mã lệnh đã gửi để kiểm tra. Lệnh khôi phục giữ nguyên nội dung phân bổ.'}
      </InlineBanner> : <StateBoundary isLoading={!readError && candidates === null} error={readError} isEmpty={candidates?.length === 0}
        contextDomain="warehouse" scope="widget" isForbidden={readError instanceof ApiError && readError.status === 403}
        emptyTitle="Không có dòng phiếu cần phân bổ" onRetry={() => setAttempt(value => value + 1)}>
        <div className="space-y-3">
          <p>{direct ? 'Admin xác nhận trực tiếp và lưu lịch sử.' : 'Thủ kho đối chiếu chứng từ, Quản lý duyệt và áp dụng.'}</p>
          <label className="block">Dòng phiếu xuất<Select aria-label="Dòng phiếu xuất" value={selectedId}
            onChange={event => { setSelectedId(event.target.value); setSplit(initialSplit); setWriteError(null); }}
            options={[{ value: '', label: 'Chọn dòng phiếu' }, ...(candidates ?? []).map(row => ({
              value: row.issueLineId, label: `${row.issueCode} · ${row.ingredientName}${row.pendingProposalId ? ' · Chờ duyệt' : ''}`,
            }))]} /></label>
          {candidate?.pendingProposalId ? <InlineBanner variant="info">Dòng phiếu đã có đề xuất chờ duyệt.</InlineBanner> : candidate && <>
            <p>Chưa phân bổ <Num value={candidate.unallocatedQuantity} format="plain" decimals={6} /> {candidate.unitName}</p>
            {candidate.returnedQuantity > 0 && <InlineBanner variant="warning">Phiếu đã nhập trả. Chỉ xác nhận một mục đích nếu có đủ căn cứ.</InlineBanner>}
            {split.map((row, index) => <div className="grid gap-2 sm:grid-cols-2" key={index}>
              <label>Mục đích {index + 1}<Select aria-label={`Mục đích ${index + 1}`} value={row.target}
                options={options} onChange={event => updateRow(index, { target: event.target.value })} /></label>
              <label>Lượng phân bổ {index + 1}<Input aria-label={`Lượng phân bổ ${index + 1}`} inputMode="decimal" value={row.quantity}
                onChange={event => updateRow(index, { quantity: event.target.value })} /></label>
              {split.length > 1 && <Button variant="outline" size="sm" onClick={() => setSplit(rows => rows.filter((_, i) => i !== index))}>Bỏ dòng {index + 1}</Button>}
            </div>)}
            {candidate.returnedQuantity === 0 && split.length < options.length - 1 && <Button variant="outline" size="sm"
              onClick={() => setSplit(rows => [...rows, { target: '', quantity: '' }])}>Thêm mục đích</Button>}
            <label className="block">Căn cứ phân bổ<Input aria-label="Căn cứ phân bổ" value={reason} maxLength={2000}
              onChange={event => setReason(event.target.value)} /></label>
          </>}
        </div>
      </StateBoundary>}
      {writeError && !pending && <InlineBanner variant={writeError instanceof ApiError && writeError.status === 409 ? 'conflict' : 'error'}>{writeError.message}</InlineBanner>}
    </div>
  </Modal>;
}
