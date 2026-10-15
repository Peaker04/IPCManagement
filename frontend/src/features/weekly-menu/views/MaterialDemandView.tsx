import { useState } from 'react';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { Tabs } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Modal } from '../../../components/ui/modal';
import type { WeeklyMenuData } from '../../../api/weeklyMenuApi';
import type { MaterialDemandItem, ProductionPlanItem } from '../../../types';

export interface MaterialDemandViewProps {
  data: WeeklyMenuData;
  onRecalculate?: () => void;
  onOpenApprovalQueue?: () => void;
}

interface HandoffVoucher {
  voucherId: string;
  voucherCode: string;
  shiftName: string;
  itemCount: number;
  totalQuantity: string;
  createdBy: string;
  createdAt: string;
  status: 'signed' | 'pending';
}

const SAMPLE_VOUCHERS: HandoffVoucher[] = [
  {
    voucherId: 'v-1',
    voucherCode: 'BG-260921-01',
    shiftName: 'Ca 1 (Sáng)',
    itemCount: 26,
    totalQuantity: '1.240,5 kg',
    createdBy: 'Thủ kho Trần Văn B',
    createdAt: '08:30 21/09/2026',
    status: 'signed',
  },
  {
    voucherId: 'v-2',
    voucherCode: 'BG-260921-02',
    shiftName: 'Ca 2 (Chiều)',
    itemCount: 3,
    totalQuantity: '35,0 kg',
    createdBy: 'Thủ kho Trần Văn B',
    createdAt: '10:15 21/09/2026',
    status: 'pending',
  },
];

