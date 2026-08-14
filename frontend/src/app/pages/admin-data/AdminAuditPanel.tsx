import { History } from 'lucide-react';
import { CursorPaginationBar, InlineAlert, SectionPanel, TableViewport } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';
import { formatDateTime } from '@/lib/formatters';
import { typography } from '@/lib/typography';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth';
import type { TablePreferenceConfig } from '@/components/common/tablePreferences';

type AdminAuditPanelProps = { model: AdminDataPageModel };

const ALL_AUDIT_AREAS_VALUE = '__all_audit_areas__';

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
    { id: 'area', label: 'Mảng nghiệp vụ' },
    { id: 'field', label: 'Đối tượng/Trường ảnh hưởng' },
    { id: 'oldValue', label: 'Giá trị cũ' },
    { id: 'newValue', label: 'Giá trị mới' },
    { id: 'reason', label: 'Lý do thay đổi' },
  ],
};

export function AdminAuditPanel({ model }: AdminAuditPanelProps) {
  const currentUser = useAppSelector(selectCurrentUser);
  const { auditActor, auditArea, auditCursors, auditEntity, auditField, auditResult, displayLogs, effectiveActiveView, exportError, handleExportAuditCsv, isExportingAudit, queryViews, setAuditActor, setAuditArea, setAuditCursors, setAuditEntity, setAuditField } = model;
  return (
    <>
      {effectiveActiveView === 'audit' && (
        <SectionPanel title="Nhật ký thay đổi hệ thống" icon={<History size={18} />}>
          <div id="admin-audit-panel" role="tabpanel" aria-labelledby="admin-audit-tab" className="flex flex-col gap-4">
            {/* Bộ lọc Audit log */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Người thực hiện</label>
                <Input
                  type="text"
                  value={auditActor}
                  onChange={(e) => { setAuditActor(e.target.value); setAuditCursors([]); }}
                  placeholder="Họ tên / tài khoản..."
                  className="w-48 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Mảng nghiệp vụ</label>
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
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tên bảng/Thực thể</label>
                <Input
                  type="text"
                  value={auditEntity}
                  onChange={(e) => { setAuditEntity(e.target.value); setAuditCursors([]); }}
                  placeholder="Ví dụ: Mealquantityplan..."
                  className="w-44 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tên cột/Trường</label>
                <Input
                  type="text"
                  value={auditField}
                  onChange={(e) => { setAuditField(e.target.value); setAuditCursors([]); }}
                  placeholder="Ví dụ: Status..."
                  className="w-40 text-xs"
                />
              </div>

              <div className="flex gap-2 items-end h-8 mt-4 ml-auto">
                <Button
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
                >
                  {isExportingAudit ? 'Đang xuất...' : 'Xuất CSV'}
                </Button>
              </div>
            </div>
            {exportError && <div role="alert"><InlineAlert title="Chưa thể tải file CSV" variant="danger">{exportError}</InlineAlert></div>}

            <AdminQueryBoundary queries={[{ label: 'nhật ký thay đổi', view: queryViews.audit }]}>
              <TableViewport ariaLabel="Bảng nhật ký thay đổi hệ thống" className="ipc-admin-audit-shell" preferences={{ accountId: currentUser?.id, config: adminAuditPreferenceConfig }}>
              {({ columns }) => <table className="ipc-data-table ipc-admin-audit-table text-xs">
                <thead>
                  <tr>
                    {columns.map((column) => <th scope="col" key={column.id} className={column.id === 'timestamp' || column.id === 'reason' ? 'text-left' : undefined}>{column.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {displayLogs.map((log) => {
                    const cells: Record<string, React.ReactNode> = {
                      timestamp: <span className={`${typography.code} text-left text-slate-500`}>{formatDateTime(log.timestamp)}</span>,
                      actor: <span className="font-semibold text-slate-800">{log.actor}</span>,
                      area: log.businessArea,
                      field: <span className="font-medium text-blue-700">{log.fieldAffected}</span>,
                      oldValue: <span className={`${typography.code} text-slate-500 ipc-admin-audit-value`}>{log.oldValue}</span>,
                      newValue: <span className={`${typography.code} font-bold text-slate-900 ipc-admin-audit-value`}>{log.newValue}</span>,
                      reason: <span className="ipc-admin-audit-reason text-left text-slate-600">{log.reason}</span>,
                    };
                    return <tr key={log.id} className="hover:bg-slate-50 transition-colors">{columns.map((column) => <td key={column.id}>{cells[column.id]}</td>)}</tr>;
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
                  setAuditCursors((current) => [...current, { cursorDate: nextCursorDate, cursorId: auditResult.data?.nextCursorId }]);
                }
              }}
              ariaLabel="Phân trang nhật ký thay đổi"
              />
            </AdminQueryBoundary>
          </div>
        </SectionPanel>
      )}


    </>
  );
}
