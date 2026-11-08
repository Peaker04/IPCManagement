import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CommandBar, EmptyState, OperationalFrame, StatusBadge } from '@/components/common';
import { QueryViewBoundary, type QueryViewEntry } from '@/components/common/QueryViewBoundary';
import { Button } from '@/components/ui/button';
import { useGetOperationalKpisQuery } from '@/api/dashboardApi';
import { useWorkflowOverview } from '@/api/reportsApi';
import { type RoleInboxItem, type WorkflowLane, type WorkflowTone } from '@/types/workflow';
import { resolveWorkflowGateAction } from '@/lib/actionEligibility';
import { ROUTES } from '@/lib/routeConfig';
import { toLabeledQueryView } from '@/lib/labeledQueryView';
import { useHasPermission } from '@/lib/useHasPermission';

const queuePriority: Record<WorkflowTone, number> = {
  danger: 0,
  warning: 1,
  neutral: 2,
  success: 3,
};

type DashboardQueueCategory = 'all' | 'kitchen' | 'purchase' | 'data';

interface DashboardQueueItem {
  id: string;
  category: Exclude<DashboardQueueCategory, 'all'>;
  owner: string;
  title: string;
  description: string;
  due: string;
  nextAction: string;
  tone: WorkflowTone;
  route: string;
}

const queueFilters: Array<{ key: DashboardQueueCategory; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'kitchen', label: 'Chặn bếp' },
  { key: 'purchase', label: 'Thu mua' },
  { key: 'data', label: 'Dữ liệu' },
];

const getNumber = (value: number | undefined) => value ?? 0;

const sumLaneCount = (lanes: WorkflowLane[], key: 'waiting' | 'blocked' | 'done') =>
  lanes.reduce((total, lane) => total + lane[key], 0);

const sortQueueItems = (items: RoleInboxItem[]) =>
  [...items].sort((a, b) => queuePriority[a.tone] - queuePriority[b.tone]);

const getQueueCategory = (item: RoleInboxItem): Exclude<DashboardQueueCategory, 'all'> => {
  if (item.route.includes(ROUTES.PURCHASING) || item.laneId === 'purchasing' || item.laneId === 'management') {
    return 'purchase';
  }

  if (item.route.includes(ROUTES.CHEF_DASHBOARD) || item.laneId === 'kitchen' || item.laneId === 'warehouse') {
    return 'kitchen';
  }

  return 'data';
};

