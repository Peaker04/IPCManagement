import { useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { StateBoundary } from '../../../components/workbench/StateBoundary';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Num } from '../../../components/ui/num';
import { CreateCustomerModal } from '../CreateCustomerModal';
import { customerApi, type CustomerContractItem } from '../../../api/customerApi';

export function AdminCustomersBranch() {
  const [contracts, setContracts] = useState<CustomerContractItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await customerApi.getCustomerContracts();
      setContracts(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể tải danh sách hợp đồng khách hàng.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const columns = useMemo<ColumnDef<CustomerContractItem>[]>(() => [
    {
      id: 'code',
      header: 'Mã khách',
      width: '15%',
      minWidth: '120px',
      cell: (row) => <IdentifierText value={row.customerCode} />,
    },
    {
      id: 'name',
      header: 'Tên khách hàng / Doanh nghiệp',
      width: '32%',
      minWidth: '220px',
      cell: (row) => (
        <div>
          <span className="font-semibold text-slate-900 text-sm block">{row.customerName}</span>
          {row.note && <span className="text-[11px] text-slate-500 truncate block">{row.note}</span>}
        </div>
      ),
    },
    {
      id: 'price',
      header: 'Mốc giá hợp đồng',
      width: '18%',
      minWidth: '130px',
      align: 'right',
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-slate-900">
          <Num value={row.defaultMenuPrice || 25000} format="currency" />
        </span>
      ),
    },
    {
      id: 'shifts',
      header: 'Ca phục vụ',
      width: '18%',
      minWidth: '130px',
      cell: (row) => (
        <div className="flex flex-wrap gap-1 text-[11px] font-mono">
          {(row.shiftNames || ['MORNING']).map((s, idx) => (
            <span key={idx} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
              {s === 'MORNING' ? 'Sáng' : s === 'AFTERNOON' ? 'Chiều' : s}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '17%',
      minWidth: '120px',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">
          {row.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
        </Badge>
      ),
    },
  ], []);

  const totalCount = contracts.length;
  const activeCount = contracts.filter((c) => c.isActive).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {/* Zone 2: Telemetry Subbar (44px) */}
      <div className="h-11 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-500">Hợp đồng khách hàng:</span>
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Users size={14} className="text-slate-500" aria-hidden="true" />
            <strong className="font-mono">{totalCount}</strong> doanh nghiệp
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 size={13} aria-hidden="true" />
            <strong className="font-mono">{activeCount}</strong> đang phục vụ
          </span>
          {inactiveCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <AlertCircle size={13} aria-hidden="true" />
                <strong className="font-mono">{inactiveCount}</strong> tạm dừng
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="h-7 px-3 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
          >
            <UserPlus size={13} aria-hidden="true" />
            <span>Thêm khách hàng mới</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="h-7 px-2.5 text-xs flex items-center gap-1"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Main DataGrid */}
      <div className="flex-1 min-h-0 flex flex-col">
        <StateBoundary
          isLoading={isLoading}
          error={error}
          onRetry={() => void loadData()}
          isEmpty={!isLoading && !error && contracts.length === 0}
          emptyScenario="empty-first-use"
          emptyTitle="Chưa có khách hàng & hợp đồng"
          emptyDescription="Chưa có khách hàng nào trong hệ thống. Bấm nút bên dưới để tạo khách hàng mới và thiết lập mốc giá."
          actionLabel="Thêm khách hàng mới"
          onAction={() => setIsCreateModalOpen(true)}
          contextDomain="catalog"
        >
          <DataGrid
            data={contracts}
            columns={columns}
            keyExtractor={(row) => row.customerId}
            minWidth="min-w-[850px]"
          />
        </StateBoundary>
      </div>

      <CreateCustomerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => void loadData()}
      />
    </div>
  );
}
