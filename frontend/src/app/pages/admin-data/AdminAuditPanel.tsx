import { History } from 'lucide-react';
import { CursorPaginationBar, InlineAlert, PaginatedTableFrame, SectionPanel } from '@/components/common';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminAuditPanelProps = { model: AdminDataPageModel };

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
                <input
                  type="text"
                  value={auditActor}
                  onChange={(e) => { setAuditActor(e.target.value); setAuditCursors([]); }}
                  placeholder="Họ tên / tài khoản..."
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-48 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Mảng nghiệp vụ</label>
                <select
                  value={auditArea}
                  onChange={(e) => { setAuditArea(e.target.value); setAuditCursors([]); }}
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-40 bg-white focus:outline-none"
                >
                  <option value="">Tất cả</option>
                  <option value="Signoff">Hoàn thành ca</option>
                  <option value="Coordination">Điều phối</option>
                  <option value="MaterialRequest">Yêu cầu nguyên liệu</option>
                  <option value="PurchaseRequest">Đề xuất mua hàng</option>
                  <option value="InventoryReceipt">Nhập kho</option>
                  <option value="InventoryIssue">Xuất kho</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tên bảng/Thực thể</label>
                <input
                  type="text"
                  value={auditEntity}
                  onChange={(e) => { setAuditEntity(e.target.value); setAuditCursors([]); }}
                  placeholder="Ví dụ: Mealquantityplan..."
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-44 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tên cột/Trường</label>
                <input
                  type="text"
                  value={auditField}
                  onChange={(e) => { setAuditField(e.target.value); setAuditCursors([]); }}
                  placeholder="Ví dụ: Status..."
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-40 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 items-end h-8 mt-4 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setAuditActor('');
                    setAuditArea('');
                    setAuditEntity('');
                    setAuditField('');
                    setAuditCursors([]);
                  }}
                  className="ipc-button ipc-button-ghost py-1 px-3 text-xs"
                >
                  Xóa bộ lọc
                </button>
                <button
                  type="button"
                  onClick={handleExportAuditCsv}
                  className="ipc-button ipc-button-primary py-1 px-3 text-xs bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 border-0"
                >
                  Xuất CSV
                </button>
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
                        {new Date(log.timestamp).toLocaleTimeString('vi-VN')} {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="font-semibold text-slate-800">{log.actor}</td>
                      <td>{log.businessArea}</td>
                      <td className="font-medium text-blue-700">{log.fieldAffected}</td>
                      <td className="text-slate-500 font-mono">{log.oldValue}</td>
                      <td className="font-bold text-slate-900 font-mono">{log.newValue}</td>
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
