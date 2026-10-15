import { useState, useEffect, useMemo } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { SplitView } from '../../components/workbench/SplitView';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Tabs } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import {
  approvalsApi,
  type ApprovalInboxItem,
} from '../../api/approvalsApi';

export function ApprovalPage() {
  const [items, setItems] = useState<ApprovalInboxItem[]>([]);
  const [selectedType, setSelectedType] = useState('ALL');
  const [filterDate, setFilterDate] = useState('2026-09-21');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (type = selectedType) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await approvalsApi.getInbox(type);
      setItems(resp);
      if (resp.length > 0 && !selectedItemId) {
        setSelectedItemId(resp[0].inboxItemId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải hàng đợi phê duyệt.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchInbox() {
      try {
        const resp = await approvalsApi.getInbox(selectedType);
        if (!ignore) {
          setItems(resp);
          if (resp.length > 0) setSelectedItemId(resp[0].inboxItemId);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải hàng đợi phê duyệt.');
          setIsLoading(false);
        }
      }
    }

    fetchInbox();

    return () => {
      ignore = true;
    };
  }, [selectedType]);

  const handleDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await approvalsApi.decide(selectedItem.targetType, selectedItem.targetId, decision, decisionReason);
      setDecisionReason('');
      await loadData();
      alert(`Đã ${decision === 'APPROVE' ? 'phê duyệt' : 'từ chối'} yêu cầu ${selectedItem.targetCode} thành công!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Thao tác phê duyệt thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (selectedType === 'ALL') return items;
    return items.filter((i) => i.targetType === selectedType);
  }, [items, selectedType]);

  const selectedItem = items.find((i) => i.inboxItemId === selectedItemId) || filteredItems[0] || null;

  const TYPE_OPTIONS = [
    { value: 'ALL', label: 'Tất cả loại yêu cầu (16 chờ xử lý)' },
    { value: 'material-demand', label: 'Nhu cầu nguyên liệu (6)' },
    { value: 'purchase-order', label: 'Đơn mua hàng PO (4)' },
    { value: 'warehouse-receipt', label: 'Phiếu nhập kho (6)' },
  ];

  const TAB_ITEMS = [
    { id: 'ALL', label: 'Tất cả yêu cầu', count: items.length },
    { id: 'material-demand', label: 'Nhu cầu nguyên liệu', count: items.filter((i) => i.targetType === 'material-demand').length },
    { id: 'purchase-order', label: 'Đơn mua hàng PO', count: items.filter((i) => i.targetType === 'purchase-order').length },
    { id: 'warehouse-receipt', label: 'Phiếu nhập kho', count: items.filter((i) => i.targetType === 'warehouse-receipt').length },
  ];

  const columns: ColumnDef<ApprovalInboxItem>[] = [
    {
      id: 'targetCode',
      header: 'Mã đối tượng',
      width: '20%',
      cell: (row) => <IdentifierText value={row.targetCode} />,
    },
    {
      id: 'title',
      header: 'Tiêu đề yêu cầu phê duyệt',
      width: '32%',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.title}</span>
          <span className="text-xs text-slate-400">{row.itemType} · {row.source}</span>
        </div>
      ),
    },
    {
      id: 'submittedBy',
      header: 'Người gửi',
      width: '16%',
      cell: (row) => <span className="text-slate-700 text-sm truncate block">{row.submittedBy}</span>,
    },
    {
      id: 'sla',
      header: 'Hạn SLA',
      width: '14%',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.slaDeadline}</span>,
    },
    {
      id: 'total',
      header: 'Giá trị / Khối lượng',
      width: '16%',
      align: 'right',
      cell: (row) => (
        row.totalValue ? (
          <Num value={row.totalValue} format="currency" className="font-bold text-slate-900 text-sm" />
        ) : (
          <Num value={row.totalQuantity || 1275.5} format="quantity" suffix=" kg" className="font-bold text-slate-900 text-sm" />
        )
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'}
          size="sm"
        >
          {row.status === 'PENDING' ? 'Chờ duyệt' : row.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Hàng đợi phê duyệt"
        contextSelectors={
          <>
            <Select
              options={TYPE_OPTIONS}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-9 w-64 font-medium text-sm"
            />
            <VietnameseDateInput
              value={filterDate}
              onChange={(d) => setFilterDate(d)}
              className="h-9 w-40 font-mono text-sm"
            />
            <Badge variant="warning" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              {filteredItems.length} yêu cầu chờ xử lý
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={() => loadData()}
              className="h-9 text-sm font-medium"
            >
              Làm mới
            </Button>
            {/* Rule D7: Single primary button */}
            <Button
              variant="default"
              size="default"
              disabled={!selectedItem || isSubmitting}
              onClick={() => handleDecision('APPROVE')}
              className="h-9 text-sm font-medium"
            >
              Phê duyệt yêu cầu đang chọn
            </Button>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={TAB_ITEMS}
            activeId={selectedType}
            onChange={(id) => setSelectedType(id)}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Chờ duyệt:</span>
              <strong className="text-slate-900 font-mono font-bold">{filteredItems.length} hồ sơ</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">SLA khẩn:</span>
              <strong className="text-rose-700 font-bold">2 hồ sơ</strong>
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="neutral" size="sm">
              Đã duyệt hôm nay: 42
            </Badge>
          </>
        }
      />

      {/* Zone 3: SplitView (Master 7 cols Queue | Detail 5 cols Decision Drawer) */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={() => loadData()}
        isEmpty={filteredItems.length === 0}
        emptyTitle="Hàng đợi phê duyệt đang trống"
        emptyDescription="Mọi yêu cầu mua hàng, bàn giao vật tư và xuất nhập kho đã được phê duyệt xử lý xong."
        actionLabel="Làm mới hàng đợi"
        onAction={() => loadData()}
      >
        <SplitView
          masterWidthClass="w-7/12"
          master={
            <DataGrid<ApprovalInboxItem>
              data={filteredItems}
              columns={columns}
              keyExtractor={(row) => row.inboxItemId}
              selectedKey={selectedItem?.inboxItemId}
              onRowClick={(row) => setSelectedItemId(row.inboxItemId)}
            />
          }
          detail={
            selectedItem ? (
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                <div className="h-10 px-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Chi tiết hồ sơ phê duyệt
                  </span>
                  <Badge variant="warning" size="sm">
                    {selectedItem.targetCode}
                  </Badge>
                </div>

                <div className="p-4 space-y-4 flex-1 overflow-auto text-sm text-slate-800">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">{selectedItem.title}</h3>
                    <p className="text-xs text-slate-500">
                      Nguồn: {selectedItem.source} · Người lập: {selectedItem.submittedBy} ({selectedItem.submittedAt})
                    </p>
                  </div>

                  <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mã chứng từ:</span>
                      <strong className="text-slate-900">{selectedItem.targetCode}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hạn xử lý (SLA):</span>
                      <strong className="text-rose-700 font-bold">{selectedItem.slaDeadline}</strong>
                    </div>
                    {selectedItem.supplierName && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nhà cung cấp:</span>
                        <strong className="text-slate-900">{selectedItem.supplierName}</strong>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 font-medium">
                      <span className="text-slate-600">Tổng quy mô:</span>
                      <strong className="text-slate-900 text-sm">
                        {selectedItem.totalValue ? `${selectedItem.totalValue.toLocaleString('vi-VN')} ₫` : `${selectedItem.totalQuantity || 1275.5} kg`}
                      </strong>
                    </div>
                  </div>

                  {selectedItem.materials && selectedItem.materials.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Danh sách vật tư đính kèm ({selectedItem.materials.length} mặt hàng)
                      </h4>
                      <div className="rounded border border-slate-200 divide-y divide-slate-100 text-xs">
                        {selectedItem.materials.map((m, idx) => (
                          <div key={idx} className="flex justify-between px-3 py-2">
                            <span className="font-medium text-slate-900">{m.name}</span>
                            <span className="font-mono text-slate-700">
                              <Num value={m.quantity} format="quantity" suffix={` ${m.unit}`} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 pt-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Ghi chú / Căn cứ phê duyệt
                    </label>
                    <Input
                      placeholder="Nhập căn cứ chấp thuận hoặc lý do từ chối hồ sơ..."
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="h-12 px-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('REJECT')}
                    className="text-red-600 hover:bg-red-50 border-red-200"
                  >
                    Từ chối hồ sơ
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('APPROVE')}
                  >
                    {isSubmitting ? 'Đang duyệt...' : 'Phê duyệt hồ sơ'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-sm">
                Chọn một hồ sơ bên trái để xem nội dung thẩm định
              </div>
            )
          }
        />
      </StateBoundary>
    </div>
  );
}
