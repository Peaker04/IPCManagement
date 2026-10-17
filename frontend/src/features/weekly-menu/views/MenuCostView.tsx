import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { Num } from '../../../components/ui/num';
import type { WeeklyMenuData } from '../../../api/weeklyMenuApi';
import type { DishCostSummaryItem } from '../../../types';

export interface MenuCostViewProps {
  data: WeeklyMenuData;
}

export function MenuCostView({ data }: MenuCostViewProps) {
  const columns: ColumnDef<DishCostSummaryItem>[] = [
    {
      id: 'dish',
      header: 'Món ăn',
      width: '36%',
      cell: (row) => <span className="font-semibold text-slate-900">{row.dishName}</span>,
    },
    {
      id: 'category',
      header: 'Phân loại',
      width: '18%',
      cell: (row) => <span className="text-slate-700">{row.dishType || row.dishGroup || row.categoryName || '—'}</span>,
    },
    {
      id: 'bom-lines',
      header: 'Dòng BOM',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.bomItemsCount} format="quantity" />,
    },
    {
      id: 'cost',
      header: 'Giá vốn có thẩm quyền',
      width: '18%',
      align: 'right',
      cell: (row) => <Num value={row.calculatedCost} format="currency" />,
    },
    {
      id: 'ratio',
      header: 'Tỷ lệ giá vốn',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.costRatioPercent} format="percent" decimals={1} />,
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <TelemetrySubbar
        leftControls={<span className="text-xs font-semibold text-slate-700">Báo cáo giá vốn theo dữ liệu Backend</span>}
        telemetryPills={
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-500">Món có số liệu:</span>
            <strong className="text-slate-900 font-mono">{data.dishCosts.length}</strong>
          </span>
        }
      />
      <DataGrid data={data.dishCosts} columns={columns} keyExtractor={(row) => row.dishId} />
    </div>
  );
}
