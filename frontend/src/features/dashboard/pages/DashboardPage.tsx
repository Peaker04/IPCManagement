import { Link } from 'react-router-dom';
import { ROUTES } from '../../../routes/routeConfig';
import { AlertTriangle, CalendarClock, ClipboardCheck, PackageX, Route, TimerOff, TrendingDown, Truck } from 'lucide-react';
import {
  CommandBar,
  ExceptionLane,
  InlineAlert,
  OperationalFrame,
  RoleInbox,
  SectionPanel,
  StatCard,
  SwimlaneProgress,
} from '@/components/common';
import { useGetOperationalKpisQuery, useWorkflowOverview } from '@/features/workflow';

const DashboardPage = () => {
  const { blockedItems, isError, isLoading, roleInboxItems, workflowLanes } = useWorkflowOverview();
  const { data: kpis } = useGetOperationalKpisQuery();

  const kpiCards = [
    {
      key: 'shortage',
      label: 'Thiếu hụt',
      value: kpis?.shortageCount ?? '—',
      icon: <PackageX size={18} color="var(--ipc-danger)" />,
      backgroundColor: 'var(--ipc-danger-soft)',
      valueColor: 'var(--ipc-danger)',
      route: `${ROUTES.REPORTS}?view=demand`,
    },
    {
      key: 'lowStock',
      label: 'Tồn thấp',
      value: kpis?.lowStockCount ?? '—',
      icon: <TrendingDown size={18} color="var(--ipc-warning)" />,
      backgroundColor: 'var(--ipc-warning-soft)',
      valueColor: 'var(--ipc-warning)',
      route: `${ROUTES.REPORTS}?view=stock`,
    },
    {
      key: 'overduePr',
      label: 'PR quá hạn',
      value: kpis?.overduePurchaseRequestCount ?? '—',
      icon: <TimerOff size={18} color="var(--ipc-danger)" />,
      backgroundColor: 'var(--ipc-danger-soft)',
      valueColor: 'var(--ipc-danger)',
      route: `${ROUTES.REPORTS}?view=purchase`,
    },
    {
      key: 'lateReceipt',
      label: 'Receipt trễ',
      value: kpis?.lateReceiptCount ?? '—',
      icon: <Truck size={18} color="var(--ipc-warning)" />,
      backgroundColor: 'var(--ipc-warning-soft)',
      valueColor: 'var(--ipc-warning)',
      route: `${ROUTES.PURCHASING}?view=orders`,
    },
    {
      key: 'pendingConfirmation',
      label: 'Issue chờ bếp xác nhận',
      value: kpis?.pendingKitchenConfirmationCount ?? '—',
      icon: <ClipboardCheck size={18} color="var(--ipc-warning)" />,
      backgroundColor: 'var(--ipc-warning-soft)',
      valueColor: 'var(--ipc-warning)',
      route: `${ROUTES.REPORTS}?view=kitchen`,
    },
  ];

  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <Link to={ROUTES.MEAL_ORDERS} className="ipc-button ipc-button-primary">
                Mở điều phối ca
              </Link>
              <Link to={ROUTES.APPROVALS} className="ipc-button ipc-button-ghost">
                Xem hàng đợi duyệt
              </Link>
            </>
          }
        >
          <div className="ipc-command-meta">
            <CalendarClock size={16} />
            <span>Ngày phục vụ 13/06/2026 · Ca trưa</span>
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
      <SectionPanel title="KPI vận hành" icon={<AlertTriangle size={18} />}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {kpiCards.map((card) => (
            <Link key={card.key} to={card.route} className="no-underline">
              <StatCard
                label={card.label}
                value={card.value}
                icon={card.icon}
                backgroundColor={card.backgroundColor}
                valueColor={card.valueColor}
              />
            </Link>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Bảng lane vận hành" icon={<Route size={18} />}>
        <SwimlaneProgress
          lanes={workflowLanes}
          actionForLane={(lane) => (
            <Link to={lane.route} className="ipc-button ipc-button-ghost w-full">
              Thao tác
            </Link>
          )}
        />
      </SectionPanel>

      <div className="flex flex-col gap-3">
        <SectionPanel title="Hàng đợi xử lý" icon={<ClipboardCheck size={18} />}>
          <RoleInbox
            items={roleInboxItems}
            title={null}
            actionForItem={(item) => (
              <Link to={item.route} className="ipc-button ipc-button-ghost ipc-button-bounded">
                {item.nextAction}
              </Link>
            )}
          />
        </SectionPanel>

        <SectionPanel title="Ngoại lệ cần xử lí" icon={<AlertTriangle size={18} />}>
          <ExceptionLane
            title="Điểm tắc liên lane"
            items={blockedItems.map((item) => ({
              title: item.title,
              description: item.description,
              action: `${item.owner}: ${item.nextAction}`,
              tone: item.tone === 'neutral' ? 'info' : item.tone,
            }))}
            empty="Không có điểm tắc trong ca này."
          />
        </SectionPanel>
      </div>

    </OperationalFrame>
  );
};

export default DashboardPage;
