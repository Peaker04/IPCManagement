import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Info, RotateCcw, ShoppingCart, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { CommandBar, ContextStrip, EmptyState, InlineAlert, KeepAliveTabPanel, OperationalFrame, StatusBadge, ViewSwitcher } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { visibleTabIds } from '@/lib/navigationPreferences';
import { formatDateOnly } from '@/lib/formatters';
import { toQueryView } from '@/lib/queryView';
import { useGetPurchaseWorkbenchQuery } from '@/api/purchasingApi';
import { ServiceRunBlockerPanel } from '@/components/common/ServiceRunBlockerPanel';
import { PurchaseServiceDateWorkbench } from '../PurchaseServiceDateWorkbench';
import { PurchaseDecisionPanel } from '../PurchaseDecisionPanel';
import { PurchaseWorkflowGuide } from '../PurchaseWorkflowGuide';
import { useSupplierQuotations } from '../quotation/useSupplierQuotations';
import {
  getPurchasingErrorMessage,
  isPurchasingStage,
  resolveNextPurchasingAction,
  resolvePurchasingRouteState,
  type PurchasingStageId,
} from '../purchasingModel';

const SupplementalPurchasingWorkbench = lazy(() => import('../SupplementalPurchasingWorkbench').then(({ SupplementalPurchasingWorkbench: component }) => ({ default: component })))
const SupplierQuotationSection = lazy(() => import('../quotation/SupplierQuotationSection').then(({ SupplierQuotationSection: component }) => ({ default: component })))
const purchasingCapabilityFallback = <div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50 motion-reduce:animate-none" />

type PurchasingView = 'workflow' | 'supplemental' | 'quotations';

