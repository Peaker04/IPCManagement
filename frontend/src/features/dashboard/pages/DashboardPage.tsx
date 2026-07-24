import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CommandBar, InlineAlert, OperationalFrame } from '@/components/common';
import { useGetOperationalKpisQuery, useWorkflowOverview, type RoleInboxItem, type WorkflowLane, type WorkflowTone } from '@/features/workflow';
import { ROUTES } from '../../../routes/routeConfig';

const tonePriority: Record<WorkflowTone, number> = {
  danger: 3,
  warning: 2,
  neutral: 1,
  success: 0,
};

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

const getLaneTone = (lanes: WorkflowLane[]) =>
  lanes.reduce<WorkflowTone>(
    (current, lane) => (tonePriority[lane.tone] > tonePriority[current] ? lane.tone : current),
    'success',
  );

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

const DashboardPage = () => {
  const { isError, isLoading, roleInboxItems, workflowLanes } = useWorkflowOverview();
  const { data: kpis, isError: isKpiError, isLoading: isKpiLoading } = useGetOperationalKpisQuery();
  const [activeQueueFilter, setActiveQueueFilter] = useState<DashboardQueueCategory>('all');
  const isDashboardLoading = isLoading || isKpiLoading;
  const hasDashboardError = isError || isKpiError;

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
      description: 'Điều phối chốt menu, khách và ca phục vụ.',
      lanes: [laneById.get('coordination')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.MEAL_ORDERS,
    },
    {
      key: 'bom',
      order: '02',
      title: 'Định lượng BOM',
      description: 'KHSX kiểm tier BOM, định lượng và tồn kho.',
      lanes: [laneById.get('planning'), laneById.get('admin')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.WEEKLY_MENU,
    },
    {
      key: 'purchase',
      order: '03',
      title: 'Duyệt & thu mua',
      description: 'Quản lý duyệt, thu mua chọn NCC và theo receipt.',
      lanes: [laneById.get('management'), laneById.get('purchasing')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.PURCHASING,
    },
    {
      key: 'kitchen',
      order: '04',
      title: 'Kho & bếp',
      description: 'Thủ kho xuất nguyên liệu, bếp xác nhận nhận hàng.',
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
      helper: `${overduePurchaseCount} PR / ${lateReceiptCount} receipt`,
      numberTone: overduePurchaseCount + lateReceiptCount > 0 ? 'warning' : 'neutral',
      route: `${ROUTES.REPORTS}?view=purchase`,
    },
    {
      key: 'kitchen',
      label: 'Bếp chờ xác nhận',
      value: pendingKitchenCount,
      helper: 'Issue chưa nhận bếp',
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

  const syntheticItems: DashboardQueueItem[] = [];

  if (shortageCount + lowStockCount > 0) {
    syntheticItems.push({
      id: 'kpi-material-shortage',
      category: 'purchase',
      owner: 'Thu mua',
      title: 'Thiếu hoặc tồn thấp nguyên liệu',
      description: `${shortageCount} thiếu hụt / ${lowStockCount} tồn thấp`,
      due: 'Trước đặt hàng',
      nextAction: 'Mở kế hoạch mua',
      tone: shortageCount > 0 ? 'danger' : 'warning',
      route: `${ROUTES.REPORTS}?view=demand`,
    });
  }

  if (failedWorkflowCount + criticalDataCount > 0) {
    syntheticItems.push({
      id: 'kpi-data-blockers',
      category: 'data',
      owner: 'Admin',
      title: 'Dữ liệu đang chặn luồng',
      description: `${failedWorkflowCount} workflow lỗi / ${criticalDataCount} lỗi dữ liệu`,
      due: 'Trước gửi bếp',
      nextAction: 'Kiểm dữ liệu',
      tone: 'danger',
      route: `${ROUTES.ADMIN_DATA}?view=cleanup`,
    });
  }

  if (pendingKitchenCount > 0) {
    syntheticItems.push({
      id: 'kpi-kitchen-pending',
      category: 'kitchen',
      owner: 'Bếp trưởng',
      title: 'Bếp chờ xác nhận nguyên liệu',
      description: `${pendingKitchenCount} issue chưa được xác nhận`,
      due: 'Trong ca',
      nextAction: 'Mở bếp trưởng',
      tone: 'warning',
      route: ROUTES.CHEF_DASHBOARD,
    });
  }

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
  const actionQueue = [...syntheticItems, ...workflowItems].sort((a, b) => queuePriority[a.tone] - queuePriority[b.tone]);

  const visibleQueue = actionQueue
    .filter((item) => activeQueueFilter === 'all' || item.category === activeQueueFilter)
    .slice(0, 7);
  const totalWaiting = sumLaneCount(workflowLanes, 'waiting');
  const totalBlocked = sumLaneCount(workflowLanes, 'blocked') + failedWorkflowCount + criticalDataCount;

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
      {hasDashboardError && (
        <InlineAlert title="Không tải được dữ liệu workflow" variant="warning">
          Bảng điều hành đang chờ backend trả dữ liệu báo cáo workflow.
        </InlineAlert>
      )}
      {isDashboardLoading && (
        <span className="sr-only" role="status">
          Hệ thống đang tổng hợp chứng từ, nhu cầu và luân chuyển kho.
        </span>
      )}

      <section className="ipc-dashboard-incident" aria-labelledby="dashboard-shift-status" aria-busy={isDashboardLoading}>
        <div className="ipc-dashboard-incident-main">
          <div className="ipc-dashboard-incident-copy">
            <h2 id="dashboard-shift-status">Tổng quan ca hôm nay</h2>
            <p>
              Theo dõi liên tục từ menu, định lượng, mua/kho đến xác nhận bếp trong ca.
            </p>
          </div>
        </div>
        <div className="ipc-dashboard-readiness-metrics">
          <div>
            <span>Cần xử lý</span>
            <strong>{isDashboardLoading ? '—' : actionQueue.length}</strong>
          </div>
          <div>
            <span>Đang chờ</span>
            <strong>{isDashboardLoading ? '—' : totalWaiting}</strong>
          </div>
          <div>
            <span>Điểm tắc</span>
            <strong>{isDashboardLoading ? '—' : totalBlocked}</strong>
          </div>
        </div>
      </section>

      <section className="ipc-dashboard-section" aria-label="Tín hiệu vận hành">
        <div className="ipc-dashboard-risk-board">
          {riskGroups.map((signal) => (
            <Link
              key={signal.key}
              to={signal.route}
              className="ipc-dashboard-signal"
              aria-label={`${signal.label}: ${isDashboardLoading ? 'đang tổng hợp' : signal.value}`}
            >
              <span className="ipc-dashboard-signal-copy">
                <span className="ipc-dashboard-signal-label">{signal.label}</span>
                <strong className={`ipc-dashboard-signal-number tone-${isDashboardLoading ? 'neutral' : signal.numberTone}`}>
                  {isDashboardLoading ? '—' : signal.value}
                </strong>
                <small>{isDashboardLoading ? 'Đang tổng hợp' : signal.helper}</small>
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
            <Link to={ROUTES.APPROVALS} className="ipc-dashboard-panel-link">
              Xem toàn bộ
            </Link>
          </div>
          <div className="ipc-dashboard-queue-filters" role="group" aria-label="Lọc hàng đợi xử lý">
            {queueFilters.map((filter) => {
              const count = filter.key === 'all' ? actionQueue.length : actionQueue.filter((item) => item.category === filter.key).length;

              return (
                <button
                  key={filter.key}
                  type="button"
                  className={filter.key === activeQueueFilter ? 'is-active' : undefined}
                  onClick={() => setActiveQueueFilter(filter.key)}
                  aria-pressed={filter.key === activeQueueFilter}
                >
                  {filter.label}
                  {filter.key !== 'all' && <span>{count}</span>}
                </button>
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
              <div className="ipc-dashboard-empty">Không có việc cần xử lý trong ca này.</div>
            ) : (
              visibleQueue.map((item, index) => (
                <Link
                  key={`${item.category}-${item.id}-${index}`}
                  to={item.route}
                  className={`ipc-dashboard-task${index === 0 ? ' is-recommended' : ''}`}
                >
                  <span className="ipc-dashboard-task-copy">
                    <strong>{item.title}</strong>
                    <small className={index === 0 ? 'ipc-dashboard-task-recommended' : undefined}>
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
              const tone = getLaneTone(gate.lanes);
              const nextAction = gate.lanes.find((lane) => lane.tone === tone)?.nextAction ?? gate.lanes[0]?.nextAction;

              return (
                <Link key={gate.key} to={gate.route} className="ipc-dashboard-gate">
                  <span className="ipc-dashboard-gate-order">{gate.order}</span>
                  <span className="ipc-dashboard-gate-copy">
                    <strong>{gate.title}</strong>
                    <small>{gate.description}</small>
                  </span>
                  <span className="ipc-dashboard-gate-next">
                    {nextAction ?? 'Mở công đoạn'}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </OperationalFrame>
  );
};

export default DashboardPage;