export default function DefaultDashboardPage() {
  const canReadPurchaseReports = useHasPermission('purchase.read');
  const workflowOverview = useWorkflowOverview({ skipPrice: !canReadPurchaseReports });
  const kpiQuery = useGetOperationalKpisQuery();
  const [activeQueueFilter, setActiveQueueFilter] = useState<DashboardQueueCategory>('all');
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  const workflowData = { roleInboxItems: workflowOverview.roleInboxItems, workflowLanes: workflowOverview.workflowLanes };
  const workflowView = toLabeledQueryView({
    ...workflowOverview,
    data: workflowOverview.isLoading || workflowOverview.isError ? undefined : workflowData,
    currentData: workflowOverview.isLoading || workflowOverview.isError ? undefined : workflowData,
    isUninitialized: false,
    isSuccess: !workflowOverview.isLoading && !workflowOverview.isError,
  }, 'tổng quan workflow');
  const kpiView = toLabeledQueryView(kpiQuery, 'chỉ số vận hành');
  const dashboardQueries: QueryViewEntry[] = [
    { label: 'tổng quan workflow', view: workflowView },
    { label: 'chỉ số vận hành', view: kpiView },
  ];
  const preserveLoadingFallback = dashboardQueries.every(({ view }) => view.phase !== 'error' && view.phase !== 'forbidden');
  const isDashboardLoading = dashboardQueries.some(({ view }) => view.phase === 'loading' || view.phase === 'uninitialized');
  const { roleInboxItems, workflowLanes } = workflowView.phase === 'ready'
    ? workflowView.data
    : { roleInboxItems: [], workflowLanes: [] };
  const kpis = kpiView.phase === 'ready' ? kpiView.data : undefined;

  const shortageCount = getNumber(kpis?.shortageCount);
  const lowStockCount = getNumber(kpis?.lowStockCount);
  const overduePurchaseCount = getNumber(kpis?.overduePurchaseRequestCount);
  const lateReceiptCount = getNumber(kpis?.lateReceiptCount);
  const pendingKitchenCount = getNumber(kpis?.pendingKitchenConfirmationCount);
  const failedWorkflowCount = getNumber(kpis?.failedWorkflowCount);
  const criticalDataCount = getNumber(kpis?.criticalDataQualityCount);
  const overdueApprovalCount = getNumber(kpis?.overdueApprovalCount);

  const laneById = new Map(workflowLanes.map((lane) => [lane.id, lane]));
  const workflowSteps = [
    {
      key: 'menu',
      order: '01',
      title: 'Menu & số suất',
      description: 'Chốt menu và số suất.',
      lanes: [laneById.get('coordination')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.MEAL_ORDERS,
    },
    {
      key: 'bom',
      order: '02',
      title: 'Định lượng BOM',
      description: 'Kiểm BOM và định lượng.',
      lanes: [laneById.get('planning'), laneById.get('admin')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.WEEKLY_MENU,
    },
    {
      key: 'purchase',
      order: '03',
      title: 'Duyệt & thu mua',
      description: 'Duyệt và xử lý mua hàng.',
      lanes: [laneById.get('management'), laneById.get('purchasing')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.PURCHASING,
    },
    {
      key: 'kitchen',
      order: '04',
      title: 'Kho & bếp',
      description: 'Xuất kho và Bếp xác nhận.',
      lanes: [laneById.get('warehouse'), laneById.get('kitchen')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.WAREHOUSE,
    },
  ];

  const riskGroups = [
    {
      key: 'materials',
      label: 'Thiếu / tồn thấp',
      value: shortageCount,
      helper: `${lowStockCount} tồn thấp`,
      numberTone: shortageCount > 0 ? 'danger' : lowStockCount > 0 ? 'warning' : 'neutral',
      route: `${ROUTES.REPORTS}?view=demand`,
    },
    {
      key: 'purchase',
      label: 'Thu mua trễ',
      value: overduePurchaseCount + lateReceiptCount,
      helper: `${overduePurchaseCount} đề nghị mua / ${lateReceiptCount} phiếu nhập`,
      numberTone: overduePurchaseCount + lateReceiptCount > 0 ? 'warning' : 'neutral',
      route: `${ROUTES.REPORTS}?view=purchase`,
    },
    {
      key: 'kitchen',
      label: 'Bếp chờ xác nhận',
      value: pendingKitchenCount,
      helper: 'Phiếu xuất chưa được Bếp nhận',
      numberTone: pendingKitchenCount > 0 ? 'warning' : 'neutral',
      route: `${ROUTES.REPORTS}?view=kitchen`,
    },
    {
      key: 'data',
      label: 'Dữ liệu chặn luồng',
      value: failedWorkflowCount + criticalDataCount,
      helper: `${criticalDataCount} lỗi dữ liệu`,
      numberTone: failedWorkflowCount + criticalDataCount > 0 ? 'danger' : 'neutral',
      route: `${ROUTES.ADMIN_DATA}?view=cleanup`,
    },
    {
      key: 'approval',
      label: 'Duyệt quá hạn',
      value: overdueApprovalCount,
      helper: 'Cần quản lý xử lý',
      numberTone: overdueApprovalCount > 0 ? 'warning' : 'neutral',
      route: ROUTES.APPROVALS,
    },
  ] as const;

  const workflowItems = sortQueueItems(roleInboxItems).map<DashboardQueueItem>((item) => ({
    id: item.id,
    category: getQueueCategory(item),
    owner: item.owner,
    title: item.title,
    description: item.description,
    due: item.due,
    nextAction: item.nextAction,
    tone: item.tone,
    route: item.route,
  }));
  const actionQueue = workflowItems;

  const filteredQueue = actionQueue.filter((item) => activeQueueFilter === 'all' || item.category === activeQueueFilter);
  const visibleQueue = isQueueExpanded ? filteredQueue : filteredQueue.slice(0, 7);
  const hiddenQueueCount = Math.max(filteredQueue.length - 7, 0);

  return (
    <OperationalFrame
      className="ipc-dashboard-frame"
      command={
        <CommandBar
          className="ipc-dashboard-command-bar"
          actions={
            <>
              <Link to={ROUTES.MEAL_ORDERS} className="ipc-button ipc-button-primary">
                Mở điều phối ca
              </Link>
              <Link to={ROUTES.APPROVALS} className="ipc-button ipc-button-ghost">
                Hàng đợi duyệt
              </Link>
              <Link to={ROUTES.ADMIN_DATA} className="ipc-button ipc-button-ghost">
                Kiểm dữ liệu
              </Link>
            </>
          }
        >
          <div className="ipc-dashboard-command-main">
            <span>Ngày phục vụ hôm nay · Ca đang vận hành</span>
          </div>
        </CommandBar>
      }
    >
      <QueryViewBoundary
        queries={dashboardQueries}
        preserveFallback={preserveLoadingFallback}
        refreshLabel="Đang cập nhật tổng quan vận hành"
      >
        <section className="ipc-dashboard-section" aria-label="Tín hiệu vận hành">
          <div className="ipc-dashboard-risk-board">
            {riskGroups.map((signal) => (
              <Link
                key={signal.key}
                to={signal.route}
                className="ipc-dashboard-signal"
              >
                <span className="ipc-dashboard-signal-copy">
                  <span className="ipc-dashboard-signal-label !text-slate-700">{signal.label}</span>
                  <strong className={`ipc-dashboard-signal-number tone-${isDashboardLoading ? 'neutral' : signal.numberTone}`}>
                    {isDashboardLoading ? '—' : signal.value}
                  </strong>
                  <small className="!text-slate-700">{isDashboardLoading ? 'Đang tổng hợp' : signal.helper}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="ipc-dashboard-grid">
          <section className="ipc-dashboard-panel ipc-dashboard-queue-panel">
            <div className="ipc-dashboard-panel-header">
              <div>
                <h3>Việc cần xử lý trước</h3>
              </div>
              {hiddenQueueCount > 0 && <Button type="button" variant="ghost" size="sm" className="ipc-dashboard-panel-link" onClick={() => setIsQueueExpanded((value) => !value)}>
                {isQueueExpanded ? 'Thu gọn' : `Xem thêm ${hiddenQueueCount}`}
              </Button>}
            </div>
            <div className="ipc-dashboard-queue-filters" role="group" aria-label="Lọc hàng đợi xử lý">
              {queueFilters.map((filter) => {
                const count = filter.key === 'all' ? actionQueue.length : actionQueue.filter((item) => item.category === filter.key).length;

                return (
                  <Button
                    key={filter.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={filter.key === activeQueueFilter ? 'is-active' : undefined}
                    onClick={() => { setActiveQueueFilter(filter.key); setIsQueueExpanded(false); }}
                    aria-pressed={filter.key === activeQueueFilter}
                  >
                    {filter.label}
                    {filter.key !== 'all' && <span>{count}</span>}
                  </Button>
                );
              })}
            </div>
            <div className="ipc-dashboard-task-list">
              {isDashboardLoading ? (
                Array.from({ length: 7 }, (_, index) => (
                  <div key={`dashboard-task-skeleton-${index}`} className="ipc-dashboard-task ipc-dashboard-task-skeleton" aria-hidden="true">
                    <span className="ipc-dashboard-skeleton-copy">
                      <span />
                      <span />
                    </span>
                    <span className="ipc-dashboard-skeleton-owner" />
                    <span className="ipc-dashboard-skeleton-due" />
                  </div>
                ))
              ) : visibleQueue.length === 0 ? (
                <EmptyState
                  title="Không có việc cần xử lý trong ca này."
                  className="ipc-dashboard-empty !min-h-0 !items-stretch !justify-start !p-3 !text-left [&_p]:!text-slate-800"
                />
              ) : (
                visibleQueue.map((item, index) => (
                  <Link
                    key={`${item.category}-${item.id}-${index}`}
                    to={item.route}
                    className={`ipc-dashboard-task${index === 0 ? ' is-recommended' : ''}`}
                  >
                    <span className="ipc-dashboard-task-copy">
                      <strong>{item.title}</strong>
                      <small className={index === 0 ? 'ipc-dashboard-task-recommended' : undefined} title={index === 0 ? item.nextAction : item.description}>
                        {index === 0 ? item.nextAction : item.description}
                      </small>
                    </span>
                    <span className="ipc-dashboard-task-field ipc-dashboard-task-owner">
                      <small>Phụ trách</small>
                      <strong>{item.owner}</strong>
                    </span>
                    <span className="ipc-dashboard-task-field ipc-dashboard-task-due">
                      <small>Thời hạn</small>
                      <strong>{item.due}</strong>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="ipc-dashboard-panel ipc-dashboard-panel-main">
            <div className="ipc-dashboard-panel-header">
              <div>
                <h3>Tiến độ 4 công đoạn</h3>
              </div>
              <Link to={ROUTES.WEEKLY_MENU} className="ipc-dashboard-panel-link">
                Xem KHSX
              </Link>
            </div>
            <div className="ipc-dashboard-gate-list">
              {isDashboardLoading ? (
                Array.from({ length: 4 }, (_, index) => (
                  <div key={`dashboard-gate-skeleton-${index}`} className="ipc-dashboard-gate ipc-dashboard-gate-skeleton" aria-hidden="true">
                    <span className="ipc-dashboard-gate-order">{String(index + 1).padStart(2, '0')}</span>
                    <span className="ipc-dashboard-skeleton-copy">
                      <span />
                      <span />
                    </span>
                    <span className="ipc-dashboard-skeleton-action" />
                  </div>
                ))
              ) : workflowSteps.map((gate) => {
                const gateLaneIds = new Set(gate.lanes.map((lane) => lane.id));
                const gateInboxAction = sortQueueItems(roleInboxItems.filter((item) => gateLaneIds.has(item.laneId)))[0]?.nextAction;
                const hasPendingGateWork = sumLaneCount(gate.lanes, 'waiting') + sumLaneCount(gate.lanes, 'blocked') > 0;
                const rawAction = hasPendingGateWork && gateInboxAction ? gateInboxAction : resolveWorkflowGateAction(gate.lanes);
                const displayAction = rawAction === 'CANCELLED' ? 'Đã hủy' : rawAction === 'COMPLETED' ? 'Đã hoàn tất' : rawAction === 'PENDING' ? 'Đang xử lý' : rawAction;
                const isStatus = rawAction === 'CANCELLED' || rawAction === 'COMPLETED' || rawAction === 'PENDING';
                const statusTone: 'neutral' | 'success' | 'warning' = rawAction === 'CANCELLED' ? 'neutral' : rawAction === 'COMPLETED' ? 'success' : 'warning';

                return (
                  <Link key={gate.key} to={gate.route} className="ipc-dashboard-gate">
                    <span className="ipc-dashboard-gate-order">{gate.order}</span>
                    <span className="ipc-dashboard-gate-copy">
                      <strong>{gate.title}</strong>
                      <small>{gate.description}</small>
                    </span>
                    <span className="ipc-dashboard-gate-next">
                      {isStatus ? (
                        <StatusBadge variant={statusTone} className="min-w-[96px] justify-center">{displayAction}</StatusBadge>
                      ) : (
                        <span>{displayAction}</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </QueryViewBoundary>
    </OperationalFrame>
  );
}
