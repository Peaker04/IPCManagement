import React from 'react';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import type { WeeklyMenuData } from '../../../api/weeklyMenuApi';
import { clsx } from 'clsx';

export interface WeeklyScheduleViewProps {
  data: WeeklyMenuData;
}

export function WeeklyScheduleView({ data }: WeeklyScheduleViewProps) {
  // Group matrix rows by sectionTitle (e.g. MENU MẶN CA SÁNG, MENU CHAY CA SÁNG)
  const sections = Array.from(new Set(data.matrixRows.map((r) => r.sectionTitle)));

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 text-sm">
              Khách hàng: {data.customerName}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-mono">
              Tuần: {data.scheduleDays[0]?.dateStr} — {data.scheduleDays[data.scheduleDays.length - 1]?.dateStr}
            </span>
          </div>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Món tuần:</span>
              <strong className="text-slate-900 font-semibold">{data.matrixRows.length * 6} lượt</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Định mức:</span>
              {data.mealTargetPrice > 0 ? (
                <Num
                  value={data.mealTargetPrice}
                  format="currency"
                  className="text-slate-900 font-mono font-semibold"
                />
              ) : (
                <span className="text-slate-500 font-medium">Theo ca / Chưa chốt</span>
              )}
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="neutral" size="sm">
              Trạng thái: Kế hoạch tuần
            </Badge>
          </>
        }
      />

      {/* Zone 3: Matrix Grid tràn khung (flex-1) */}
      <div className="flex-1 min-h-0 overflow-auto bg-white">
        <table className="w-full text-left text-sm border-collapse table-fixed min-w-[960px]">
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200">
            <tr>
              <th className="h-10 px-4 w-44 text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap bg-slate-100">
                Phân nhóm / Loại món
              </th>
              {data.scheduleDays.map((day) => (
                <th
                  key={day.dayName}
                  className="h-10 px-3 text-xs font-semibold text-slate-800 whitespace-nowrap border-l border-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <span>{day.dayName}</span>
                    <span className="font-mono text-xs text-slate-400 font-normal">
                      {day.dateStr}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sections.map((sectionTitle) => {
              const rowsInSection = data.matrixRows.filter((r) => r.sectionTitle === sectionTitle);
              return (
                <React.Fragment key={sectionTitle}>
                  {/* Section Divider Header */}
                  <tr className="bg-slate-50/80 border-y border-slate-200">
                    <td
                      colSpan={data.scheduleDays.length + 1}
                      className="px-4 py-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      {sectionTitle}
                    </td>
                  </tr>

                  {/* Rows in section */}
                  {rowsInSection.map((row, rowIdx) => (
                    <tr
                      key={`${sectionTitle}-${row.slotLabel}`}
                      className={clsx(
                        'min-h-[52px] transition-colors',
                        rowIdx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900 bg-white border-r border-slate-200 align-middle">
                        <span className="text-xs text-slate-700">{row.slotLabel}</span>
                      </td>

                      {data.scheduleDays.map((day, dIdx) => {
                        const isoDate = Object.keys(row.days)[dIdx] || '';
                        const dishName = row.days[isoDate] || Object.values(row.days)[dIdx] || '';

                        return (
                          <td
                            key={day.dayName}
                            className="px-3 py-2 border-l border-slate-100 align-middle hover:bg-blue-50/30 transition-colors"
                          >
                            {dishName ? (
                              <div className="p-2 rounded border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition-colors">
                                <span className="font-semibold text-sm text-slate-900 leading-snug line-clamp-2">
                                  {dishName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 italic text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
