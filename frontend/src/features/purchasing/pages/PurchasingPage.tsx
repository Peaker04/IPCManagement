import { lazy, Suspense, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { CommandBar, ContextStrip, InlineAlert, KeepAliveTabPanel, OperationalFrame, StatusBadge, ViewSwitcher } from '@/components/common';
import { Button } from '@/components/ui/button';
import { ReconciliationWorkspace } from '@/features/reconciliation/ReconciliationWorkspace';
import { visibleTabIds } from '@/lib/navigationPreferences';
import { useUiStreamlinePreferences } from '@/lib/uiStreamlineConfig';
import { formatDateOnly } from '@/lib/formatters';
import { toQueryView } from '@/lib/queryView';
import { useGetPurchaseWorkbenchQuery } from '@/api/purchasingApi';
import type { PurchaseWorkflowStageCounts } from '@/api/workflowApiTypes';
import { PurchaseDecisionPanel } from '../PurchaseDecisionPanel';
import { PurchaseServiceDateWorkbench } from '../PurchaseServiceDateWorkbench';
import { useSupplierQuotations } from '../quotation/useSupplierQuotations';
import { useSystemOperation } from '@/features/system-operation/systemOperationContext';
import {
  getPurchasingErrorMessage,
  isPurchasingStage,
  resolveNextPurchasingAction,
  resolvePurchasingRouteState,
  type PurchasingStageId,
} from '../purchasingModel';

const ServiceRunBlockerPanel = lazy(() => import('@/components/common/ServiceRunBlockerPanel').then(({ ServiceRunBlockerPanel: component }) => ({ default: component })))
const PurchaseWorkflowGuide = lazy(() => import('../PurchaseWorkflowGuide').then(({ PurchaseWorkflowGuide: component }) => ({ default: component })))
const SupplementalPurchasingWorkbench = lazy(() => import('../SupplementalPurchasingWorkbench').then(({ SupplementalPurchasingWorkbench: component }) => ({ default: component })))
const SupplierQuotationSection = lazy(() => import('../quotation/SupplierQuotationSection').then(({ SupplierQuotationSection: component }) => ({ default: component })))
const purchasingCapabilityFallback = <div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50 motion-reduce:animate-none" />

const emptyStageCounts: PurchaseWorkflowStageCounts = {
  demand: 0,
  supplierPrice: 0,
  exception: 0,
  submittedRequest: 0,
  approvedOrder: 0,
  receivingProgress: 0,
};

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
  const streamline = useUiStreamlinePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedLineId, setSelectedLineId] = useState<string>();
  const systemOperation = useSystemOperation();
  const isMaterialReconciliationMode = systemOperation?.mode === 'MATERIAL_RECONCILIATION';

  const purchasingTabIds = useMemo(() => {
    const locallyVisibleTabs = visibleTabIds('purchasing') as PurchasingView[];
    const backendTabs = systemOperation?.capabilities.pageTabs['purchasing'];
    if (!backendTabs) {
      return locallyVisibleTabs;
    }
    return locallyVisibleTabs.filter((tabId) => backendTabs.includes(tabId));
  }, [systemOperation?.capabilities.pageTabs]);

  const requestedView = searchParams.get('view');
  const requestedPurchasingView: PurchasingView = requestedView === 'quotations' || requestedView === 'supplemental' ? requestedView : 'workflow';
  const activeView: PurchasingView = purchasingTabIds.includes(requestedPurchasingView) ? requestedPurchasingView : purchasingTabIds[0] ?? 'workflow';
  const quotationWorkflow = useSupplierQuotations(!isMaterialReconciliationMode && activeView === 'quotations');
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
  }, { skip: isMaterialReconciliationMode || activeView !== 'workflow' });
  const workbenchView = toQueryView(workbenchQuery, {
    instruction: 'Mở tab Xử lý thu mua để tải quy trình theo tuần.',
    retry: () => workbenchQuery.refetch(),
    errorMessage: (error) => `Không tải được quy trình thu mua. ${getPurchasingErrorMessage(error)}`,
    forbiddenMessage: 'Bạn không có quyền xem quy trình thu mua.',
  });
  const workbench = workbenchView.phase === 'ready' ? workbenchView.data : undefined;
  const isFetching = workbenchView.phase === 'loading'
    || workbenchView.phase === 'ready' && workbenchView.isRefreshing;

  const routeState = useMemo(
    () => resolvePurchasingRouteState(
      {
        week: searchParams.get('week'),
        date: searchParams.get('date') ?? workbench?.selectedDate,
        stage: searchParams.get('stage') ?? workbench?.selectedStage,
      },
      workbench?.serviceDates ?? [],
    ),
    [searchParams, workbench?.selectedDate, workbench?.selectedStage, workbench?.serviceDates],
  );
  const activeDate = workbench?.serviceDates.find((item) => item.serviceDate === routeState.date);
  const selectedLine = activeDate?.purchaseLines.find((line) => line.purchaseRequestLineId === selectedLineId);
  const nextAction = resolveNextPurchasingAction(activeDate, { loadError: workbenchView.phase === 'error' });
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

  const replaceRouteContext = (next: { date?: string; stage?: PurchasingStageId }) => {
    const params = new URLSearchParams(searchParams);
    if (next.date) params.set('date', next.date);
    else params.delete('date');
    if (next.stage) params.set('stage', next.stage);
    else params.delete('stage');
    setSearchParams(params, { replace: true });
  };

  const changeWeek = (direction: -7 | 7) => {
    const nextWeek = shiftIsoWeek(routeState.week, direction);
    const params = new URLSearchParams(searchParams);
    params.set('week', nextWeek);
    params.delete('date');
    params.delete('stage');
    setPage(1);
    setSelectedLineId(undefined);
    setSearchParams(params);
  };

  const changeView = (nextTabId: string) => {
    const view = nextTabId.replace('purchasing-', '') as PurchasingView;
    const params = new URLSearchParams(searchParams);
    if (view === 'workflow') params.delete('view');
    else params.set('view', view);
    setSearchParams(params);
  };

  if (isMaterialReconciliationMode || purchasingTabIds.length === 0) {
    return (
      <OperationalFrame className="ipc-purchasing-page">
        <ReconciliationWorkspace owner="purchasing" />
      </OperationalFrame>
    );
  }

  return (
    <OperationalFrame
      className="ipc-purchasing-page"
      command={
        <CommandBar
          actions={
            activeView === 'workflow' ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Tuần trước"
                  onClick={() => changeWeek(-7)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Tuần sau"
                  onClick={() => changeWeek(7)}
                >
                  <ChevronRight size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Tải lại tuần hiện tại"
                  onClick={() => workbenchQuery.refetch()}
                >
                  <RotateCcw size={16} />
                </Button>
              </div>
            ) : null
          }
        >
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CalendarDays size={16} className="text-slate-500" />
            <span className="font-medium">Tuần: {formatWeekRange(routeState.week)}</span>
          </div>
        </CommandBar>
      }
      context={
        <ContextStrip items={activeView === 'workflow' ? [
          { label: 'Ngày cần xử lý', value: workbenchView.phase === 'ready' ? workbenchView.data.stageCounts.demand : '—', tone: workbenchView.phase === 'ready' && workbenchView.data.stageCounts.demand > 0 ? 'warning' : 'neutral' },
          { label: 'Nhu cầu chờ duyệt', value: workbenchView.phase === 'ready' ? (activeDate && activeDate.approvedDemandCount === 0 ? 1 : 0) : '—', tone: workbenchView.phase === 'ready' && activeDate && activeDate.approvedDemandCount === 0 ? 'warning' : 'neutral' },
          { label: 'Ngoại lệ giá', value: workbenchView.phase === 'ready' ? activeDate?.blockingExceptionCount ?? 0 : '—', tone: workbenchView.phase === 'ready' && (activeDate?.blockingExceptionCount ?? 0) > 0 ? 'danger' : 'neutral' },
          { label: 'Đơn chờ nhập', value: workbenchView.phase === 'ready' ? (activeDate ? Math.max(0, activeDate.receivingLineCount - activeDate.fullyReceivedLineCount) : 0) : '—', tone: workbenchView.phase === 'ready' && activeDate && activeDate.receivingLineCount > activeDate.fullyReceivedLineCount ? 'warning' : 'neutral' },
        ] : activeView === 'quotations' ? [
          { label: 'Nguyên liệu', value: quotationWorkflow.ingredientView.phase === 'ready' ? quotationWorkflow.ingredients.length : '—', tone: 'neutral' },
          { label: 'Nhà cung cấp', value: quotationWorkflow.supplierView.phase === 'ready' ? quotationWorkflow.suppliers.length : '—', tone: 'neutral' },
          { label: 'Báo giá đang xem', value: quotationWorkflow.quotationView.phase === 'ready' ? quotationWorkflow.response?.totalCount ?? 0 : quotationWorkflow.quotationView.phase === 'uninitialized' ? 0 : '—', tone: 'info' },
        ] : []} />
      }
    >
      <div className="min-w-0 space-y-4 overflow-x-clip">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold leading-[1.2] text-slate-950">{activeView === 'workflow' ? 'Thu mua theo nhu cầu đã duyệt' : activeView === 'supplemental' ? 'Mua bổ sung cho bếp' : 'Quản lý báo giá nhà cung cấp'}</h2>
            {streamline.showPurchasingDescriptions && (
              <p className="mt-2 text-body leading-[1.5] text-slate-600">{activeView === 'workflow' ? 'Một luồng sáu giai đoạn từ nhu cầu đã duyệt đến tiến độ nhập kho.' : activeView === 'supplemental' ? 'Xử lý riêng các yêu cầu bổ sung khi kho không đủ hàng, không chen vào luồng duyệt theo ngày.' : 'Quản lý đơn giá hiệu lực theo nguyên liệu và nhà cung cấp trong một vùng làm việc độc lập.'}</p>
            )}
          </div>
          <StatusBadge variant={isPageFailure ? 'danger' : isPagePending ? 'warning' : 'success'}>
            {isPageFailure ? 'Lỗi tải dữ liệu' : isPagePending ? 'Đang tải' : 'Đã đồng bộ'}
          </StatusBadge>
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

        {activeView === 'workflow' && (
          <div className={streamline.showPurchasingNextActionAlert ? "min-h-[68px]" : undefined} aria-live="polite">
            {workbenchView.phase === 'forbidden' ? (
              <InlineAlert title="Không có quyền xem quy trình thu mua" variant="danger">
                <span role="alert">{workbenchView.message}</span>
              </InlineAlert>
            ) : workbenchView.phase === 'error' ? (
              <InlineAlert
                title="Không tải được quy trình thu mua"
                variant="danger"
                action={<Button type="button" variant="outline" size="sm" onClick={() => workbenchQuery.refetch()}>Thử lại</Button>}
              >
                <span role="alert">{workbenchView.message} Các lựa chọn chưa được lưu.</span>
              </InlineAlert>
            ) : workbenchView.phase === 'loading' ? (
              <InlineAlert title="Đang tải quy trình thu mua" variant="info">
                Hệ thống đang lấy dữ liệu tuần mua hàng. Nội dung sẽ được giữ ổn định trong lúc đồng bộ.
              </InlineAlert>
            ) : streamline.showPurchasingNextActionAlert && workbenchView.phase === 'ready' && nextAction.message ? (
              <InlineAlert title={nextAction.kind === 'complete' ? 'Đã hoàn tất' : 'Hành động tiếp theo'} variant={nextAction.kind === 'blocked' ? 'warning' : 'info'}>
                <span role={nextAction.kind === 'blocked' ? 'alert' : 'status'}>{nextAction.message}</span>
              </InlineAlert>
            ) : null}
          </div>
        )}

        <div className="min-h-[480px]">
          <KeepAliveTabPanel id="purchasing-workflow" active={activeView === 'workflow'} className="space-y-4">
            {workbenchView.phase === 'ready' ? (
              <>
                {streamline.showPurchasingDescriptions && (
                  <Suspense fallback={<div aria-hidden="true" className="min-h-20 rounded-md bg-slate-50" />}><ServiceRunBlockerPanel serviceDate={routeState.date} owner="Thu mua" /></Suspense>
                )}
                {streamline.showPurchasingGuide && (
                  <Suspense fallback={<div aria-hidden="true" className="min-h-24 rounded-md bg-slate-50" />}>
                    <PurchaseWorkflowGuide
                      currentStage={activeDate?.currentStage}
                      selectedStage={routeState.stage}
                      stageCounts={workbenchView.data.stageCounts ?? emptyStageCounts}
                      onStageChange={(stage) => replaceRouteContext({ date: routeState.date, stage })}
                    />
                  </Suspense>
                )}

                <PurchaseServiceDateWorkbench
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
                  <PurchaseDecisionPanel
                    key={`${routeState.date ?? 'none'}-${selectedLineId ?? 'none'}`}
                    week={routeState.week}
                    selectedStage={routeState.stage}
                    serviceDate={activeDate}
                    selectedLine={selectedLine}
                  />
                </PurchaseServiceDateWorkbench>
              </>
            ) : (
              <div className="min-h-[420px] rounded-lg border border-slate-200 bg-white p-4 space-y-4 motion-reduce:animate-none" aria-busy="true">
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
      <ReconciliationWorkspace owner="purchasing" />
    </OperationalFrame>
  );
}
