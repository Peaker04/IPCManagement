import { useState } from 'react';
import { Select } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { VietnameseDateInput } from '../ui/vietnamese-date-input';
import { useHistoricalScope } from '../../hooks/useHistoricalScope';
import { historicalRange, type HistoricalSelection } from '../../utils/historicalScope';

function Controls({ value, onApply }: { value: HistoricalSelection; onApply: (next: HistoricalSelection) => void }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const appliedKey = JSON.stringify(value);
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    setDraft(value);
    setError('');
  }
  return <form className="flex flex-wrap items-center gap-2" onSubmit={event => {
    event.preventDefault();
    const problem = historicalRange(draft).error;
    setError(problem || '');
    if (!problem) onApply(draft);
  }}>
    <div className="w-40"><Select aria-label="Kỳ thời gian" value={draft.period}
      options={[{ value: 'ALL', label: 'Toàn thời gian' }, { value: 'YEAR', label: 'Chọn năm' }, { value: 'RANGE', label: 'Khoảng ngày' }, { value: 'THIS_YEAR', label: 'Năm nay' }, { value: 'THIS_MONTH', label: 'Tháng này' }]}
      onChange={event => {
        const next = { ...draft, period: event.target.value };
        setDraft(next);
        setError('');
        if (['ALL', 'THIS_YEAR', 'THIS_MONTH'].includes(next.period)) onApply(next);
      }} /></div>
    {draft.period === 'YEAR' && <Input aria-label="Năm tra cứu" className="w-24" inputMode="numeric" maxLength={4} value={draft.year} onChange={event => setDraft(previous => ({ ...previous, year: event.target.value }))} />}
    {draft.period === 'RANGE' && <>
      <label className="flex items-center gap-1 text-xs text-slate-700">Từ<VietnameseDateInput aria-label="Từ ngày" value={draft.from} onChange={from => setDraft(previous => ({ ...previous, from }))} /></label>
      <label className="flex items-center gap-1 text-xs text-slate-700">Đến<VietnameseDateInput aria-label="Đến ngày" value={draft.to} onChange={to => setDraft(previous => ({ ...previous, to }))} /></label>
    </>}
    {['YEAR', 'RANGE'].includes(draft.period) && <Button type="submit" variant="outline">Áp dụng kỳ</Button>}
    {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
  </form>;
}

export function HistoricalScopeFilter({ prefix = '' }: { prefix?: string }) {
  const scope = useHistoricalScope(prefix);
  return <Controls value={scope.selection} onApply={scope.apply} />;
}
