import { useState } from 'react';
import { Settings, Plus, Edit2, Trash2, Shield, Layers } from 'lucide-react';
import {
  OperationalFrame,
  SectionPanel,
  CommandBar,
  StatusBadge,
  useToast,
} from '@/components/common';
import {
  useGetApprovalRulesQuery,
  useCreateApprovalRuleMutation,
  useUpdateApprovalRuleMutation,
  useDeleteApprovalRuleMutation,
  type ApprovalAssignmentDto,
  type ApprovalRuleDto,
  type ApprovalRuleRequestDto,
} from '@/features/workflow';
import { useGetAdminEmployeesQuery, type AdminEmployee } from '@/features/admin/adminApi';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RuleAssignmentForm {
  sequence: number;
  approverRole: string;
  approverUserId: string;
  isRequired: boolean;
}

const formatMutationError = (error: unknown) => {
  const candidate = error as {
    data?: { message?: string; errors?: Record<string, string[]> } | string;
    message?: string;
  } | null;
  const dataMessage = typeof candidate?.data === 'string'
    ? candidate.data
    : candidate?.data?.message;
  const validationMessage = candidate?.data && typeof candidate.data !== 'string'
    ? Object.values(candidate.data.errors ?? {}).flat()[0]
    : undefined;

  return dataMessage ?? validationMessage ?? candidate?.message ?? 'Hệ thống chưa trả về chi tiết lỗi. Vui lòng thử lại.';
};

const approvalDocumentLabels: Record<string, string> = {
  'purchase-request': 'Đơn mua thêm',
  'inventory-issue': 'Phiếu xuất kho',
  'order-adjustment': 'Điều chỉnh suất ăn',
};

const approverRoleLabels: Record<string, string> = {
  quanly: 'Quản lý',
  beptruong: 'Bếp trưởng',
  thumua: 'Thu mua',
  thukho: 'Thủ kho',
};

const formatApprovalDocumentType = (value: string) => approvalDocumentLabels[value] ?? value;
const formatApproverRole = (value: string) => approverRoleLabels[value] ?? value;

