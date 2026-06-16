import { useState } from 'react';
import { ClipboardCheck, FileCheck2, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ApprovalQueue,
  CommandBar,
  ContextStrip,
  DocumentRail,
  OperationalFrame,
  SectionPanel,
  SplitWorkbench,
  StatusBadge,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  approvalRecords,
  getDocumentByType,
} from '@/features/workflow';

export default function ApprovalPage() {
  const [activeView, setActiveView] = useState<'queue' | 'role' | 'history'>('queue');
  const purchaseDocuments = getDocumentByType('Danh sách mua thêm');

  return (
    <OperationalFrame
      title="Duyệt vận hành"
      eyebrow="Luồng Quản lí"
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-success" type="button">Duyệt danh sách mua thêm</button>
              <button className="ipc-button ipc-button-ghost" type="button">Trả lại để bổ sung</button>
              <Link className="ipc-button ipc-button-primary" to={ROUTES.PURCHASING}>
                <FileCheck2 size={16} />
                Sang thu mua
              </Link>
              <Link className="ipc-button ipc-button-ghost" to={ROUTES.WAREHOUSE}>
                <RotateCcw size={16} />
                Kiểm tra kho
              </Link>
            </>
          }
        >
          <span className="ipc-command-meta">
            <ClipboardCheck size={16} />
            Nguồn: KHSX-0613-TRUA
          </span>
          <span className="ipc-command-meta">Hạn duyệt gần nhất: 09:20</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Trạng thái chính', value: 'Chờ duyệt', tone: 'warning' },
            { label: 'Danh sách mua thêm', value: '2 nguyên liệu thiếu', tone: 'danger' },
            { label: 'Nhu cầu xuất', value: '1 phiếu cần bổ sung', tone: 'warning' },
            { label: 'Người duyệt', value: 'Quản lí vận hành', tone: 'neutral' },
          ]}
        />
      }
    >
      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn duyệt vận hành"
        tabs={[
          { id: 'approval-queue', label: 'Cần duyệt' },
          { id: 'approval-role', label: 'Theo vai trò' },
          { id: 'approval-history', label: 'Lịch sử' },
        ]}
        activeTab={`approval-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('approval-', '') as 'queue' | 'role' | 'history')}
      />

      {activeView === 'queue' && (
        <div id="approval-queue-panel" role="tabpanel" aria-labelledby="approval-queue-tab">
          <SplitWorkbench
            detailLabel="Chứng từ"
            detail={
              <DocumentRail
                documents={purchaseDocuments}
                title={null}
                actionForDocument={(document) => (
                  <Link className="ipc-button ipc-button-ghost" to={document.route}>
                    Mở chứng từ
                  </Link>
                )}
              />
            }
          >
            <SectionPanel title="Danh sách cần duyệt" icon={<ClipboardCheck size={18} />}>
              <ApprovalQueue
                records={approvalRecords}
                title={null}
                actionForRecord={(record) => (
                  <button className="ipc-button ipc-button-ghost" type="button">
                    {record.nextAction}
                  </button>
                )}
              />
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'role' && (
        <SectionPanel title="Việc đang chờ quản lí" icon={<ClipboardCheck size={18} />}>
          <div id="approval-role-panel" role="tabpanel" aria-labelledby="approval-role-tab">
          <div>
            <ApprovalQueue
              records={approvalRecords.filter((record) => record.type === 'purchase' || record.type === 'issue')}
              title={null}
            />
          </div>
          </div>
        </SectionPanel>
      )}

      {activeView === 'history' && (
        <SectionPanel title="Lịch sử duyệt và phản hồi">
          <div id="approval-history-panel" role="tabpanel" aria-labelledby="approval-history-tab">
          <div className="ipc-audit-log-list">
            {approvalRecords.map((record) => (
              <div key={`audit-${record.id}`} className="ipc-audit-log-row">
                <div className="ipc-audit-log-main">
                  <strong className="ipc-audit-log-id">{record.id}</strong>
                  <p className="ipc-audit-log-desc">
                    {record.submittedBy} gửi cho {record.owner}. Việc kế tiếp: {record.nextAction}.
                  </p>
                </div>
                <StatusBadge variant={record.tone}>{record.status}</StatusBadge>
              </div>
            ))}
          </div>
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}
