import { useId, useState } from 'react';
import { Input } from '../../components/ui/input';
import { formatMrxQuantityText, parseMrxQuantityText } from './mrxQuantity';

export function MrxQuantityInput({ value, onChange, label, disabled }: {
  value: string; onChange: (canonical: string) => void; label: string; disabled: boolean;
}) {
  const id = useId();
  const [edit, setEdit] = useState({ canonical: value, text: formatMrxQuantityText(value) });
  // External fill/restore changes replace local text; incomplete local edits retain their display.
  if (edit.canonical !== value) setEdit({ canonical: value, text: formatMrxQuantityText(value) });
  const text = edit.canonical === value ? edit.text : formatMrxQuantityText(value);
  const invalid = text !== '' && parseMrxQuantityText(text) === null;
  return <>
    <Input type="text" inputMode="decimal" aria-label={label} value={text} disabled={disabled}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? id : undefined}
      onChange={event => {
        const next = event.target.value;
        const canonical = parseMrxQuantityText(next) ?? '';
        setEdit({ canonical, text: next });
        onChange(canonical);
      }}
      onBlur={() => {
        const canonical = parseMrxQuantityText(text);
        if (canonical !== null) setEdit({ canonical, text: formatMrxQuantityText(canonical) });
      }} className="h-8 text-right tabular-nums text-sm" />
    {invalid && <span id={id} role="alert" className="text-xs text-red-700 whitespace-normal">Nhập số thập phân không phân nhóm.</span>}
  </>;
}
