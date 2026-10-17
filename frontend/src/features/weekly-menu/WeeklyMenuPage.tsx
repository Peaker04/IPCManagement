import { useEffect, useMemo, useRef, useState } from 'react';
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

function currentWeekStart(): string {
  const now = new Date();
  const businessDate = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now) + 'T00:00:00Z'
  );
  const day = businessDate.getUTCDay();
  businessDate.setUTCDate(businessDate.getUTCDate() - (day === 0 ? 6 : day - 1));
  return businessDate.toISOString().slice(0, 10);
}

export function WeeklyMenuPage() {
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeView = requestedView === 'demand' || requestedView === 'production-plan' || requestedView === 'cost'
    ? requestedView
    : 'schedule';

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerCode, setCustomerCode] = useState('');
  const [weekStartDate, setWeekStartDate] = useState(currentWeekStart);
  const [data, setData] = useState<WeeklyMenuData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi
      .getCustomers()
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
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!customerCode) return;
    const sequence = ++requestSequence.current;
    weeklyMenuApi
      .getWeeklyMenuData(customerCode, weekStartDate)
      .then((response) => {
        if (sequence === requestSequence.current) setData(response);
      })
      .catch((cause: unknown) => {
        if (sequence === requestSequence.current) {
          setData(null);
          setError(cause instanceof Error ? cause : new Error('Không thể tải dữ liệu thực đơn tuần.'));
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) setIsLoading(false);
      });
  }, [customerCode, weekStartDate]);

  const handleRefresh = async () => {
    if (!customerCode) return;
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await weeklyMenuApi.getWeeklyMenuData(customerCode, weekStartDate);
      if (sequence === requestSequence.current) setData(response);
    } catch (cause: unknown) {
      if (sequence === requestSequence.current) {
        setData(null);
        setError(cause instanceof Error ? cause : new Error('Không thể tải dữ liệu thực đơn tuần.'));
      }
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  };

  const isViewEmpty = useMemo(() => {
    if (!data) return true;
    if (activeView === 'demand') return data.demandRows.length === 0;
    if (activeView === 'production-plan') return data.productionPlans.length === 0;
    if (activeView === 'cost') return data.dishCosts.length === 0;
    return data.matrixRows.length === 0;
  }, [data, activeView]);

  const emptyContext = useMemo(() => {
    if (activeView === 'demand') {
      return {
        title: 'Chưa có nhu cầu nguyên liệu có thẩm quyền',
        desc: 'Backend chưa trả demand aggregate cho khách hàng và tuần đã chọn. Không sử dụng BOM tự tính thay cho nhu cầu đã sinh.',
      };
    }
    if (activeView === 'production-plan') {
      return {
        title: 'Chưa có kế hoạch sản xuất',
        desc: 'Không có KHSX persisted trong phạm vi khách hàng và tuần đã chọn.',
      };
    }
    if (activeView === 'cost') {
      return {
        title: 'Chưa có số liệu phân rã chi phí BOM',
        desc: 'Backend hiện chưa cung cấp báo cáo giá vốn món ăn đúng grain cho phạm vi này; frontend không tự suy diễn chi phí.',
      };
    }
    return {
      title: 'Chưa có thực đơn cho tuần này',
      desc: 'Không có dòng thực đơn persisted cho khách hàng và tuần đã chọn.',
    };
  }, [activeView]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Thực đơn & KHSX tuần"
        contextSelectors={
          <>
            <Select
              aria-label="Chọn khách hàng thực đơn"
              options={customers.map((customer) => ({
                value: customer.customerCode,
                label: `${customer.customerCode} - ${customer.customerName}`,
              }))}
              value={customerCode}
              onChange={(event) => {
                setIsLoading(true);
                setError(null);
                setData(null);
                setCustomerCode(event.target.value);
              }}
              disabled={customers.length === 0}
              className="h-9 w-64 font-medium text-sm"
            />
            <VietnameseDateInput
              aria-label="Tuần bắt đầu"
              value={weekStartDate}
              onChange={(date) => {
                setIsLoading(true);
                setError(null);
                setData(null);
                setWeekStartDate(date);
              }}
              className="h-9 w-40 font-mono text-sm"
            />
            {data && data.mealTargetPrice > 0 && (
              <Badge variant="neutral" size="default" className="h-9 px-3 text-sm font-mono flex items-center">
                Mức giá: {data.mealTargetPrice.toLocaleString('vi-VN')} ₫
              </Badge>
            )}
          </>
        }
        actions={
          <Button variant="outline" size="default" onClick={handleRefresh} className="h-9 text-sm font-medium">
            Làm mới
          </Button>
        }
      />

      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={handleRefresh}
        isEmpty={isViewEmpty}
        emptyScenario="prerequisite-blocked"
        emptyTitle={emptyContext.title}
        emptyDescription={emptyContext.desc}
      >
        {data && activeView === 'schedule' && <WeeklyScheduleView data={data} />}
        {data && activeView === 'demand' && <MaterialDemandView data={data} />}
        {data && activeView === 'production-plan' && <ProductionPlanView data={data} />}
        {data && activeView === 'cost' && <MenuCostView data={data} />}
      </StateBoundary>
    </div>
  );
}
