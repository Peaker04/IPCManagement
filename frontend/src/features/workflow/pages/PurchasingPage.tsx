import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, ShoppingCart } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { CommandBar, ContextStrip, InlineAlert, OperationalFrame, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  useGetPurchaseWorkbenchQuery,
  type PurchaseWorkflowStageCounts,
} from '../workflowApi';
import { PurchaseDecisionPanel } from '../purchasing/PurchaseDecisionPanel';
import { PurchaseServiceDateWorkbench } from '../purchasing/PurchaseServiceDateWorkbench';
import { PurchaseWorkflowGuide } from '../purchasing/PurchaseWorkflowGuide';
import {
  getPurchasingErrorMessage,
  isPurchasingStage,
  resolveNextPurchasingAction,
  resolvePurchasingRouteState,
  type PurchasingStageId,
} from '../purchasing/purchasingModel';

const emptyStageCounts: PurchaseWorkflowStageCounts = {
  demand: 0,
  supplierPrice: 0,
  exception: 0,
  submittedRequest: 0,
  approvedOrder: 0,
  receivingProgress: 0,
};

const shiftIsoWeek = (week: string, days: number) => {
  const date = new Date(`${week}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatWeekRange = (week: string) => {
  const start = new Date(`${week}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

export default function PurchasingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedLineId, setSelectedLineId] = useState<string>();
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
  const {
    data: workbench,
    isFetching,
    error,
    refetch,
  } = useGetPurchaseWorkbenchQuery({
    week: initialRoute.week,
    date: rawDate,
    stage: rawStage,
    page,
    pageSize: 8,
  });

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
  const nextAction = resolveNextPurchasingAction(activeDate, { loadError: Boolean(error) });

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('week', routeState.week);
    if (routeState.date) next.set('date', routeState.date);
    else next.delete('date');
    next.set('stage', routeState.stage);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [routeState.date, routeState.stage, routeState.week, searchParams, setSearchParams]);

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
      void refetch();
      return;
    }
    document.getElementById('purchase-decision-panel')?.focus();
  };

  return (
    <OperationalFrame
      command={
        <CommandBar
          actionsClassName="ipc-purchasing-actions"
          actions={<>
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
            {nextAction.label ? (
              <Button
                variant={nextAction.kind === 'recovery' ? 'outline' : 'default'}
                className="min-h-11 sm:min-h-9"
                onClick={focusDecisionPanel}
                disabled={isFetching && nextAction.kind !== 'recovery'}
              >
                {nextAction.label}
              </Button>
            ) : null}
          </>}
        >
          <span className="ipc-command-meta"><ShoppingCart size={16} aria-hidden="true" />Tuần mua hàng: {formatWeekRange(routeState.week)}</span>
          <span className="ipc-command-meta"><CalendarDays size={16} aria-hidden="true" />Cả ngày (FULLDAY)</span>
        </CommandBar>
      }
      context={
        <ContextStrip items={[
          { label: 'Ngày cần xử lý', value: workbench?.stageCounts.demand ?? 0, tone: (workbench?.stageCounts.demand ?? 0) > 0 ? 'warning' : 'neutral' },
          { label: 'Nhu cầu chờ duyệt', value: activeDate && activeDate.approvedDemandCount === 0 ? 1 : 0, tone: activeDate && activeDate.approvedDemandCount === 0 ? 'warning' : 'success' },
          { label: 'Ngoại lệ giá', value: activeDate?.blockingExceptionCount ?? 0, tone: (activeDate?.blockingExceptionCount ?? 0) > 0 ? 'danger' : 'success' },
          { label: 'Đơn chờ nhập', value: activeDate ? Math.max(0, activeDate.receivingLineCount - activeDate.fullyReceivedLineCount) : 0, tone: activeDate && activeDate.receivingLineCount > activeDate.fullyReceivedLineCount ? 'warning' : 'success' },
        ]} />
      }
    >
      <div className="min-w-0 space-y-4 overflow-x-clip">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold leading-[1.2] text-slate-950">Thu mua theo nhu cầu đã duyệt</h1>
            <p className="mt-2 text-[14px] leading-[1.5] text-slate-600">Một luồng sáu giai đoạn từ nhu cầu đã duyệt đến tiến độ nhập kho.</p>
          </div>
          <StatusBadge variant={error ? 'danger' : isFetching ? 'warning' : 'success'}>
            {error ? 'Lỗi tải dữ liệu' : isFetching ? 'Đang tải' : 'Đã đồng bộ'}
          </StatusBadge>
        </div>

        {isFetching ? <p role="status" className="text-[14px] text-slate-600">Đang tải quy trình thu mua trong tuần...</p> : null}
        {error ? (
          <InlineAlert title="Không tải được quy trình thu mua" variant="danger">
            <span role="alert">Không tải được quy trình thu mua. Kiểm tra kết nối và thử lại. Các lựa chọn chưa được lưu. {getPurchasingErrorMessage(error)}</span>
          </InlineAlert>
        ) : null}
        {nextAction.message && !error ? (
          <InlineAlert title={nextAction.kind === 'complete' ? 'Đã hoàn tất' : 'Hành động tiếp theo'} variant={nextAction.kind === 'blocked' ? 'warning' : 'info'}>
            <span role={nextAction.kind === 'blocked' ? 'alert' : 'status'}>{nextAction.message}</span>
          </InlineAlert>
        ) : null}

        <PurchaseWorkflowGuide
          currentStage={activeDate?.currentStage}
          selectedStage={routeState.stage}
          stageCounts={workbench?.stageCounts ?? emptyStageCounts}
          onStageChange={(stage) => replaceRouteContext({ date: routeState.date, stage })}
        />

        <PurchaseServiceDateWorkbench
          serviceDates={workbench?.serviceDates ?? []}
          selectedDate={routeState.date}
          selectedLineId={selectedLineId}
          page={workbench?.page ?? page}
          pageSize={workbench?.pageSize ?? 8}
          totalItems={workbench?.totalItems ?? 0}
          isLoading={isFetching && !workbench}
          errorMessage={error ? getPurchasingErrorMessage(error) : undefined}
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
      </div>
    </OperationalFrame>
  );
}
