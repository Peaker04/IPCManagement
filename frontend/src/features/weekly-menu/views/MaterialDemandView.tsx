import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { Tabs } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import type { WeeklyMenuData } from '../../../api/weeklyMenuApi';
import type { MaterialDemandItem, ProductionPlanItem } from '../../../types';

export interface MaterialDemandViewProps {
  data: WeeklyMenuData;
}

export function MaterialDemandView({ data }: MaterialDemandViewProps) {
  const [activeSegment, setActiveSegment] = useState<'demand' | 'source-khsx'>('demand');
  const [dayIndex, setDayIndex] = useState(0);
  const currentDay = data.scheduleDays[dayIndex];

  const demandColumns: ColumnDef<MaterialDemandItem>[] = [
    {
      id: 'material',
      header: 'Nguyên liệu',
      width: '34%',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 truncate">{row.materialName}</span>
          <IdentifierText value={row.materialCode} />
        </div>
      ),
    },
    {
      id: 'required',
      header: 'Nhu cầu đã tính',
      width: '18%',
      align: 'right',
      cell: (row) => <Num value={row.requiredQuantity} format="quantity" suffix={` ${row.unit}`} />,
    },
    {
      id: 'issued',
      header: 'Đã xuất vật lý',
      width: '18%',
      align: 'right',
      cell: (row) => <Num value={row.issuedQuantity} format="quantity" suffix={` ${row.unit}`} />,
    },
    {
      id: 'remaining',
      header: 'Còn phải xuất',
      width: '18%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.remainingQuantity}
          format="quantity"
          suffix={` ${row.unit}`}
          className={row.remainingQuantity > 0 ? 'text-amber-700 font-bold' : 'text-slate-600'}
        />
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái bàn giao',
      width: '18%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.status === 'fulfilled' ? 'success' : row.status === 'in_progress' ? 'warning' : 'neutral'} size="sm">
          {row.status === 'fulfilled' ? 'Đã hoàn tất bàn giao' : row.status === 'in_progress' ? 'Đang bàn giao' : 'Chưa bàn giao'}
        </Badge>
      ),
    },
  ];

  const planColumns: ColumnDef<ProductionPlanItem>[] = [
    {
      id: 'code',
      header: 'Mã KHSX',
      width: '20%',
      cell: (row) => <IdentifierText value={row.planCode} />,
    },
    {
      id: 'dish',
      header: 'Món ăn lập kế hoạch',
      width: '34%',
      cell: (row) => <span className="font-semibold text-slate-900">{row.dishName}</span>,
    },
    {
      id: 'shift',
      header: 'Ca nấu',
      width: '16%',
      cell: (row) => <span className="text-slate-700">{row.shiftName}</span>,
    },
    {
      id: 'servings',
      header: 'Số suất kế hoạch',
      width: '16%',
      align: 'right',
      cell: (row) => <Num value={row.plannedServings} format="quantity" suffix=" suất" />,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '14%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.status === 'completed' ? 'success' : row.status === 'sent_to_kitchen' ? 'info' : 'neutral'} size="sm">
          {row.status === 'completed' ? 'Hoàn tất' : row.status === 'sent_to_kitchen' ? 'Đã gửi Bếp' : 'Bản nháp'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-3">
            {currentDay && (
              <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDayIndex((previous) => Math.max(0, previous - 1))}
                  disabled={dayIndex === 0}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-xs font-bold"
                  aria-label="Ngày trước"
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                </button>
                <span className="text-xs font-semibold text-slate-900 px-1 whitespace-nowrap">
                  {currentDay.dayName}, {currentDay.dateStr} ({dayIndex + 1}/{data.scheduleDays.length})
                </span>
                <button
                  type="button"
                  onClick={() => setDayIndex((previous) => Math.min(data.scheduleDays.length - 1, previous + 1))}
                  disabled={dayIndex === data.scheduleDays.length - 1}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-xs font-bold"
                  aria-label="Ngày sau"
                >
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            <Tabs
              items={[
                { id: 'demand', label: 'Nhu cầu nguyên liệu', count: data.demandRows.length },
                { id: 'source-khsx', label: 'KHSX nguồn', count: data.productionPlans.length },
              ]}
              activeId={activeSegment}
              onChange={(id) => setActiveSegment(id as 'demand' | 'source-khsx')}
              size="default"
            />
          </div>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Vật tư:</span>
              <strong className="text-slate-900 font-semibold">{data.demandRows.length}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-amber-700 font-semibold">
              Còn phải xuất: {data.demandRows.filter((row) => row.remainingQuantity > 0).length}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-700 font-semibold">
              Đã xuất đủ: {data.demandRows.filter((row) => row.issuedQuantity > 0 && row.remainingQuantity === 0).length}
            </span>
          </>
        }
      />

      {activeSegment === 'demand' ? (
        <DataGrid data={data.demandRows} columns={demandColumns} keyExtractor={(row) => row.materialId} />
      ) : (
        <DataGrid data={data.productionPlans} columns={planColumns} keyExtractor={(row) => row.planId} />
      )}
    </div>
  );
}
