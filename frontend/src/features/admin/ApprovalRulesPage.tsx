import { useState, useEffect, useMemo } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Tabs } from '../../components/ui/tabs';
import { Modal } from '../../components/ui/modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import {
  adminApi,
  type ApprovalRuleItem,
} from '../../api/adminApi';

export function ApprovalRulesPage() {
  const [rules, setRules] = useState<ApprovalRuleItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Rule Modal
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [ruleCode, setRuleCode] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [targetType, setTargetType] = useState('purchase-order');
  const [thresholdAmount, setThresholdAmount] = useState(20000000);
  const [approverRole, setApproverRole] = useState('QuanLyThuMua');
  const [slaHours, setSlaHours] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await adminApi.getApprovalRules();
      setRules(resp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải quy tắc phê duyệt.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const resp = await adminApi.getApprovalRules();
        if (!ignore) {
          setRules(resp);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải quy tắc phê duyệt.');
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateRule = async () => {
    if (!ruleCode || !ruleName) {
      alert('Vui lòng nhập đầy đủ mã và tên quy tắc phê duyệt');
      return;
    }
    setIsSubmitting(true);
    try {
      await adminApi.createApprovalRule({
        ruleCode,
        ruleName,
        targetType,
        thresholdAmount,
        approverRole,
        slaHours,
      });
      setIsNewRuleOpen(false);
      setRuleCode('');
      setRuleName('');
      await loadData();
      alert('Đã thiết lập quy tắc phê duyệt mới thành công!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Thêm quy tắc thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRules = useMemo(() => {
    if (activeTab === 'ALL') return rules;
    return rules.filter((r) => r.targetType === activeTab);
  }, [rules, activeTab]);

  const TAB_ITEMS = [
    { id: 'ALL', label: 'Tất cả quy tắc', count: rules.length },
    { id: 'purchase-order', label: 'Đơn mua hàng PO', count: rules.filter((r) => r.targetType === 'purchase-order').length },
    { id: 'material-demand', label: 'Nhu cầu vật tư', count: rules.filter((r) => r.targetType === 'material-demand').length },
    { id: 'menu-amendment', label: 'Đổi thực đơn', count: rules.filter((r) => r.targetType === 'menu-amendment').length },
  ];

  const columns: ColumnDef<ApprovalRuleItem>[] = [
    {
      id: 'code',
      header: 'Mã quy tắc',
      width: '18%',
      cell: (row) => <IdentifierText value={row.ruleCode} />,
    },
    {
      id: 'name',
      header: 'Tên quy tắc phê duyệt',
      width: '32%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.ruleName}</span>,
    },
    {
      id: 'type',
      header: 'Phạm vi áp dụng',
      width: '18%',
      cell: (row) => (
        <span className="text-slate-600 text-sm">
          {row.targetType === 'purchase-order'
            ? 'Đơn mua hàng PO'
            : row.targetType === 'material-demand'
            ? 'Nhu cầu nguyên liệu'
            : row.targetType === 'menu-amendment'
            ? 'Điều chỉnh thực đơn'
            : row.targetType}
        </span>
      ),
    },
    {
      id: 'threshold',
      header: 'Ngưỡng giá trị duyệt',
      width: '18%',
      align: 'right',
      cell: (row) => <Num value={row.thresholdAmount} format="currency" className="font-bold text-slate-900 text-sm" />,
    },
    {
      id: 'role',
      header: 'Vai trò thẩm định',
      width: '18%',
      cell: (row) => <span className="font-medium text-slate-800 text-sm">{row.approverRole}</span>,
    },
    {
      id: 'sla',
      header: 'Thời hạn SLA',
      width: '12%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.slaHours} giờ</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">
          {row.isActive ? 'Hiệu lực' : 'Đang tạm dừng'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Thiết lập quy trình duyệt"
        contextSelectors={
          <Badge variant="neutral" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
            {rules.length} quy tắc phân quyền tự động
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={loadData}
              className="h-9 text-sm font-medium"
            >
              Làm mới
            </Button>
            {/* Rule D7: Single primary button */}
            <Button
              variant="default"
              size="default"
              onClick={() => setIsNewRuleOpen(true)}
              className="h-9 text-sm font-medium"
            >
              Thêm quy tắc duyệt
            </Button>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={TAB_ITEMS}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id)}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Quy tắc hiệu lực:</span>
              <strong className="text-slate-900 font-mono font-bold">{filteredRules.length}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Ngưỡng tối đa:</span>
              <strong className="text-slate-900 font-mono font-bold">50.000.000 ₫</strong>
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="success" size="sm">
              SLA nhanh nhất: 2 giờ
            </Badge>
          </>
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={loadData}
        isEmpty={filteredRules.length === 0}
      >
        <DataGrid<ApprovalRuleItem>
          data={filteredRules}
          columns={columns}
          keyExtractor={(row) => row.ruleId}
        />
      </StateBoundary>

      {/* New Rule Modal */}
      <Modal
        isOpen={isNewRuleOpen}
        onClose={() => setIsNewRuleOpen(false)}
        title="Thêm quy tắc phê duyệt mới"
        description="Cấu hình ma trận phê duyệt thẩm định tự động theo giá trị và đối tượng"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsNewRuleOpen(false)}>
              Hủy bỏ
            </Button>
            <Button variant="default" size="sm" disabled={isSubmitting} onClick={handleCreateRule}>
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận tạo'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Mã quy tắc</label>
            <Input
              placeholder="Ví dụ: RULE-PO-CRITICAL"
              value={ruleCode}
              onChange={(e) => setRuleCode(e.target.value)}
              className="h-9 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Tên quy tắc phê duyệt</label>
            <Input
              placeholder="Ví dụ: Duyệt đơn PO vượt hạn mức ngân sách"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Đối tượng phê duyệt</label>
              <Select
                options={[
                  { value: 'purchase-order', label: 'Đơn mua hàng PO' },
                  { value: 'material-demand', label: 'Nhu cầu nguyên liệu' },
                  { value: 'menu-amendment', label: 'Điều chỉnh thực đơn' },
                ]}
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Ngưỡng giá trị duyệt (₫)</label>
              <Input
                type="number"
                value={thresholdAmount}
                onChange={(e) => setThresholdAmount(parseFloat(e.target.value) || 0)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Vai trò phê duyệt</label>
              <Select
                options={[
                  { value: 'GiamDocDieuHanh', label: 'Giám đốc điều hành' },
                  { value: 'QuanLyThuMua', label: 'Quản lý thu mua' },
                  { value: 'QuanLySanXuat', label: 'Quản lý sản xuất' },
                  { value: 'KeToanTruong', label: 'Kế toán trưởng' },
                ]}
                value={approverRole}
                onChange={(e) => setApproverRole(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Thời hạn SLA (giờ)</label>
              <Input
                type="number"
                value={slaHours}
                onChange={(e) => setSlaHours(parseInt(e.target.value, 10) || 4)}
                className="h-9 font-mono"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
