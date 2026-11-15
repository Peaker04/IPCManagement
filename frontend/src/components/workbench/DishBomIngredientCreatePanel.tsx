import type { FormEventHandler } from 'react';
import type { UnitItem } from '../../api/adminApi';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SearchableCombobox } from '../ui/searchable-combobox';
import { InlineBanner } from '../ui/inline-banner';

interface PanelState {
  open: boolean;
  name: string;
  unitId: string;
  referencePrice: string;
  freshDaily: boolean;
  units: UnitItem[];
  unitError: string | null;
  searchError: string | null;
  outcomeUnknown: boolean;
  busy: boolean;
  reloadNeeded: boolean;
}

interface PanelActions {
  toggle: () => void;
  retryUnits: () => void;
  retrySearch: () => void;
  checkUnknown: () => void;
  setName: (value: string) => void;
  setUnitId: (value: string) => void;
  setReferencePrice: (value: string) => void;
  setFreshDaily: (value: boolean) => void;
}

export function DishBomIngredientCreatePanel({ state, actions, onSubmit }: {
  state: PanelState;
  actions: PanelActions;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  return <div className="space-y-2">
    <Button type="button" variant="outline" size="sm" disabled={state.busy || state.reloadNeeded} onClick={actions.toggle}>
      {state.open ? 'Đóng tạo nguyên liệu' : 'Tạo nguyên liệu mới'}
    </Button>
    {state.open && <form onSubmit={onSubmit} className="rounded border p-3 space-y-3">
      <p className="text-xs">Tìm trong danh mục trước khi tạo. Sau khi lưu nguyên liệu, nhập định mức ở bên dưới.</p>
      {state.unitError && <InlineBanner variant="error" actionLabel="Tải lại đơn vị" onAction={actions.retryUnits}>{state.unitError}</InlineBanner>}
      {state.outcomeUnknown && <Button type="button" variant="outline" size="sm" disabled={state.busy} onClick={actions.checkUnknown}>Kiểm tra kết quả tạo</Button>}
      <div className="space-y-3">
        <label className="block space-y-1 text-xs font-medium">Tên nguyên liệu mới<Input aria-label="Tên nguyên liệu mới" value={state.name} maxLength={200} onChange={event => actions.setName(event.target.value)} required disabled={state.busy} /></label>
        <label className="block space-y-1 text-xs font-medium">Đơn vị nguyên liệu mới<SearchableCombobox aria-label="Đơn vị nguyên liệu mới" value={state.unitId} onChange={actions.setUnitId} options={state.units.map(unit => ({ value: unit.unitId, label: unit.unitName }))} placeholder="Tìm và chọn đơn vị" maxVisibleOptions={5} listInFlow disabled={state.busy || Boolean(state.unitError)} /></label>
        <label className="block space-y-1 text-xs font-medium">Giá tham chiếu<Input aria-label="Giá tham chiếu nguyên liệu mới" type="number" min="0" step="0.01" value={state.referencePrice} onChange={event => actions.setReferencePrice(event.target.value)} required disabled={state.busy} /></label>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={state.freshDaily} onChange={event => actions.setFreshDaily(event.target.checked)} disabled={state.busy} />Nguyên liệu tươi nhập hằng ngày</label>
      <p className="text-xs">Giá tham chiếu bằng 0 sẽ làm giá vốn BOM chưa đầy đủ cho đến khi cập nhật giá.</p>
      <Button type="submit" size="sm" disabled={state.busy || Boolean(state.unitError) || !state.unitId || !state.name.trim()}>{state.busy ? 'Đang kiểm tra…' : 'Lưu nguyên liệu'}</Button>
    </form>}
    {state.searchError && <InlineBanner variant="error" actionLabel="Tìm lại" onAction={actions.retrySearch}>{state.searchError}</InlineBanner>}
  </div>;
}
