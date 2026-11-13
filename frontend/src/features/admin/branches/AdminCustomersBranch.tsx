import { useMemo, useRef, useState } from 'react';
import { Users, UserPlus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { StateBoundary } from '../../../components/workbench/StateBoundary';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Num } from '../../../components/ui/num';
import { CreateCustomerModal } from '../CreateCustomerModal';
import { customerApi, type CustomerContractItem } from '../../../api/customerApi';
import { LocalFindBar } from '../../../components/workbench/LocalFindBar';
import { normalizeSearchText } from '../../../utils/search';
import { ActionGuard } from '../../../components/ui/action-guard';
import { Modal } from '../../../components/ui/modal';
import { InlineBanner } from '../../../components/ui/inline-banner';
import { useAuth } from '../../../store/useAuth';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';

const CUSTOMER_WRITE_ROLES = ['ADMIN', 'MANAGER', 'Quản lý', 'COORDINATOR', 'Điều phối'];

export function AdminCustomersBranch() {
  const { user, operationalMode, hasRole } = useAuth();
  const canManage = hasRole(CUSTOMER_WRITE_ROLES);
  const customersQuery = useWorkbenchQuery<CustomerContractItem[]>({
    scopeKey: `admin_customers_${user?.userId}_${operationalMode}`,
    cacheKey: `admin_data_customers_${user?.userId}_${operationalMode}`,
    snapshotKey: `snapshot:admin_data_customers_${user?.userId}_${operationalMode}`,
    queryFn: () => customerApi.getCustomerContracts(),
    isDatasetEmpty: (res) => !res || res.length === 0,
  });
  const contracts = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const { isLoading, isFetching, error, hasExistingData, isPreviousData } = customersQuery.stateProps;
  const setContracts = customersQuery.setData;
  const loadData = () => customersQuery.refetch(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [statusTarget, setStatusTarget] = useState<CustomerContractItem | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const statusPending = useRef(false);
  const metadataDirty = Boolean(statusTarget && (editNote.trim() !== (statusTarget.note || '') || editActive !== statusTarget.isActive));
  const saveCustomer = async () => {
    if (!statusTarget || statusPending.current || !canManage || !metadataDirty) return;
    statusPending.current = true;
    setStatusSaving(true);
    setStatusError(null);
    try {
      const saved = await customerApi.updateCustomerContract(statusTarget.customerId, {
        ...(editNote.trim() !== (statusTarget.note || '') ? { note: editNote.trim() } : {}),
        ...(editActive !== statusTarget.isActive ? { isActive: editActive } : {}),
      });
      setContracts(current => (current ?? []).map(customer => customer.customerId === saved.customerId ? saved : customer));
      setStatusTarget(null);
    } catch (cause) {
      setStatusError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái khách hàng.');
    } finally {
      statusPending.current = false;
      setStatusSaving(false);
    }
  };
  const query = normalizeSearchText(searchTerm);
  const filteredContracts = useMemo(() => contracts.filter(contract =>
    [contract.customerCode, contract.customerName].some(value => normalizeSearchText(value).includes(query))
  ), [contracts, query]);
  const selectedCustomer = !isLoading && !error ? filteredContracts.find(customer => customer.customerId === selectedId) : undefined;
  const isFilterEmpty = contracts.length > 0 && filteredContracts.length === 0;

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
      width: '50%',
      minWidth: '220px',
      cell: (row) => (
        <div>
          <span className="font-semibold text-slate-900 text-sm block">{row.customerName}</span>
          {row.note && <span className="text-xs text-slate-500 truncate block">{row.note}</span>}
        </div>
      ),
    },
    {
      id: 'shifts',
      header: 'Ca phục vụ',
      width: '18%',
      minWidth: '130px',
      cell: (row) => (
        <div className="flex flex-wrap gap-1 text-xs">
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
      <div className="min-h-11 px-4 py-1.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Khách hàng:</span>
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Users size={14} className="text-slate-500" aria-hidden="true" />
            <strong className="font-mono"><Num value={hasExistingData && !error ? totalCount : undefined} /></strong> doanh nghiệp
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 size={13} aria-hidden="true" />
            <strong className="font-mono"><Num value={hasExistingData && !error ? activeCount : undefined} /></strong> đang phục vụ
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-500 flex items-center gap-1">
            <AlertCircle size={13} aria-hidden="true" />
            <strong className="font-mono"><Num value={hasExistingData && !error ? inactiveCount : undefined} /></strong> tạm dừng
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ActionGuard capabilityId="COORD.CUSTOMER_CONTRACT.UPDATE" roles={CUSTOMER_WRITE_ROLES}>
            <Button variant="outline" size="sm" disabled={!selectedCustomer || statusSaving}
              title={selectedCustomer ? `Chỉnh sửa ${selectedCustomer.customerCode}` : 'Chọn một khách hàng trong bảng để chỉnh sửa'}
              onClick={() => {
                if (!selectedCustomer) return;
                setStatusTarget(selectedCustomer);
                setEditNote(selectedCustomer.note || '');
                setEditActive(selectedCustomer.isActive);
                setStatusError(null);
              }}>Chỉnh sửa</Button>
          </ActionGuard>
          <ActionGuard capabilityId="COORD.CUSTOMER_CONTRACT.CREATE" roles={CUSTOMER_WRITE_ROLES}>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="h-7 px-3 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
          >
            <UserPlus size={13} aria-hidden="true" />
            <span>Thêm khách hàng mới</span>
          </Button>
          </ActionGuard>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={isLoading || statusSaving}
            className="h-7 px-2.5 text-xs flex items-center gap-1"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      <LocalFindBar label="Tìm khách hàng trong danh sách" value={searchTerm} onChange={setSearchTerm}
        matched={hasExistingData && !error ? filteredContracts.length : undefined} total={hasExistingData && !error ? totalCount : undefined}
        scope="Trong danh sách khách hàng đã tải." />

      {/* Main DataGrid */}
      <div className="flex-1 min-h-0 flex flex-col">
        <StateBoundary
          isLoading={isLoading}
          isFetching={isFetching}
          isPreviousData={isPreviousData}
          hasExistingData={hasExistingData}
          error={error}
          onRetry={() => void loadData()}
          isEmpty={!isLoading && !error && !isFilterEmpty && filteredContracts.length === 0}
          emptyScenario="empty-first-use"
          emptyTitle="Chưa có khách hàng"
          emptyDescription="Thêm khách hàng để bắt đầu lập thực đơn."
          actionLabel={canManage ? 'Thêm khách hàng mới' : undefined}
          onAction={canManage ? () => setIsCreateModalOpen(true) : undefined}
          contextDomain="catalog"
        >
          <DataGrid
            data={filteredContracts}
            columns={columns}
            keyExtractor={(row) => row.customerId}
            selectedKey={selectedCustomer?.customerId}
            onRowClick={canManage ? row => setSelectedId(row.customerId) : undefined}
            minWidth="min-w-[680px]"
            emptyState={
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-slate-900">Không có khách hàng khớp tìm kiếm</p>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">Xóa tìm kiếm để xem lại danh sách đã tải.</p>
                <div className="pt-1">
                  <Button type="button" variant="outline" size="xs" onClick={() => setSearchTerm('')}>
                    Xóa bộ lọc
                  </Button>
                </div>
              </div>
            }
          />
        </StateBoundary>
      </div>

      {statusTarget && canManage && <Modal isOpen onClose={() => { setStatusTarget(null); setStatusError(null); }}
        isDirty={metadataDirty} closeDisabled={statusSaving}
        title="Chỉnh sửa khách hàng"
        description={`${statusTarget.customerCode} · ${statusTarget.customerName}`}
        maxWidth="max-w-xl"
        footer={(requestClose) => <>
          <Button variant="outline" size="sm" disabled={statusSaving} onClick={requestClose}>Hủy bỏ</Button>
          <Button variant="default" size="sm" disabled={statusSaving || !metadataDirty} onClick={() => void saveCustomer()}>
            {statusSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </>}>
        <div className="space-y-4">
          <div>
            <label htmlFor="customer-edit-note" className="block text-xs font-semibold mb-1">Ghi chú</label>
            <Input id="customer-edit-note" aria-label="Ghi chú khách hàng" value={editNote}
              disabled={statusSaving} onChange={event => setEditNote(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={editActive} disabled={statusSaving} onChange={event => setEditActive(event.target.checked)} />
            Đang hoạt động
          </label>
          {statusError && <InlineBanner variant="error">{statusError}</InlineBanner>}
        </div>
      </Modal>}
      <CreateCustomerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => void loadData()}
      />
    </div>
  );
}
