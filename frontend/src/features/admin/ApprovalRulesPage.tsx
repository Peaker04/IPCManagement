import { useState } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Tabs } from '../../components/ui/tabs';
import { adminApi, type ApprovalRuleItem } from '../../api/adminApi';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  'purchase-order': 'Đơn mua hàng PO',
  'material-demand': 'Nhu cầu nguyên liệu',
  'menu-amendment': 'Điều chỉnh thực đơn',
};

export function ApprovalRulesPage() {
  const [activeType, setActiveType] = useState('ALL');
  const query = useWorkbenchQuery<ApprovalRuleItem[]>({
    scopeKey: 'admin_approval_rules',
    cacheKey: 'admin_approval_rules',
    snapshotKey: '',
    queryFn: (_, signal) => adminApi.getApprovalRules(signal),
  });
  const rules = query.data ?? [];
  const loadData = () => query.refetch(true);
  const filteredRules = activeType === 'ALL' ? rules : rules.filter(rule => rule.documentType === activeType);
  const tabs = [
    { id: 'ALL', label: 'Tất cả', count: rules.length },
    ...Object.entries(DOCUMENT_TYPE_LABELS).map(([id, label]) => ({ id, label, count: rules.filter((rule) => rule.documentType === id).length })),
  ];
  const columns: ColumnDef<ApprovalRuleItem>[] = [
    { id: 'id', header: 'Mã quy tắc', width: '15%', cell: (row) => <IdentifierText value={row.ruleId} /> },
    { id: 'name', header: 'Tên quy tắc', width: '25%', cell: (row) => <span className="font-semibold text-slate-900">{row.ruleName}</span> },
    { id: 'type', header: 'Loại chứng từ', width: '16%', cell: (row) => <span>{DOCUMENT_TYPE_LABELS[row.documentType] || row.documentType}</span> },
    { id: 'min', header: 'Giá trị tối thiểu', width: '13%', align: 'right', cell: (row) => row.minAmount == null ? <span>—</span> : <Num value={row.minAmount} format="currency" /> },
    { id: 'max', header: 'Giá trị tối đa', width: '13%', align: 'right', cell: (row) => row.maxAmount == null ? <span>—</span> : <Num value={row.maxAmount} format="currency" /> },
    { id: 'sla', header: 'SLA', width: '8%', align: 'right', cell: (row) => row.slaHours == null ? <span>—</span> : <Num value={row.slaHours} format="quantity" suffix=" giờ" /> },
    { id: 'status', header: 'Trạng thái', width: '10%', align: 'center', cell: (row) => <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">{row.isActive ? 'Hiệu lực' : 'Tạm dừng'}</Badge> },
  ];

  return <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
    <WorkspaceHeader title="Thiết lập quy trình duyệt" breadcrumb="Hệ thống · Quy trình phê duyệt" contextSelectors={<Badge variant="neutral" size="default" className="h-9 px-3">{rules.length} quy tắc phê duyệt hiệu lực</Badge>} actions={<Button variant="outline" size="default" onClick={loadData}>Làm mới</Button>} />
    <TelemetrySubbar leftControls={<Tabs items={tabs} activeId={activeType} onChange={setActiveType} size="sm" />} telemetryPills={<span className="text-slate-500 tabular-nums"><strong className="inline-block min-w-[2ch] text-right font-mono text-slate-900">{filteredRules.length}</strong> quy tắc trong phạm vi</span>} />
    <StateBoundary
      {...query.stateProps}
      onRetry={loadData}
      isEmpty={false}
      emptyScenario="empty-first-use"
      emptyTitle="Chưa có quy tắc phê duyệt"
      emptyDescription="Chưa thiết lập quy tắc phê duyệt cho loại chứng từ này."
      actionLabel="Làm mới quy tắc"
      onAction={loadData}
      contextDomain="approvals"
    >
      <DataGrid
        data={filteredRules}
        columns={columns}
        keyExtractor={(row) => row.ruleId}
        emptyState={
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold text-slate-900">Chưa có quy tắc phê duyệt</p>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">Chưa thiết lập quy tắc phê duyệt cho loại chứng từ này.</p>
            <div className="pt-1">
              <Button variant="outline" size="xs" onClick={loadData}>
                Làm mới quy tắc
              </Button>
            </div>
          </div>
        }
      />
    </StateBoundary>
  </div>;
}
