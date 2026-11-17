import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { mrxApi, type MrxSupplementalDemand, type MrxSupplementalFulfillment, type CreateMrxIssueRequest } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { SearchableCombobox } from '../../components/ui/searchable-combobox';
import { Select } from '../../components/ui/select';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Num } from '../../components/ui/num';
import { DataGrid } from '../../components/workbench/DataGrid';
import { normalizeQuantity } from './mrxQuantity';

export interface SupplementalIssueSelection {
  dailyLineId: string;
  quantity: number;
  reason: string;
  allocations?: CreateMrxIssueRequest['lines'][number]['allocations'];
}
interface Props {
  batchId: string;
  serviceDate: string;
  materialLabels: readonly { dailyLineId: string; ingredientName?: string | null; ingredientCode?: string | null; canonicalUnitName?: string | null }[];
  busy: boolean;
  outcomeUnknown: boolean;
  onSubmit: (lines: SupplementalIssueSelection[]) => boolean | void | Promise<boolean | void>;
  actionTarget?: Element | null;
  draftKey?: string;
  onDirtyChange?: (dirty: boolean) => void;
  sourceVersion?: number;
}
export function MrxSupplementalFulfillmentForm(props: Props) {
  return <FulfillmentForm key={`${props.draftKey}:${props.batchId}:${props.serviceDate}`} {...props} />;
}
function FulfillmentForm({ batchId, serviceDate, materialLabels, busy, outcomeUnknown, onSubmit, actionTarget, draftKey, onDirtyChange, sourceVersion }: Props) {
  const [balance, setBalance] = useState<MrxSupplementalFulfillment | null>(null);
  const [balanceVersion, setBalanceVersion] = useState<number>();
  const [demand, setDemand] = useState<MrxSupplementalDemand | null>(null);
  const [demandReadVersion, setDemandReadVersion] = useState<number>();
  const [purpose, setPurpose] = useState('BASELINE_SHORTAGE');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  const acknowledged = useRef(false);
  const [restoreCandidate, setRestoreCandidate] = useState<{ purpose: string; quantities: Record<string, string>; reason: string } | null>(() => {
    if (!draftKey) return null;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      return saved && typeof saved.purpose === 'string' && typeof saved.reason === 'string'
        && saved.quantities && typeof saved.quantities === 'object' && !Array.isArray(saved.quantities)
        && Object.values(saved.quantities).every(value => typeof value === 'string') ? saved : null;
    } catch { return null; }
  });
  const dirty = Boolean(reason.trim() || Object.values(quantities).some(value => value.trim()));
  const frozen = busy || outcomeUnknown || Boolean(restoreCandidate);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!draftKey || !dirty || restoreCandidate || acknowledged.current) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ purpose, quantities, reason })); } catch { /* Keep editable data in memory. */ }
  }, [draftKey, dirty, restoreCandidate, purpose, quantities, reason]);
  useEffect(() => {
    let ignore = false;
    void mrxApi.getSupplementalFulfillment(batchId, serviceDate).then(value => {
      if (value.batchId !== batchId || value.serviceDate !== serviceDate) throw new Error('Số liệu cấp bổ sung không đúng lô/ngày.');
      if (!ignore) { setBalance(value); setBalanceVersion(sourceVersion); }
    }).catch(cause => { if (!ignore) setError(cause instanceof Error ? cause : new Error('Không tải được số lượng còn thiếu.')); });
    return () => { ignore = true; };
  }, [batchId, serviceDate, retry, sourceVersion]);
  const extra = purpose !== 'BASELINE_SHORTAGE' && purpose !== 'UNPLANNED_EXTRA';
  useEffect(() => {
    if (!extra) return;
    let ignore = false;
    void mrxApi.getSupplementalDemand(purpose).then(value => {
      if (value.demandId !== purpose || value.batchId !== batchId || value.serviceDate !== serviceDate || value.status !== 'APPROVED')
        throw new Error('Nhu cầu không còn được duyệt trong lô/ngày đang chọn.');
      if (!ignore) { setDemand(value); setDemandReadVersion(sourceVersion); }
    }).catch(cause => { if (!ignore) setError(cause instanceof Error ? cause : new Error('Không tải được nhu cầu đã duyệt.')); });
    return () => { ignore = true; };
  }, [batchId, serviceDate, purpose, extra, retry, sourceVersion]);
  const balances = (balance?.lines ?? []).map(line => {
    const allocation = extra ? line.extraDemands.find(x => x.demandId === purpose) : undefined;
    const remaining = purpose === 'BASELINE_SHORTAGE' ? line.baselineRemainingQuantity
      : purpose === 'UNPLANNED_EXTRA' ? undefined : allocation?.remainingQuantity;
    const label = materialLabels.find(x => x.dailyLineId === line.dailyLineId);
    return { line, allocation, remaining, name: label?.ingredientName || line.ingredientId, unit: label?.canonicalUnitName || 'Chưa rõ đơn vị' };
  });
  const ambiguous = balances.some(x => (x.line.hasIncompleteAllocation || x.line.hasAmbiguousReturn) && (purpose === 'BASELINE_SHORTAGE' || x.allocation));
  const candidates = balances.filter(x => purpose === 'UNPLANNED_EXTRA' || x.remaining != null && x.remaining > 0);
  const rows = purpose === 'UNPLANNED_EXTRA'
    ? candidates.filter(x => picked.includes(x.line.dailyLineId) || quantities[x.line.dailyLineId]?.trim())
    : candidates;
  const selected = rows.filter(x => quantities[x.line.dailyLineId]?.trim());
  const obsolete = Object.entries(quantities).some(([id, quantity]) => quantity.trim() && !rows.some(x => x.line.dailyLineId === id));
  const invalidQuantity = selected.some(x => {
    const qty = normalizeQuantity(Number(quantities[x.line.dailyLineId]));
    return !Number.isFinite(qty) || qty <= 0 || (x.remaining != null && qty > x.remaining);
  });
  const ready = !obsolete && !invalidQuantity && Boolean(balance) && balanceVersion === sourceVersion && !frozen && !error
    && (!extra || (demand?.demandId === purpose && demandReadVersion === sourceVersion))
    && Boolean(reason.trim()) && reason.trim().length <= 1000 && selected.length > 0;
  const submit = async () => {
    if (!ready) return;
    const accepted = await onSubmit(selected.map(x => {
      const quantity = normalizeQuantity(Number(quantities[x.line.dailyLineId]));
      return { dailyLineId: x.line.dailyLineId, quantity, reason: reason.trim(), allocations: [{ quantity,
        purpose: extra ? 'APPROVED_EXTRA_DEMAND' : purpose,
        ...(extra ? { demandMaterialId: x.allocation!.demandMaterialId, expectedDemandVersion: demand!.version } : {}),
      }] };
    }));
    if (accepted) {
      acknowledged.current = true;
      setPicked([]);
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* The server acknowledgment remains authoritative. */ } }
      setQuantities({}); setReason(''); onDirtyChange?.(false);
    }
  };
  const ids = [...new Set((balance?.lines ?? []).flatMap(x => x.extraDemands.map(d => d.demandId)))];
  const action = <Button disabled={!ready} onClick={submit}>{busy ? 'Đang ghi phiếu…' : 'Xác nhận xuất bổ sung'}</Button>;
  return <div className="space-y-3 text-sm">
    {error && <InlineBanner variant="error" actionLabel="Tải lại số liệu bổ sung" onAction={() => { setError(null); setRetry(x => x + 1); }}>{error.message}</InlineBanner>}
    {!balance && !error && <p role="status">Đang tải số lượng còn thiếu…</p>}
    {balance && <>
      {restoreCandidate && <InlineBanner variant="info" title="Có nháp xuất bổ sung chưa gửi">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy || outcomeUnknown} onClick={() => {
            const ids = new Set(balance.lines.map(x => x.dailyLineId));
            const validPurpose = ['BASELINE_SHORTAGE', 'UNPLANNED_EXTRA'].includes(restoreCandidate.purpose)
              || balance.lines.some(x => x.extraDemands.some(d => d.demandId === restoreCandidate.purpose));
            if (!validPurpose || Object.keys(restoreCandidate.quantities).some(id => !ids.has(id))) {
              setError(new Error('Phạm vi nháp không còn khớp dữ liệu hiện hành. Đối chiếu hoặc bỏ nháp để nhập lại.')); return;
            }
            setPurpose(restoreCandidate.purpose); setPicked([]); setQuantities(restoreCandidate.quantities); setReason(restoreCandidate.reason); setRestoreCandidate(null);
          }}>Khôi phục nháp xuất bổ sung</Button>
          <Button variant="outline" size="sm" disabled={busy || outcomeUnknown} onClick={() => {
            if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* Local storage may be unavailable. */ } }
            setRestoreCandidate(null); setError(null);
          }}>Bỏ nháp xuất bổ sung</Button>
        </div>
      </InlineBanner>}
      <label className="block">Mục đích xuất bổ sung<Select aria-label="Mục đích xuất bổ sung" value={purpose} disabled={frozen}
        onChange={e => { setPurpose(e.target.value); setPicked([]); setQuantities({}); setDemand(null); setError(null); }}
        options={[{ value: 'BASELINE_SHORTAGE', label: 'Bù phần thiếu của định mức gốc' }, ...ids.map(id => ({ value: id, label: `Nhu cầu suất phát sinh đã duyệt · ${id.slice(0, 8)}` })),
          { value: 'UNPLANNED_EXTRA', label: 'Cấp thêm ngoài nhu cầu đã duyệt' }]} /></label>
      {balance.pendingDemandCount > 0 && <InlineBanner variant="info">Có {balance.pendingDemandCount} đề nghị đang chờ Quản lý/Admin duyệt.</InlineBanner>}
      {extra && demand?.demandId === purpose && <p>{demand.reason}</p>}
      {extra && !demand && !error && <p role="status">Đang kiểm tra nhu cầu đã duyệt…</p>}
      {ambiguous && <InlineBanner variant="warning">Chưa đủ bằng chứng phân bổ phiếu cũ hoặc hoàn trả để xác định lượng còn thiếu. Cần đối chiếu phân bổ trước khi cấp theo nhu cầu.</InlineBanner>}
      {purpose === 'UNPLANNED_EXTRA' && <InlineBanner variant="warning">Lượng cấp ngoài nhu cầu được ghi riêng, không tự tăng suất hoặc bù cho nhu cầu khác.</InlineBanner>}
      <label className="block">Lý do xuất bổ sung<Input aria-label="Lý do xuất bổ sung" maxLength={1000} value={reason} disabled={frozen} onChange={e => { acknowledged.current = false; setReason(e.target.value); }} /></label>
      {purpose === 'UNPLANNED_EXTRA' && <SearchableCombobox aria-label="Chọn nguyên liệu xuất bổ sung"
        placeholder="Tìm tên hoặc mã nguyên liệu" value="" disabled={frozen} listInFlow
        options={candidates.filter(x => !rows.includes(x)).map(x => ({ value: x.line.dailyLineId, label: x.name,
          sublabel: [materialLabels.find(label => label.dailyLineId === x.line.dailyLineId)?.ingredientCode, x.unit].filter(Boolean).join(' · ') }))}
        onChange={id => { if (id) setPicked(ids => [...ids, id]); }} />}
      {!frozen && !ambiguous && !error && <p role="status" className="text-slate-600">
        {obsolete ? 'Có dòng nháp không còn phù hợp. Đối chiếu lượng còn thiếu hoặc bỏ dòng không hợp lệ.'
          : invalidQuantity ? 'Kiểm tra số lượng xuất thêm. Lượng nhập phải lớn hơn 0 và không vượt phần còn thiếu.'
          : !selected.length ? 'Chọn nguyên liệu và nhập lượng cần xuất.' : !reason.trim() ? 'Nhập lý do để xác nhận xuất bổ sung.'
          : balanceVersion !== sourceVersion || extra && demandReadVersion !== sourceVersion ? 'Đang cập nhật số lượng còn thiếu…' : ''}
        {obsolete && <Button variant="outline" size="sm" onClick={() => setQuantities(current =>
          Object.fromEntries(Object.entries(current).filter(([id]) => rows.some(x => x.line.dailyLineId === id))))}>Bỏ dòng không còn phù hợp</Button>}
      </p>}
      {!ambiguous && <DataGrid data={rows} keyExtractor={x => x.line.dailyLineId} emptyMessage={purpose === 'UNPLANNED_EXTRA' ? 'Chưa chọn nguyên liệu.' : 'Không còn nguyên liệu thiếu cho mục đích đang chọn.'} columns={[
        { id: 'ingredient', header: 'Nguyên liệu', cell: x => <span>{x.name}<span className="block text-xs">{x.unit}</span></span> },
        { id: 'remaining', header: 'Còn thiếu', align: 'right', cell: x => <Num value={x.remaining} format="plain" decimals={6} /> },
        { id: 'actual', header: 'Xuất thêm', align: 'right', cell: x => <Input aria-label={`Lượng xuất bổ sung ${x.name}`} type="number" min="0.000001" step="0.000001"
          max={x.remaining ?? undefined} disabled={frozen || Boolean(error) || extra && !demand} value={quantities[x.line.dailyLineId] || ''}
          onChange={e => { acknowledged.current = false; setQuantities(q => ({ ...q, [x.line.dailyLineId]: e.target.value })); }} /> },
        ...(purpose === 'UNPLANNED_EXTRA' ? [{ id: 'remove', header: 'Thao tác', cell: (x: typeof rows[number]) =>
          <Button variant="outline" size="sm" aria-label={`Bỏ ${x.name}`} disabled={frozen} onClick={() => {
            setPicked(ids => ids.filter(id => id !== x.line.dailyLineId));
            setQuantities(q => Object.fromEntries(Object.entries(q).filter(([id]) => id !== x.line.dailyLineId)));
          }}>Bỏ</Button> }] : []),
      ]} />}
    </>}
    {actionTarget ? createPortal(action, actionTarget) : action}
  </div>;
}
