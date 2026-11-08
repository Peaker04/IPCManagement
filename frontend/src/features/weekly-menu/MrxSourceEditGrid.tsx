import { getMrxShiftLabel } from '../../constants/mrxConstants';
import { useState } from 'react';
import type { DishItem } from '../../api/adminApi';
import type { MrxEditScope } from '../../api/mrxApi';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Num } from '../../components/ui/num';
import { SearchableCombobox } from '../../components/ui/searchable-combobox';
import type { MrxSourceDraft } from './hooks/useMrxSourceEdit';
import { buildMrxSourceMatrix, type MrxMatrixMode } from './mrxSourceMatrixModel';

type Variant = 'savory' | 'vegetarian';

interface MrxSourceEditGridProps {
  editScope: MrxEditScope;
  draft: MrxSourceDraft;
  dishOptions: DishItem[];
  mode?: MrxMatrixMode;
  readOnly?: boolean;
  disabled?: boolean;
  servingErrorId?: string;
  onServingsChange: (date: string, shift: string, variant: Variant, value: number | null) => void;
  onDishChange: (date: string, shift: string, dishSlot: string, dishId: string) => void;
  lockedHighlight: string[];
}

function shortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

function dayLabel(value: string): string {
  const labels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return `${labels[day]} · ${shortDate(value)}`;
}

