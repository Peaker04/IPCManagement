import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { mrxApi, type MrxSupplementalDemand, type MrxSupplementalDemandWrite, type MrxSupplementalDemandCommand, type MrxSupplementalDishOptions } from '../../api/mrxApi';
import { ApiError } from '../../api/client';
import { useAuth } from '../../store/useAuth';
import { getDraftStorageKey } from '../../hooks/useClientDraftPersistence';
import { getMrxShiftLabel } from '../../constants/mrxConstants';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Num } from '../../components/ui/num';
import { DataGrid } from '../../components/workbench/DataGrid';

interface Props {
  batchId: string;
  serviceDate: string;
  materialLabels: readonly { dailyLineId: string; ingredientName?: string | null; canonicalUnitName?: string | null }[];
  onLockChange: (locked: boolean) => void;
  actionTarget?: Element | null;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmitted?: () => Promise<void>;
}
interface Selection { choice: string; servings: string; menu?: string }
type Pending = { action: 'save'; body: MrxSupplementalDemandWrite; id?: string }
  | { action: 'submit'; body: MrxSupplementalDemandCommand; id: string };
interface Draft { rows: Selection[]; reason: string; snapshot?: MrxSupplementalDemand; previewCurrent?: boolean; pending?: Pending; modeVersion?: number | null }
const menus = [
  { value: 'MORNING:savory', label: 'Sáng mặn' },
  { value: 'MORNING:vegetarian', label: 'Sáng chay' },
  { value: 'AFTERNOON:savory', label: 'Chiều mặn' },
  { value: 'AFTERNOON:vegetarian', label: 'Chiều chay' },
] as const;
const choiceKey = (dish: MrxSupplementalDishOptions['dishes'][number]) => JSON.stringify([dish.dishId, dish.shiftName, dish.menuVariant]);

export function MrxSupplementalDemandForm(props: Props) {
  const { user, operationalMode, operationalModeVersion } = useAuth();
  if (!user || operationalMode !== 'MATERIAL_RECONCILIATION') return <InlineBanner variant="warning">Không có quyền lập nhu cầu trong chế độ hiện tại.</InlineBanner>;
  const key = getDraftStorageKey(`mrx_supplemental_demand_${operationalMode}_${props.batchId}_${props.serviceDate}`, user.userId);
  return <DemandForm key={key} {...props} storageKey={key} modeVersion={operationalModeVersion} />;
}

