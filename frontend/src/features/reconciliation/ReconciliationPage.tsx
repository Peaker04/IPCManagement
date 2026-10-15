import { useState, useEffect } from 'react';
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
import { Tabs } from '../../components/ui/tabs';
import { Modal } from '../../components/ui/modal';
import { Input } from '../../components/ui/input';
import { ActionGuard } from '../../components/ui/action-guard';
import {
  reconciliationApi,
  type ReconciliationBatchSummary,
  type ReconciliationLineItem,
} from '../../api/reconciliationApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';

export function ReconciliationPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([
    { customerId: 'c6c0b2f4-1567-4c62-b687-e50d3e93f348', customerCode: 'DAV', customerName: 'Draxlmaier' },
    { customerId: 'b1e40f3e-bda5-4c16-be27-ea7146e10d37', customerCode: 'ANV', customerName: 'AMANN' },
  ]);
  const [customerCode, setCustomerCode] = useState('DAV');
  const [serviceDate, setServiceDate] = useState('2026-09-21');
  const [activeTab, setActiveTab] = useState<'variance' | 'history'>('variance');
  const [data, setData] = useState<ReconciliationBatchSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Complete Reconciliation Modal
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [reconNotes, setReconNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((list) => {
      if (!ignore && list.length > 0) setCustomers(list);
    }).catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const loadData = async (date = serviceDate, cust = customerCode) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await reconciliationApi.getReconciliationSummary(date, 'Ca 1 (Sáng)', cust);
      setData(resp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải biên bản đối soát nguyên liệu ca.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const resp = await reconciliationApi.getReconciliationSummary(serviceDate, 'Ca 1 (Sáng)', customerCode);
        if (!ignore) {
          setData(resp);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải biên bản đối soát nguyên liệu ca.');
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, [serviceDate, customerCode]);

  const handleCompleteRecon = async () => {
    if (!data) return;
    if (!reconNotes.trim()) {
      alert('Vui lòng nhập ghi chú / lý do chốt sổ đối soát ca (BR-GLOBAL-03)');
      return;
    }
    setIsSubmitting(true);
    try {
      await reconciliationApi.completeReconciliation(data.batchId, reconNotes);
      setIsCompleteOpen(false);
      await loadData();
      alert('Đã chốt sổ đối soát ca thành công và đồng bộ dữ liệu vào sổ cái kho!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chốt đối soát thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const customerSelectOptions = customers.map((c) => ({
    value: c.customerCode,
    label: `${c.customerCode} - ${c.customerName}`,
  }));

  const TAB_ITEMS = [
    { id: 'variance', label: 'Bảng sai lệch ca', count: data?.lines.length },
    { id: 'history', label: 'Lịch sử chốt sổ', count: 1 },
  ];

  const columns: ColumnDef<ReconciliationLineItem>[] = [
    {
      id: 'code',
      header: 'Mã nguyên liệu',
      width: '16%',
      cell: (row) => <IdentifierText value={row.materialCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '26%',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.materialName}</span>
          {row.notes && <span className="text-xs text-slate-400 italic truncate">{row.notes}</span>}
        </div>
      ),
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '10%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.unit}</span>,
    },
    {
      id: 'bom',
      header: 'Định mức BOM',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.bomTargetQty} format="quantity" />,
    },
    {
      id: 'issued',
      header: 'Xuất kho thực tế',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.actualIssuedQty} format="quantity" />,
    },
    {
      id: 'used',
      header: 'Bếp sử dụng',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.kitchenUsedQty} format="quantity" className="font-bold text-slate-900" />,
    },
    {
      id: 'variance',
      header: 'Sai lệch (+/-)',
      width: '12%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.varianceQty}
          format="quantity"
          prefix={row.varianceQty > 0 ? '+' : ''}
          className={
            row.varianceQty > 0
              ? 'text-emerald-700 font-bold'
              : row.varianceQty < 0
              ? 'text-rose-700 font-bold'
              : 'text-slate-400'
          }
        />
      ),
    },
    {
      id: 'waste',
      header: 'Hao hụt (%)',
      width: '12%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.wastePercent}
          format="percent"
          decimals={1}
          className={row.wastePercent > 2.0 ? 'text-rose-700 font-bold' : 'text-slate-700'}
        />
      ),
    },
    {
      id: 'eval',
      header: 'Đánh giá',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.evaluation === 'normal' ? 'success' : row.evaluation === 'warning' ? 'warning' : 'danger'}
          size="sm"
        >
          {row.evaluation === 'normal' ? 'Đạt chuẩn' : row.evaluation === 'warning' ? 'Cảnh báo' : 'Vượt mức'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Đối soát nguyên liệu"
        contextSelectors={
          <>
            <Select
              options={customerSelectOptions}
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              className="h-9 w-64 font-medium text-sm"
            />
            <VietnameseDateInput
              value={serviceDate}
              onChange={(d) => setServiceDate(d)}
              className="h-9 w-40 font-mono text-sm"
            />
            <Badge variant="success" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              Ca 1 đã hoàn tất
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={() => alert('Xuất biên bản đối soát ca thành công!')}
              className="h-9 text-sm font-medium"
            >
              Xuất biên bản đối soát
            </Button>
            {/* Rule D7: Single primary button */}
            <ActionGuard roles={['ADMIN', 'MANAGER']}>
              <Button
                variant="default"
                size="default"
                onClick={() => setIsCompleteOpen(true)}
                className="h-9 text-sm font-medium"
              >
                Chốt đối soát ca
              </Button>
            </ActionGuard>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={TAB_ITEMS}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as 'variance' | 'history')}
            size="default"
          />
        }
        telemetryPills={
          data ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Mã lô đối soát:</span>
                <strong className="text-slate-900 font-mono text-xs">{data.batchCode}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Suất chốt:</span>
                <strong className="text-slate-900 font-mono font-bold">{data.totalServings}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Hao hụt chung:</span>
                <strong className="text-emerald-700 font-bold">{data.overallWastePercent}%</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-500">Chênh lệch tiền:</span>
                <span className="text-amber-700 font-mono font-bold">
                  {data.totalVarianceAmount.toLocaleString('vi-VN')} ₫
                </span>
              </span>
            </>
          ) : null
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={() => loadData()}
        isEmpty={!data || data.lines.length === 0}
        emptyTitle="Chưa có dữ liệu đối soát ca này"
        emptyDescription="Bếp trưởng chưa hoàn tất ca nấu hoặc chưa có phiếu xuất kho đối chiếu."
        actionLabel="Làm mới đối soát"
        onAction={() => loadData()}
      >
        {data && (
          <DataGrid<ReconciliationLineItem>
            data={data.lines}
            columns={columns}
            keyExtractor={(row) => row.id}
          />
        )}
      </StateBoundary>

      {/* Complete Modal */}
      <Modal
        isOpen={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        title="Xác nhận chốt sổ đối soát ca"
        description={`Lô đối soát ${data?.batchCode || ''} - Khách hàng ${data?.customerName || ''}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCompleteOpen(false)}>
              Quay lại
            </Button>
            <Button variant="default" size="sm" disabled={isSubmitting} onClick={handleCompleteRecon}>
              {isSubmitting ? 'Đang chốt sổ...' : 'Xác nhận chốt sổ & Khóa ca'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Hệ thống sẽ khóa bất biến số liệu đối soát của ca ngày <strong>{serviceDate}</strong> và ghi nhận vào báo cáo tài chính suất ăn.
          </p>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Tổng suất chốt phục vụ:</span>
              <strong className="text-slate-900">{data?.totalServings} suất</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tỷ lệ hao hụt trung bình:</span>
              <strong className="text-emerald-700">{data?.overallWastePercent}%</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Chênh lệch giá trị vật tư:</span>
              <strong className="text-amber-700">{data?.totalVarianceAmount.toLocaleString('vi-VN')} ₫</strong>
            </div>
          </div>
          <div className="space-y-1 pt-1">
            <label className="block text-xs font-medium text-slate-700">Ghi chú đối soát</label>
            <Input
              placeholder="Nhập ghi chú chốt sổ đối soát ca..."
              value={reconNotes}
              onChange={(e) => setReconNotes(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