export function MrxSourceEditGrid({
  editScope,
  draft,
  dishOptions,
  mode = 'dish-edit',
  readOnly = false,
  disabled = false,
  servingErrorId,
  onServingsChange,
  onDishChange,
  lockedHighlight,
}: MrxSourceEditGridProps) {
  const [expandedSlots, setExpandedSlots] = useState<string[]>([]);
  const isReadOnly = readOnly || editScope.batchStatus === 'COMPLETED';
  const matrix = buildMrxSourceMatrix(editScope, draft, isReadOnly ? 'completion' : mode, !isReadOnly && mode === 'dish-edit' ? expandedSlots : []);
  const options = dishOptions.map((dish) => ({ value: dish.dishId, label: dish.dishName, sublabel: dish.dishCode }));
  const dishNameById = new Map(dishOptions.map((dish) => [dish.dishId, dish.dishName]));

  return (
    <div className="h-full min-h-0 overflow-auto bg-white" aria-label="Bảng sửa nguồn MRX">
      {!isReadOnly && mode === 'dish-edit' && expandedSlots.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setExpandedSlots([])}>
          Hoàn tất sửa từng dòng
        </Button>
      )}
      <table className="w-full min-w-[960px] border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700">
          <tr>
            <th className="sticky left-0 z-30 h-10 w-40 border-b border-r border-slate-200 bg-slate-100 px-3 text-left font-semibold">
              Nhóm / Loại món
            </th>
            {matrix.dates.map((date) => {
              const day = editScope.days.find((item) => item.serviceDate === date);
              return (
                <th key={date} className="h-10 min-w-36 border-b border-r border-slate-200 bg-slate-100 px-3 py-1 text-center font-semibold">
                  <span className="block">{dayLabel(date)}</span>
                  {day?.isLocked && editScope.batchStatus !== 'COMPLETED' && <Badge variant={day.lockReason === 'Đã xuất kho' ? 'success' : 'neutral'} size="sm">{day.lockReason || 'Đã khóa'}</Badge>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {matrix.sections.map((section) => (
            <SectionRows
              key={section.key}
              section={section}
              mode={mode}
              readOnly={isReadOnly}
              disabled={disabled}
              servingErrorId={servingErrorId}
              options={options}
              dishNameById={dishNameById}
              onServingsChange={onServingsChange}
              onDishChange={onDishChange}
              onExpand={(slots) => setExpandedSlots((current) => [...new Set([...current, ...slots])])}
              lockedHighlight={lockedHighlight}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SectionRowsProps {
  section: ReturnType<typeof buildMrxSourceMatrix>['sections'][number];
  mode: MrxMatrixMode;
  readOnly: boolean;
  disabled: boolean;
  servingErrorId?: string;
  options: Array<{ value: string; label: string; sublabel: string }>;
  dishNameById: Map<string, string>;
  onServingsChange: MrxSourceEditGridProps['onServingsChange'];
  onDishChange: MrxSourceEditGridProps['onDishChange'];
  onExpand: (slots: string[]) => void;
  lockedHighlight: string[];
}

function SectionRows({
  section,
  mode,
  readOnly,
  disabled,
  servingErrorId,
  options,
  dishNameById,
  onServingsChange,
  onDishChange,
  onExpand,
  lockedHighlight,
}: SectionRowsProps) {
  const variant = section.menuVariant === 'vegetarian' ? 'vegetarian' : 'savory';
  return (
    <>
      <tr>
        <th
          colSpan={section.servings.length + 1}
          className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs font-bold tracking-wider text-slate-700"
        >
          {section.label}
        </th>
      </tr>
      <tr className={`${readOnly ? 'h-10' : 'h-11'} bg-slate-50`}>
        <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 text-left font-semibold text-slate-700">
          Số suất <span className="font-normal">(suất)</span>
        </th>
        {section.servings.map((serving) => (
          <td key={serving.serviceDate} className={`border-b border-r border-slate-200 px-3 py-1.5 text-right ${serving.value == null ? 'bg-amber-50' : 'bg-slate-50'}`}>
            {readOnly ? (
              serving.value == null ? <span className="block text-center leading-5 text-slate-600">Chưa nhập</span> : <Num value={serving.value} decimals={0} />
            ) : <Input
              type="number"
              min={0}
              aria-label={`Số suất ${variant === 'savory' ? 'Mặn' : 'Chay'} ${shortDate(serving.serviceDate)} ${getMrxShiftLabel(section.shiftName)}`}
              data-serving-date={serving.serviceDate}
              data-serving-shift={section.shiftName}
              data-serving-variant={variant}
              aria-invalid={Boolean(servingErrorId && serving.value == null && !serving.isLocked) || undefined}
              aria-describedby={servingErrorId && serving.value == null && !serving.isLocked ? servingErrorId : undefined}
              disabled={disabled || readOnly || serving.isLocked}
              value={serving.value ?? ''}
              placeholder="Chưa nhập"
              onChange={(event) => onServingsChange(
                serving.serviceDate,
                section.shiftName,
                variant,
                event.target.value === '' ? null : Number(event.target.value),
              )}
              className="h-8 w-full min-w-28 text-right tabular-nums placeholder:text-center"
            />}
          </td>
        ))}
      </tr>
      {section.rows.length === 0 && <tr className="h-9"><td colSpan={section.servings.length + 1} className="border-b border-slate-200 px-3 text-slate-600">Chưa có món {variant === 'vegetarian' ? 'chay' : 'mặn'} trong nguồn ca này.</td></tr>}
      {section.rows.map((row) => (
        <tr key={`${section.key}-${row.dishSlot}`} className={`${mode === 'dish-edit' && !readOnly ? 'h-11' : 'h-10'} align-middle`}>
          <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 text-left font-medium text-slate-700">
            {row.slotLabel}
          </th>
          {row.positions.map((position, positionIndex) => {
            if (position.kind === 'covered') return null;
            if (position.kind === 'empty') {
              return (
                <td key={`${position.serviceDate}-${positionIndex}`} className="border-b border-r border-slate-200 bg-white px-3 text-center text-slate-400">
                  —
                </td>
              );
            }

            const { cell } = position;
            const highlighted = cell.serviceDates.some((date) => lockedHighlight.includes(date));
            const displayName = dishNameById.get(cell.dishId) || cell.dishName || 'Chưa chọn món';
            const accessibleName = `${displayName}, ${cell.serviceDates.length} ngày, ${cell.rowSpan} loại món`;
            const firstSlot = cell.slots[0];
            return (
              <td
                key={`${cell.serviceDates[0]}-${firstSlot.dishSlot}`}
                rowSpan={cell.rowSpan}
                colSpan={cell.colSpan}
                aria-label={accessibleName}
                className={`border-b border-r border-slate-200 px-3 py-2 text-center align-middle ${highlighted ? 'bg-rose-50' : 'bg-white'}`}
              >
                {mode === 'dish-edit' && !readOnly && !cell.isLocked ? (
                  <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
                    {cell.rowSpan > 1 && <span className="text-xs text-slate-600">Nhóm · {cell.slots.length} dòng</span>}
                    <div className="w-44 min-w-0 max-w-full">
                    <SearchableCombobox
                      aria-label={`${firstSlot.slotLabel} ${shortDate(firstSlot.serviceDate)} ${getMrxShiftLabel(section.shiftName)}${cell.rowSpan > 1 ? ` · Đổi món cho nhóm · ${cell.slots.length} dòng` : ''}`}
                      disabled={disabled || readOnly || cell.isLocked}
                      value={cell.dishId}
                      options={options}
                      onChange={(dishId) => {
                        for (const slot of cell.slots) onDishChange(slot.serviceDate, section.shiftName, slot.dishSlot, dishId);
                      }}
                    />
                    </div>
                    {cell.rowSpan > 1 && (
                      <Button type="button" variant="ghost" size="sm" disabled={disabled}
                        aria-label={`Tách để sửa riêng ${firstSlot.slotLabel} ${shortDate(firstSlot.serviceDate)} ${getMrxShiftLabel(section.shiftName)}`}
                        onClick={() => onExpand(cell.slots.map((slot) => `${slot.serviceDate}:${section.shiftName}:${slot.dishSlot}`))}>
                        Tách để sửa riêng
                      </Button>
                    )}
                  </div>
                ) : (
                  <span className="block text-center font-medium leading-5 text-slate-900">{displayName}</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
