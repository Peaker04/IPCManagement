import { Eye, History } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { CursorPaginationBar, InlineAlert, KeepAliveTabPanel, SectionPanel, TableViewport } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import type { ReconciliationAdminDataPageModel } from './useReconciliationAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';
import { formatDateTime } from '@/lib/formatters';
import { typography } from '@/lib/typography';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth';
import type { TablePreferenceConfig } from '@/components/common/tablePreferences';
import { formatAuditActor, presentAudit } from './auditPresentation';
import { AuditIssueEventDialog } from './AuditIssueEventDialog';

type AdminAuditPanelProps = { model: AdminDataPageModel | ReconciliationAdminDataPageModel };

const ALL_AUDIT_AREAS_VALUE = '__all_audit_areas__';

const eventStatusLabels: Record<string, string> = {
  CREATED: 'Đã tạo phiếu',
  RECEIVED: 'Bếp đã nhận',
};

const auditAreaLabels: Record<string, string> = {
  Signoff: 'Hoàn thành ca',
  Coordination: 'Điều phối',
  MaterialRequest: 'Yêu cầu nguyên liệu',
  PurchaseRequest: 'Đề xuất mua hàng',
  InventoryReceipt: 'Nhập kho',
  InventoryIssue: 'Xuất kho',
};

const adminAuditPreferenceConfig: TablePreferenceConfig = {
  tableId: 'admin-audit',
  columns: [
    { id: 'timestamp', label: 'Thời gian', locked: true },
    { id: 'actor', label: 'Người thực hiện' },
    { id: 'area', label: 'Hoạt động' },
    { id: 'oldValue', label: 'Trước' },
    { id: 'newValue', label: 'Sau / Kết quả' },
    { id: 'reason', label: 'Lý do' },
  ],
};

