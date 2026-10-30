import { useEffect, useState, useCallback } from 'react';
import { useOperationalRecovery, executeSafeMutation } from '../../hooks/useOperationalRecovery';
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
import { InlineBanner } from '../../components/ui/inline-banner';
import { coordinationApi, type CoordinationOrderItem, type CoordinationShiftSummary } from '../../api/coordinationApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { todayInBusinessTimezone } from '../../utils/dates';
import { serverStateCache } from '../../store/serverStateCache';
import type { CustomerOption } from '../../types';

const SHIFT_TABS = [
  { id: 'MORNING', label: 'Ca 1 (Sáng)' },
  { id: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
];

interface MealOrdersSnapshot {
  customerCode: string;
  serviceDate: string;
  shiftName: 'MORNING' | 'AFTERNOON';
  data: CoordinationShiftSummary | null;
}

export function MealOrdersPage() {
  const snapshot = serverStateCache.get<MealOrdersSnapshot>('snapshot:meal_orders')?.data;
  const cachedCustomers = serverStateCache.get<CustomerOption[]>('catalog_customers')?.data;
  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const initialCustomerCode = snapshot?.customerCode || cachedCustomers?.[0]?.customerCode || '';
  const [customerCode, setCustomerCode] = useState(() => initialCustomerCode);
  const [serviceDate, setServiceDate] = useState(() => snapshot?.serviceDate || todayInBusinessTimezone());
  const [shiftName, setShiftName] = useState<'MORNING' | 'AFTERNOON'>(() => snapshot?.shiftName || 'MORNING');

  const orderKey = `meal_orders_${initialCustomerCode}_${snapshot?.serviceDate || todayInBusinessTimezone()}_${snapshot?.shiftName || 'MORNING'}`;
  const cachedOrders = snapshot?.data ?? (initialCustomerCode ? serverStateCache.get<CoordinationShiftSummary>(orderKey)?.data : null);

  const [hasCustomersLoaded, setHasCustomersLoaded] = useState(() => Boolean(cachedCustomers && cachedCustomers.length > 0));
  const [customerError, setCustomerError] = useState<Error | null>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [lockSuccess, setLockSuccess] = useState<string | null>(null);
  const [lockError, setLockError] = useState<Error | null>(null);

  const fetcher = useCallback(async (f: { customerCode: string; serviceDate: string; shiftName: 'MORNING' | 'AFTERNOON' }) => {
    if (!f.customerCode) return null;
    const summary = await coordinationApi.getOrders(f.serviceDate, f.shiftName, f.customerCode);
    serverStateCache.set('snapshot:meal_orders', {
      customerCode: f.customerCode,
      serviceDate: f.serviceDate,
      shiftName: f.shiftName,
      data: summary,
    });
    return summary;
  }, []);

  const recovery = useOperationalRecovery<CoordinationShiftSummary | null, { customerCode: string; serviceDate: string; shiftName: 'MORNING' | 'AFTERNOON' }>({
    queryKey: `meal_orders_${customerCode}_${serviceDate}_${shiftName}`,
    fetcher,
    initialFilters: { customerCode, serviceDate, shiftName },
    defaultFilters: { customerCode: customers[0]?.customerCode || '', serviceDate: todayInBusinessTimezone(), shiftName: 'MORNING' },
    prerequisiteRoute: '/admin-data?view=customers',
    prerequisiteLabel: 'Khách hàng & Hợp đồng',
  });

  const { setFilters } = recovery;
  useEffect(() => {
    if (customerCode) {
      setFilters({ customerCode, serviceDate, shiftName });
    }
  }, [customerCode, serviceDate, shiftName, setFilters]);

  const data = recovery.data || cachedOrders || null;
  const isLoading = recovery.isLoading && !data;
  const isFetching = recovery.isFetching;
  const error = customerError || recovery.error;
  const loadOrders = recovery.refetch;

  const handleLock = async () => {
    if (!data || data.orders.length === 0) return;
    setIsLocking(true);
    setLockError(null);

    await executeSafeMutation({
      mutationFn: async (payload: {
        serviceDate: string;
        shiftName: string;
        scope: string;
        lines: Array<{ quantityPlanLineId: string; orderId: string; actualQuantity: number }>;
      }) => {
        return coordinationApi.lockOrderPlan(payload);
      },
      payload: {
        serviceDate,
        shiftName,
        scope: 'FULLDAY',
        lines: data.orders.map((o) => ({
          quantityPlanLineId: o.quantityPlanLineId,
          orderId: o.id,
          actualQuantity: o.actualQuantity,
        })),
      },
      onSuccess: async () => {
        setLockSuccess(`Đã chốt đơn suất ăn cho ${data.customerCode} ${shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)'} thành công.`);
        setIsLockModalOpen(false);
        setLockError(null);
        serverStateCache.delete(`meal_orders_${customerCode}_${serviceDate}_${shiftName}`);
        await loadOrders();
      },
      onError: (err) => {
        setLockError(err);
      },
    });

    setIsLocking(false);
  };

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers()
      .then((list) => {
        if (ignore) return;
        setCustomers(list);
        setHasCustomersLoaded(true);
        serverStateCache.set('catalog_customers', list);
        const existing = customerCode && list.find((c) => c.customerCode === customerCode);
        if (existing) return;
        setCustomerCode((current) => current || list[0]?.customerCode || '');
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setHasCustomersLoaded(true);
          setCustomerError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
        }
      });
    return () => { ignore = true; };
  }, []);

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
        breadcrumb="Điều phối · Điều phối suất ăn"
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
        <InlineBanner variant="success" onClose={() => setLockSuccess(null)} className="shrink-0">
          {lockSuccess}
        </InlineBanner>
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
        isLoading={isLoading && !data}
        isFetching={isFetching || (isLoading && Boolean(data))}
        hasExistingData={Boolean(data || snapshot?.data)}
        error={error}
        onRetry={loadOrders}
        isEmpty={!isLoading && !isFetching && hasCustomersLoaded && (!data || data.orders.length === 0 || customers.length === 0)}
        emptyScenario={customers.length === 0 ? 'prerequisite-blocked' : 'filter-empty'}
        prerequisiteLabel="Khách hàng & Hợp đồng"
        onNavigatePrerequisite={() => { window.location.href = '/admin-data?view=customers'; }}
        onResetFilters={() => {
          setShiftName('MORNING');
          if (customers.length > 0) setCustomerCode(customers[0].customerCode);
        }}
        contextDomain="coordination"
        emptyTitle={customers.length === 0 ? 'Chưa có dữ liệu Khách hàng' : 'Chưa có kế hoạch suất ăn'}
        emptyDescription={customers.length === 0 ? 'Hệ thống chưa có khách hàng nào. Vui lòng tạo khách hàng trước.' : 'Chưa có kế hoạch suất ăn được chốt cho khách hàng, ngày và ca đã chọn.'}
      >
        {data && <DataGrid data={data.orders} columns={columns} keyExtractor={(row) => row.quantityPlanLineId} />}
      </StateBoundary>

      <Modal
        isOpen={isLockModalOpen}
        onClose={() => {
          if (!isLocking) {
            setIsLockModalOpen(false);
            setLockError(null);
          }
        }}
        title="Xác nhận chốt đơn suất ăn ca phục vụ"
        description={`Khách hàng: ${data?.customerCode ?? ''} · Ngày: ${serviceDate} · Ca: ${shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)'}`}
        footer={
          <>
            <Button variant="outline" size="sm" disabled={isLocking} onClick={() => { setIsLockModalOpen(false); setLockError(null); }}>
              Hủy
            </Button>
            <Button variant="default" size="sm" disabled={isLocking} onClick={() => void handleLock()}>
              {isLocking ? 'Đang chốt…' : 'Xác nhận chốt đơn'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          {lockError && (
            <InlineBanner variant="error" onClose={() => setLockError(null)}>
              {lockError.message}
            </InlineBanner>
          )}
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
