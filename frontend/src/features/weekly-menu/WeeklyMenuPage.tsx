import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { weeklyMenuApi, type WeeklyMenuData } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';
import { WeeklyScheduleView } from './views/WeeklyScheduleView';
import { MaterialDemandView } from './views/MaterialDemandView';
import { ProductionPlanView } from './views/ProductionPlanView';
import { MenuCostView } from './views/MenuCostView';

export function WeeklyMenuPage() {
  const [searchParams] = useSearchParams();
  const activeView = searchParams.get('view') || 'schedule';

  const [customers, setCustomers] = useState<CustomerOption[]>([
    { customerId: 'c6c0b2f4-1567-4c62-b687-e50d3e93f348', customerCode: 'DAV', customerName: 'Draxlmaier' },
    { customerId: 'b1e40f3e-bda5-4c16-be27-ea7146e10d37', customerCode: 'ANV', customerName: 'AMANN' },
  ]);
  const [customerCode, setCustomerCode] = useState('DAV');
  const [weekStartDate, setWeekStartDate] = useState('2026-09-21');
  const [data, setData] = useState<WeeklyMenuData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch customer options on mount
  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((list) => {
      if (!ignore && list.length > 0) {
        setCustomers(list);
      }
    }).catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch weekly menu data when customer or week changes
  useEffect(() => {
    let ignore = false;
    async function fetchMenu() {
      try {
        const resp = await weeklyMenuApi.getWeeklyMenuData(customerCode, weekStartDate);
        if (!ignore) {
          setData(resp);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu thực đơn tuần.');
          setIsLoading(false);
        }
      }
    }

    fetchMenu();

    return () => {
      ignore = true;
    };
  }, [customerCode, weekStartDate]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await weeklyMenuApi.getWeeklyMenuData(customerCode, weekStartDate);
      setData(resp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu thực đơn tuần.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setIsLoading(true);
    try {
      await weeklyMenuApi.recalculateDemand(customerCode, weekStartDate);
      const resp = await weeklyMenuApi.getWeeklyMenuData(customerCode, weekStartDate);
      setData(resp);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Tính lại nhu cầu thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const customerSelectOptions = customers.map((c) => ({
    value: c.customerCode,
    label: `${c.customerCode} - ${c.customerName}`,
  }));

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: Shared WorkspaceHeader (Cao 56px / h-14) */}
      <WorkspaceHeader
        title="Thực đơn & KHSX tuần"
        contextSelectors={
          <>
            <Select
              options={customerSelectOptions}
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              className="h-9 w-64 font-medium text-sm"
            />
            <VietnameseDateInput
              value={weekStartDate}
              onChange={(d) => setWeekStartDate(d)}
              className="h-9 w-40 font-mono text-sm"
            />
            <Badge variant="neutral" size="default" className="h-9 px-3 text-sm font-mono flex items-center">
              Định mức: 25.000 ₫
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={handleRefresh}
              className="h-9 text-sm font-medium"
            >
              Làm mới
            </Button>
            {/* Rule D7: Single primary button */}
            <Button
              variant="default"
              size="default"
              onClick={() => alert('Đã gửi phê duyệt toàn bộ kế hoạch tuần')}
              className="h-9 text-sm font-medium"
            >
              Duyệt kế hoạch tuần
            </Button>
          </>
        }
      />

      {/* State Boundary & Active View Render (NO duplicate tab bar!) */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={handleRefresh}
        isEmpty={!data}
        emptyTitle="Chưa có thực đơn cho tuần này"
        emptyDescription="Khách hàng chưa đăng ký thực đơn cho khoảng thời gian đã chọn. Bấm nút bên dưới để tạo mới."
        actionLabel="Khởi tạo thực đơn tuần"
        onAction={handleRefresh}
      >
        {data && (
          <>
            {activeView === 'schedule' && (
              <WeeklyScheduleView data={data} />
            )}

            {activeView === 'demand' && (
              <MaterialDemandView
                data={data}
                onRecalculate={handleRecalculate}
              />
            )}

            {activeView === 'production-plan' && (
              <ProductionPlanView data={data} />
            )}

            {activeView === 'cost' && (
              <MenuCostView data={data} />
            )}
          </>
        )}
      </StateBoundary>
    </div>
  );
}