export function AdminAuditPanel({ model }: AdminAuditPanelProps) {
  const currentUser = useAppSelector(selectCurrentUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const isReconciliationMode = 'isReconciliationMode' in model && model.isReconciliationMode;
  const selectedEventId = searchParams.get('auditIssueId') ?? undefined;
  const selectedBatchId = searchParams.get('auditBatchId') ?? undefined;
  const { auditActor, auditArea, auditCursors, auditEntity, auditField, auditResult, displayLogs, effectiveActiveView, exportError, handleExportAuditCsv, isExportingAudit, queryViews, setAuditActor, setAuditArea, setAuditCursors, setAuditEntity, setAuditField } = model;
  const setSelectedEvent = (eventId?: string, batchId?: string) => {
    const next = new URLSearchParams(searchParams);
    if (eventId && batchId) {
      next.set('auditIssueId', eventId);
      next.set('auditBatchId', batchId);
    } else {
      next.delete('auditIssueId');
      next.delete('auditBatchId');
    }
    setSearchParams(next, { replace: true });
  };
  return (
    <KeepAliveTabPanel id="admin-audit" active={effectiveActiveView === 'audit'} className="flex flex-col gap-4">
      <SectionPanel
        title="Nhật ký thay đổi hệ thống"
        icon={<History size={18} />}
        description="Tra cứu lịch sử thao tác, thay đổi dữ liệu và đối tượng ảnh hưởng trên toàn hệ thống."
      >
        <div className="flex flex-col gap-4">
          {/* Bộ lọc Audit log */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Người thực hiện</label>
              <Input
                type="text"
                value={auditActor}
                onChange={(e) => { setAuditActor(e.target.value); setAuditCursors([]); }}
                placeholder="Họ tên / tài khoản..."
                className="w-48 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Mảng nghiệp vụ</label>
              <Select
                value={auditArea || ALL_AUDIT_AREAS_VALUE}
                onValueChange={(value) => {
                  setAuditArea(!value || value === ALL_AUDIT_AREAS_VALUE ? '' : value);
                  setAuditCursors([]);
                }}
              >
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue>{auditArea ? auditAreaLabels[auditArea] ?? 'Tất cả' : 'Tất cả'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_AUDIT_AREAS_VALUE}>Tất cả</SelectItem>
                  <SelectItem value="Signoff">Hoàn thành ca</SelectItem>
                  <SelectItem value="Coordination">Điều phối</SelectItem>
                  <SelectItem value="MaterialRequest">Yêu cầu nguyên liệu</SelectItem>
                  <SelectItem value="PurchaseRequest">Đề xuất mua hàng</SelectItem>
                  <SelectItem value="InventoryReceipt">Nhập kho</SelectItem>
                  <SelectItem value="InventoryIssue">Xuất kho</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Đối tượng nghiệp vụ</label>
              <Input
                type="text"
                value={auditEntity}
                onChange={(e) => { setAuditEntity(e.target.value); setAuditCursors([]); }}
                placeholder="Ví dụ: Kế hoạch suất ăn..."
                className="w-44 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Thông tin thay đổi</label>
              <Input
                type="text"
                value={auditField}
                onChange={(e) => { setAuditField(e.target.value); setAuditCursors([]); }}
                placeholder="Ví dụ: Trạng thái..."
                className="w-40 text-xs"
              />
            </div>

            <div className="flex gap-2 items-end h-8 mt-4 ml-auto">
              <Button
                data-inp-action="export-audit-csv"
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setAuditActor('');
                  setAuditArea('');
                  setAuditEntity('');
                  setAuditField('');
                  setAuditCursors([]);
                }}
              >
                Xóa bộ lọc
              </Button>
              <Button
                type="button"
                variant="default"
                size="xs"
                onClick={handleExportAuditCsv}
                disabled={isExportingAudit}
                className="border-0 bg-green-600 text-white hover:bg-green-700"
                title={isReconciliationMode ? 'Xuất các dòng thay đổi chi tiết; file CSV không gộp theo sự kiện' : 'Xuất các dòng thay đổi chi tiết'}
              >
                {isExportingAudit ? 'Đang xuất...' : 'Xuất CSV chi tiết'}
              </Button>
            </div>
          </div>
          {exportError && <div role="alert"><InlineAlert title="Chưa thể tải file CSV" variant="danger">{exportError}</InlineAlert></div>}

          <AdminQueryBoundary queries={[{ label: 'nhật ký thay đổi', view: queryViews.audit }]}>
            <TableViewport ariaLabel="Bảng nhật ký thay đổi hệ thống" className="ipc-admin-audit-shell" preferences={{ accountId: currentUser?.id, config: adminAuditPreferenceConfig }}>
              {({ columns }) => <table className="ipc-data-table ipc-erp-grid-table ipc-admin-audit-table w-full text-xs">
                <thead>
                  <tr>
                    {columns.map((column) => <th scope="col" key={column.id} className="text-left">{column.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {displayLogs.map((log) => {
                    const presentation = presentAudit({
                      businessArea: log.businessArea,
                      entityName: log.entityName,
                      fieldName: log.fieldName,
                      oldValue: log.oldValue,
                      newValue: log.newValue,
                      reason: log.reason,
                    });
                    const cells: Record<string, React.ReactNode> = {
                      timestamp: <span className={`${typography.code} text-left text-slate-500`}>{formatDateTime(log.timestamp)}</span>,
                      actor: <span className="font-semibold text-slate-800" title={log.actor}>{formatAuditActor(log.actor)}</span>,
                      area: <span className="font-semibold text-slate-900" title={presentation.technicalTuple}>{presentation.action}</span>,
                      oldValue: <span className="text-slate-600 ipc-admin-audit-value" title={presentation.oldValueTitle}>{presentation.before}</span>,
                      newValue: <div className="flex items-center justify-between gap-2"><span className="ipc-admin-audit-value" title={presentation.newValueTitle}><span className="block font-bold text-slate-900">{log.eventCode ?? presentation.after}{log.eventLineCount != null ? ` · ${log.eventLineCount} dòng` : ''}</span>{log.eventId ? <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{eventStatusLabels[log.eventStatus ?? ''] ?? 'Trạng thái chưa xác định'} · {log.eventRole === 'UNKNOWN' ? 'Vai trò chưa được lưu' : log.eventRole}</span> : isReconciliationMode && log.businessArea === 'Issue' ? <span className="mt-0.5 block text-[11px] font-medium text-amber-700">Dòng chi tiết · Liên kết sự kiện chưa xác định</span> : null}</span>{isReconciliationMode && log.eventId && log.reconciliationBatchId && <Button type="button" variant="outline" size="xs" aria-label={`Xem chi tiết sự kiện ${log.eventCode ?? log.eventId}`} onClick={() => setSelectedEvent(log.eventId, log.reconciliationBatchId)}><Eye size={14} aria-hidden="true" /> Chi tiết</Button>}</div>,
                      reason: <span className="ipc-admin-audit-reason text-left text-slate-600" title={presentation.reasonTitle}>{presentation.reason}</span>,
                    };
                    return <tr key={log.id}>{columns.map((column) => <td key={column.id}>{cells[column.id]}</td>)}</tr>;
                  })}
                </tbody>
              </table>
              }
            </TableViewport>
            <CursorPaginationBar
              page={auditCursors.length + 1}
              hasNext={auditResult.data?.hasNext ?? false}
              onPrevious={() => setAuditCursors((current) => current.slice(0, -1))}
              onNext={() => {
                const nextCursorDate = auditResult.data?.nextCursorDate;
                if (nextCursorDate) {
                  setAuditCursors((current) => [...current, { cursorDate: nextCursorDate, cursorId: auditResult.data?.nextCursorId, cursorOffset: auditResult.data?.nextCursorOffset }]);
                }
              }}
              ariaLabel="Phân trang nhật ký thay đổi"
            />
          </AdminQueryBoundary>
        </div>
      </SectionPanel>
      {isReconciliationMode && (
        <AuditIssueEventDialog
          open={Boolean(selectedEventId && selectedBatchId)}
          eventId={selectedEventId}
          expectedBatchId={selectedBatchId}
          onOpenChange={(open) => { if (!open) setSelectedEvent(); }}
        />
      )}
    </KeepAliveTabPanel>
  );
}
