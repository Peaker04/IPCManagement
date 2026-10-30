import { useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { InlineBanner } from '../../components/ui/inline-banner';
import { weeklyMenuApi, type WeeklyMenuData } from '../../api/weeklyMenuApi';
import { serverStateCache } from '../../store/serverStateCache';
import type { CustomerOption } from '../../types';
import { WeeklyScheduleView } from './views/WeeklyScheduleView';
import { MaterialDemandView } from './views/MaterialDemandView';
import { ProductionPlanView } from './views/ProductionPlanView';
import { MenuCostView } from './views/MenuCostView';
import { MrxBatchWorkbench } from './MrxBatchWorkbench';
import { WeeklyMenuImportModal } from './WeeklyMenuImportModal';
import { WeeklyScheduleEditorModal } from './WeeklyScheduleEditorModal';
import { weekStartFor } from '../../utils/dates';

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
  const { operationalMode } = useAuth();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  // DOM-MODE-1: In MRX mode, any non-mrx-batch URL must automatically canonicalize to ?view=mrx-batch
  if (operationalMode === 'MATERIAL_RECONCILIATION' && view !== 'mrx-batch') {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', 'mrx-batch');
    return <Navigate to={`/weekly-menu?${nextParams.toString()}`} replace />;
  }

  if (view === 'mrx-batch') {
    return <MrxBatchWorkbench />;
  }

  return <DefaultWeeklyMenuPage />;
}

interface WeeklyMenuSnapshot {
  customerCode: string;
  weekStartDate: string;
  data: WeeklyMenuData | null;
}

