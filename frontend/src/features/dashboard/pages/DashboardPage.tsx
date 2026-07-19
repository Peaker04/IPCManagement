import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Gauge,
  PackageX,
  ShoppingCart,
  TimerOff,
  Truck,
  Utensils,
  Warehouse,
} from 'lucide-react';
import { CommandBar, InlineAlert, OperationalFrame, StatusBadge } from '@/components/common';
import { useGetOperationalKpisQuery, useWorkflowOverview, type RoleInboxItem, type WorkflowLane, type WorkflowTone } from '@/features/workflow';
import { ROUTES } from '../../../routes/routeConfig';

const tonePriority: Record<WorkflowTone, number> = {
  danger: 3,
  warning: 2,
  neutral: 1,
  success: 0,
};

const toneLabel: Record<WorkflowTone, string> = {
  danger: 'Cần xử lý',
  warning: 'Đang chờ',
  neutral: 'Chưa có dữ liệu',
  success: 'Ổn định',
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
  const { blockedItems, isError, isLoading, roleInboxItems, workflowLanes } = useWorkflowOverview();
  const { data: kpis } = useGetOperationalKpisQuery();
  const [activeQueueFilter, setActiveQueueFilter] = useState<DashboardQueueCategory>('all');

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
      icon: <ClipboardCheck size={17} />,
      lanes: [laneById.get('coordination')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.MEAL_ORDERS,
    },
    {
      key: 'bom',
      order: '02',
      title: 'Định lượng BOM',
      description: 'KHSX kiểm tier BOM, định lượng và tồn kho.',
      icon: <Gauge size={17} />,
      lanes: [laneById.get('planning'), laneById.get('admin')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.WEEKLY_MENU,
    },
    {
      key: 'purchase',
      order: '03',
      title: 'Duyệt & thu mua',
      description: 'Quản lý duyệt, thu mua chọn NCC và theo receipt.',
      icon: <ShoppingCart size={17} />,
      lanes: [laneById.get('management'), laneById.get('purchasing')].filter(Boolean) as WorkflowLane[],
      route: ROUTES.PURCHASING,
    },
    {
      key: 'kitchen',
      order: '04',
      title: 'Kho & bếp',
      description: 'Thủ kho xuất nguyên liệu, bếp xác nhận nhận hàng.',
      icon: <Warehouse size={17} />,
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
      tone: shortageCount > 0 ? 'danger' : lowStockCount > 0 ? 'warning' : 'success',
      icon: <PackageX size={17} />,
      route: `${ROUTES.REPORTS}?view=demand`,
    },
    {
      key: 'purchase',
      label: 'Thu mua trễ',
      value: overduePurchaseCount + lateReceiptCount,
      helper: `${overduePurchaseCount} PR / ${lateReceiptCount} receipt`,
      tone: overduePurchaseCount + lateReceiptCount > 0 ? 'danger' : 'success',
      icon: <Truck size={17} />,
      route: `${ROUTES.REPORTS}?view=purchase`,
    },
    {
      key: 'kitchen',
      label: 'Bếp chờ xác nhận',
      value: pendingKitchenCount,
      helper: 'Issue chưa nhận bếp',
      tone: pendingKitchenCount > 0 ? 'warning' : 'success',
      icon: <Utensils size={17} />,
      route: `${ROUTES.REPORTS}?view=kitchen`,
    },
    {
      key: 'data',
      label: 'Dữ liệu chặn luồng',
      value: failedWorkflowCount + criticalDataCount,
      helper: `${criticalDataCount} lỗi dữ liệu`,
      tone: failedWorkflowCount + criticalDataCount > 0 ? 'danger' : 'success',
      icon: <Database size={17} />,
      route: `${ROUTES.ADMIN_DATA}?view=cleanup`,
    },
    {
      key: 'approval',
      label: 'Duyệt quá hạn',
      value: overdueApprovalCount,
      helper: 'Cần quản lý xử lý',
      tone: overdueApprovalCount > 0 ? 'warning' : 'success',
      icon: <TimerOff size={17} />,
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
  const blockerCount = blockedItems.length + failedWorkflowCount + criticalDataCount;
  const readyTone: WorkflowTone = blockerCount > 0 || shortageCount > 0 ? 'danger' : actionQueue.length > 0 ? 'warning' : 'success';
  const readyLabel = readyTone === 'danger' ? 'Đang nghẽn' : readyTone === 'warning' ? 'Cần theo dõi' : 'Sẵn sàng vận hành';
  const topIncident = [...riskGroups].sort((a, b) => tonePriority[b.tone] - tonePriority[a.tone] || b.value - a.value)[0];
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
            <CalendarClock size={16} />
            <span>Ngày phục vụ hôm nay · Ca đang vận hành</span>
            <span className={`ipc-dashboard-status-chip is-${readyTone}`}>{readyLabel}</span>
          </div>
        </CommandBar>
      }
    >
      {isError && (
        <InlineAlert title="Không tải được dữ liệu workflow" variant="warning">
          Bảng điều hành đang chờ backend trả dữ liệu báo cáo workflow.
        </InlineAlert>
      )}
      {isLoading && (
        <InlineAlert title="Đang tải dữ liệu workflow" variant="info">
          Hệ thống đang tổng hợp chứng từ, nhu cầu và luân chuyển kho.
        </InlineAlert>
      )}

      <section className={`ipc-dashboard-incident is-${readyTone}`}>
        <div className="ipc-dashboard-incident-main">
          <div className="ipc-dashboard-readiness-icon">
            {readyTone === 'success' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <span className="ipc-dashboard-panel-kicker">Trạng thái ca</span>
            <h2>{readyLabel}</h2>
            <p>
              Ưu tiên hiện tại: {topIncident.label.toLowerCase()} ({topIncident.value}). Theo dõi menu, BOM, mua/kho và xác nhận bếp trong ca.
            </p>
          </div>
        </div>
        <div className="ipc-dashboard-readiness-metrics">
          <div>
            <span>Việc mở</span>
            <strong>{actionQueue.length}</strong>
          </div>
          <div>
            <span>Dữ liệu chặn</span>
            <strong>{failedWorkflowCount + criticalDataCount}</strong>
          </div>
          <div>
            <span>Thiếu / tồn thấp</span>
            <strong>{shortageCount + lowStockCount}</strong>
          </div>
        </div>
      </section>

      <section className="ipc-dashboard-risk-board" aria-label="Tín hiệu vận hành chính">
        {riskGroups.map((signal) => (
          <Link key={signal.key} to={signal.route} className={`ipc-dashboard-signal is-${signal.tone}`}>
            <span className="ipc-dashboard-signal-icon">{signal.icon}</span>
            <span className="ipc-dashboard-signal-copy">
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <small>{signal.helper}</small>
            </span>
          </Link>
        ))}
      </section>

      <div className="ipc-dashboard-grid">
        <section className="ipc-dashboard-panel ipc-dashboard-panel-main">
          <div className="ipc-dashboard-panel-header">
            <div>
              <span className="ipc-dashboard-panel-kicker">Luồng IPC hôm nay</span>
              <h3>Menu → định lượng → mua/kho → bếp</h3>
            </div>
            <div className="ipc-dashboard-flow-summary" aria-label="Tổng trạng thái luồng">
              <span>{totalBlocked} tắc</span>
              <span>{totalWaiting} chờ</span>
            </div>
            <Link to={ROUTES.WEEKLY_MENU} className="ipc-dashboard-panel-link">
              Xem KHSX <ArrowRight size={15} />
            </Link>
          </div>
          <div className="ipc-dashboard-gate-list">
            {workflowSteps.map((gate) => {
              const tone = getLaneTone(gate.lanes);
              const blocked = sumLaneCount(gate.lanes, 'blocked');
              const waiting = sumLaneCount(gate.lanes, 'waiting');
              const done = sumLaneCount(gate.lanes, 'done');
              const nextAction = gate.lanes.find((lane) => lane.tone === tone)?.nextAction ?? gate.lanes[0]?.nextAction;

              return (
                <Link key={gate.key} to={gate.route} className={`ipc-dashboard-gate is-${tone}`}>
                  <span className="ipc-dashboard-gate-order">{gate.order}</span>
                  <span className="ipc-dashboard-gate-icon">{gate.icon}</span>
                  <span className="ipc-dashboard-gate-copy">
                    <strong>{gate.title}</strong>
                    <small>{gate.description}</small>
                  </span>
                  <span className="ipc-dashboard-gate-state">
                    <StatusBadge variant={tone}>{toneLabel[tone]}</StatusBadge>
                    <small>{blocked} tắc / {waiting} chờ / {done} xong</small>
                  </span>
                  <span className="ipc-dashboard-gate-next">{nextAction}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="ipc-dashboard-panel ipc-dashboard-queue-panel">
          <div className="ipc-dashboard-panel-header">
            <div>
              <span className="ipc-dashboard-panel-kicker">Action queue</span>
              <h3>Việc cần gỡ trước khi gửi bếp</h3>
            </div>
            <Link to={ROUTES.APPROVALS} className="ipc-dashboard-panel-link">
              Mở duyệt <ArrowRight size={15} />
            </Link>
          </div>
          <div className="ipc-dashboard-queue-filters" aria-label="Lọc hàng đợi xử lý">
            {queueFilters.map((filter) => {
              const count = filter.key === 'all' ? actionQueue.length : actionQueue.filter((item) => item.category === filter.key).length;

              return (
                <button
                  key={filter.key}
                  type="button"
                  className={filter.key === activeQueueFilter ? 'is-active' : undefined}
                  onClick={() => setActiveQueueFilter(filter.key)}
                >
                  {filter.label}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="ipc-dashboard-task-list">
            {visibleQueue.length === 0 ? (
              <div className="ipc-dashboard-empty">Không có việc cần xử lý trong ca này.</div>
            ) : (
              visibleQueue.map((item) => (
                <Link key={item.id} to={item.route} className={`ipc-dashboard-task is-${item.tone}`}>
                  <span className="ipc-dashboard-task-marker" />
                  <span className="ipc-dashboard-task-copy">
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="ipc-dashboard-task-meta">
                    <span>{item.owner}</span>
                    <StatusBadge variant={item.tone}>{item.due}</StatusBadge>
                  </span>
                  <span className="ipc-dashboard-task-action">{item.nextAction}</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </OperationalFrame>
  );
};

export default DashboardPage;