function DemandForm({ batchId, serviceDate, materialLabels, onLockChange, storageKey, actionTarget, onDirtyChange, onSubmitted, modeVersion }: Props & { storageKey: string; modeVersion: number | null }) {
  const { canNavigate } = useAuth();
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as Draft | null;
      if (saved && Array.isArray(saved.rows) && typeof saved.reason === 'string') return saved;
    } catch { /* Keep a new local form if storage is unavailable. */ }
    return { rows: [{ choice: '', servings: '' }], reason: '' };
  });
  const [options, setOptions] = useState<MrxSupplementalDishOptions | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const unknown = Boolean(draft.pending);
  const approved = draft.snapshot?.status === 'APPROVED';
  const submitted = Boolean(draft.snapshot && draft.snapshot.status !== 'DRAFT');
  const dirty = !submitted && Boolean(draft.reason.trim() || draft.rows.some(row => row.menu || row.choice || row.servings));
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const locked = busy || unknown || submitted;
  useEffect(() => {
    let ignore = false;
    void mrxApi.getSupplementalDishOptions(batchId, serviceDate).then(value => {
      if (value.batchId !== batchId || value.serviceDate !== serviceDate) throw new Error('Danh sách món không đúng lô/ngày đang chọn.');
      if (!ignore) setOptions(value);
    })
      .catch(cause => { if (!ignore) setError(cause instanceof Error ? cause : new Error('Không thể tải món đóng băng.')); });
    return () => { ignore = true; };
  }, [batchId, serviceDate, retry]);
  useEffect(() => {
    onLockChange(busy || unknown);
    return () => onLockChange(false);
  }, [busy, unknown, onLockChange]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); } catch { /* In-memory draft remains available. */ }
  }, [draft, storageKey]);

  const update = (change: Partial<Draft>) => setDraft(current => ({ ...current, ...change, previewCurrent: false }));
  const refreshStatus = async () => {
    if (!draft.snapshot || busy || unknown) return;
    setBusy(true); setError(null);
    try {
      const current = await mrxApi.getSupplementalDemand(draft.snapshot.demandId);
      if (current.demandId !== draft.snapshot.demandId || current.batchId !== batchId || current.serviceDate !== serviceDate)
        throw new Error('Phản hồi đề nghị không đúng phạm vi.');
      setDraft(value => ({ ...value, snapshot: current }));
      await onSubmitted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể cập nhật trạng thái đề nghị.'));
    } finally { setBusy(false); }
  };
  const run = async (pending: Pending) => {
    if (sending.current) return;
    if (draft.pending && draft.modeVersion !== modeVersion) {
      setError(new Error('Phiên bản chế độ đã thay đổi. Cần đối chiếu đề nghị đã gửi trước khi xử lý tiếp.')); return;
    }
    sending.current = true; setBusy(true); setError(null);
    const saved = { ...draft, pending, modeVersion };
    setDraft(saved);
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* Retain exact command in memory. */ }
    let acknowledged = false;
    try {
      const result = pending.action === 'submit'
        ? await mrxApi.submitSupplementalDemand(pending.id, pending.body)
        : pending.id ? await mrxApi.updateSupplementalDemand(pending.id, pending.body)
          : await mrxApi.createSupplementalDemand(pending.body);
      const expectedId = pending.action === 'save' && !pending.id ? pending.body.commandId : pending.id;
      if (result.batchId !== batchId || result.serviceDate !== serviceDate || result.demandId !== expectedId || !result.version
        || (pending.action === 'submit' ? !['PENDING', 'APPROVED'].includes(result.status) : result.status !== 'DRAFT'))
        throw new Error('Phản hồi đề nghị không đúng phạm vi. Cần kiểm tra lại lệnh đã gửi.');
      setDraft(current => ({ ...current, snapshot: result, previewCurrent: true, pending: undefined }));
      acknowledged = true;
      if (pending.action === 'submit') await onSubmitted?.();
    } catch (cause) {
      if (acknowledged) {
        setError(new Error('Nhu cầu đã được ghi nhận. Chưa tải lại được dữ liệu Kho; hãy tải lại trước khi xuất bổ sung.'));
        return;
      }
      const definite = cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.code !== 'SESSION_CHANGED';
      if (definite) setDraft(current => ({ ...current, pending: undefined }));
      setError(cause instanceof Error ? cause : new Error('Không thể xác nhận kết quả đề nghị.'));
    } finally { sending.current = false; setBusy(false); }
  };
  const dishes = options?.dishes ?? [];
  const menuOf = (row: Selection) => row.menu ?? (row.choice ? 'CUSTOM' : '');
  const menuDishes = (menu: string) => dishes.filter(dish => `${dish.shiftName}:${dish.menuVariant}` === menu);
  const selections = draft.rows.map(row => ({ row, dishes: menuOf(row) === 'CUSTOM'
    ? dishes.filter(dish => choiceKey(dish) === row.choice) : [...new Map(menuDishes(menuOf(row)).map(dish => [choiceKey(dish), dish])).values()] }));
  const expanded = selections.flatMap(selection => selection.dishes.map(dish => ({ dish, extraServings: Number(selection.row.servings) })));
  const duplicate = new Set(expanded.map(x => choiceKey(x.dish))).size !== expanded.length;
  const canSave = Boolean(options?.canCreate) && !locked && Boolean(draft.reason.trim()) && draft.reason.trim().length <= 2000
    && selections.length > 0 && selections.every(selection => selection.dishes.length > 0 && !selection.dishes.some(dish => dish.blockedReason)
      && Number.isSafeInteger(Number(selection.row.servings)) && Number(selection.row.servings) > 0) && !duplicate;
  const save = () => {
    if (!canSave || !options) return;
    void run({ action: 'save', id: draft.snapshot?.demandId, body: {
      commandId: crypto.randomUUID(), expectedVersion: draft.snapshot?.version ?? 0, expectedBatchVersion: options.batchVersion,
      batchId, serviceDate, reason: draft.reason.trim(), dishes: expanded.map(({ dish, extraServings }) => ({
        dishId: dish.dishId, shiftName: dish.shiftName, menuVariant: dish.menuVariant, extraServings,
      })),
    } });
  };
  const action = unknown ? <Button variant="outline" disabled={busy} onClick={() => { if (draft.pending) void run(draft.pending); }}>Kiểm tra lại lệnh đã gửi</Button>
    : submitted ? null : draft.snapshot && draft.previewCurrent ? <Button disabled={locked} onClick={() => {
      if (draft.snapshot) void run({ action: 'submit', id: draft.snapshot.demandId, body: { commandId: crypto.randomUUID(),
        expectedVersion: draft.snapshot.version, expectedBatchVersion: draft.snapshot.batchVersion, reason: draft.reason.trim() } });
    }}>{options?.requiresApproval === false ? 'Ghi nhận suất phát sinh' : 'Gửi duyệt nhu cầu'}</Button> : <Button disabled={!canSave} onClick={save}>{busy ? 'Đang tính nhu cầu…' : 'Tính nhu cầu và lưu nháp'}</Button>;

  return <div className="space-y-3 text-sm">
    <p>{options?.requiresApproval === false
      ? 'Admin ghi nhận trực tiếp nhu cầu tăng suất. Lượng thực xuất được xác nhận riêng tại Kho.'
      : 'Quản lý/Admin xác nhận nhu cầu tăng suất. Kho xác nhận lượng thực xuất sau khi được duyệt.'}</p>
    {error && <InlineBanner variant={unknown ? 'warning' : 'error'} title={unknown ? 'Chưa xác nhận được kết quả' : undefined}
      actionLabel={!unknown ? 'Tải lại danh sách món' : undefined}
      onAction={!unknown ? () => { setError(null); setOptions(null); setDraft(d => ({ ...d, previewCurrent: false })); setRetry(x => x + 1); } : undefined}>{error.message}</InlineBanner>}
    {!options && !error && <p role="status">Đang tải món đóng băng…</p>}
    {options?.blockedReason && <InlineBanner variant="warning">{options.blockedReason}</InlineBanner>}
    {options && <>
      {submitted && <InlineBanner variant={draft.snapshot?.status === 'REJECTED' ? 'error' : approved ? 'success' : 'info'}
        title={approved ? (options.requiresApproval === false ? 'Admin đã ghi nhận nhu cầu' : 'Nhu cầu đã được duyệt')
          : draft.snapshot?.status === 'REJECTED' ? 'Nhu cầu đã bị từ chối'
          : draft.snapshot?.status === 'CANCELLED' ? 'Nhu cầu đã hủy' : 'Đã gửi duyệt nhu cầu'}>
        {canNavigate('/approvals')
          ? <Link to={`/approvals?targetType=mrx-supplemental-demand&targetId=${draft.snapshot!.demandId}${draft.snapshot!.status !== 'PENDING' ? '&state=PROCESSED' : ''}`}>Xem đề nghị tại Duyệt vận hành</Link>
          : <Button variant="outline" size="sm" disabled={busy || unknown} onClick={() => void refreshStatus()}>Cập nhật trạng thái đề nghị</Button>}
        {draft.snapshot?.decisionReason && <p>{draft.snapshot.decisionReason}</p>}
      </InlineBanner>}
      {duplicate && <InlineBanner variant="warning">Có món trùng ca và loại suất. Bỏ lựa chọn trùng trước khi lưu.</InlineBanner>}
      {selections.map(({ row, dishes: selectedDishes }, index) => <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="sm:col-span-2">Menu hoặc tùy chọn {index + 1}
          <Select aria-label={`Menu hoặc tùy chọn ${index + 1}`} value={menuOf(row)} disabled={locked}
            onChange={e => update({ rows: draft.rows.map((r, i) => i === index ? { ...r, menu: e.target.value, choice: '' } : r) })}
            options={[{ value: '', label: 'Chọn menu phục vụ' }, ...menus.map(menu => ({ ...menu, disabled: !menuDishes(menu.value).length })),
              { value: 'CUSTOM', label: 'Tùy chọn' }]} />
        </label>
        {menuOf(row) === 'CUSTOM' && <label className="sm:col-span-2">Món, ca và loại suất {index + 1}
          <Select aria-label={`Món, ca và loại suất ${index + 1}`} value={row.choice} disabled={locked}
            onChange={e => update({ rows: draft.rows.map((r, i) => i === index ? { ...r, choice: e.target.value } : r) })}
            options={[{ value: '', label: 'Chọn món và ca phục vụ' }, ...dishes.map(dish => ({ value: choiceKey(dish),
              label: `${dish.dishName} · ${getMrxShiftLabel(dish.shiftName)} · ${dish.menuVariant === 'savory' ? 'Mặn' : dish.menuVariant === 'vegetarian' ? 'Chay' : dish.menuVariant}${dish.blockedReason ? ' · Thiếu dữ liệu BOM' : ''}`,
              disabled: Boolean(dish.blockedReason),
            }))]} />
        </label>}
        <label>Suất tăng thêm {index + 1}<Input aria-label={`Suất tăng thêm ${index + 1}`} type="number" min="1" step="1" value={row.servings} disabled={locked}
          onChange={e => update({ rows: draft.rows.map((r, i) => i === index ? { ...r, servings: e.target.value } : r) })} /></label>
        {menuOf(row) && menuOf(row) !== 'CUSTOM' && <p className="sm:col-span-3 text-slate-600">
          {selectedDishes.length === 0 ? 'Menu chưa có món đóng băng.' : selectedDishes.some(dish => dish.blockedReason)
            ? `Không thể tăng cả menu. Thiếu BOM cho ${selectedDishes.filter(dish => dish.blockedReason).map(dish => dish.dishName).join(', ')}.`
            : `Tăng cùng số suất cho ${selectedDishes.length} món trong menu.`}
        </p>}
        {draft.rows.length > 1 && <Button variant="outline" size="sm" disabled={locked} onClick={() => update({ rows: draft.rows.filter((_, i) => i !== index) })}>Bỏ dòng {index + 1}</Button>}
      </div>)}
      <Button variant="outline" size="sm" disabled={locked || draft.rows.length >= options.dishes.length}
        onClick={() => update({ rows: [...draft.rows, { choice: '', servings: '' }] })}>Thêm món hoặc ca</Button>
      <label className="block">Lý do tăng suất<Input aria-label="Lý do tăng suất" maxLength={2000} value={draft.reason} disabled={locked}
        onChange={e => update({ reason: e.target.value })} /></label>
      {draft.snapshot && draft.previewCurrent && <>
        <h3 className="font-semibold">Nhu cầu nguyên liệu theo BOM đóng băng</h3>
        <DataGrid data={draft.snapshot.materials} keyExtractor={x => x.demandMaterialId} columns={[
          { id: 'ingredient', header: 'Nguyên liệu', cell: x => materialLabels.find(l => l.dailyLineId === x.dailyLineId)?.ingredientName ?? x.ingredientId },
          { id: 'quantity', header: 'Cần thêm', align: 'right', cell: x => <Num value={x.requiredQuantity} format="plain" decimals={6} /> },
          { id: 'unit', header: 'ĐVT', cell: x => materialLabels.find(l => l.dailyLineId === x.dailyLineId)?.canonicalUnitName ?? 'Chưa rõ đơn vị' },
        ]} />
      </>}
      {submitted && <Button variant="outline" size="sm" disabled={busy || unknown || !options.canCreate} onClick={() => {
        setDraft({ rows: [{ choice: '', servings: '' }], reason: '' });
        setError(null);
        setOptions(null);
        setRetry(value => value + 1);
      }}>Lập đề nghị mới</Button>}
    </>}
    {actionTarget ? createPortal(action, actionTarget) : action}
  </div>;
}
