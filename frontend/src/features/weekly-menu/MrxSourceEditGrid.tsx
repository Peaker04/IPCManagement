import type { DishItem } from '../../api/adminApi';
import type { MrxEditScope } from '../../api/mrxApi';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
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
  onServingsChange,
  onDishChange,
  lockedHighlight,
}: MrxSourceEditGridProps) {
  const matrix = buildMrxSourceMatrix(editScope, draft, mode);
  const options = dishOptions.map((dish) => ({ value: dish.dishId, label: dish.dishName, sublabel: dish.dishCode }));
  const dishNameById = new Map(dishOptions.map((dish) => [dish.dishId, dish.dishName]));

  return (
    <div className="h-full min-h-0 overflow-auto bg-white" aria-label="Bảng sửa nguồn MRX">
      <table className="w-full min-w-[960px] border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700">
          <tr>
            <th className="sticky left-0 z-30 h-10 w-40 border-b border-r border-slate-200 bg-slate-100 px-3 text-left font-semibold">
              Nhóm / Loại món
            </th>
            {matrix.dates.map((date) => (
              <th key={date} className="h-10 min-w-36 border-b border-r border-slate-200 bg-slate-100 px-3 text-left font-semibold">
                {dayLabel(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.sections.map((section) => (
            <SectionRows
              key={section.key}
              section={section}
              mode={mode}
              readOnly={readOnly}
              options={options}
              dishNameById={dishNameById}
              onServingsChange={onServingsChange}
              onDishChange={onDishChange}
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
  options: Array<{ value: string; label: string; sublabel: string }>;
  dishNameById: Map<string, string>;
  onServingsChange: MrxSourceEditGridProps['onServingsChange'];
  onDishChange: MrxSourceEditGridProps['onDishChange'];
  lockedHighlight: string[];
}

function SectionRows({
  section,
  mode,
  readOnly,
  options,
  dishNameById,
  onServingsChange,
  onDishChange,
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
      <tr className="h-11 bg-amber-50/30">
        <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-amber-50 px-3 text-left font-semibold text-amber-900">
          Số suất <span className="font-normal">(suất)</span>
        </th>
        {section.servings.map((serving) => (
          <td key={serving.serviceDate} className="border-b border-r border-slate-200 bg-amber-50/30 p-1.5 text-right">
            <Input
              type="number"
              min={0}
              aria-label={`Số suất ${variant === 'savory' ? 'Mặn' : 'Chay'} ${shortDate(serving.serviceDate)} ${section.shiftName}`}
              disabled={readOnly || serving.isLocked}
              value={serving.value ?? ''}
              placeholder="Chưa nhập"
              onChange={(event) => onServingsChange(
                serving.serviceDate,
                section.shiftName,
                variant,
                event.target.value === '' ? null : Number(event.target.value),
              )}
              className="ml-auto h-8 w-24 text-right tabular-nums"
            />
          </td>
        ))}
      </tr>
      {section.rows.map((row) => (
        <tr key={`${section.key}-${row.dishSlot}`} className="h-10 align-middle">
          <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 text-left font-medium text-slate-700">
            {row.slotLabel}
          </th>
          {row.positions.map((position, positionIndex) => {
            if (position.kind === 'covered') return null;
            if (position.kind === 'empty') {
              return (
                <td key={`${position.serviceDate}-${positionIndex}`} className="border-b border-r border-slate-200 bg-white px-3 text-slate-400">
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
                className={`border-b border-r border-slate-200 p-2 align-middle ${highlighted ? 'bg-rose-50' : 'bg-white'}`}
              >
                {mode === 'dish-edit' ? (
                  <div className="space-y-1.5">
                    <SearchableCombobox
                      aria-label={`${firstSlot.slotLabel} ${shortDate(firstSlot.serviceDate)} ${section.shiftName}`}
                      disabled={readOnly || cell.isLocked}
                      value={cell.dishId}
                      options={options}
                      onChange={(dishId) => onDishChange(firstSlot.serviceDate, section.shiftName, firstSlot.dishSlot, dishId)}
                    />
                    {cell.isLocked && <Badge variant="warning" size="sm">{cell.lockReason || 'Đã khóa'}</Badge>}
                  </div>
                ) : (
                  <div className="flex min-h-9 items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50/40 px-2.5 py-1.5">
                    <span className="font-semibold leading-snug text-slate-900">{displayName}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {cell.rowSpan > 1 ? `${cell.rowSpan} loại món` : ''}
                      {cell.colSpan > 1 ? ` · ${cell.colSpan} ngày` : ''}
                    </span>
                  </div>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
