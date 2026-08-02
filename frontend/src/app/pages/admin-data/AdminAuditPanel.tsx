import { History } from 'lucide-react';
import { CursorPaginationBar, InlineAlert, PaginatedTableFrame, SectionPanel } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';
import { formatDateTime } from '@/lib/formatters';

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

export function AdminAuditPanel({ model }: AdminAuditPanelProps) {
  const { auditActor, auditArea, auditCursors, auditEntity, auditField, auditResult, displayLogs, effectiveActiveView, exportError, handleExportAuditCsv, queryViews, setAuditActor, setAuditArea, setAuditCursors, setAuditEntity, setAuditField } = model;
  return (
    <>
      {effectiveActiveView === 'audit' && (
        <SectionPanel title="Nhật ký thay đổi hệ thống (Audit Trail)" icon={<History size={18} />}>
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
                  className="border-0 bg-green-600 text-white hover:bg-green-700"
                >
                  Xuất CSV
                </Button>
              </div>
            </div>
            {exportError && <div role="alert"><InlineAlert title="Chưa thể tải file CSV" variant="danger">{exportError}</InlineAlert></div>}

            <AdminQueryBoundary queries={[{ label: 'nhật ký thay đổi', view: queryViews.audit }]}>
              <PaginatedTableFrame ariaLabel="Bảng nhật ký thay đổi hệ thống" className="ipc-admin-audit-shell">
              <table className="ipc-data-table ipc-admin-audit-table text-xs">
                <thead>
                  <tr>
                    <th className="text-left">Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Mảng nghiệp vụ</th>
                    <th>Đối tượng/Trường ảnh hưởng</th>
                    <th>Giá trị cũ</th>
                    <th>Giá trị mới</th>
                    <th className="text-left">Lý do thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="font-mono text-slate-500 text-left">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="font-semibold text-slate-800">{log.actor}</td>
                      <td>{log.businessArea}</td>
                      <td className="font-medium text-blue-700">{log.fieldAffected}</td>
                      <td className="text-slate-500 font-mono"><span className="ipc-admin-audit-value">{log.oldValue}</span></td>
                      <td className="font-bold text-slate-900 font-mono"><span className="ipc-admin-audit-value">{log.newValue}</span></td>
                      <td className="ipc-admin-audit-reason text-left text-slate-600">
                        <span>{log.reason}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </PaginatedTableFrame>
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
