import { useState } from 'react';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import type { WeeklyMenuData } from '../../../api/weeklyMenuApi';
import type { ProductionPlanItem } from '../../../types';
import { formatVietnameseDate } from '../../../utils/dates';

export interface ProductionPlanViewProps {
  data: WeeklyMenuData;
}

export function ProductionPlanView({ data }: ProductionPlanViewProps) {
  const [dayIndex, setDayIndex] = useState(0);
  const [scope, setScope] = useState('all');

  const currentDay = data.scheduleDays[dayIndex] || data.scheduleDays[0];

  const SCOPE_OPTIONS = [
    { value: 'all', label: 'Tất cả các ca' },
    { value: 'shift_1', label: 'Chỉ Ca 1 (Sáng)' },
    { value: 'shift_2', label: 'Chỉ Ca 2 (Chiều)' },
  ];

  const filteredPlans = data.productionPlans.filter((p) => {
    if (scope === 'shift_1') return p.shiftName.includes('Ca 1') || p.shiftName.includes('Sáng');
    if (scope === 'shift_2') return p.shiftName.includes('Ca 2') || p.shiftName.includes('Chiều');
    return true;
  });

  const totalServings = filteredPlans.reduce((sum, p) => sum + p.plannedServings, 0);

  const columns: ColumnDef<ProductionPlanItem>[] = [
    {
      id: 'planCode',
      header: 'Mã KHSX',
      width: '20%',
      cell: (row) => <IdentifierText value={row.planCode} />,
    },
    {
      id: 'dishName',
      header: 'Tên món ăn',
      width: '32%',
      cell: (row) => (
        <span className="font-semibold text-slate-900 text-sm truncate block">
          {row.dishName}
        </span>
      ),
    },
    {
      id: 'shift',
      header: 'Ca sản xuất',
      width: '16%',
      cell: (row) => <span className="font-medium text-slate-700 text-sm">{row.shiftName}</span>,
    },
    {
      id: 'plannedServings',
      header: 'Số suất kế hoạch',
      width: '18%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.plannedServings}
          format="quantity"
          suffix=" suất"
          className="font-bold text-slate-900 text-sm"
        />
      ),
    },
    {
      id: 'date',
      header: 'Ngày phục vụ',
      width: '14%',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700 font-medium">
          {formatVietnameseDate(row.serviceDate)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '14%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'completed' ? 'success' : 'info'}
          size="sm"
        >
          {row.status === 'completed' ? 'Hoàn thành' : 'Đã phát lệnh'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-2.5">
            {/* Day Switcher */}
            <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setDayIndex((prev) => Math.max(0, prev - 1))}
                disabled={dayIndex === 0}
                className="h-6 w-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-xs font-bold"
                title="Ngày trước"
              >
                ‹
              </button>
              <span className="text-xs font-semibold text-slate-900 px-1 whitespace-nowrap">
                {currentDay.dayName}, {currentDay.dateStr}
              </span>
              <button
                type="button"
                onClick={() => setDayIndex((prev) => Math.min(data.scheduleDays.length - 1, prev + 1))}
                disabled={dayIndex === data.scheduleDays.length - 1}
                className="h-6 w-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-xs font-bold"
                title="Ngày sau"
              >
                ›
              </button>
            </div>

            {/* Scope select */}
            <Select
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-40 h-8 text-xs"
            />
          </div>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Mã lệnh:</span>
              <strong className="text-slate-900 font-mono">KHSX-DAV-20260921</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng món:</span>
              <strong className="text-slate-900 font-semibold">{filteredPlans.length} dòng</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng suất:</span>
              <strong className="text-slate-900 font-mono font-bold">
                {totalServings.toLocaleString('vi-VN')} suất
              </strong>
            </span>
          </>
        }
        rightActions={
          <Button variant="outline" size="sm" className="text-xs font-medium">
            In lệnh sản xuất
          </Button>
        }
      />

      {/* Zone 3: DataGrid chiếm trọn 85% màn hình */}
      <DataGrid<ProductionPlanItem>
        data={filteredPlans}
        columns={columns}
        keyExtractor={(row) => row.planId}
      />
    </div>
  );
}
