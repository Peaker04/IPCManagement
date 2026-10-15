import { useState, useEffect } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { Modal } from '../../components/ui/modal';
import { Input } from '../../components/ui/input';
import { Tabs } from '../../components/ui/tabs';
import { ActionGuard } from '../../components/ui/action-guard';
import { coordinationApi, type CoordinationOrderItem, type CoordinationShiftSummary } from '../../api/coordinationApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';

const SHIFT_TABS = [
  { id: 'MORNING', label: 'Ca 1 (Sáng)' },
  { id: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
];

export function MealOrdersPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([
    { customerId: 'c6c0b2f4-1567-4c62-b687-e50d3e93f348', customerCode: 'DAV', customerName: 'Draxlmaier' },
    { customerId: 'b1e40f3e-bda5-4c16-be27-ea7146e10d37', customerCode: 'ANV', customerName: 'AMANN' },
  ]);
  const [customerCode, setCustomerCode] = useState('DAV');
  const [serviceDate, setServiceDate] = useState('2026-09-21');
  const [shiftName, setShiftName] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [data, setData] = useState<CoordinationShiftSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Adjustment modal state
  const [selectedOrder, setSelectedOrder] = useState<CoordinationOrderItem | null>(null);
  const [adjustedServings, setAdjustedServings] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [actionNotification, setActionNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((list) => {
      if (!ignore && list.length > 0) setCustomers(list);
    }).catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const loadOrders = async (date = serviceDate, shift = shiftName, cust = customerCode) => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await coordinationApi.getOrders(date, shift, cust);
      setData(summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách đơn ăn ca phục vụ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchSummary() {
      try {
        const summary = await coordinationApi.getOrders(serviceDate, shiftName, customerCode);
        if (!ignore) {
          setData(summary);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải danh sách đơn ăn ca phục vụ.');
          setIsLoading(false);
        }
      }
    }

    fetchSummary();

    return () => {
      ignore = true;
    };
  }, [serviceDate, shiftName, customerCode]);

  const handleLockOrders = async () => {
    setIsLoading(true);
    try {
      await coordinationApi.lockOrders(serviceDate, shiftName);
      setIsLockModalOpen(false);
      await loadOrders();
      setActionNotification({
        type: 'success',
        message: 'Đã chốt số lượng suất ăn ca thành công làm căn cứ phát lệnh KHSX!',
      });
      setTimeout(() => setActionNotification(null), 5000);
    } catch (err) {
      setIsLockModalOpen(false);
      setActionNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Chốt đơn ăn thất bại',
      });
      setIsLoading(false);
    }
  };

  const handleOpenAdjustModal = (order: CoordinationOrderItem) => {
    setSelectedOrder(order);
    setAdjustedServings(order.finalServings);
    setAdjustmentReason('');
    setAdjustError(null);
  };

  const handleSaveAdjustment = async () => {
    if (!selectedOrder) return;
    if (!adjustmentReason.trim()) {
      setAdjustError('Vui lòng nhập lý do điều chỉnh số suất ăn (BR-GLOBAL-03)');
      return;
    }
    setIsAdjusting(true);
    setAdjustError(null);
    try {
      await coordinationApi.adjustServings(selectedOrder.id, adjustedServings, adjustmentReason);
      const dish = selectedOrder.dishName;
      const targetServings = adjustedServings;
      setSelectedOrder(null);
      await loadOrders();
      setActionNotification({
        type: 'success',
        message: `Đã cập nhật suất ăn món ${dish} thành ${targetServings} suất.`,
      });
      setTimeout(() => setActionNotification(null), 5000);
    } catch (err) {
      setActionNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Điều chỉnh số suất thất bại',
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  const customerSelectOptions = customers.map((c) => ({
    value: c.customerCode,
    label: `${c.customerCode} - ${c.customerName}`,
  }));

  const columns: ColumnDef<CoordinationOrderItem>[] = [
    {
      id: 'mealType',
      header: 'Phân loại suất ăn',
      width: '24%',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.mealType}</span>
          <span className="text-xs text-slate-400 font-mono">Đơn vị: {row.customerName}</span>
        </div>
      ),
    },
    {
      id: 'dishName',
      header: 'Món chính phục vụ',
      width: '28%',
      cell: (row) => (
        <span className="font-medium text-slate-800 text-sm truncate block">
          {row.dishName}
        </span>
      ),
    },
    {
      id: 'forecast',
      header: 'Suất đăng ký',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.forecastQuantity} format="quantity" suffix=" suất" />,
    },
    {
      id: 'adjustment',
      header: 'Điều chỉnh',
      width: '12%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.adjustmentQuantity}
          format="quantity"
          prefix={row.adjustmentQuantity > 0 ? '+' : ''}
          suffix=" suất"
          className={row.adjustmentQuantity !== 0 ? 'text-blue-700 font-semibold' : 'text-slate-400'}
        />
      ),
    },
    {
      id: 'final',
      header: 'Tổng suất chốt',
      width: '12%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.finalServings}
          format="quantity"
          suffix=" suất"
          className="font-bold text-slate-900 text-sm"
        />
      ),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <Badge variant="success" size="sm">
            Đã chốt
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenAdjustModal(row)}
            className="h-7 text-xs font-medium"
          >
            Sửa
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Điều phối đơn ăn"
        contextSelectors={
          <>
            <Select
              options={customerSelectOptions}
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              className="h-9 w-64 font-medium text-sm"
            />
            <VietnameseDateInput
              value={serviceDate}
              onChange={(d) => setServiceDate(d)}
              className="h-9 w-40 font-mono text-sm"
            />
            <Badge variant="success" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              Trạng thái: Đã chốt ca
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                window.print();
                setActionNotification({
                  type: 'success',
                  message: 'Đã sẵn sàng in báo cáo điều phối ca phục vụ.',
                });
                setTimeout(() => setActionNotification(null), 4000);
              }}
              className="h-9 text-sm font-medium"
            >
              Xuất báo cáo ca
            </Button>
            {/* Rule D7: Single primary button */}
            <ActionGuard roles={['ADMIN', 'MANAGER', 'DIEUPHOI']}>
              <Button
                variant="default"
                size="default"
                onClick={() => setIsLockModalOpen(true)}
                className="h-9 text-sm font-medium"
              >
                Chốt số lượng suất ăn
              </Button>
            </ActionGuard>
          </>
        }
      />

      {actionNotification && (
        <div
          className={`px-4 py-2 text-sm font-medium border-b flex items-center justify-between shrink-0 ${
            actionNotification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{actionNotification.message}</span>
          <button
            type="button"
            onClick={() => setActionNotification(null)}
            className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-3">
            <Tabs
              items={SHIFT_TABS}
              activeId={shiftName}
              onChange={(id) => setShiftName(id as 'MORNING' | 'AFTERNOON')}
              size="sm"
            />
          </div>
        }
        telemetryPills={
          data ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Đăng ký:</span>
                <strong className="text-slate-900 font-mono">{data.registeredServings} suất</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Thực tế chốt:</span>
                <strong className="text-emerald-700 font-mono font-bold">{data.actualServings} suất</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Lệch suất:</span>
                <span className={data.varianceServings < 0 ? 'text-amber-700 font-bold' : 'text-slate-700 font-bold'}>
                  {data.varianceServings > 0 ? `+${data.varianceServings}` : data.varianceServings} suất
                </span>
              </span>
              <span className="text-slate-300">·</span>
              <Badge variant="neutral" size="sm">
                Tỷ lệ: {data.attendanceRatePercent}%
              </Badge>
            </>
          ) : null
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={() => loadOrders()}
        isEmpty={!data || data.orders.length === 0}
        emptyTitle="Chưa có đơn ăn cho ca này"
        emptyDescription="Khách hàng chưa đăng ký số lượng suất ăn cho ca phục vụ đã chọn."
        actionLabel="Làm mới dữ liệu"
        onAction={() => loadOrders()}
      >
        {data && (
          <DataGrid<CoordinationOrderItem>
            data={data.orders}
            columns={columns}
            keyExtractor={(row) => row.id}
          />
        )}
      </StateBoundary>

      {/* Adjustment Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => {
          if (!isAdjusting) {
            setSelectedOrder(null);
            setAdjustError(null);
          }
        }}
        isDirty={
          selectedOrder
            ? adjustmentReason.trim().length > 0 || adjustedServings !== selectedOrder.finalServings
            : false
        }
        title="Điều chỉnh số suất ăn sau chốt"
        description={selectedOrder ? `${selectedOrder.mealType} - ${selectedOrder.customerName}` : undefined}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isAdjusting}
              onClick={() => {
                setSelectedOrder(null);
                setAdjustError(null);
              }}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={isAdjusting}
              onClick={handleSaveAdjustment}
            >
              {isAdjusting ? 'Đang lưu...' : 'Lưu điều chỉnh'}
            </Button>
          </>
        }
      >
        {selectedOrder && (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Số suất thực tế sau điều chỉnh
              </label>
              <Input
                type="number"
                value={adjustedServings}
                onChange={(e) => setAdjustedServings(parseInt(e.target.value, 10) || 0)}
                className="h-9"
              />
              <span className="text-xs text-slate-400">
                Chênh lệch so với đăng ký ban đầu: {adjustedServings - selectedOrder.forecastQuantity} suất
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Lý do điều chỉnh (bắt buộc)
              </label>
              <Input
                placeholder="Ví dụ: Khách hàng báo tăng ca đột xuất +20 người"
                value={adjustmentReason}
                onChange={(e) => {
                  setAdjustmentReason(e.target.value);
                  if (adjustError) setAdjustError(null);
                }}
                className={`h-9 ${adjustError ? 'border-red-500' : ''}`}
              />
              {adjustError && (
                <p className="text-xs text-red-600 font-medium">{adjustError}</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Lock Orders Confirmation Modal */}
      <Modal
        isOpen={isLockModalOpen}
        onClose={() => {
          if (!isLoading) setIsLockModalOpen(false);
        }}
        title="Xác nhận chốt số lượng suất ăn ca"
        description={`${customerCode} · Ngày ${serviceDate} · ${shiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'}`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => setIsLockModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={isLoading}
              onClick={handleLockOrders}
            >
              {isLoading ? 'Đang chốt...' : 'Xác nhận chốt đơn'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Hành động này sẽ khóa số liệu đơn ăn của ca phục vụ, dùng làm căn cứ chính thức để phát lệnh KHSX và bóc tách định mức vật tư. Bạn có chắc chắn muốn chốt số lượng này không?
        </p>
      </Modal>
    </div>
  );
}
