import { useState, useEffect, useMemo } from 'react';
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
  warehouseApi,
  type WarehouseItem,
  type InventoryReceiptItem,
  type InventoryIssueItem,
} from '../../api/warehouseApi';
import { formatVietnameseDate } from '../../utils/dates';

interface StockCardRow {
  materialCode: string;
  materialName: string;
  unit: string;
  openingStock: number;
  inQty: number;
  outQty: number;
  closingStock: number;
}

const SAMPLE_STOCK_CARDS: StockCardRow[] = [
  { materialCode: 'NL-THIT-01', materialName: 'Thịt đùi heo tươi', unit: 'Kilogram', openingStock: 250, inQty: 120, outQty: 185.5, closingStock: 184.5 },
  { materialCode: 'NL-GA-06', materialName: 'Thịt gà phi lê tươi', unit: 'Kilogram', openingStock: 180, inQty: 70, outQty: 160.0, closingStock: 90.0 },
  { materialCode: 'NL-CA-02', materialName: 'Chả cá thác lác', unit: 'Kilogram', openingStock: 150, inQty: 140, outQty: 142.0, closingStock: 148.0 },
  { materialCode: 'NL-RAU-03', materialName: 'Bầu sao tươi', unit: 'Kilogram', openingStock: 300, inQty: 200, outQty: 220.0, closingStock: 280.0 },
  { materialCode: 'NL-GIA-04', materialName: 'Giá đỗ sạch', unit: 'Kilogram', openingStock: 120, inQty: 110, outQty: 95.0, closingStock: 135.0 },
  { materialCode: 'NL-TOM-05', materialName: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', openingStock: 80, inQty: 35, outQty: 45.0, closingStock: 70.0 },
  { materialCode: 'NL-DAUAN-09', materialName: 'Dầu ăn thực vật Cái Lân', unit: 'Lít', openingStock: 90, inQty: 40, outQty: 40.0, closingStock: 90.0 },
  { materialCode: 'NL-NUOCMAM-10', materialName: 'Nước mắm cá cơm 30 độ', unit: 'Lít', openingStock: 60, inQty: 25, outQty: 25.0, closingStock: 60.0 },
];

export function WarehousePage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('ALL');
  const [movementDate, setMovementDate] = useState('2026-09-21');
  const [activeTab, setActiveTab] = useState<'issues' | 'receipts' | 'stock'>('issues');
  const [issues, setIssues] = useState<InventoryIssueItem[]>([]);
  const [receipts, setReceipts] = useState<InventoryReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Issue Modal
  const [isNewIssueOpen, setIsNewIssueOpen] = useState(false);
  const [issueShift, setIssueShift] = useState('Ca 1 (Sáng)');
  const [issueNotes, setIssueNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [whs, iss, rcp] = await Promise.all([
        warehouseApi.getWarehouses(),
        warehouseApi.getIssues(),
        warehouseApi.getReceipts(),
      ]);
      setWarehouses(whs);
      setIssues(iss);
      setReceipts(rcp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu kho vận.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const [whs, iss, rcp] = await Promise.all([
          warehouseApi.getWarehouses(),
          warehouseApi.getIssues(),
          warehouseApi.getReceipts(),
        ]);
        if (!ignore) {
          setWarehouses(whs);
          setIssues(iss);
          setReceipts(rcp);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu kho vận.');
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateIssue = async () => {
    if (!issueNotes.trim()) {
      alert('Vui lòng nhập ghi chú / lý do xuất kho (BR-GLOBAL-03)');
      return;
    }
    setIsSubmitting(true);
    try {
      await warehouseApi.createIssue({
        warehouseId: selectedWarehouseId === 'ALL' ? 'wh-1' : selectedWarehouseId,
        shiftName: issueShift,
        lines: [{ ingredientId: 'ing-1', qty: 50 }],
      });
      setIsNewIssueOpen(false);
      await loadData();
      alert('Đã tạo phiếu xuất kho nguyên liệu ca thành công!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Tạo phiếu xuất thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const warehouseOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'Tất cả các kho (7 kho trung tâm & chi nhánh)' },
      ...warehouses.map((w) => ({ value: w.warehouseId, label: `${w.warehouseCode} - ${w.warehouseName}` })),
    ];
  }, [warehouses]);

  const TAB_ITEMS = [
    { id: 'issues', label: 'Phiếu xuất kho ca', count: issues.length },
    { id: 'receipts', label: 'Phiếu nhập kho từ PO', count: receipts.length },
    { id: 'stock', label: 'Thẻ kho & Tồn hiện tại', count: SAMPLE_STOCK_CARDS.length },
  ];

  // Tab 1: Issues Columns
  const issueColumns: ColumnDef<InventoryIssueItem>[] = [
    {
      id: 'code',
      header: 'Mã phiếu xuất',
      width: '20%',
      cell: (row) => <IdentifierText value={row.issueCode} />,
    },
    {
      id: 'date',
      header: 'Ngày xuất',
      width: '14%',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {formatVietnameseDate(row.issueDate)}
        </span>
      ),
    },
    {
      id: 'shift',
      header: 'Ca áp dụng',
      width: '16%',
      cell: (row) => <span className="font-medium text-slate-800 text-sm">{row.shiftName}</span>,
    },
    {
      id: 'warehouse',
      header: 'Kho xuất hàng',
      width: '26%',
      cell: (row) => <span className="text-slate-700 text-sm truncate block">{row.warehouseName}</span>,
    },
    {
      id: 'items',
      header: 'Số mặt hàng',
      width: '12%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs">{row.itemsCount} dòng</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'ISSUED' ? 'success' : row.status === 'CONFIRMED' ? 'info' : 'neutral'}
          size="sm"
        >
          {row.status === 'ISSUED' ? 'Đã xuất kho' : row.status === 'CONFIRMED' ? 'Đã nhận đủ' : 'Dự thảo'}
        </Badge>
      ),
    },
  ];

  // Tab 2: Receipts Columns
  const receiptColumns: ColumnDef<InventoryReceiptItem>[] = [
    {
      id: 'code',
      header: 'Mã phiếu nhập',
      width: '20%',
      cell: (row) => <IdentifierText value={row.receiptCode} />,
    },
    {
      id: 'date',
      header: 'Ngày nhập',
      width: '14%',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {formatVietnameseDate(row.receiptDate)}
        </span>
      ),
    },
    {
      id: 'supplier',
      header: 'Nhà cung cấp',
      width: '26%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm truncate block">{row.supplierName}</span>,
    },
    {
      id: 'warehouse',
      header: 'Kho tiếp nhận',
      width: '20%',
      cell: (row) => <span className="text-slate-700 text-sm truncate block">{row.warehouseName}</span>,
    },
    {
      id: 'items',
      header: 'Số dòng',
      width: '10%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs">{row.itemsCount} dòng</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '10%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'POSTED' ? 'success' : row.status === 'APPROVED' ? 'info' : 'neutral'}
          size="sm"
        >
          {row.status === 'POSTED' ? 'Đã nhập kho' : row.status === 'APPROVED' ? 'Đã duyệt' : 'Dự thảo'}
        </Badge>
      ),
    },
  ];

  // Tab 3: Stock Cards Columns
  const stockColumns: ColumnDef<StockCardRow>[] = [
    {
      id: 'code',
      header: 'Mã vật tư',
      width: '16%',
      cell: (row) => <IdentifierText value={row.materialCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '32%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.materialName}</span>,
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '10%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.unit}</span>,
    },
    {
      id: 'opening',
      header: 'Tồn đầu ngày',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.openingStock} format="quantity" />,
    },
    {
      id: 'in',
      header: 'Nhập trong ngày',
      width: '14%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.inQty}
          format="quantity"
          prefix="+"
          className="text-emerald-700 font-semibold"
        />
      ),
    },
    {
      id: 'out',
      header: 'Xuất trong ngày',
      width: '14%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.outQty}
          format="quantity"
          prefix="-"
          className="text-amber-700 font-semibold"
        />
      ),
    },
    {
      id: 'closing',
      header: 'Tồn cuối ngày',
      width: '14%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.closingStock}
          format="quantity"
          className="font-bold text-slate-900 text-sm"
        />
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Kho nguyên liệu & Nhập xuất"
        contextSelectors={
          <>
            <Select
              options={warehouseOptions}
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="h-9 w-72 font-medium text-sm"
            />
            <VietnameseDateInput
              value={movementDate}
              onChange={(d) => setMovementDate(d)}
              className="h-9 w-40 font-mono text-sm"
            />
            <Badge variant="success" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              Kho đang hoạt động
            </Badge>
          </>
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
            <ActionGuard roles={['ADMIN', 'THUKHO', 'WAREHOUSE']}>
              <Button
                variant="default"
                size="default"
                onClick={() => setIsNewIssueOpen(true)}
                className="h-9 text-sm font-medium"
              >
                Tạo phiếu xuất kho
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
            onChange={(id) => setActiveTab(id as 'issues' | 'receipts' | 'stock')}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng phiếu:</span>
              <strong className="text-slate-900 font-mono font-bold">{issues.length + receipts.length} chứng từ</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Kho vận hành:</span>
              <strong className="text-slate-900 font-semibold">{warehouses.length || 7} kho</strong>
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="neutral" size="sm">
              Khớp thẻ kho: 100%
            </Badge>
          </>
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={loadData}
        isEmpty={false}
      >
        {activeTab === 'issues' && (
          <DataGrid<InventoryIssueItem>
            data={issues}
            columns={issueColumns}
            keyExtractor={(row) => row.issueId}
          />
        )}

        {activeTab === 'receipts' && (
          <DataGrid<InventoryReceiptItem>
            data={receipts}
            columns={receiptColumns}
            keyExtractor={(row) => row.receiptId}
          />
        )}

        {activeTab === 'stock' && (
          <DataGrid<StockCardRow>
            data={SAMPLE_STOCK_CARDS}
            columns={stockColumns}
            keyExtractor={(row) => row.materialCode}
          />
        )}
      </StateBoundary>

      {/* New Issue Modal */}
      <Modal
        isOpen={isNewIssueOpen}
        onClose={() => setIsNewIssueOpen(false)}
        title="Tạo phiếu xuất kho nguyên liệu ca nấu"
        description="Xuất vật tư từ kho lưu trữ phục vụ chế biến suất ăn công nghiệp"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsNewIssueOpen(false)}>
              Hủy bỏ
            </Button>
            <Button variant="default" size="sm" disabled={isSubmitting} onClick={handleCreateIssue}>
              {isSubmitting ? 'Đang tạo...' : 'Xác nhận xuất kho'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Ca phục vụ xuất kho</label>
            <Select
              options={[
                { value: 'Ca 1 (Sáng)', label: 'Ca 1 (Sáng) — Bàn giao 07:30' },
                { value: 'Ca 2 (Chiều)', label: 'Ca 2 (Chiều) — Bàn giao 14:00' },
              ]}
              value={issueShift}
              onChange={(e) => setIssueShift(e.target.value)}
              className="h-9 w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Ghi chú phiếu xuất</label>
            <Input
              placeholder="Ví dụ: Xuất nguyên liệu ca trưa theo lệnh KHSX-DAV-20260921"
              value={issueNotes}
              onChange={(e) => setIssueNotes(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
