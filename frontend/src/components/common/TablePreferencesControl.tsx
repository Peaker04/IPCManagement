import { useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
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
  compact: 'Gọn',
  standard: 'Tiêu chuẩn',
  comfortable: 'Thoáng',
};

export function TablePreferencesControl({ config, state, onChange, onReset }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const save = (next: TablePreferenceState) => {
    onChange(next);
    setAnnouncement('Đã lưu tùy chỉnh bảng');
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = state.columnIds.indexOf(id);
    const target = index + direction;
    const sourceColumn = config.columns.find((column) => column.id === id);
    const targetColumn = config.columns.find((column) => column.id === state.columnIds[target]);
    if (index < 0 || target < 0 || target >= state.columnIds.length || sourceColumn?.locked || targetColumn?.locked) return;

    const columnIds = [...state.columnIds];
    [columnIds[index], columnIds[target]] = [columnIds[target], columnIds[index]];
    save({ ...state, columnIds });
  };

  return (
    <Popover.Root>
      <Popover.Trigger render={<Button ref={triggerRef} type="button" variant="outline" size="sm" />}>
        Tùy chỉnh bảng
      </Popover.Trigger>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup
            aria-label="Tùy chỉnh bảng"
            finalFocus={triggerRef}
            className="w-80 max-w-[calc(100vw-2rem)] max-h-[min(var(--available-height),32rem)] overflow-y-auto rounded-md border border-border bg-surface p-4 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <Popover.Title className="text-sm font-semibold">Tùy chỉnh bảng</Popover.Title>
              <Popover.Close render={<Button type="button" variant="ghost" size="xs" aria-label="Đóng tùy chỉnh bảng" />}>
                Đóng
              </Popover.Close>
            </div>

            <section aria-labelledby={`${config.tableId}-columns-heading`} className="space-y-2">
              <h3 id={`${config.tableId}-columns-heading`} className="text-sm font-medium">Cột hiển thị</h3>
              <div className="space-y-2">
                {config.columns.map((column) => {
                  const visible = !state.hiddenColumnIds.includes(column.id);
                  const index = state.columnIds.indexOf(column.id);
                  const canMoveUp = !column.locked && index > 0 && !config.columns.find((item) => item.id === state.columnIds[index - 1])?.locked;
                  const canMoveDown = !column.locked && index >= 0 && index < state.columnIds.length - 1 && !config.columns.find((item) => item.id === state.columnIds[index + 1])?.locked;

                  return (
                    <div key={column.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`${config.tableId}-${column.id}`}
                        checked={visible}
                        disabled={column.locked}
                        onCheckedChange={(checked) => save({ ...state, hiddenColumnIds: checked ? state.hiddenColumnIds.filter((id) => id !== column.id) : [...state.hiddenColumnIds, column.id] })}
                      />
                      <label htmlFor={`${config.tableId}-${column.id}`} className="min-w-0 flex-1 text-sm">{column.label}</label>
                      {!column.locked && <>
                        <Button type="button" variant="ghost" size="xs" aria-label={`Đưa ${column.label} lên`} disabled={!canMoveUp} onClick={() => move(column.id, -1)}>↑</Button>
                        <Button type="button" variant="ghost" size="xs" aria-label={`Đưa ${column.label} xuống`} disabled={!canMoveDown} onClick={() => move(column.id, 1)}>↓</Button>
                      </>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby={`${config.tableId}-density-heading`} className="mt-4 space-y-2 border-t border-border pt-4">
              <h3 id={`${config.tableId}-density-heading`} className="text-sm font-medium">Mật độ hàng</h3>
              <RadioGroup value={state.density} onValueChange={(density) => save({ ...state, density: density as TableDensity })} aria-labelledby={`${config.tableId}-density-heading`} className="grid gap-2">
                {(Object.keys(densityLabels) as TableDensity[]).map((density) => (
                  <div key={density} className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                    <Radio.Root value={density} aria-label={densityLabels[density]} className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring data-checked:border-primary data-checked:bg-primary">
                      <Radio.Indicator className="size-1.5 rounded-full bg-primary-foreground" />
                    </Radio.Root>
                    <span className="text-sm">{densityLabels[density]}</span>
                  </div>
                ))}
              </RadioGroup>
            </section>

            <div className="mt-4 border-t border-border pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => { onReset(); setAnnouncement('Đã khôi phục tùy chỉnh bảng mặc định'); }}>
                Khôi phục mặc định
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