const shiftIsoWeek = (week: string, days: number) => {
  const date = new Date(`${week}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatWeekRange = (week: string) => {
  const start = new Date(`${week}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${formatDateOnly(start.toISOString())} - ${formatDateOnly(end.toISOString())}`;
};

export default function PurchasingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedLineId, setSelectedLineId] = useState<string>();
  const requestedView = searchParams.get('view');
  const purchasingTabIds = useMemo(() => visibleTabIds('purchasing') as PurchasingView[], []);
  const requestedPurchasingView: PurchasingView = requestedView === 'quotations' || requestedView === 'supplemental' ? requestedView : 'workflow';
  const activeView: PurchasingView = purchasingTabIds.includes(requestedPurchasingView) ? requestedPurchasingView : purchasingTabIds[0] ?? 'workflow';
  const quotationWorkflow = useSupplierQuotations(activeView === 'quotations');
  const requestedStage = searchParams.get('stage');
  const initialRoute = resolvePurchasingRouteState(
    {
      week: searchParams.get('week'),
      date: searchParams.get('date'),
      stage: requestedStage,
    },
    [],
  );
  const rawDate = searchParams.get('date') ?? undefined;
  const rawStage = isPurchasingStage(requestedStage) ? requestedStage : undefined;
  const workbenchQuery = useGetPurchaseWorkbenchQuery({
    week: initialRoute.week,
    date: rawDate,
    stage: rawStage,
    page,
    pageSize: 8,
  }, { skip: activeView !== 'workflow' });
  const workbenchView = toQueryView(workbenchQuery, {
    instruction: 'Mở tab Xử lý thu mua để tải quy trình theo tuần.',
    retry: () => workbenchQuery.refetch(),
    errorMessage: (error) => `Không tải được quy trình thu mua. ${getPurchasingErrorMessage(error)}`,
    forbiddenMessage: 'Bạn không có quyền xem quy trình thu mua.',
  });
  const workbench = workbenchView.phase === 'ready' ? workbenchView.data : undefined;
  const isWorkflowReadyEmpty =
    activeView === 'workflow' &&
    workbenchView.phase === 'ready' &&
    workbenchView.data.serviceDates.length === 0;
  const isFetching = workbenchView.phase === 'loading'
    || workbenchView.phase === 'ready' && workbenchView.isRefreshing;

  const requestedPurchaseRequestId = searchParams.get('purchaseRequestId');
  const requestedPurchaseDate = requestedPurchaseRequestId
    ? workbench?.serviceDates.find((item) => item.purchaseRequestId === requestedPurchaseRequestId)?.serviceDate
    : undefined;
  const routeState = useMemo(
    () => resolvePurchasingRouteState(
      {
        week: searchParams.get('week'),
        date: searchParams.get('date') ?? requestedPurchaseDate ?? workbench?.selectedDate,
        stage: searchParams.get('stage') ?? workbench?.selectedStage,
      },
      workbench?.serviceDates ?? [],
    ),
    [requestedPurchaseDate, searchParams, workbench?.selectedDate, workbench?.selectedStage, workbench?.serviceDates],
  );
  const activeDate = workbench?.serviceDates.find((item) => item.serviceDate === routeState.date);
  const selectedLine = activeDate?.purchaseLines.find((line) => line.purchaseRequestLineId === selectedLineId);
  const nextAction = resolveNextPurchasingAction(activeDate, { loadError: workbenchView.phase === 'error' });
  const isSupplierLineDecision = routeState.stage === 'supplier-price' && Boolean(selectedLine);
  const showCommandAction = nextAction.kind === 'recovery'
    || routeState.stage !== 'demand'
      && (routeState.stage !== 'supplier-price' || nextAction.label === 'Gửi đề xuất mua');
  const isQuotationFailure = quotationWorkflow.isLookupError
    || quotationWorkflow.isLookupForbidden
    || quotationWorkflow.quotationView.phase === 'error'
    || quotationWorkflow.quotationView.phase === 'forbidden';
  const isQuotationPending = quotationWorkflow.ingredientView.phase === 'loading'
    || quotationWorkflow.supplierView.phase === 'loading'
    || quotationWorkflow.ingredientView.phase === 'ready' && quotationWorkflow.ingredientView.isRefreshing
    || quotationWorkflow.supplierView.phase === 'ready' && quotationWorkflow.supplierView.isRefreshing
    || quotationWorkflow.quotationView.phase === 'loading'
    || quotationWorkflow.quotationView.phase === 'ready' && quotationWorkflow.quotationView.isRefreshing;
  const isPageFailure = activeView === 'workflow'
    ? workbenchView.phase === 'error' || workbenchView.phase === 'forbidden'
    : activeView === 'quotations' && isQuotationFailure;
  const isPagePending = activeView === 'workflow'
    ? isFetching
    : activeView === 'quotations' && isQuotationPending;

  useEffect(() => {
    if (activeView !== 'workflow') return;
    if (!workbench && workbenchView.phase !== 'error') return;

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('week', routeState.week);
      if (current.has('date')) {
        if (routeState.date) next.set('date', routeState.date);
        else next.delete('date');
      }
      if (current.has('stage')) next.set('stage', routeState.stage);
      return next.toString() === current.toString() ? current : next;
    }, { replace: true });
  }, [activeView, routeState.date, routeState.stage, routeState.week, setSearchParams, workbench, workbenchView.phase]);

  const changeView = (id: string) => {
    const view: PurchasingView = id === 'purchasing-quotations'
      ? 'quotations'
      : id === 'purchasing-supplemental'
        ? 'supplemental'
        : 'workflow';
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (view === 'workflow') next.delete('view');
      else next.set('view', view);
      return next;
    });
  };

  const replaceRouteContext = (nextContext: {
    week?: string;
    date?: string;
    stage?: PurchasingStageId;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (nextContext.week) next.set('week', nextContext.week);
    if (nextContext.date) next.set('date', nextContext.date);
    else if (nextContext.week) next.delete('date');
    if (nextContext.stage) next.set('stage', nextContext.stage);
    else if (nextContext.week) next.delete('stage');
    setPage(1);
    setSelectedLineId(undefined);
    setSearchParams(next);
  };

  const moveWeek = (days: number) => replaceRouteContext({ week: shiftIsoWeek(routeState.week, days) });
  const focusDecisionPanel = () => {
    if (nextAction.kind === 'recovery') {
      void workbenchQuery.refetch();
      return;
    }
    document.getElementById('purchase-decision-panel')?.focus();
  };

  return (
    <OperationalFrame
      command={
        <CommandBar
          actionsClassName="ipc-purchasing-actions"
          actions={activeView === 'workflow' ? <>
            <Button variant="outline" size="icon" className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9" aria-label="Tuần trước" onClick={() => moveWeek(-7)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => replaceRouteContext({ week: resolvePurchasingRouteState({}, []).week })}>
              <RotateCcw aria-hidden="true" />
              Tuần hiện tại
            </Button>
            <Button variant="outline" size="icon" className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9" aria-label="Tuần sau" onClick={() => moveWeek(7)}>
              <ChevronRight aria-hidden="true" />
            </Button>
            {nextAction.label && showCommandAction ? (
              <Button
                variant={nextAction.kind === 'recovery' ? 'outline' : 'default'}
                className="min-h-11 min-w-[10.25rem] sm:min-h-9"
                onClick={focusDecisionPanel}
                disabled={isFetching && nextAction.kind !== 'recovery'}
              >
                {nextAction.label}
              </Button>
            ) : null}
          </> : undefined}
        >
          {activeView === 'workflow' ? (
            <>
              <span className="ipc-command-meta"><ShoppingCart size={16} aria-hidden="true" />Tuần mua hàng: {formatWeekRange(routeState.week)}</span>
              <span className="ipc-command-meta" title="Phạm vi kỹ thuật: FULLDAY"><CalendarDays size={16} aria-hidden="true" />Cả ngày</span>
            </>
          ) : activeView === 'supplemental' ? (
            <span className="ipc-command-meta"><ShoppingCart size={16} aria-hidden="true" />Yêu cầu mua bổ sung từ bếp</span>
          ) : (
            <span className="ipc-command-meta"><ShoppingCart size={16} aria-hidden="true" />Danh mục báo giá nhà cung cấp</span>
          )}
        </CommandBar>
      }
      context={activeView === 'quotations' ? (
        <ContextStrip items={[
          { label: 'Nguyên liệu', value: quotationWorkflow.ingredientView.phase === 'ready' ? quotationWorkflow.ingredients.length : '—', tone: 'neutral' },
          { label: 'Nhà cung cấp', value: quotationWorkflow.supplierView.phase === 'ready' ? quotationWorkflow.suppliers.length : '—', tone: 'neutral' },
          { label: 'Báo giá đang xem', value: quotationWorkflow.quotationView.phase === 'ready' ? quotationWorkflow.response?.totalCount ?? 0 : quotationWorkflow.quotationView.phase === 'uninitialized' ? 0 : '—', tone: 'info' },
        ]} />
      ) : undefined}
    >
      <div className="min-w-0 space-y-4 overflow-x-clip">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-semibold leading-[1.2] text-slate-950">{activeView === 'workflow' ? 'Thu mua theo nhu cầu đã duyệt' : activeView === 'supplemental' ? 'Mua bổ sung cho bếp' : 'Quản lý báo giá nhà cung cấp'}</h2>
            {activeView !== 'workflow' ? (
              <span
                className="inline-flex cursor-help text-slate-400 hover:text-slate-600 transition-colors"
                title={activeView === 'supplemental' ? 'Xử lý riêng các yêu cầu bổ sung khi kho không đủ hàng, không chen vào luồng duyệt theo ngày.' : 'Quản lý đơn giá hiệu lực theo nguyên liệu và nhà cung cấp trong một vùng làm việc độc lập.'}
                aria-label={activeView === 'supplemental' ? 'Xử lý riêng các yêu cầu bổ sung khi kho không đủ hàng, không chen vào luồng duyệt theo ngày.' : 'Quản lý đơn giá hiệu lực theo nguyên liệu và nhà cung cấp trong một vùng làm việc độc lập.'}
              >
                <Info size={16} aria-hidden="true" />
              </span>
            ) : null}
          </div>
          {isPageFailure || isPagePending ? (
            <StatusBadge variant={isPageFailure ? 'danger' : 'warning'}>
              {isPageFailure ? 'Lỗi tải dữ liệu' : 'Đang tải'}
            </StatusBadge>
          ) : null}
        </div>

        <ViewSwitcher
          compact
          ariaLabel="Chọn góc nhìn thu mua"
          tabs={[
            { id: 'purchasing-workflow', label: 'Xử lý thu mua' },
            { id: 'purchasing-supplemental', label: 'Mua bổ sung' },
            { id: 'purchasing-quotations', label: 'Báo giá nhà cung cấp' },
          ].filter((tab) => purchasingTabIds.includes(tab.id.replace('purchasing-', '') as PurchasingView))}
          activeTab={`purchasing-${activeView}`}
          onTabChange={changeView}
        />

        {activeView === 'workflow' && <div aria-live="polite">
          {workbenchView.phase === 'forbidden' ? (
            <InlineAlert title="Không có quyền xem quy trình thu mua" variant="danger">
              <span role="alert">{workbenchView.message}</span>
            </InlineAlert>
          ) : workbenchView.phase === 'error' ? (
            <InlineAlert title="Không tải được quy trình thu mua" variant="danger">
              <span role="alert">{workbenchView.message} Các lựa chọn chưa được lưu.</span>
            </InlineAlert>
          ) : workbenchView.phase === 'loading' ? (
            <InlineAlert title="Đang tải quy trình thu mua" variant="info">
              Hệ thống đang lấy dữ liệu tuần mua hàng. Nội dung sẽ được giữ ổn định trong lúc đồng bộ.
            </InlineAlert>
          ) : workbenchView.phase === 'ready' && nextAction.message && activeDate ? (
            <InlineAlert title={nextAction.kind === 'complete' ? 'Đã hoàn tất' : 'Hành động tiếp theo'} variant={nextAction.kind === 'blocked' ? 'warning' : 'info'}>
              <span role={nextAction.kind === 'blocked' ? 'alert' : 'status'}>{nextAction.message}</span>
            </InlineAlert>
          ) : null}
        </div>}

        <div>
          <KeepAliveTabPanel id="purchasing-workflow" active={activeView === 'workflow'} className="space-y-4">
            {workbenchView.phase === 'ready' ? (
              isWorkflowReadyEmpty ? (
                <EmptyState
                  title="Chưa có nhu cầu nguyên liệu đã duyệt trong tuần này."
                  description="Tuần này chưa có nhu cầu nguyên liệu đã được duyệt. Chọn tuần khác hoặc kiểm tra KHSX tại Thực đơn tuần."
                  className="rounded-lg border border-slate-200 bg-white p-6"
                />
              ) : (
                <>
                  <ServiceRunBlockerPanel serviceDate={routeState.date} owner="Thu mua" />
                  <PurchaseWorkflowGuide
                    currentStage={activeDate?.currentStage}
                    selectedStage={routeState.stage}
                    onStageChange={(stage) => replaceRouteContext({ date: routeState.date, stage })}
                  />

                  <PurchaseServiceDateWorkbench
                    selectedStage={routeState.stage}
                    serviceDates={workbenchView.data.serviceDates}
                    selectedDate={routeState.date}
                    selectedLineId={selectedLineId}
                    page={workbenchView.data.page}
                    pageSize={workbenchView.data.pageSize}
                    totalItems={workbenchView.data.totalItems}
                    isLoading={false}
                    onDateChange={(date) => replaceRouteContext({ date: date.serviceDate, stage: isPurchasingStage(date.currentStage) ? date.currentStage : 'demand' })}
                    onLineChange={setSelectedLineId}
                    onPageChange={setPage}
                  >
                    {routeState.stage !== 'supplier-price' ? (
                      <PurchaseDecisionPanel
                          key={`${routeState.date ?? 'none'}-${selectedLineId ?? 'none'}`}
                          week={routeState.week}
                          selectedStage={routeState.stage}
                          serviceDate={activeDate}
                          selectedLine={selectedLine}
                      />
                    ) : null}
                  </PurchaseServiceDateWorkbench>

                  <Drawer open={isSupplierLineDecision} onOpenChange={(open) => { if (!open) setSelectedLineId(undefined); }}>
                    <DrawerContent aria-label={`Xử lý nhà cung cấp${selectedLine ? ` cho ${selectedLine.ingredientName}` : ''}`}>
                      <DrawerHeader className="flex-row items-center justify-between gap-3">
                        <DrawerTitle>Xử lý nhà cung cấp</DrawerTitle>
                        <Button variant="ghost" size="icon" aria-label="Đóng xử lý nhà cung cấp" onClick={() => setSelectedLineId(undefined)}>
                          <X aria-hidden="true" />
                        </Button>
                      </DrawerHeader>
                      <DrawerBody className="p-0">
                        <PurchaseDecisionPanel
                            key={`${routeState.date ?? 'none'}-${selectedLineId ?? 'none'}`}
                            week={routeState.week}
                            selectedStage={routeState.stage}
                            serviceDate={activeDate}
                            selectedLine={selectedLine}
                        />
                      </DrawerBody>
                    </DrawerContent>
                  </Drawer>
                </>
              )
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4 motion-reduce:animate-none" aria-busy="true">
                <div className="h-10 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-12 w-full animate-pulse rounded bg-slate-50" />
                <div className="h-64 w-full animate-pulse rounded bg-slate-50" />
              </div>
            )}
          </KeepAliveTabPanel>

          <KeepAliveTabPanel id="purchasing-supplemental" active={activeView === 'supplemental'} lazy={false}>
            <Suspense fallback={purchasingCapabilityFallback}>
              <SupplementalPurchasingWorkbench week={routeState.week} />
            </Suspense>
          </KeepAliveTabPanel>

          <KeepAliveTabPanel id="purchasing-quotations" active={activeView === 'quotations'}>
            {activeView === 'quotations' ? (
              <Suspense fallback={purchasingCapabilityFallback}>
                <SupplierQuotationSection workflow={quotationWorkflow} />
              </Suspense>
            ) : null}
          </KeepAliveTabPanel>
        </div>
      </div>
    </OperationalFrame>
  );
}
