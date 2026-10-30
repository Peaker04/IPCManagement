import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Layers, Scale, Warehouse, ArrowRight, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { IdentifierText } from '../../components/ui/identifier-text';
import { mrxApi, type MrxBatchSummary, type MrxOperationalSummary } from '../../api/mrxApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { serverStateCache } from '../../store/serverStateCache';
import { toVietnameseDate } from '../../utils/dates';
import type { CustomerOption } from '../../types';

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Lập lô & Nguồn thực đơn',
    desc: 'Khóa định mức BOM và chốt số suất tuần',
    route: '/weekly-menu?view=mrx-batch',
    icon: CalendarDays,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    step: '02',
    title: 'Kho xuất định lượng ngày',
    desc: 'Thực xuất nguyên liệu theo 7 ngày phục vụ',
    route: '/warehouse?view=mrx-daily',
    icon: Warehouse,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  {
    step: '03',
    title: 'Phân rã phiếu nấu Bếp',
    desc: 'Định lượng đóng băng theo ca cho Bếp trưởng',
    route: '/chef?view=mrx-cooking',
    icon: Layers,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
  {
    step: '04',
    title: 'Giám sát đối soát & Quyết toán',
    desc: 'Rà soát chênh lệch, xử lý và chốt lô vĩnh viễn',
    route: '/reconciliation',
    icon: Scale,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
] as const;

const PERIOD_OPTIONS = [
  { value: 'ALL', label: 'Toàn thời gian' },
  { value: 'THIS_YEAR', label: 'Năm nay' },
  { value: 'THIS_MONTH', label: 'Tháng này' },
];

export function ReconciliationDashboardPage() {
  const navigate = useNavigate();

  const cachedSummary = serverStateCache.get<MrxOperationalSummary>('mrx_operational_summary')?.data;
  const cachedCustomers = serverStateCache.get<CustomerOption[]>('catalog_customers')?.data;
  const cachedBatches = serverStateCache.get<MrxBatchSummary[]>('mrx_recent_batches')?.data;

  const [_operationalSummary, setOperationalSummary] = useState<MrxOperationalSummary | null>(() => cachedSummary ?? null);
  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [batches, setBatches] = useState<MrxBatchSummary[]>(() => cachedBatches ?? []);
  const [isLoading, setIsLoading] = useState(!cachedSummary && !cachedBatches);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async (force = false) => {
    if (!force && cachedSummary && cachedBatches) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const [summaryRes, custRes, batchRes] = await Promise.all([
        mrxApi.getOperationalSummary(),
        weeklyMenuApi.getCustomers(),
        mrxApi.getBatchPage({ pageSize: 20 }),
      ]);
      setOperationalSummary(summaryRes);
      setCustomers(custRes);
      setBatches(batchRes.items);
      serverStateCache.set('mrx_operational_summary', summaryRes);
      serverStateCache.set('catalog_customers', custRes);
      serverStateCache.set('mrx_recent_batches', batchRes.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải tổng quan đối soát.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [cachedBatches, cachedSummary]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredBatches = useMemo(() => {
    const now = new Date();
    return batches
      .filter((b) => {
        if (selectedCustomerId !== 'ALL' && b.customerId !== selectedCustomerId) return false;
        const date = new Date(b.weekStartDate);
        if (selectedPeriod === 'THIS_YEAR' && date.getFullYear() !== now.getFullYear()) return false;
        if (selectedPeriod === 'THIS_MONTH' && (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
  }, [batches, selectedCustomerId, selectedPeriod]);

  const customerOptions = useMemo(() => [
    { value: 'ALL', label: 'Tất cả khách hàng' },
    ...customers.map((c) => ({ value: c.customerId, label: `${c.customerCode} - ${c.customerName}` })),
  ], [customers]);

  const totalBatches = filteredBatches.length;
  const awaitingWarehouse = filteredBatches.filter((b) => b.status === 'TRANSFERRED' || b.status === 'READY').length;
  const inProgress = filteredBatches.filter((b) => b.status === 'IN_PROGRESS').length;
  const readyCompletion = filteredBatches.filter((b) => b.status === 'COMPLETED').length;

  const batchColumns = useMemo<ColumnDef<MrxBatchSummary>[]>(() => [
    {
      id: 'batchId',
      header: 'Mã lô đối soát',
      width: '20%',
      minWidth: '150px',
      cell: (row) => <IdentifierText value={row.batchId.slice(0, 10)} />,
    },
    {
      id: 'customer',
      header: 'Khách hàng',
      width: '24%',
      minWidth: '160px',
      cell: (row) => (
        <span className="font-semibold text-slate-900 text-sm truncate">
          {row.customerCode ? `${row.customerCode} · ` : ''}{row.customerName || 'Khách hàng'}
        </span>
      ),
    },
    {
      id: 'week',
      header: 'Tuần bắt đầu',
      width: '18%',
      minWidth: '120px',
      cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.weekStartDate)}</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '18%',
      minWidth: '130px',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'COMPLETED' ? 'neutral' : row.status === 'TRANSFERRED' ? 'info' : 'warning'}
          size="sm"
        >
          {row.status === 'COMPLETED' ? 'Đã quyết toán' : row.status === 'TRANSFERRED' ? 'Chờ Kho xuất' : row.status === 'IN_PROGRESS' ? 'Đang đối chiếu' : row.status}
        </Badge>
      ),
    },
    {
      id: 'action',
      header: 'Thao tác',
      width: '20%',
      minWidth: '140px',
      align: 'right',
      cell: (row) => (
        <Button
          variant="outline"
          size="xs"
          onClick={() => navigate(`/reconciliation?batchId=${encodeURIComponent(row.batchId)}`)}
          className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-50"
        >
          Mở trạm làm việc →
        </Button>
      ),
    },
  ], [navigate]);

  return (
    <WorkspaceFrame.Root className="select-text">
      {/* Zone 1: Workspace Header */}
      <WorkspaceHeader
        title="Bàn điều hành đối soát"
        breadcrumb="Tổng quan MRX · Đài chỉ huy"
        contextSelectors={
          <>
            <Select
              aria-label="Lọc theo khách hàng"
              options={customerOptions}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="h-9 w-64 font-medium text-sm"
            />
            <WorkspaceHeader.BadgeSlot variant="status">
              <Badge variant="info" size="default" className="h-8 px-2.5 text-xs font-semibold whitespace-nowrap">
                Quy trình khép kín
              </Badge>
            </WorkspaceHeader.BadgeSlot>
          </>
        }
        actions={
          <WorkspaceHeader.Actions>
            <Button
              variant="outline"
              size="default"
              onClick={() => void loadData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={clsx('transition-transform', isRefreshing && 'animate-spin')} aria-hidden="true" />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="default"
              size="default"
              onClick={() => navigate('/weekly-menu?view=mrx-batch')}
              className="h-9 font-medium"
            >
              Lập lô đối soát mới
            </Button>
          </WorkspaceHeader.Actions>
        }
      />

      {/* Zone 2: TelemetrySubbar */}
      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">Kỳ thời gian:</span>
            <Select
              aria-label="Kỳ thời gian"
              options={PERIOD_OPTIONS}
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-7 text-xs w-36 font-medium"
            />
          </div>
        }
        telemetryPills={
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-500">Tổng số lô:</span>
            <strong className="text-slate-900 font-mono font-bold">{filteredBatches.length} lô</strong>
          </span>
        }
      />

      {/* Zone 3: Executive Canvas */}
      <WorkspaceFrame.Body className="p-4 sm:p-5 space-y-5 overflow-y-auto">
        {/* 4 Executive KPI Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0" aria-label="Chỉ số điều hành đối soát">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-slate-500 block">Đổi nguồn chờ duyệt</span>
            <div className="mt-1 text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {totalBatches}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-slate-500 block">Lô chờ Kho xuất</span>
            <div className="mt-1 text-2xl font-bold font-mono tracking-tight text-amber-700 tabular-nums">
              {awaitingWarehouse}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-slate-500 block">Dòng lệch cần xử lý</span>
            <div className="mt-1 text-2xl font-bold font-mono tracking-tight text-sky-700 tabular-nums">
              {inProgress}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-slate-500 block">Lô sẵn sàng chốt</span>
            <div className="mt-1 text-2xl font-bold font-mono tracking-tight text-emerald-700 tabular-nums">
              {readyCompletion}
            </div>
          </div>
        </div>

        {/* 4-Step Interactive Pipeline Cards */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs shrink-0">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            Sơ đồ quy trình đối chiếu 4 bước
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.step}
                  type="button"
                  onClick={() => navigate(step.route)}
                  className="rounded-lg border border-slate-200 hover:border-blue-400 p-3 flex flex-col justify-between text-left hover:bg-slate-50/70 transition-all duration-150 cursor-pointer group"
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      BƯỚC {step.step}
                    </span>
                    <div className={clsx('size-7 rounded-md border flex items-center justify-center shrink-0', step.color)}>
                      <Icon size={14} aria-hidden="true" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 flex items-center justify-between">
                      <span>{step.title}</span>
                      <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Batches DataGrid */}
        <div className="rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-slate-900">
              Danh sách các lô đối soát đang vận hành
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Hiển thị {filteredBatches.length} lô gần nhất
            </span>
          </div>
          <StateBoundary
            isLoading={isLoading}
            hasExistingData={batches.length > 0}
            error={error}
            onRetry={() => void loadData(true)}
            isEmpty={!isLoading && !error && filteredBatches.length === 0}
            emptyTitle="Chưa có lô đối soát nào"
            emptyDescription="Bấm nút 'Lập lô đối soát mới' ở phía trên để bắt đầu tạo lô đối soát cho tuần tới."
          >
            <DataGrid<MrxBatchSummary>
              data={filteredBatches}
              columns={batchColumns}
              keyExtractor={(row) => row.batchId}
            />
          </StateBoundary>
        </div>
      </WorkspaceFrame.Body>
    </WorkspaceFrame.Root>
  );
}
