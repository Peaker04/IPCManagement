import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { TableDensity, TablePreferenceConfig, TablePreferenceState } from './tablePreferences';

type Props = {
  config: TablePreferenceConfig;
  state: TablePreferenceState;
  onChange: (state: TablePreferenceState) => void;
  onReset: () => void;
};

const densityLabels: Record<TableDensity, string> = {
  compact: 'Gọn (40px)',
  standard: 'Chuẩn (48px)',
  comfortable: 'Thoáng (56px)',
};

export function TablePreferencesControl({ config, state, onChange, onReset }: Props) {
  const move = (id: string, direction: -1 | 1) => {
    const index = state.columnIds.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.columnIds.length || config.columns.find((column) => column.id === id)?.locked) return;
    const columnIds = [...state.columnIds];
    [columnIds[index], columnIds[target]] = [columnIds[target], columnIds[index]];
    onChange({ ...state, columnIds });
  };

  return (
    <fieldset className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-3" aria-label="Tùy chọn hiển thị bảng">
      <legend className="sr-only">Tùy chọn hiển thị bảng</legend>
      {config.columns.map((column) => {
        const visible = !state.hiddenColumnIds.includes(column.id);
        return <div key={column.id} className="flex items-center gap-1">
          <Checkbox
            id={`${config.tableId}-${column.id}`}
            checked={visible}
            disabled={column.locked}
            onCheckedChange={(checked) => onChange({ ...state, hiddenColumnIds: checked ? state.hiddenColumnIds.filter((id) => id !== column.id) : [...state.hiddenColumnIds, column.id] })}
          />
          <label htmlFor={`${config.tableId}-${column.id}`} className="text-xs">{column.label}</label>
          {!column.locked && <>
            <Button type="button" variant="ghost" size="xs" aria-label={`Đưa ${column.label} lên`} onClick={() => move(column.id, -1)}>↑</Button>
            <Button type="button" variant="ghost" size="xs" aria-label={`Đưa ${column.label} xuống`} onClick={() => move(column.id, 1)}>↓</Button>
          </>}
        </div>;
      })}
      <div className="ml-auto flex items-center gap-1" role="radiogroup" aria-label="Mật độ hàng">
        {(Object.keys(densityLabels) as TableDensity[]).map((density) => <Button key={density} type="button" variant={state.density === density ? 'default' : 'outline'} size="xs" aria-pressed={state.density === density} onClick={() => onChange({ ...state, density })}>{densityLabels[density]}</Button>)}
      </div>
      <Button type="button" variant="outline" size="xs" onClick={onReset}>Khôi phục mặc định</Button>
    </fieldset>
  );
}