function DefaultWeeklyMenuPage() {
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeView = requestedView === 'demand' || requestedView === 'production-plan' || requestedView === 'cost'
    ? requestedView
    : 'schedule';

  const snapshot = serverStateCache.get<WeeklyMenuSnapshot>('snapshot:weekly_menu')?.data;
  const cachedCustomers = serverStateCache.get<CustomerOption[]>('catalog_customers')?.data;
  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const initialCustomerCode = snapshot?.customerCode || cachedCustomers?.[0]?.customerCode || '';
  const initialWeek = snapshot?.weekStartDate || currentWeekStart();
  const [customerCode, setCustomerCode] = useState(() => initialCustomerCode);
  const [weekStartDate, setWeekStartDate] = useState(() => initialWeek);

  const menuKey = `weekly_menu_${initialCustomerCode}_${initialWeek}`;
  const cachedMenu = snapshot?.data ?? (initialCustomerCode ? serverStateCache.get<WeeklyMenuData>(menuKey)?.data : null);
  const [data, setData] = useState<WeeklyMenuData | null>(() => cachedMenu ?? null);
  const [hasCustomersLoaded, setHasCustomersLoaded] = useState(() => Boolean(cachedCustomers && cachedCustomers.length > 0));
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedMenu);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const requestSequence = useRef(0);

  const handlePublish = async () => {
    const matchedCustomer = customers.find((c) => c.customerCode === customerCode);
    if (!matchedCustomer) return;
    setIsPublishing(true);
    setError(null);
    try {
      const schedules = await weeklyMenuApi.getMenuSchedules(matchedCustomer.customerId, weekStartDate);
      if (schedules.length === 0) throw new Error('Không tìm thấy lịch thực đơn để xuất bản.');
      await weeklyMenuApi.publishMenuSchedule(schedules[0].menuScheduleId, 'Xuất bản thực đơn tuần');
      setPublishSuccess('Đã xuất bản thực đơn tuần thành công.');
      await handleRefresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause : new Error('Không thể xuất bản thực đơn.'));
    } finally {
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi
      .getCustomers()
      .then((list) => {
        if (ignore) return;
        setCustomers(list);
        setHasCustomersLoaded(true);
        serverStateCache.set('catalog_customers', list);
        const existing = customerCode && list.find((c) => c.customerCode === customerCode);
        if (existing) return;
        setCustomerCode((current) => current || list[0]?.customerCode || '');
        if (list.length === 0) setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setHasCustomersLoaded(true);
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
    const key = `weekly_menu_${customerCode}_${weekStartDate}`;
    const cached = serverStateCache.get<WeeklyMenuData>(key)?.data;
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setIsFetching(true);
    } else if (!data) {
      setIsLoading(true);
    }
    const sequence = ++requestSequence.current;
    weeklyMenuApi
      .getWeeklyMenuData(customerCode, weekStartDate)
      .then((response) => {
        if (sequence === requestSequence.current) {
          setData(response);
          serverStateCache.set(key, response);
          serverStateCache.set('snapshot:weekly_menu', { customerCode, weekStartDate, data: response });
        }
      })
      .catch((cause: unknown) => {
        if (sequence === requestSequence.current) {
          setData(null);
          setError(cause instanceof Error ? cause : new Error('Không thể tải dữ liệu thực đơn tuần.'));
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) {
          setIsLoading(false);
          setIsFetching(false);
        }
      });
  }, [customerCode, weekStartDate]);

  const handleRefresh = async () => {
    if (!customerCode) return;
    const key = `weekly_menu_${customerCode}_${weekStartDate}`;
    serverStateCache.delete(key);
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await weeklyMenuApi.getWeeklyMenuData(customerCode, weekStartDate);
      if (sequence === requestSequence.current) {
        setData(response);
        serverStateCache.set(key, response);
      }
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
        title: 'Chưa có nhu cầu nguyên liệu cho tuần này',
        desc: 'Chưa phát sinh dữ liệu bàn giao nguyên liệu cho khách hàng và tuần đã chọn.',
      };
    }
    if (activeView === 'production-plan') {
      return {
        title: 'Chưa có kế hoạch sản xuất ca bếp',
        desc: 'Chưa có KHSX được duyệt cho khách hàng và tuần đã chọn.',
      };
    }
    if (activeView === 'cost') {
      return {
        title: 'Chưa có số liệu phân rã chi phí BOM',
        desc: 'Hệ thống đang chờ báo cáo giá vốn món ăn chính thức từ phân hệ định mức.',
      };
    }
    return {
      title: 'Chưa có thực đơn cho tuần này',
      desc: 'Chưa có thực đơn được duyệt cho khách hàng và tuần đã chọn.',
    };
  }, [activeView]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Thực đơn & KHSX tuần"
        breadcrumb="Kế hoạch · Thực đơn & KHSX"
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
                setCustomerCode(event.target.value);
              }}
              disabled={customers.length === 0}
              className="h-9 w-64 font-medium text-sm"
            />
            <VietnameseDateInput
              aria-label="Tuần bắt đầu"
              value={weekStartDate}
              onChange={(date) => {
                const monday = weekStartFor(date);
                setIsLoading(true);
                setError(null);
                setWeekStartDate(monday);
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => setIsImportModalOpen(true)}
              className="h-9 text-sm font-medium"
            >
              Nhập thực đơn Excel
            </Button>
            {data && data.matrixRows.length > 0 && (
              <Button
                variant="outline"
                size="default"
                onClick={() => setIsEditorModalOpen(true)}
                className="h-9 text-sm font-medium"
              >
                Chỉnh sửa lịch tuần
              </Button>
            )}
            {data && data.matrixRows.length > 0 && (
              <Button
                variant="default"
                size="default"
                disabled={isPublishing}
                onClick={() => void handlePublish()}
                className="h-9 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
              >
                {isPublishing ? 'Đang xuất bản…' : 'Xuất bản thực đơn'}
              </Button>
            )}
            <Button variant="outline" size="default" onClick={handleRefresh} className="h-9 text-sm font-medium">
              Làm mới
            </Button>
          </div>
        }
      />

      {publishSuccess && (
        <InlineBanner variant="success" onClose={() => setPublishSuccess(null)} className="shrink-0">
          {publishSuccess}
        </InlineBanner>
      )}

      <StateBoundary
        isLoading={isLoading && !data}
        isFetching={isFetching || (isLoading && Boolean(data))}
        hasExistingData={Boolean(data || snapshot?.data)}
        error={error}
        onRetry={handleRefresh}
        isEmpty={!isLoading && !isFetching && hasCustomersLoaded && isViewEmpty}
        emptyScenario="prerequisite-blocked"
        emptyTitle={emptyContext.title}
        emptyDescription={emptyContext.desc}
        actionLabel={activeView === 'schedule' ? 'Nhập thực đơn ngay' : 'Làm mới dữ liệu'}
        onAction={activeView === 'schedule' ? () => setIsImportModalOpen(true) : handleRefresh}
      >
        {data && activeView === 'schedule' && <WeeklyScheduleView data={data} />}
        {data && activeView === 'demand' && <MaterialDemandView data={data} />}
        {data && activeView === 'production-plan' && <ProductionPlanView data={data} />}
        {data && activeView === 'cost' && <MenuCostView data={data} />}
      </StateBoundary>

      <WeeklyMenuImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        customers={customers}
        initialCustomerId={customers.find((c) => c.customerCode === customerCode)?.customerId}
        initialWeekStartDate={weekStartDate}
        onImportSuccess={handleRefresh}
      />

      {data && (
        <WeeklyScheduleEditorModal
          isOpen={isEditorModalOpen}
          onClose={() => setIsEditorModalOpen(false)}
          data={data}
          onSaveSuccess={() => { void handleRefresh(); }}
        />
      )}
    </div>
  );
}
