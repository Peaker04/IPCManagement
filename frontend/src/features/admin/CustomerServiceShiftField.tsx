import { Checkbox } from '../../components/ui/checkbox';
import { MRX_SHIFT_OPTIONS } from '../../constants/mrxConstants';

interface CustomerServiceShiftFieldProps {
  value: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}

export function CustomerServiceShiftField({ value, disabled, onChange }: CustomerServiceShiftFieldProps) {
  return (
    <fieldset disabled={disabled} className="space-y-1">
      <legend className="text-xs font-semibold text-slate-700">Ca phục vụ</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {MRX_SHIFT_OPTIONS.filter(option => option.value !== 'ALL').map(option => (
          <label key={option.value} className="flex min-h-8 items-center gap-2 text-sm">
            <Checkbox checked={value.includes(option.value)} onChange={event => onChange(event.target.checked
              ? [...value, option.value] : value.filter(shift => shift !== option.value))} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
