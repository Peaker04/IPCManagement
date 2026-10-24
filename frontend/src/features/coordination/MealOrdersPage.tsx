import { useEffect, useRef, useState, useCallback } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { Tabs } from '../../components/ui/tabs';
import { Modal } from '../../components/ui/modal';
import { coordinationApi, type CoordinationOrderItem, type CoordinationShiftSummary } from '../../api/coordinationApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';

const SHIFT_TABS = [
  { id: 'MORNING', label: 'Ca 1 (Sáng)' },
  { id: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
];

function todayInBusinessTimezone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function MealOrdersPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerCode, setCustomerCode] = useState('');
  const [serviceDate, setServiceDate] = useState(todayInBusinessTimezone);
  const [shiftName, setShiftName] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [data, setData] = useState<CoordinationShiftSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [lockSuccess, setLockSuccess] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const handleLock = async () => {
    if (!data || data.orders.length === 0) return;
    setIsLocking(true);
    setError(null);
    try {
      await coordinationApi.lockOrderPlan({
        serviceDate,
        shiftName,
        scope: 'FULLDAY',
        lines: data.orders.map((o) => ({
          quantityPlanLineId: o.quantityPlanLineId,
          orderId: o.id,
          actualQuantity: o.actualQuantity,
        })),
      });
      setLockSuccess(`Đã chốt đơn suất ăn cho ${data.customerCode} ${shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)'} thành công.`);
      setIsLockModalOpen(false);
      await loadOrders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể chốt đơn kế hoạch suất ăn.'));
    } finally {
      setIsLocking(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers()
      .then((list) => {
        if (ignore) return;
        setCustomers(list);
        setCustomerCode((current) => current || list[0]?.customerCode || '');
        if (list.length === 0) setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
          setIsLoading(false);
        }
      });
    return () => { ignore = true; };
  }, []);

  const loadOrders = useCallback(async () => {
    if (!customerCode) return;
    setIsLoading(true);
    setError(null);
    try {
      const summary = await coordinationApi.getOrders(serviceDate, shiftName, customerCode);
      setData(summary);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách đơn ăn ca phục vụ.'));
    } finally {
      setIsLoading(false);
    }
  }, [serviceDate, shiftName, customerCode]);

  useEffect(() => {
    if (!customerCode) return;
    const sequence = ++requestSequence.current;
    coordinationApi.getOrders(serviceDate, shiftName, customerCode)
      .then((summary) => {
        if (sequence === requestSequence.current) setData(summary);
      })
      .catch((cause: unknown) => {
        if (sequence === requestSequence.current) {
          setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách đơn ăn ca phục vụ.'));
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) setIsLoading(false);
      });
  }, [serviceDate, shiftName, customerCode]);

  const customerSelectOptions = customers.map((customer) => ({
    value: customer.customerCode,
    label: `${customer.customerCode} - ${customer.customerName}`,
  }));

  const columns: ColumnDef<CoordinationOrderItem>[] = [
    {
      id: 'mealType',
      header: 'Phân loại suất ăn',
      width: '20%',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.mealType || 'Chưa phân loại'}</span>
          <span className="text-xs text-slate-400 font-mono">{row.customerCode} · {row.customerName}</span>
        </div>
      ),
    },
    {
      id: 'menu',
      header: 'Thực đơn',
      width: '20%',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-800 text-sm truncate">{row.menuName || 'Chưa có tên thực đơn'}</span>
          <span className="text-xs text-slate-400 font-mono">{row.menuCode || row.menuId}</span>
        </div>
      ),
    },
    {
      id: 'dishes',
      header: 'Món ăn theo thực đơn ca',
      width: '28%',
      cell: (row) => (
        <span className="text-sm text-slate-700">
          {row.dishes.length > 0 ? row.dishes.map((dish) => dish.dishName).join(', ') : 'Chưa có món ăn'}
        </span>
      ),
    },
    {
      id: 'forecast',
      header: 'Suất dự kiến',
      width: '11%',
      align: 'right',
      cell: (row) => <Num value={row.forecastQuantity} format="quantity" suffix=" suất" />,
    },
    {
      id: 'actual',
      header: 'Suất thực tế',
      width: '11%',
      align: 'right',
      cell: (row) => <Num value={row.actualQuantity} format="quantity" suffix=" suất" />,
    },
    {
      id: 'scope',
      header: 'Ca phục vụ',
      width: '10%',
      align: 'center',
      cell: (row) => (
        <Badge variant="neutral" size="sm" className="whitespace-nowrap">
          {row.shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : row.shiftName === 'AFTERNOON' ? 'Ca 2 (Chiều)' : row.shiftName}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Điều phối đơn ăn"
        contextSelectors={
          <>
            <Select
              aria-label="Chọn khách hàng"
              options={customerSelectOptions}
              value={customerCode}
              onChange={(event) => setCustomerCode(event.target.value)}
              disabled={customers.length === 0}
              className="h-9 w-64 font-medium text-sm"
            />
            <VietnameseDateInput
              aria-label="Ngày phục vụ"
              value={serviceDate}
              onChange={setServiceDate}
              className="h-9 w-40 font-mono text-sm"
            />
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="default" onClick={loadOrders} className="h-9 text-sm font-medium">
              Làm mới
            </Button>
            {data && data.orders.length > 0 && (
              <Button
                variant="default"
                size="default"
                disabled={isLocking}
                onClick={() => setIsLockModalOpen(true)}
                className="h-9 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
              >
                Chốt đơn ca
              </Button>
            )}
          </div>
        }
      />

      {lockSuccess && (
        <div role="status" className="px-4 py-2 text-xs font-semibold border-b border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center justify-between shrink-0">
          <span>{lockSuccess}</span>
          <button type="button" onClick={() => setLockSuccess(null)} className="underline cursor-pointer">Đóng</button>
        </div>
      )}

      <TelemetrySubbar
        leftControls={
          <Tabs
            items={SHIFT_TABS}
            activeId={shiftName}
            onChange={(id) => setShiftName(id as 'MORNING' | 'AFTERNOON')}
            size="sm"
          />
        }
        telemetryPills={data ? (
          <>
            <span className="inline-flex items-center gap-1"><span className="text-slate-500">Dự kiến:</span><strong className="text-slate-900 font-mono">{data.registeredServings} suất</strong></span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1"><span className="text-slate-500">Thực tế:</span><strong className="text-slate-900 font-mono">{data.actualServings} suất</strong></span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1"><span className="text-slate-500">Chênh lệch:</span><strong className="text-slate-900 font-mono">{data.varianceServings > 0 ? '+' : ''}{data.varianceServings} suất</strong></span>
            <span className="text-slate-300">·</span>
            <Badge variant="neutral" size="sm">Tỷ lệ: {data.attendanceRatePercent === null ? '—' : `${data.attendanceRatePercent}%`}</Badge>
          </>
        ) : null}
      />

      <StateBoundary
        isLoading={isLoading}
        isFetching={isLoading}
        hasExistingData={Boolean(data && data.orders.length > 0)}
        error={error}
        onRetry={loadOrders}
        isEmpty={Boolean(data && data.orders.length === 0)}
        emptyScenario="prerequisite-blocked"
        emptyTitle="Chưa có kế hoạch suất ăn"
        emptyDescription="Chưa có kế hoạch suất ăn được chốt cho khách hàng, ngày và ca đã chọn."
      >
        {data && <DataGrid data={data.orders} columns={columns} keyExtractor={(row) => row.quantityPlanLineId} />}
      </StateBoundary>

      <Modal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        title="Xác nhận chốt đơn suất ăn ca phục vụ"
        description={`Khách hàng: ${data?.customerCode ?? ''} · Ngày: ${serviceDate} · Ca: ${shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)'}`}
        footer={
          <>
            <Button variant="outline" size="sm" disabled={isLocking} onClick={() => setIsLockModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="default" size="sm" disabled={isLocking} onClick={() => void handleLock()}>
              {isLocking ? 'Đang chốt…' : 'Xác nhận chốt đơn'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Bạn có chắc chắn muốn chốt số lượng suất ăn cho ca này? Sau khi chốt, số suất thực tế sẽ được khóa và đồng bộ sang Bếp trưởng và Kho vận.
          </p>
          <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs space-y-1 font-mono">
            <div>Tổng suất dự kiến: <strong>{data?.registeredServings} suất</strong></div>
            <div>Tổng suất thực tế: <strong className="text-slate-900 font-bold">{data?.actualServings} suất</strong></div>
            <div>Chênh lệch: <strong className={data && data.varianceServings !== 0 ? 'text-amber-700 font-bold' : ''}>{data?.varianceServings} suất</strong></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
