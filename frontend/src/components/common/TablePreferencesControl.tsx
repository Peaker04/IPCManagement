import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
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
  const popupRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!open) return;

    const closeAndRestoreFocus = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popupRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeAndRestoreFocus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndRestoreFocus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
    <div className="relative inline-block">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Tùy chỉnh bảng
      </Button>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
      {open && (
        <div
          ref={popupRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[32rem] overflow-y-auto rounded-md border border-border bg-surface p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-sm font-semibold">Tùy chỉnh bảng</h2>
            <Button type="button" variant="ghost" size="xs" aria-label="Đóng tùy chỉnh bảng" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>
              Đóng
            </Button>
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
                    <input
                      id={`${config.tableId}-${column.id}`}
                      type="checkbox"
                      checked={visible}
                      disabled={column.locked}
                      onChange={(event) => save({ ...state, hiddenColumnIds: event.target.checked ? state.hiddenColumnIds.filter((id) => id !== column.id) : [...state.hiddenColumnIds, column.id] })}
                      className="size-4 shrink-0 rounded border-input accent-primary"
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
            <div role="radiogroup" aria-labelledby={`${config.tableId}-density-heading`} className="grid gap-2">
              {(Object.keys(densityLabels) as TableDensity[]).map((density) => (
                <label key={density} className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                  <input
                    type="radio"
                    aria-label={densityLabels[density]}
                    name={`${config.tableId}-density`}
                    value={density}
                    checked={state.density === density}
                    onChange={() => save({ ...state, density })}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm">{densityLabels[density]}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="mt-4 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => { onReset(); setAnnouncement('Đã khôi phục tùy chỉnh bảng mặc định'); }}>
              Khôi phục mặc định
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
