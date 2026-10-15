import { useState, useEffect } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { Checkbox } from '../../components/ui/checkbox';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Tabs } from '../../components/ui/tabs';
import { Modal } from '../../components/ui/modal';
import { ActionGuard } from '../../components/ui/action-guard';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import {
  chefApi,
  type ChefDashboardData,
  type ChefShiftDishItem,
  type ChefMaterialChecklistItem,
  type ChefExcessMaterialItem,
} from '../../api/chefApi';

const SHIFT_OPTIONS = [
  { value: 'MORNING', label: 'Ca 1 (Sáng)' },
  { value: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
];

export function ChefDashboardPage() {
  const [serviceDate, setServiceDate] = useState('2026-09-21');
  const customerCode = 'DAV';
  const [shiftName, setShiftName] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [activeTab, setActiveTab] = useState<'dishes' | 'materials' | 'excess'>('dishes');
  const [data, setData] = useState<ChefDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  // Local checklist state for interactive quality check
  const [checklist, setChecklist] = useState<ChefMaterialChecklistItem[]>([]);

  const loadData = async (date = serviceDate, shift = shiftName, cust = customerCode) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await chefApi.getChefDashboardData(date, shift, cust);
      setData(resp);
      setChecklist(resp.checklist);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu ca nấu của bếp trưởng.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchChefData() {
      try {
        const resp = await chefApi.getChefDashboardData(serviceDate, shiftName, customerCode);
        if (!ignore) {
          setData(resp);
          setChecklist(resp.checklist);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu ca nấu của bếp trưởng.');
          setIsLoading(false);
        }
      }
    }

    fetchChefData();

    return () => {
      ignore = true;
    };
  }, [serviceDate, shiftName, customerCode]);

  const handleToggleQuality = (materialId: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.materialId === materialId ? { ...item, isQualityPassed: !item.isQualityPassed } : item
      )
    );
  };

  const handleConfirmCompleteShift = async () => {
    setIsLoading(true);
    try {
      await chefApi.completeShift('2026-09-21', shiftName);
      setIsCompleteModalOpen(false);
      await loadData();
      alert('Đã xác nhận hoàn tất ca nấu thành công và gửi thông tin sang đối soát!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xác nhận hoàn tất ca thất bại');
      setIsLoading(false);
    }
  };

  const TAB_ITEMS = [
    { id: 'dishes', label: 'Lệnh sản xuất ca', count: data?.dishes.length },
    { id: 'materials', label: 'Checklist nhận vật tư', count: checklist.length },
    { id: 'excess', label: 'Đề xuất bổ sung / Trả thừa', count: data?.excessItems.length },
  ];

  // Tab 1: Dishes Columns
  const dishColumns: ColumnDef<ChefShiftDishItem>[] = [
    {
      id: 'dishCode',
      header: 'Mã món',
      width: '16%',
      cell: (row) => <IdentifierText value={row.dishCode} />,
    },
    {
      id: 'dishName',
      header: 'Tên món ăn & Quy cách',
      width: '32%',
      cell: (row) => (
        <span className="font-semibold text-slate-900 text-sm truncate block">
          {row.dishName}
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Phân loại',
      width: '16%',
      cell: (row) => <span className="text-slate-600 text-sm">{row.category}</span>,
    },
    {
      id: 'planned',
      header: 'Số suất cần nấu',
      width: '16%',
      align: 'right',
      cell: (row) => <Num value={row.plannedServings} format="quantity" suffix=" suất" className="font-bold text-slate-900" />,
    },
    {
      id: 'startTime',
      header: 'Bắt đầu',
      width: '10%',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.startTime}</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '10%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'completed' ? 'success' : 'info'}
          size="sm"
        >
          {row.status === 'completed' ? 'Đã nấu xong' : 'Đang chế biến'}
        </Badge>
      ),
    },
  ];

  // Tab 2: Material Checklist Columns
  const materialColumns: ColumnDef<ChefMaterialChecklistItem>[] = [
    {
      id: 'code',
      header: 'Mã vật tư',
      width: '18%',
      cell: (row) => <IdentifierText value={row.materialCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu',
      width: '34%',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.materialName}</span>
          {row.notes && <span className="text-xs text-slate-400 italic">{row.notes}</span>}
        </div>
      ),
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '12%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.unit}</span>,
    },
    {
      id: 'delivered',
      header: 'Số lượng giao',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.deliveredQty} format="quantity" />,
    },
    {
      id: 'received',
      header: 'Thực nhận',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.receivedQty} format="quantity" className="font-bold text-slate-900" />,
    },
    {
      id: 'quality',
      header: 'Đạt chất lượng',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.isQualityPassed}
            onChange={() => handleToggleQuality(row.materialId)}
            aria-label={`Kiểm tra chất lượng ${row.materialName}`}
          />
        </div>
      ),
    },
  ];

  // Tab 3: Excess & Supplemental Columns
  const excessColumns: ColumnDef<ChefExcessMaterialItem>[] = [
    {
      id: 'name',
      header: 'Nguyên liệu',
      width: '30%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.materialName}</span>,
    },
    {
      id: 'type',
      header: 'Phân loại đề xuất',
      width: '24%',
      cell: (row) => (
        <Badge variant={row.actionType === 'return_to_warehouse' ? 'warning' : 'danger'} size="sm">
          {row.actionType === 'return_to_warehouse' ? 'Trả hàng thừa về kho' : 'Đề xuất cấp bổ sung'}
        </Badge>
      ),
    },
    {
      id: 'quantity',
      header: 'Số lượng',
      width: '16%',
      align: 'right',
      cell: (row) => <Num value={row.quantity} format="quantity" suffix={` ${row.unit}`} className="font-bold text-slate-900" />,
    },
    {
      id: 'reason',
      header: 'Lý do ghi nhận',
      width: '30%',
      cell: (row) => <span className="text-xs text-slate-600 truncate">{row.reason}</span>,
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Bếp trưởng & Ca nấu"
        contextSelectors={
          <>
            <VietnameseDateInput
              value={serviceDate}
              onChange={(d) => setServiceDate(d)}
              className="h-9 w-36 font-mono text-sm"
            />
            <Select
              options={SHIFT_OPTIONS}
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value as 'MORNING' | 'AFTERNOON')}
              className="h-9 w-36 font-medium text-sm"
            />
            <span className="text-xs font-medium text-slate-700 hidden lg:inline">
              Phụ trách: {data?.headChefName || 'Bếp trưởng Nguyễn Văn A'}
            </span>
            <Badge variant="info" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              Ca đang nấu
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={() => loadData()}
              className="h-9 text-sm font-medium"
            >
              Làm mới
            </Button>
            {/* Rule D7: Single primary button */}
            <ActionGuard roles={['ADMIN', 'CHEF']}>
              <Button
                variant="default"
                size="default"
                onClick={() => setIsCompleteModalOpen(true)}
                className="h-9 text-sm font-medium"
              >
                Xác nhận hoàn tất ca nấu
              </Button>
            </ActionGuard>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={TAB_ITEMS}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as 'dishes' | 'materials' | 'excess')}
            size="default"
          />
        }
        telemetryPills={
          data ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Mã lệnh:</span>
                <strong className="text-slate-900 font-mono text-xs">{data.planCode}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Tổng suất:</span>
                <strong className="text-slate-900 font-mono font-bold">{data.totalServings} suất</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Tiến độ:</span>
                <strong className="text-emerald-700 font-bold">{data.progressPercent}%</strong>
              </span>
            </>
          ) : null
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={() => loadData()}
        isEmpty={!data}
        emptyTitle="Chưa có kế hoạch ca nấu"
        emptyDescription="Chưa có lệnh sản xuất nào được phát cho ca phục vụ đã chọn."
        actionLabel="Tải lại dữ liệu"
        onAction={() => loadData()}
      >
        {data && (
          <>
            {activeTab === 'dishes' && (
              <DataGrid<ChefShiftDishItem>
                data={data.dishes}
                columns={dishColumns}
                keyExtractor={(row) => row.dishId}
              />
            )}

            {activeTab === 'materials' && (
              <DataGrid<ChefMaterialChecklistItem>
                data={checklist}
                columns={materialColumns}
                keyExtractor={(row) => row.materialId}
              />
            )}

            {activeTab === 'excess' && (
              <DataGrid<ChefExcessMaterialItem>
                data={data.excessItems}
                columns={excessColumns}
                keyExtractor={(row) => row.id}
                emptyState={
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-sm">
                    Ca nấu này không có nguyên liệu dư thừa hoặc phát sinh yêu cầu bù.
                  </div>
                }
              />
            )}
          </>
        )}
      </StateBoundary>

      {/* Complete Shift Modal */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title="Xác nhận hoàn tất ca nấu"
        description={`Kế hoạch sản xuất ${data?.planCode || ''} - ${shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)'}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCompleteModalOpen(false)}>
              Quay lại
            </Button>
            <Button variant="default" size="sm" onClick={handleConfirmCompleteShift}>
              Xác nhận hoàn tất & Chốt ca
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Bếp trưởng xác nhận toàn bộ <strong>{data?.dishes.length || 0} món ăn</strong> đã chế biến hoàn tất đạt chuẩn vệ sinh an toàn thực phẩm và sẵn sàng chia khay phục vụ.
          </p>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Tổng số suất hoàn thành:</span>
              <strong className="text-slate-900">{data?.totalServings} suất</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vật tư nhận đủ:</span>
              <strong className="text-emerald-700">{checklist.filter((i) => i.isQualityPassed).length}/{checklist.length} mặt hàng</strong>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
