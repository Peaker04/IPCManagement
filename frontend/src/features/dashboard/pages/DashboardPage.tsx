import { Link } from 'react-router-dom';
import { ROUTES } from '../../../routes/routeConfig';
import { AlertTriangle, CalendarClock, ClipboardCheck, Route } from 'lucide-react';
import {
  CommandBar,
  ExceptionLane,
  InlineAlert,
  OperationalFrame,
  RoleInbox,
  SectionPanel,
  SwimlaneProgress,
} from '@/components/common';
import { useWorkflowOverview } from '@/features/workflow';

const DashboardPage = () => {
  const { blockedItems, isError, isLoading, roleInboxItems, workflowLanes } = useWorkflowOverview();

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
