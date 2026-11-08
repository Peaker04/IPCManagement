import { useId, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Num } from '../ui/num';

interface LocalFindBarProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  matched?: number;
  total?: number;
  scope: string;
  clearLabel?: string;
  children?: ReactNode;
  leading?: ReactNode;
  searchTrailing?: ReactNode;
  showSearch?: boolean;
  disabled?: boolean;
}

export function LocalFindBar({ label, value, onChange, matched, total, scope, clearLabel = 'Xóa tìm kiếm', children, leading, searchTrailing, showSearch = true, disabled = false }: LocalFindBarProps) {
  const id = useId();
  return (
    <div className="px-4 py-1 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
      {leading}
      {showSearch && <><label htmlFor={id} className="text-xs font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
        <Input id={id} type="search" aria-describedby={`${id}-scope`} placeholder="Mã, tên không dấu..." value={value}
          disabled={disabled} onChange={event => onChange(event.target.value)} className="h-9 text-xs min-w-0 sm:w-52" />
        {searchTrailing}
        <Button variant="outline" className="h-9 text-xs shrink-0" aria-label={clearLabel} disabled={disabled || !value} onClick={() => onChange('')}>Xóa</Button>
      </div></>}
      {children}
      <span role="status" aria-label={`Kết quả ${label.toLocaleLowerCase('vi-VN')}`} aria-atomic="true" className="sr-only">Khớp <Num value={matched} />/<Num value={total} /> kết quả</span>
      <p id={`${id}-scope`} className="sr-only">{scope}</p>
    </div>
  );
}
