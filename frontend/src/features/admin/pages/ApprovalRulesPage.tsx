import { useState } from 'react';
import { Settings, Plus, Edit2, Trash2, Shield, Layers } from 'lucide-react';
import {
  OperationalFrame,
  SectionPanel,
  CommandBar,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  QueryErrorAlert,
  StatusBadge,
  useToast,
} from '@/components/common';
import { useGetApprovalRulesQuery, useCreateApprovalRuleMutation, useUpdateApprovalRuleMutation, useDeleteApprovalRuleMutation } from '@/features/admin/adminWorkflowApi';
import type { ApprovalAssignmentDto, ApprovalRuleDto, ApprovalRuleRequestDto } from '@/api/workflowApiTypes';
import { useGetAdminEmployeesQuery, type AdminEmployee } from '@/features/admin/adminApi';
import { formatCurrency } from '@/lib/formatters';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toQueryView } from '@/lib/queryView';

interface RuleAssignmentForm {
  sequence: number;
  approverRole: string;
  approverUserId: string;
  isRequired: boolean;
}

const EMPTY_APPROVER_USER_VALUE = '__empty_approver_user__';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleNameError, setRuleNameError] = useState<{ title: string; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [ruleName, setRuleName] = useState('');
  const [documentType, setDocumentType] = useState('purchase-request');
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');
  const [slaHours, setSlaHours] = useState<number | ''>(24);
  const [isActive, setIsActive] = useState(true);
  const [assignments, setAssignments] = useState<RuleAssignmentForm[]>([
    { sequence: 1, approverRole: 'quanly', approverUserId: '', isRequired: true }
  ]);

  const rulesQuery = useGetApprovalRulesQuery();
  const rulesView = toQueryView(rulesQuery, {
    instruction: 'Mở trang thiết lập duyệt để tải quy tắc phê duyệt.',
    retry: () => rulesQuery.refetch(),
    errorMessage: 'Không tải được quy tắc phê duyệt.',
    forbiddenMessage: 'Bạn không có quyền xem quy tắc phê duyệt.',
  });
  const rules = rulesView.phase === 'ready' ? rulesView.data.data ?? [] : [];

  const employeesQuery = useGetAdminEmployeesQuery({ pageNumber: 1, pageSize: 200 }, { skip: !isModalOpen });
  const employeesView = toQueryView(employeesQuery, {
    instruction: 'Mở biểu mẫu quy tắc để tải danh sách nhân viên.',
    retry: () => employeesQuery.refetch(),
    errorMessage: 'Không tải được danh sách nhân viên chỉ định.',
    forbiddenMessage: 'Bạn không có quyền xem danh sách nhân viên chỉ định.',
    getTruncation: (response) => {
      const page = response.data;
      return page && page.items.length < page.totalCount
        ? { shown: page.items.length, total: page.totalCount }
        : null;
    },
  });
  const employees = employeesView.phase === 'ready' ? employeesView.data.data?.items ?? [] : [];

  const [createRule, { isLoading: isCreating }] = useCreateApprovalRuleMutation();
  const [updateRule, { isLoading: isUpdating }] = useUpdateApprovalRuleMutation();
  const [deleteRule, { isLoading: isDeleting }] = useDeleteApprovalRuleMutation();

  const handleOpenCreate = () => {
    setRuleNameError(null);
    setSaveError(null);
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

    setRuleNameError(null);
    setSaveError(null);
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
    setRuleNameError(null);
    setSaveError(null);
    if (!ruleName.trim()) {
      setRuleNameError({ title: 'Thiếu tên quy tắc', message: 'Vui lòng nhập tên để dễ nhận biết luồng phê duyệt.' });
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
      setSaveError(formatMutationError(err));
    }
  };

  const handleDelete = (id: string) => {
    setDeleteError(null);
    setDeleteTargetId(id);
  };


  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteRule(deleteTargetId).unwrap();
      setDeleteTargetId(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(formatMutationError(err));
    }
  };

  return (
    <OperationalFrame
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
            Quản trị thiết lập quy trình phê duyệt và thời hạn xử lý
          </span>
        </CommandBar>
      }
    >
      <div className="p-4 space-y-6">
        <SectionPanel title="Danh sách các quy tắc phê duyệt" icon={<Layers size={18} />}>
          {rulesView.phase === 'forbidden' ? (
            <InlineAlert title="Không có quyền xem quy tắc phê duyệt" variant="danger">
              <span role="alert">{rulesView.message}</span>
            </InlineAlert>
          ) : rulesView.phase === 'error' ? (
            <QueryErrorAlert
              title="Không tải được quy tắc phê duyệt"
              isRetrying={rulesView.isRetrying}
              onRetry={rulesView.retry}
            >
              Chưa thể phân biệt lỗi kết nối với trường hợp chưa cấu hình quy tắc. Hãy thử tải lại trước khi tạo hoặc sửa luồng duyệt.
            </QueryErrorAlert>
          ) : rulesView.phase === 'uninitialized' ? (
            <InlineAlert title="Chưa khởi tạo quy tắc phê duyệt" variant="info">{rulesView.instruction}</InlineAlert>
          ) : rulesView.phase === 'loading' ? (
            <div className="p-8 text-center text-slate-500">Đang tải cấu hình...</div>
          ) : (
            <>
              {rulesView.isRefreshing && (
                <InlineAlert title="Đang cập nhật quy tắc phê duyệt" variant="info">
                  Danh sách hiện tại vẫn được giữ trong khi đồng bộ bản mới.
                </InlineAlert>
              )}
              {rules.length === 0 ? (
                <EmptyState
                  icon={<Layers className="size-12 text-slate-400" />}
                  title="Chưa có quy tắc phê duyệt nào được thiết lập."
                  description="Nhấn nút '+ Thêm quy tắc' ở thanh điều khiển trên để thiết lập quy trình phê duyệt."
                  className="!min-h-0 !p-8"
                />
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
                      <div>Thời hạn xử lý (SLA): <span className="font-semibold text-slate-700">{rule.slaHours ? `${rule.slaHours} giờ` : 'Không hạn'}</span></div>
                      {rule.minAmount !== null && (
                        <div className="col-span-2">Ngưỡng tiền: <span className="font-semibold text-slate-700">{rule.minAmount === undefined ? '' : formatCurrency(rule.minAmount)} {rule.maxAmount ? ` - ${formatCurrency(rule.maxAmount)}` : ' trở lên'}</span></div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-semibold text-slate-700 mb-2">Trình tự duyệt:</h4>
                      <div className="space-y-1">
                        {(rule.approvalassignments ?? []).map((a: ApprovalAssignmentDto) => (
                          <div key={a.assignmentId ?? `${rule.ruleId}-${a.sequence}-${a.approverRole}`} className="flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">{a.sequence}</span>
                            <span className="font-semibold text-slate-700">{formatApproverRole(a.approverRole)}</span>
                            {a.approverUser && <span className="text-slate-700">({a.approverUser.fullName})</span>}
                            {a.isRequired && <span className="text-[10px] text-red-700 font-semibold bg-red-50 px-1 rounded">Bắt buộc</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-slate-100">
                    <Button
                      onClick={() => handleOpenEdit(rule)}
                      variant="outline"
                      size="xs"
                      type="button"
                    >
                      <Edit2 size={12} />
                      Sửa
                    </Button>
                    <Button
                      onClick={() => rule.ruleId && handleDelete(rule.ruleId)}
                      disabled={isDeleting || !rule.ruleId}
                      variant="destructive"
                      size="xs"
                      type="button"
                    >
                      <Trash2 size={12} />
                      Xóa
                    </Button>
                  </div>
                </div>
              ))}
                </div>
              )}
            </>
          )}
        </SectionPanel>
      </div>

      {/* Create / Edit Rule Dialog */}
      {isModalOpen && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent
            aria-label={editingRuleId ? 'Cập nhật quy tắc duyệt' : 'Tạo quy tắc duyệt mới'}
            className="max-w-2xl overflow-y-auto max-h-[85vh]"
          >
            <DialogHeader>
              <DialogTitle>{editingRuleId ? 'Cập nhật quy tắc duyệt' : 'Tạo quy tắc duyệt mới'}</DialogTitle>
              <DialogDescription>
                Cấu hình điều kiện lọc chứng từ, thời hạn xử lý tối đa (SLA) và phân rã các bước phê duyệt tuần tự.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="ipc-approval-rule-form-grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="approval-rule-name" className="text-xs font-semibold text-slate-600">Tên quy tắc</label>
                  <Input
                    id="approval-rule-name"
                    value={ruleName}
                    aria-invalid={Boolean(ruleNameError) || undefined}
                    aria-describedby={ruleNameError ? 'approval-rule-name-error' : undefined}
                    onChange={(event) => {
                      setRuleName(event.target.value);
                      setRuleNameError(null);
                    }}
                    placeholder="Ví dụ: Duyệt PR vượt ngưỡng 10M..."
                  />
                  {ruleNameError && (
                    <p id="approval-rule-name-error" className="text-xs text-red-700">
                      <span className="font-semibold">{ruleNameError.title}</span>{' '}{ruleNameError.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Loại chứng từ</label>
                  <Select
                    value={documentType}
                    onValueChange={value => setDocumentType(value ?? '')}
                    >
                      <SelectTrigger className="h-10 w-full">
                      <SelectValue>{documentType === 'purchase-request' ? 'Đơn mua thêm (PR)' : formatApprovalDocumentType(documentType)}</SelectValue>
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase-request">Đơn mua thêm (PR)</SelectItem>
                      <SelectItem value="inventory-issue">Phiếu xuất kho</SelectItem>
                      <SelectItem value="order-adjustment">Điều chỉnh suất ăn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Ngưỡng tối thiểu (Min đ)</label>
                  <Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Không xét" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Ngưỡng tối đa (Max đ)</label>
                  <Input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Không xét" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Thời hạn phê duyệt (giờ)</label>
                  <Input type="number" value={slaHours} onChange={e => setSlaHours(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Mặc định: 24" />
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
                  <Button
                    type="button"
                    onClick={handleAddStep}
                    size="xs"
                  >
                    <Plus size={12} />
                    Thêm bước duyệt
                  </Button>
                </div>

                {employeesView.phase === 'forbidden' ? (
                  <InlineAlert title="Không có quyền xem nhân viên chỉ định" variant="danger">
                    <span role="alert">{employeesView.message}</span>
                  </InlineAlert>
                ) : employeesView.phase === 'error' ? (
                  <QueryErrorAlert
                    title="Không tải được nhân viên chỉ định"
                    isRetrying={employeesView.isRetrying}
                    onRetry={employeesView.retry}
                  >
                    Vẫn có thể chọn vai trò chung, nhưng chưa thể chọn một nhân viên cụ thể.
                  </QueryErrorAlert>
                ) : employeesView.phase === 'uninitialized' ? (
                  <InlineAlert title="Chưa khởi tạo danh sách nhân viên" variant="info">{employeesView.instruction}</InlineAlert>
                ) : employeesView.phase === 'loading' ? (
                  <InlineAlert title="Đang tải nhân viên chỉ định" variant="info">Danh sách nhân viên đang được đồng bộ.</InlineAlert>
                ) : employeesView.phase === 'ready' ? (
                  <>
                    {employeesView.isRefreshing && (
                      <InlineAlert title="Đang cập nhật nhân viên" variant="info">Các lựa chọn hiện tại vẫn được giữ.</InlineAlert>
                    )}
                    {employeesView.truncation && (
                      <InlineAlert title="Danh sách nhân viên bị giới hạn" variant="warning">
                        Đang hiển thị {employeesView.truncation.shown}/{employeesView.truncation.total ?? '?'} nhân viên. Hãy thu hẹp phạm vi trước khi chỉ định.
                      </InlineAlert>
                    )}
                  </>
                ) : null}

                <div className="space-y-3">
                  {assignments.map((assignment, idx) => (
                    <div key={idx} className="flex flex-col items-stretch gap-3 rounded-md border border-slate-100 bg-slate-50/50 p-3 sm:flex-row sm:items-center">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">{assignment.sequence}</span>
                      
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Vai trò phê duyệt</label>
                          <Select
                            value={assignment.approverRole}
                            onValueChange={value => handleAssignmentChange(idx, 'approverRole', value ?? '')}
                            >
                              <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue>{formatApproverRole(assignment.approverRole)}</SelectValue>
                              </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quanly">Quản lý</SelectItem>
                              <SelectItem value="beptruong">Bếp trưởng</SelectItem>
                              <SelectItem value="thumua">Thu mua</SelectItem>
                              <SelectItem value="thukho">Thủ kho</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Nhân viên chỉ định (Tùy chọn)</label>
                          <Select
                            value={assignment.approverUserId || EMPTY_APPROVER_USER_VALUE}
                            onValueChange={value => handleAssignmentChange(
                              idx,
                              'approverUserId',
                              !value || value === EMPTY_APPROVER_USER_VALUE ? '' : value,
                            )}
                            disabled={employeesView.phase !== 'ready'}
                            >
                              <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue>{formatApproverUser(assignment.approverUserId, employees)}</SelectValue>
                              </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={EMPTY_APPROVER_USER_VALUE}>Gửi chung cho cả vai trò</SelectItem>
                              {employees.map((emp: AdminEmployee) => (
                                <SelectItem key={emp.userId} value={emp.userId}>{emp.fullName} ({emp.username})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                        <Button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          variant="destructive"
                          size="icon-xs"
                          className="self-end sm:mt-4 sm:self-auto"
                          title="Xóa bước duyệt này"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {saveError && <div role="alert"><InlineAlert title="Chưa thể lưu quy tắc" variant="danger">{saveError}</InlineAlert></div>}
            </div>

            <DialogFooter className="gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
              <Button type="button" onClick={handleSubmit} disabled={isCreating || isUpdating}>Lưu cấu hình</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteTargetId !== null && (
        <ConfirmDialog
          open={deleteTargetId !== null}
          ariaLabel="Xác nhận xóa quy tắc duyệt"
          title="Xóa quy tắc duyệt?"
          description={deleteError
            ? `Quy tắc sẽ không còn được áp dụng cho các chứng từ mới. Hãy xác nhận nếu bạn muốn tiếp tục. Chưa thể xóa quy tắc. ${deleteError}`
            : 'Quy tắc sẽ không còn được áp dụng cho các chứng từ mới. Hãy xác nhận nếu bạn muốn tiếp tục.'}
          confirmLabel="Xóa quy tắc"
          busy={isDeleting}
          busyLabel="Đang xóa..."
          onConfirm={handleConfirmDelete}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTargetId(null);
              setDeleteError(null);
            }
          }}
        />
      )}
    </OperationalFrame>
  );
}

const formatApproverUser = (userId: string, employees: readonly AdminEmployee[]) => {
  const employee = employees.find((item) => item.userId === userId);
  return employee ? `${employee.fullName} (${employee.username})` : 'Gửi chung cho cả vai trò';
};
