import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { chefApi, type ChefDashboardData, type ChefIssueItem, type ChefPlanLineItem } from '../../api/chefApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';
import { formatVietnameseDate } from '../../utils/dates';
import { MrxCookingWorkbench } from './MrxCookingWorkbench';

const SHIFT_OPTIONS = [
  { value: 'MORNING', label: 'Ca 1 (Sáng)' },
  { value: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
];

function todayInBusinessTimezone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const ISSUE_PAGE_SIZE = 25;

export function ChefDashboardPage() {
  const { operationalMode } = useAuth();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  if (!view && operationalMode === 'MATERIAL_RECONCILIATION') {
    const batchId = searchParams.get('batchId');
    const params = new URLSearchParams();
    params.set('view', 'mrx-cooking');
    if (batchId) params.set('batchId', batchId);
    return <Navigate to={`/chef?${params.toString()}`} replace />;
  }

  if (view === 'mrx-cooking') {
    return <MrxCookingWorkbench />;
  }
  return <DefaultChefDashboardPage />;
}

function DefaultChefDashboardPage() {
  const [searchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'issues' ? 'issues' : 'plans';
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [serviceDate, setServiceDate] = useState(todayInBusinessTimezone);
  const [shiftName, setShiftName] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [issuePageNumber, setIssuePageNumber] = useState(1);
  const [data, setData] = useState<ChefDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers()
      .then((list) => {
        if (ignore) return;
        setCustomers(list);
        setCustomerId((current) => current || list[0]?.customerId || '');
        if (list.length === 0) setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
          setIsLoading(false);
        }
      });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const sequence = ++requestSequence.current;
    chefApi.getChefDashboardData(serviceDate, shiftName, customerId, issuePageNumber, ISSUE_PAGE_SIZE)
      .then((result) => {
        if (sequence === requestSequence.current) setData(result);
      })
      .catch((cause: unknown) => {
        if (sequence === requestSequence.current) {
          setData(null);
          setError(cause instanceof Error ? cause : new Error('Không thể tải dữ liệu bàn giao Bếp.'));
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) setIsLoading(false);
      });
  }, [serviceDate, shiftName, customerId, issuePageNumber]);

  const reload = () => {
    if (!customerId) return;
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    chefApi.getChefDashboardData(serviceDate, shiftName, customerId, issuePageNumber, ISSUE_PAGE_SIZE)
      .then((result) => {
        if (sequence === requestSequence.current) setData(result);
      })
      .catch((cause: unknown) => {
        if (sequence === requestSequence.current) setError(cause instanceof Error ? cause : new Error('Không thể tải dữ liệu bàn giao Bếp.'));
      })
      .finally(() => {
        if (sequence === requestSequence.current) setIsLoading(false);
      });
  };

  const handleConfirmReceipt = async (issueId: string) => {
    try {
      await chefApi.confirmIssueReceipt(issueId, false);
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể xác nhận nhận hàng tại bếp.'));
    }
  };

  const planColumns: ColumnDef<ChefPlanLineItem>[] = [
    { id: 'code', header: 'Mã KHSX', width: '16%', cell: (row) => <IdentifierText value={row.planCode} /> },
    { id: 'dish', header: 'Tên món ăn', width: '30%', cell: (row) => <span className="font-semibold text-slate-900">{row.dishName}</span> },
    { id: 'shift', header: 'Ca sản xuất', width: '14%', cell: (row) => <span>{row.shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : row.shiftName === 'AFTERNOON' ? 'Ca 2 (Chiều)' : row.shiftName}</span> },
    { id: 'servings', header: 'Số suất kế hoạch', width: '14%', align: 'right', cell: (row) => <Num value={row.plannedServings} format="quantity" suffix=" suất" /> },
    { id: 'date', header: 'Ngày phục vụ', width: '13%', cell: (row) => <span className="font-mono text-xs">{formatVietnameseDate(row.serviceDate)}</span> },
    { id: 'status', header: 'Bàn giao Bếp', width: '13%', align: 'center', cell: (row) => <Badge variant={row.sentToKitchenAt ? 'info' : 'neutral'} size="sm">{row.sentToKitchenAt ? 'Đã gửi Bếp' : 'Chưa gửi'}</Badge> },
  ];

  const issueColumns: ColumnDef<ChefIssueItem>[] = [
    { id: 'code', header: 'Mã phiếu xuất', width: '16%', cell: (row) => <IdentifierText value={row.issueCode} /> },
    { id: 'date', header: 'Ngày xuất', width: '13%', cell: (row) => <span className="font-mono text-xs">{formatVietnameseDate(row.issueDate)}</span> },
    { id: 'warehouse', header: 'Kho xuất', width: '22%', cell: (row) => <span>{row.warehouseName}</span> },
    { id: 'lines', header: 'Dòng vật tư', width: '13%', align: 'right', cell: (row) => <Num value={row.lines.length} format="quantity" suffix=" dòng" /> },
    { id: 'quantity', header: 'Tổng thực xuất', width: '14%', align: 'right', cell: (row) => <Num value={row.lines.reduce((sum, line) => sum + line.issuedQty, 0)} format="quantity" /> },
    { id: 'received', header: 'Bếp xác nhận', width: '10%', align: 'center', cell: (row) => <Badge variant={row.receivedAt ? 'success' : 'warning'} size="sm">{row.receivedAt ? 'Đã nhận' : 'Chờ xác nhận'}</Badge> },
    {
      id: 'action',
      header: 'Thao tác',
      width: '12%',
      align: 'right',
      cell: (row) =>
        row.receivedAt ? (
          <span className="text-emerald-700 text-xs font-semibold">✓ Đã nhận</span>
        ) : (
          <Button
            variant="outline"
            size="xs"
            onClick={() => void handleConfirmReceipt(row.issueId)}
            className="h-6 px-2 text-xs"
          >
            Nhận hàng
          </Button>
        ),
    },
  ];

  const activeData = activeView === 'issues' ? data?.issues || [] : data?.plans || [];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Bếp trưởng & Bàn giao ca"
        contextSelectors={
          <>
            <Select
              aria-label="Chọn khách hàng"
              options={customers.map((customer) => ({ value: customer.customerId, label: `${customer.customerCode} - ${customer.customerName}` }))}
              value={customerId}
              onChange={(event) => { setIsLoading(true); setError(null); setIssuePageNumber(1); setCustomerId(event.target.value); }}
              disabled={customers.length === 0}
              className="h-9 w-64 font-medium text-sm"
            />
            <VietnameseDateInput aria-label="Ngày phục vụ" value={serviceDate} onChange={(date) => { setIsLoading(true); setError(null); setIssuePageNumber(1); setServiceDate(date); }} className="h-9 w-40 font-mono text-sm" />
            <Select aria-label="Chọn ca sản xuất" options={SHIFT_OPTIONS} value={shiftName} onChange={(event) => { setIsLoading(true); setError(null); setIssuePageNumber(1); setShiftName(event.target.value as 'MORNING' | 'AFTERNOON'); }} className="h-9 w-36 font-medium text-sm" />
          </>
        }
        actions={<Button variant="outline" size="default" onClick={reload} className="h-9 text-sm font-medium">Làm mới</Button>}
      />

      <TelemetrySubbar
        leftControls={<span className="text-xs font-semibold text-slate-700">Đang xem: {activeView === 'issues' ? 'Phiếu xuất bàn giao' : 'Kế hoạch sản xuất'}</span>}
        telemetryPills={data ? (
          <>
            <span className="inline-flex items-center gap-1"><span className="text-slate-500">KHSX:</span><strong className="font-mono">{data.totalPlans}</strong></span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1"><span className="text-slate-500">Đã gửi Bếp:</span><strong className="font-mono">{data.sentPlans}</strong></span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1"><span className="text-slate-500">Tổng suất:</span><strong className="font-mono">{data.totalServings}</strong></span>
          </>
        ) : null}
      />

      <StateBoundary
        isLoading={isLoading}
        isFetching={isLoading}
        hasExistingData={Boolean(data && activeData.length > 0)}
        error={error}
        onRetry={reload}
        isEmpty={Boolean(data && activeData.length === 0)}
        emptyScenario="prerequisite-blocked"
        emptyTitle={activeView === 'issues' ? 'Chưa có phiếu xuất bàn giao' : 'Chưa có kế hoạch sản xuất'}
        emptyDescription={activeView === 'issues' ? 'Kho chưa phát hành phiếu xuất cho ngày, ca và khách hàng đã chọn.' : 'Chưa có KHSX được duyệt cho ngày, ca và khách hàng đã chọn.'}
      >
        {data && activeView === 'plans' && <DataGrid data={data.plans} columns={planColumns} keyExtractor={(row) => row.planLineId} />}
        {data && activeView === 'issues' && <DataGrid data={data.issues} columns={issueColumns} keyExtractor={(row) => row.issueId} />}
      </StateBoundary>
      {data && activeView === 'issues' && data.issuePage.totalPages > 1 && (
        <nav aria-label="Phân trang phiếu xuất" className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2">
          <span className="text-xs text-slate-500">Trang {data.issuePage.pageNumber}/{data.issuePage.totalPages}</span>
          <Button variant="outline" size="xs" disabled={!data.issuePage.hasPrev || isLoading} onClick={() => { setIsLoading(true); setError(null); setIssuePageNumber((page) => page - 1); }}>Trang trước</Button>
          <Button variant="outline" size="xs" disabled={!data.issuePage.hasNext || isLoading} onClick={() => { setIsLoading(true); setError(null); setIssuePageNumber((page) => page + 1); }}>Trang sau</Button>
        </nav>
      )}
    </div>
  );
}
