import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Modal } from '../../components/ui/modal';
import { ActionGuard } from '../../components/ui/action-guard';
import { ApiError } from '../../api/client';
import {
  reconciliationApi,
  type ReconciliationBatchSummary,
  type ReconciliationLineItem,
} from '../../api/reconciliationApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';

function todayInBusinessTimezone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Đang chuẩn bị',
  READY: 'Chờ Kho xuất',
  TRANSFERRED: 'Đã khóa',
  IN_PROGRESS: 'Đang đối chiếu',
  COMPLETED: 'Hoàn tất',
  WEEK_COMPLETE: 'Đủ điều kiện hoàn tất tuần',
};

export function ReconciliationPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin') || hasRole('ADMIN');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerCode, setCustomerCode] = useState('');
  const [serviceDate, setServiceDate] = useState(todayInBusinessTimezone);
  const [data, setData] = useState<ReconciliationBatchSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi
      .getCustomers()
      .then((list) => {
        if (ignore) return;
        setCustomers(list);
        setCustomerCode((current) => current || list[0]?.customerCode || '');
      })
      .catch((cause: unknown) => {
        if (!ignore) setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
      });
    return () => {
      ignore = true;
    };
  }, []);

  const loadData = async (date = serviceDate, customer = customerCode) => {
    if (!customer) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setData(await reconciliationApi.getReconciliationSummary(date, customer));
    } catch (cause: unknown) {
      setData(null);
      setError(cause instanceof Error ? cause : new Error('Không thể tải lô đối soát nguyên liệu.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!customerCode) return;
    let ignore = false;
    reconciliationApi
      .getReconciliationSummary(serviceDate, customerCode)
      .then((result) => {
        if (!ignore) setData(result);
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setData(null);
          setError(cause instanceof Error ? cause : new Error('Không thể tải lô đối soát nguyên liệu.'));
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [serviceDate, customerCode]);

  const canComplete = data?.status === 'IN_PROGRESS' && data.weeklyStatus === 'WEEK_COMPLETE';

  const handleComplete = async () => {
    if (!data || !canComplete) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      const completed = await reconciliationApi.completeReconciliation(data.batchId, data.version);
      setData(completed);
      setMutationError(null);
      setIsCompleteOpen(false);
    } catch (cause: unknown) {
      setMutationError(cause instanceof Error ? cause : new Error('Không thể hoàn tất lô đối soát.'));
      setIsCompleteOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const customerOptions = customers.map((customer) => ({
    value: customer.customerCode,
    label: `${customer.customerCode} - ${customer.customerName}`,
  }));

  const columns = useMemo<ColumnDef<ReconciliationLineItem>[]>(() => [
    {
      id: 'code',
      header: 'Mã nguyên liệu',
      width: '16%',
      cell: (row) => <IdentifierText value={row.materialCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '28%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm truncate">{row.materialName}</span>,
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '10%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.unit}</span>,
    },
    {
      id: 'required',
      header: 'Nhu cầu đã khóa',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.requiredQuantity} format="quantity" />,
    },
    {
      id: 'issued',
      header: 'Đã xuất theo sổ',
      width: '14%',
      align: 'right',
      cell: (row) => row.issuedQuantity == null ? <span>—</span> : <Num value={row.issuedQuantity} format="quantity" />,
    },
    {
      id: 'difference',
      header: 'Chênh lệch xuất',
      width: '14%',
      align: 'right',
      cell: (row) => row.issuedRequiredDifference == null ? <span>—</span> : (
        <Num
          value={row.issuedRequiredDifference}
          format="quantity"
          prefix={row.issuedRequiredDifference > 0 ? '+' : ''}
          className={row.issuedRequiredDifference === 0 ? 'text-slate-600' : 'text-amber-700 font-semibold'}
        />
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái dòng',
      width: '16%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.disposition ? 'success' : row.triggers.length > 0 ? 'warning' : 'neutral'} size="sm">
          {STATUS_LABELS[row.status] || row.status}
        </Badge>
      ),
    },
  ], []);

  const isForbidden = error instanceof ApiError && error.status === 403;
  const isModeConflict = error instanceof ApiError && error.status === 409 && (
    error.message.includes('chế độ') ||
    error.message.includes('Đối chiếu') ||
    error.message.includes('MRX') ||
    error.message.includes('DEFAULT')
  );
  const isConflict = error instanceof ApiError && error.status === 409 && !isModeConflict;
  const displayedError = isForbidden || isConflict || isModeConflict ? null : error;

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Đối soát nguyên liệu"
        contextSelectors={
          <>
            <Select
              aria-label="Chọn khách hàng đối soát"
              options={customerOptions}
              value={customerCode}
              onChange={(event) => {
                setIsLoading(true);
                setError(null);
                setCustomerCode(event.target.value);
              }}
              className="h-9 w-64 font-medium text-sm"
              disabled={customers.length === 0}
            />
            <VietnameseDateInput
              aria-label="Ngày đối soát"
              value={serviceDate}
              onChange={(date) => {
                setIsLoading(true);
                setError(null);
                setServiceDate(date);
              }}
              className="h-9 w-40 font-mono text-sm"
            />
            <Badge variant={data?.status === 'COMPLETED' ? 'success' : 'info'} size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              {data ? STATUS_LABELS[data.status] || data.status : 'Chưa chọn lô'}
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="default" onClick={() => loadData()} className="h-9 text-sm font-medium">
              Làm mới
            </Button>
            {canComplete && (
              <ActionGuard
                capabilityId="RECON.BATCH.COMPLETE"
                roles={['ADMIN', 'MANAGER', 'Quản lý']}
                permissions="ReconciliationWriteAccess"
                allowedModes={['MATERIAL_RECONCILIATION']}
                mode="disable"
                reason="Chỉ khả dụng trong chế độ đối soát nguyên liệu."
              >
                <Button variant="default" size="default" onClick={() => setIsCompleteOpen(true)} className="h-9 text-sm font-medium">
                  Chốt đối soát ca
                </Button>
              </ActionGuard>
            )}
          </>
        }
      />

      <TelemetrySubbar
        leftControls={<span className="text-xs font-semibold text-slate-700">Rà soát dòng đối soát theo ngày</span>}
        telemetryPills={data ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Phiên bản lô:</span>
              <strong className="text-slate-900 font-mono">{data.version}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Trạng thái tuần:</span>
              <strong className="text-slate-900">{STATUS_LABELS[data.weeklyStatus || ''] || data.weeklyStatus || '—'}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Dòng ngày:</span>
              <strong className="text-slate-900 font-mono">{data.lines.length}</strong>
            </span>
          </>
        ) : null}
      />

      {mutationError instanceof ApiError && (mutationError.status === 403 || mutationError.status === 409) && (
        <div role="alert" className="px-4 py-2 text-sm border-b bg-rose-50 text-rose-800 border-rose-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            <strong>{mutationError.status === 409 ? 'Xung đột dữ liệu đồng thời' : 'Không có quyền thực hiện thao tác'}</strong>
            <span className="ml-2">{mutationError.message}</span>
          </div>
          {mutationError.status === 409 && <Button variant="outline" size="xs" onClick={() => { setMutationError(null); loadData(); }}>Tải lại dữ liệu mới nhất</Button>}
        </div>
      )}
      {mutationError && (!(mutationError instanceof ApiError) || (mutationError.status !== 403 && mutationError.status !== 409)) && (
        <div role="alert" className="px-4 py-2 text-sm border-b bg-rose-50 text-rose-800 border-rose-200 shrink-0">{mutationError.message}</div>
      )}

      <StateBoundary
        isLoading={isLoading}
        isFetching={isLoading}
        hasExistingData={Boolean(data && data.lines.length > 0)}
        error={displayedError}
        isForbidden={isForbidden}
        isModeConflict={isModeConflict}
        modeConflictMessage={isAdmin ? 'Hệ thống đang vận hành ở Chế độ Mặc định (DEFAULT). Theo nguyên tắc an toàn DOM-MODE-1, phân hệ Đối soát chỉ hoạt động khi kích hoạt Chế độ MRX trong phần Thiết lập nâng cao.' : 'Phân hệ Đối soát chỉ hoạt động trong Chế độ MRX. Vui lòng liên hệ Quản trị viên (Admin) để kích hoạt chế độ này.'}
        onSwitchMode={isAdmin ? () => navigate('/settings/advanced?view=mode') : undefined}
        isConflict={isConflict}
        conflictDetails={error?.message}
        onResolveConflict={() => loadData()}
        onRetry={() => loadData()}
        isPartial={Boolean(data && data.lines.length === 0 && data.status !== 'COMPLETED')}
        partialMessage="Backend chỉ trả phạm vi vận hành hoặc chưa có daily review cho ngày đã chọn."
        isEmpty={!data || data.lines.length === 0}
        emptyScenario="prerequisite-blocked"
        emptyTitle="Chưa có dòng đối soát đúng phạm vi"
        emptyDescription="Không có daily lineage cho khách hàng và ngày đã chọn, hoặc vai trò hiện tại chỉ được xem phạm vi vận hành."
      >
        {data && <DataGrid data={data.lines} columns={columns} keyExtractor={(row) => row.dailyLineId || row.id} />}
      </StateBoundary>

      <Modal
        isOpen={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        title="Xác nhận hoàn tất lô đối soát"
        description={`Lô ${data?.batchId || ''} · phiên bản ${data?.version ?? '—'}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCompleteOpen(false)}>Quay lại</Button>
            <Button variant="default" size="sm" disabled={isSubmitting} onClick={handleComplete}>
              {isSubmitting ? 'Đang hoàn tất...' : 'Xác nhận hoàn tất lô'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-700">
          Backend sẽ kiểm tra lại trạng thái tuần và phiên bản hiện tại trước khi chuyển lô sang Hoàn tất. Thao tác không tự tạo bút toán kho hoặc số liệu tài chính.
        </p>
      </Modal>
    </div>
  );
}