export default function ApprovalRulesPage() {
  const { toast } = useToast();
  const { data: rulesResponse, isLoading: isLoadingRules } = useGetApprovalRulesQuery();
  const rules = rulesResponse?.data ?? [];

  const { data: employeesResponse } = useGetAdminEmployeesQuery({ pageNumber: 1, pageSize: 200 });
  const employees = employeesResponse?.data?.items ?? [];

  const [createRule, { isLoading: isCreating }] = useCreateApprovalRuleMutation();
  const [updateRule, { isLoading: isUpdating }] = useUpdateApprovalRuleMutation();
  const [deleteRule, { isLoading: isDeleting }] = useDeleteApprovalRuleMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  
  const [ruleName, setRuleName] = useState('');
  const [documentType, setDocumentType] = useState('purchase-request');
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');
  const [slaHours, setSlaHours] = useState<number | ''>(24);
  const [isActive, setIsActive] = useState(true);
  const [assignments, setAssignments] = useState<RuleAssignmentForm[]>([
    { sequence: 1, approverRole: 'quanly', approverUserId: '', isRequired: true }
  ]);

  const handleOpenCreate = () => {
    setEditingRuleId(null);
    setRuleName('');
    setDocumentType('purchase-request');
    setMinAmount('');
    setMaxAmount('');
    setSlaHours(24);
    setIsActive(true);
    setAssignments([{ sequence: 1, approverRole: 'quanly', approverUserId: '', isRequired: true }]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: ApprovalRuleDto) => {
    if (!rule.ruleId) return;

    setEditingRuleId(rule.ruleId);
    setRuleName(rule.ruleName);
    setDocumentType(rule.documentType);
    setMinAmount(rule.minAmount ?? '');
    setMaxAmount(rule.maxAmount ?? '');
    setSlaHours(rule.slaHours ?? '');
    setIsActive(rule.isActive);
    
    const formattedAssignments = (rule.approvalassignments ?? []).map((a: ApprovalAssignmentDto) => ({
      sequence: a.sequence,
      approverRole: a.approverRole,
      approverUserId: a.approverUserId ?? '',
      isRequired: a.isRequired,
    }));
    setAssignments(formattedAssignments.length > 0 ? formattedAssignments : [{ sequence: 1, approverRole: 'quanly', approverUserId: '', isRequired: true }]);
    
    setIsModalOpen(true);
  };

  const handleAddStep = () => {
    setAssignments([
      ...assignments,
      {
        sequence: assignments.length + 1,
        approverRole: 'quanly',
        approverUserId: '',
        isRequired: true,
      }
    ]);
  };

  const handleRemoveStep = (index: number) => {
    const updated = assignments.filter((_, i) => i !== index).map((a, i) => ({
      ...a,
      sequence: i + 1
    }));
    setAssignments(updated);
  };

  const handleAssignmentChange = <K extends keyof RuleAssignmentForm>(
    index: number,
    key: K,
    value: RuleAssignmentForm[K],
  ) => {
    const updated = [...assignments];
    updated[index] = { ...updated[index], [key]: value };
    setAssignments(updated);
  };

  const handleSubmit = async () => {
    if (!ruleName.trim()) {
      toast({ title: 'Thiếu tên quy tắc', description: 'Vui lòng nhập tên để dễ nhận biết luồng phê duyệt.', variant: 'warning' });
      return;
    }

    const payload: ApprovalRuleRequestDto = {
      ruleName: ruleName.trim(),
      documentType,
      minAmount: minAmount === '' ? null : Number(minAmount),
      maxAmount: maxAmount === '' ? null : Number(maxAmount),
      slaHours: slaHours === '' ? null : Number(slaHours),
      isActive,
      assignments: assignments.map(a => ({
        sequence: a.sequence,
        approverRole: a.approverRole,
        approverUserId: a.approverUserId || null,
        isRequired: a.isRequired
      }))
    };

    try {
      if (editingRuleId) {
        await updateRule({ id: editingRuleId, body: payload }).unwrap();
        toast({ title: 'Đã cập nhật quy tắc duyệt', variant: 'success' });
      } else {
        await createRule(payload).unwrap();
        toast({ title: 'Đã tạo quy tắc duyệt', variant: 'success' });
      }
      setIsModalOpen(false);
    } catch (err) {
      toast({ title: 'Chưa thể lưu quy tắc', description: formatMutationError(err), variant: 'danger', durationMs: 0 });
    }
  };

  const handleDelete = (id: string) => setDeleteTargetId(id);

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteRule(deleteTargetId).unwrap();
      setDeleteTargetId(null);
      toast({ title: 'Đã xóa quy tắc duyệt', variant: 'success' });
    } catch (err) {
      toast({ title: 'Chưa thể xóa quy tắc', description: formatMutationError(err), variant: 'danger', durationMs: 0 });
    }
  };

  return (
    <OperationalFrame
      eyebrow="Thiết lập vận hành"
      title="Quy tắc phê duyệt"
      description="Quản lý điều kiện, thời hạn và người phụ trách cho từng luồng duyệt."
      command={
        <CommandBar
          actions={
            <button
              onClick={handleOpenCreate}
              className="ipc-button ipc-button-primary"
              type="button"
            >
              <Plus size={16} />
              Thêm quy tắc
            </button>
          }
        >
          <span className="ipc-command-meta">
            <Settings size={16} />
            Quản trị thiết lập quy trình phê duyệt & SLA
          </span>
        </CommandBar>
      }
    >
      <div className="p-4 space-y-6">
        <SectionPanel title="Danh sách các quy tắc phê duyệt" icon={<Layers size={18} />}>
          {isLoadingRules ? (
            <div className="p-8 text-center text-slate-500">Đang tải cấu hình...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-slate-500 italic">Chưa có quy tắc phê duyệt nào được thiết lập.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              {rules.map((rule: ApprovalRuleDto) => (
                <div key={rule.ruleId ?? rule.ruleName} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-slate-800 text-base">{rule.ruleName}</h3>
                      <StatusBadge variant={rule.isActive ? 'success' : 'neutral'}>
                        {rule.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                      </StatusBadge>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <div>Loại chứng từ: <span className="font-semibold text-slate-700">{formatApprovalDocumentType(rule.documentType)}</span></div>
                      <div>SLA xử lý: <span className="font-semibold text-slate-700">{rule.slaHours ? `${rule.slaHours} giờ` : 'Không hạn'}</span></div>
                      {rule.minAmount !== null && (
                        <div className="col-span-2">Ngưỡng tiền: <span className="font-semibold text-slate-700">{rule.minAmount?.toLocaleString('vi-VN')} đ {rule.maxAmount ? ` - ${rule.maxAmount?.toLocaleString('vi-VN')} đ` : ' trở lên'}</span></div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-semibold text-slate-400 mb-2">Trình tự duyệt:</h4>
                      <div className="space-y-1">
                        {(rule.approvalassignments ?? []).map((a: ApprovalAssignmentDto) => (
                          <div key={a.assignmentId ?? `${rule.ruleId}-${a.sequence}-${a.approverRole}`} className="flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">{a.sequence}</span>
                            <span className="font-semibold text-slate-700">{formatApproverRole(a.approverRole)}</span>
                            {a.approverUser && <span className="text-slate-400">({a.approverUser.fullName})</span>}
                            {a.isRequired && <span className="text-[10px] text-red-500 font-semibold bg-red-50 px-1 rounded">Bắt buộc</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEdit(rule)}
                      className="ipc-button ipc-button-ghost py-1 px-2.5 text-xs flex items-center gap-1"
                      type="button"
                    >
                      <Edit2 size={12} />
                      Sửa
                    </button>
                    <button
                      onClick={() => rule.ruleId && handleDelete(rule.ruleId)}
                      disabled={isDeleting || !rule.ruleId}
                      className="ipc-button ipc-button-ghost py-1 px-2.5 text-xs flex items-center gap-1 text-red-600 hover:bg-red-50"
                      type="button"
                    >
                      <Trash2 size={12} />
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>

      {/* Create / Edit Rule Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          aria-label={editingRuleId ? 'Cập nhật quy tắc duyệt' : 'Tạo quy tắc duyệt mới'}
          className="max-w-2xl overflow-y-auto max-h-[85vh]"
        >
          <DialogHeader>
            <DialogTitle>{editingRuleId ? 'Cập nhật quy tắc duyệt' : 'Tạo quy tắc duyệt mới'}</DialogTitle>
            <DialogDescription>
              Cấu hình điều kiện lọc chứng từ, thời gian SLA tối đa và phân rã các bước phê duyệt tuần tự.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="ipc-approval-rule-form-grid grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tên quy tắc</label>
                <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="Ví dụ: Duyệt PR vượt ngưỡng 10M..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Loại chứng từ</label>
                <select
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="purchase-request">Đơn mua thêm (PR)</option>
                  <option value="inventory-issue">Phiếu xuất kho</option>
                  <option value="order-adjustment">Điều chỉnh suất ăn</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Ngưỡng tối thiểu (Min đ)</label>
                <Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Bỏ trống nếu không xét" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Ngưỡng tối đa (Max đ)</label>
                <Input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Bỏ trống nếu không xét" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">SLA phê duyệt (Số giờ)</label>
                <Input type="number" value={slaHours} onChange={e => setSlaHours(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ví dụ: 24" />
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <input type="checkbox" id="rule-active-chk" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <label htmlFor="rule-active-chk" className="text-xs font-semibold text-slate-600 cursor-pointer">Kích hoạt hoạt động</label>
            </div>

            {/* Assignments list */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                  <Shield size={16} />
                  Các bước phê duyệt tuần tự
                </h4>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="ipc-button ipc-button-primary text-xs py-1 px-2.5 flex items-center gap-1"
                >
                  <Plus size={12} />
                  Thêm bước duyệt
                </button>
              </div>

              <div className="space-y-3">
                {assignments.map((assignment, idx) => (
                  <div key={idx} className="flex flex-col items-stretch gap-3 rounded-md border border-slate-100 bg-slate-50/50 p-3 sm:flex-row sm:items-center">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">{assignment.sequence}</span>
                    
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Vai trò phê duyệt</label>
                        <select
                          value={assignment.approverRole}
                          onChange={e => handleAssignmentChange(idx, 'approverRole', e.target.value)}
                          className="w-full h-8 px-2 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          <option value="quanly">Quản lý</option>
                          <option value="beptruong">Bếp trưởng</option>
                          <option value="thumua">Thu mua</option>
                          <option value="thukho">Thủ kho</option>
                        </select>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Nhân viên chỉ định (Tùy chọn)</label>
                        <select
                          value={assignment.approverUserId}
                          onChange={e => handleAssignmentChange(idx, 'approverUserId', e.target.value)}
                          className="w-full h-8 px-2 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          <option value="">Gửi chung cho cả vai trò</option>
                          {employees.map((emp: AdminEmployee) => (
                            <option key={emp.userId} value={emp.userId}>{emp.fullName} ({emp.username})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 sm:flex-col sm:items-center sm:gap-1 sm:pt-4">
                      <input
                        type="checkbox"
                        id={`req-chk-${idx}`}
                        checked={assignment.isRequired}
                        onChange={e => handleAssignmentChange(idx, 'isRequired', e.target.checked)}
                      />
                      <label htmlFor={`req-chk-${idx}`} className="text-[9px] font-semibold text-slate-500 cursor-pointer">Bắt buộc</label>
                    </div>

                    {assignments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="self-end p-1 text-red-500 hover:text-red-700 sm:mt-4 sm:self-auto"
                        title="Xóa bước duyệt này"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="button" onClick={handleSubmit} disabled={isCreating || isUpdating}>Lưu cấu hình</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent aria-label="Xác nhận xóa quy tắc duyệt" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa quy tắc duyệt?</DialogTitle>
            <DialogDescription>
              Quy tắc sẽ không còn được áp dụng cho các chứng từ mới. Hãy xác nhận nếu bạn muốn tiếp tục.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTargetId(null)} disabled={isDeleting}>Hủy</Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Đang xóa...' : 'Xóa quy tắc'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OperationalFrame>
  );
}