export function MaterialDemandView({
  data,
  onRecalculate,
  onOpenApprovalQueue,
}: MaterialDemandViewProps) {
  const [activeSegmentTab, setActiveSegmentTab] = useState<'demand' | 'source-khsx' | 'vouchers'>('demand');
  const [dayIndex, setDayIndex] = useState(0);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const currentDay = data.scheduleDays[dayIndex] || data.scheduleDays[0];

  const SEGMENT_TABS = [
    { id: 'demand', label: 'Nhu cầu nguyên liệu', count: data.demandRows.length },
    { id: 'source-khsx', label: 'KHSX nguồn', count: data.productionPlans.length },
    { id: 'vouchers', label: 'Chứng từ bàn giao', count: SAMPLE_VOUCHERS.length },
  ];

  const demandColumns: ColumnDef<MaterialDemandItem>[] = [
    {
      id: 'material',
      header: 'Nguyên liệu',
      width: '26%',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 truncate">{row.materialName}</span>
          <IdentifierText value={row.materialCode} />
        </div>
      ),
    },
    {
      id: 'dishes',
      header: 'Món sử dụng',
      width: '32%',
      cell: (row) => (
        <div className="text-slate-700 truncate" title={row.dishNames.join(', ')}>
          {row.dishNames.join(', ')}
        </div>
      ),
    },
    {
      id: 'required',
      header: 'Cần',
      width: '11%',
      align: 'right',
      cell: (row) => (
        <Num value={row.requiredQuantity} format="quantity" suffix={` ${row.unit}`} />
      ),
    },
    {
      id: 'issued',
      header: 'Đã xuất',
      width: '11%',
      align: 'right',
      cell: (row) => (
        <Num value={row.issuedQuantity} format="quantity" suffix={` ${row.unit}`} />
      ),
    },
    {
      id: 'remaining',
      header: 'Chưa xuất',
      width: '10%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.remainingQuantity}
          format="quantity"
          suffix={` ${row.unit}`}
          className={row.remainingQuantity > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}
        />
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '10%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.remainingQuantity === 0 ? 'success' : 'warning'}
          size="sm"
        >
          {row.remainingQuantity === 0 ? 'Đã xuất đủ' : 'Chờ xuất'}
        </Badge>
      ),
    },
  ];

  const khsxColumns: ColumnDef<ProductionPlanItem>[] = [
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
        <Badge
          variant={row.status === 'completed' ? 'success' : 'info'}
          size="sm"
        >
          {row.status === 'completed' ? 'Đã hoàn thành' : 'Đã phát lệnh'}
        </Badge>
      ),
    },
  ];

  const voucherColumns: ColumnDef<HandoffVoucher>[] = [
    {
      id: 'code',
      header: 'Mã chứng từ',
      width: '18%',
      cell: (row) => <IdentifierText value={row.voucherCode} />,
    },
    {
      id: 'shift',
      header: 'Ca áp dụng',
      width: '18%',
      cell: (row) => <span className="font-semibold text-slate-900">{row.shiftName}</span>,
    },
    {
      id: 'items',
      header: 'Số dòng vật tư',
      width: '14%',
      align: 'right',
      cell: (row) => <span className="font-mono">{row.itemCount} dòng</span>,
    },
    {
      id: 'total',
      header: 'Tổng khối lượng',
      width: '16%',
      align: 'right',
      cell: (row) => <span className="font-mono font-semibold">{row.totalQuantity}</span>,
    },
    {
      id: 'creator',
      header: 'Người lập & Thời gian',
      width: '22%',
      cell: (row) => (
        <div className="flex flex-col">
          <span>{row.createdBy}</span>
          <span className="text-xs text-slate-400 font-mono">{row.createdAt}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái ký',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.status === 'signed' ? 'success' : 'warning'} size="sm">
          {row.status === 'signed' ? 'Đã ký nhận' : 'Chờ ký'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-3">
            {/* Day Switcher [<] Thứ Hai, 21/09/2026 (1/6) [>] */}
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
                {currentDay.dayName}, {currentDay.dateStr} ({dayIndex + 1}/6)
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

            {/* Segmented Tabs chuyển đổi bảng chính (thay thế hoàn toàn 2 hộp details!) */}
            <Tabs
              items={SEGMENT_TABS}
              activeId={activeSegmentTab}
              onChange={(id) => setActiveSegmentTab(id as 'demand' | 'source-khsx' | 'vouchers')}
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
            <span className="text-amber-700 font-semibold">Chờ xuất: 3</span>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-700 font-semibold">Đã xuất: 26</span>
          </>
        }
        rightActions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onRecalculate}
              className="text-xs font-medium"
            >
              Tính lại nhu cầu
            </Button>
            {/* Rule D7: variant="outline" here so WorkspaceHeader owns the single primary action */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (onOpenApprovalQueue) onOpenApprovalQueue();
                else setIsApprovalModalOpen(true);
              }}
              className="text-xs font-medium border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Mở hàng đợi duyệt
            </Button>
          </>
        }
      />

      {/* Zone 3: Primary DataGrid tràn khung 85% Viewport */}
      {activeSegmentTab === 'demand' && (
        <DataGrid<MaterialDemandItem>
          data={data.demandRows}
          columns={demandColumns}
          keyExtractor={(row) => row.materialId}
        />
      )}

      {activeSegmentTab === 'source-khsx' && (
        <DataGrid<ProductionPlanItem>
          data={data.productionPlans}
          columns={khsxColumns}
          keyExtractor={(row) => row.planId}
        />
      )}

      {activeSegmentTab === 'vouchers' && (
        <DataGrid<HandoffVoucher>
          data={SAMPLE_VOUCHERS}
          columns={voucherColumns}
          keyExtractor={(row) => row.voucherId}
        />
      )}

      {/* Modal hàng đợi duyệt */}
      <Modal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        title="Hàng đợi phê duyệt nhu cầu bàn giao vật tư"
        description={`Kế hoạch bàn giao nguyên liệu ngày ${currentDay.dayName}, ${currentDay.dateStr}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsApprovalModalOpen(false)}>
              Đóng
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setIsApprovalModalOpen(false);
                alert('Đã phê duyệt lệnh xuất kho nguyên liệu thành công!');
              }}
            >
              Xác nhận duyệt xuất kho (29 dòng)
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            Hệ thống đã kiểm tra định mức BOM của các món ăn trong ca ngày và tính toán tổng số lượng cho 29 nguyên liệu.
          </p>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Số lượng nguyên liệu:</span>
              <strong className="text-slate-900">29 mặt hàng</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Khối lượng tổng cộng:</span>
              <strong className="text-slate-900">1.275,5 kg</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tổng giá trị dự kiến:</span>
              <strong className="text-slate-900">37.445.061 ₫</strong>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
