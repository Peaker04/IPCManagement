import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../store/useAuth';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { PaginationBar } from '../../../components/workbench/PaginationBar';
import { useUrlWorkbenchState } from '../../../hooks/useUrlWorkbenchState';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { WorkspaceFrame } from '../../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { StateBoundary } from '../../../components/workbench/StateBoundary';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Modal } from '../../../components/ui/modal';
import { SearchableCombobox } from '../../../components/ui/searchable-combobox';
import { InlineBanner } from '../../../components/ui/inline-banner';
import { ActionGuard } from '../../../components/ui/action-guard';
import { ApiError } from '../../../api/client';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';
import {
  adminApi,
  type IngredientItem,
  type DishItem,
  type PagedResult,
} from '../../../api/adminApi';

export interface AdminCatalogBranchProps {
  activeView: 'ingredients' | 'dishes';
}

type CatalogItem = IngredientItem | DishItem;
type CatalogPageInfo = Pick<PagedResult<CatalogItem>,
  'totalCount' | 'pageNumber' | 'pageSize' | 'totalPages' | 'hasPrev' | 'hasNext'>;

interface CatalogQueryResult {
  requestKey: string;
  activeView: 'ingredients' | 'dishes';
  items: CatalogItem[];
  pageInfo: CatalogPageInfo;
}

export function AdminCatalogBranch({ activeView }: AdminCatalogBranchProps) {
  const {
    q: searchKeyword,
    setQ: setSearchKeyword,
    page: pageNumber,
    pageSize,
    setPageSize,
    setPage: setPageNumber,
  } = useUrlWorkbenchState({ defaultView: 'ingredients' });

  const { user, operationalMode } = useAuth();
  const searchInput = useRef<HTMLInputElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createUnknown, setCreateUnknown] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingIngredient, setEditingIngredient] = useState<IngredientItem | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [units, setUnits] = useState<Awaited<ReturnType<typeof adminApi.getUnits>>>([]);
  const [newGroup, setNewGroup] = useState('UNCLASSIFIED');
  const [newName, setNewName] = useState('');
  const [newUnitId, setNewUnitId] = useState('');
  const [newReferencePrice, setNewReferencePrice] = useState('0');
  const [newFreshDaily, setNewFreshDaily] = useState(false);
  const keyword = searchKeyword.trim();
  const settledKeyword = useDebouncedValue(keyword, 300);
  const scopeKey = JSON.stringify(['admin', 'catalog', user?.userId, user?.roleCode, operationalMode]);
  const viewScopeKey = JSON.stringify(['admin', activeView, user?.userId, user?.roleCode, operationalMode]);
  const cacheKey = JSON.stringify([viewScopeKey, keyword, pageNumber, pageSize]);

  const catalogQuery = useWorkbenchQuery<CatalogQueryResult>({
    scopeKey,
    cacheKey,
    snapshotKey: `snapshot:${cacheKey}`,
    enabled: !isComposing && keyword === settledKeyword,
    queryFn: async (_params, signal) => {
      const search = { pageNumber, pageSize, searchKeyword: keyword || undefined };
      if (activeView === 'ingredients') {
        const result = await adminApi.getIngredients(search, signal);
        return { requestKey: cacheKey, activeView: 'ingredients', items: result.items, pageInfo: result };
      } else {
        const result = await adminApi.getDishes(search, signal);
        return { requestKey: cacheKey, activeView: 'dishes', items: result.items, pageInfo: result };
      }
    },
    isDatasetEmpty: (res) => !res || !res.items || res.items.length === 0,
    emptyTitle: keyword ? 'Không tìm thấy danh mục phù hợp' : activeView === 'ingredients' ? 'Chưa có danh mục nguyên liệu' : 'Chưa có danh mục món ăn',
    emptyDescription: keyword ? 'Thử từ khóa khác hoặc xóa tìm kiếm.' : 'Chưa có dữ liệu danh mục cho phân hệ này.',
  });
  const { data: queryResult, stateProps, refetch: loadData } = catalogQuery;

  const openCreate = async () => {
    setNewGroup('UNCLASSIFIED');
    setEditingIngredient(null);
    setNewName(''); setNewUnitId(''); setNewReferencePrice('0'); setNewFreshDaily(false);
    setCreateError(null); setCreateUnknown(false);
    setCreateOpen(true);
    setUnitError(null);
    try { setUnits(await adminApi.getUnits()); }
    catch (cause) { setUnitError(cause instanceof Error ? cause.message : 'Không tải được đơn vị tính.'); }
  };

  const openEdit = (ingredient: IngredientItem) => {
    setNewGroup(ingredient.preparationGroupCode || 'UNCLASSIFIED');
    setEditingIngredient(ingredient);
    setNewName(ingredient.ingredientName);
    setNewUnitId(ingredient.unitId);
    setNewReferencePrice(String(ingredient.referencePrice));
    setNewFreshDaily(Boolean(ingredient.isFreshDaily));
    setCreateError(null); setCreateUnknown(false); setUnitError(null);
    setCreateOpen(true);
  };

  const checkUnknownIngredient = async () => {
    setCreatePending(true);
    try {
      const existing = editingIngredient
        ? await adminApi.getIngredient(editingIngredient.ingredientId)
        : await adminApi.findActiveIngredientByNameAndUnit(newName, newUnitId);
      if (existing) {
        if (!editingIngredient || (existing.ingredientName === newName.trim() && (existing.preparationGroupCode || 'UNCLASSIFIED') === newGroup && existing.referencePrice === Number(newReferencePrice) && Boolean(existing.isFreshDaily) === newFreshDaily)) {
          setCreateOpen(false);
          setCreateUnknown(false);
          setSearchKeyword(existing.ingredientCode);
        } else {
          setCreateUnknown(false);
          setCreateError('Thay đổi chưa xuất hiện trong danh mục. Kiểm tra thông tin rồi lưu lại nếu cần.');
        }
      } else {
        setCreateUnknown(false);
        setCreateError('Chưa tìm thấy nguyên liệu cùng tên và đơn vị. Kiểm tra thông tin rồi lưu lại nếu cần.');
      }
    } catch (cause) { setCreateError(cause instanceof Error ? cause.message : 'Không kiểm tra được danh mục.'); }
    finally { setCreatePending(false); }
  };

  const submitIngredient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createPending || createUnknown || !newName.trim() || !newUnitId || (!editingIngredient && unitError)) return;
    const price = Number(newReferencePrice);
    if (!Number.isFinite(price) || price < 0) { setCreateError('Giá tham chiếu phải lớn hơn hoặc bằng 0.'); return; }
    setCreatePending(true);
    setCreateError(null);
    let writeAttempted = false;
    try {
      const duplicate = !editingIngredient || newName.trim() !== editingIngredient.ingredientName
        ? await adminApi.findActiveIngredientByNameAndUnit(newName, newUnitId)
        : null;
      if (duplicate && duplicate.ingredientId !== editingIngredient?.ingredientId) {
        setCreateError('Nguyên liệu cùng tên và đơn vị đã có trong danh mục. Hãy tìm và dùng bản ghi hiện có.');
        return;
      }
      writeAttempted = true;
      const saved = editingIngredient
        ? await adminApi.updateIngredient(editingIngredient.ingredientId, { ...(newName.trim() !== editingIngredient.ingredientName ? { ingredientName: newName.trim() } : {}), referencePrice: price, isFreshDaily: newFreshDaily, ...(newGroup !== (editingIngredient?.preparationGroupCode || 'UNCLASSIFIED') ? { preparationGroupCode: newGroup } : {}) })
        : await adminApi.createIngredient({ ingredientName: newName.trim(), unitId: newUnitId, referencePrice: price, isFreshDaily: newFreshDaily, ...(newGroup !== 'UNCLASSIFIED' ? { preparationGroupCode: newGroup } : {}) });
      setCreateOpen(false);
      setNewGroup('UNCLASSIFIED');
    setEditingIngredient(null);
      setNewName(''); setNewUnitId(''); setNewReferencePrice('0'); setNewFreshDaily(false);
      if (keyword === saved.ingredientCode) void loadData(true);
      else setSearchKeyword(saved.ingredientCode);
    } catch (cause) {
      const unknown = writeAttempted && (!(cause instanceof ApiError) || cause.status >= 500 || cause.code === 'SESSION_CHANGED');
      if (unknown) setCreateUnknown(true);
      setCreateError(unknown ? 'Chưa xác định kết quả lưu nguyên liệu. Kiểm tra bản ghi trước khi thử lại.' : cause instanceof Error ? cause.message : 'Không kiểm tra được danh mục nguyên liệu.');
    } finally { setCreatePending(false); }
  };

  const items = queryResult?.items ?? [];
  const isPreviousResult = Boolean(queryResult && queryResult.requestKey !== cacheKey);
  const pageInfo = stateProps.error ? (queryResult?.requestKey === cacheKey ? queryResult.pageInfo : undefined) : queryResult?.pageInfo;
  const exactPageInfo = queryResult?.requestKey === cacheKey ? queryResult.pageInfo : undefined;
  const canonicalPage = exactPageInfo ? Math.max(1, Math.min(exactPageInfo.pageNumber, exactPageInfo.totalPages || 1)) : pageNumber;
  const needsPageCorrection = Boolean(exactPageInfo && !stateProps.isFetching && !stateProps.error && canonicalPage !== pageNumber);
  const pending = stateProps.isLoading || stateProps.isFetching || isComposing || needsPageCorrection;
  useEffect(() => {
    if (needsPageCorrection) setPageNumber(canonicalPage, true);
  }, [canonicalPage, needsPageCorrection, setPageNumber]);

  const ingredientColumns: ColumnDef<IngredientItem>[] = [
    {
      id: 'code',
      header: 'Mã nguyên liệu',
      width: '15%',
      minWidth: '130px',
      cell: (row) => <IdentifierText value={row.ingredientCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '27%',
      minWidth: '200px',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.ingredientName}</span>,
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '8%',
      minWidth: '60px',
      align: 'center',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.unitName === 'Kilogram' || row.unitName === 'Kilograms' ? 'kg' : row.unitName || '—'}
        </span>
      ),
    },
    {
      id: 'warehouse',
      header: 'Kho quản lý',
      width: '16%',
      minWidth: '130px',
      cell: (row) => <span className="text-slate-600 text-sm">{row.warehouseName || '—'}</span>,
    },
    {
      id: 'price',
      header: 'Đơn giá tham chiếu',
      width: '14%',
      minWidth: '120px',
      align: 'right',
      cell: (row) => <Num value={row.referencePrice} format="currency" className="font-bold text-slate-900 text-sm" />,
    },
    {
      id: 'fresh',
      header: 'Loại hàng',
      width: '10%',
      minWidth: '95px',
      align: 'center',
      cell: (row) => (
        <Badge variant="neutral" size="sm" className="whitespace-nowrap">
          {row.isFreshDaily ? 'Tươi sống' : 'Tiêu chuẩn'}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '10%',
      minWidth: '105px',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm" className="whitespace-nowrap">
          {row.isActive ? 'Đang áp dụng' : 'Tạm khóa'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      width: '8%',
      minWidth: '72px',
      align: 'center',
      cell: (row) => <ActionGuard capabilityId="CAT.INGREDIENT.UPDATE" roles={['Admin', 'ADMIN', 'Manager', 'MANAGER', 'Quản lý']}>
        <Button variant="outline" size="xs" aria-label={`Sửa nguyên liệu ${row.ingredientName}`} onClick={() => openEdit(row)}>Sửa</Button>
      </ActionGuard>,
    },
  ];

  const dishColumns: ColumnDef<DishItem>[] = [
    {
      id: 'code',
      header: 'Mã món',
      width: '18%',
      minWidth: '140px',
      cell: (row) => <IdentifierText value={row.dishCode} />,
    },
    {
      id: 'name',
      header: 'Tên món ăn tiêu chuẩn',
      width: '38%',
      minWidth: '220px',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.dishName}</span>,
    },
    {
      id: 'type',
      header: 'Phân loại',
      width: '18%',
      minWidth: '120px',
      cell: (row) => <span className="text-slate-600 text-sm">{row.dishType || '—'}</span>,
    },
    {
      id: 'group',
      header: 'Nhóm phân loại',
      width: '14%',
      minWidth: '110px',
      cell: (row) => <span className="text-slate-600 text-sm">{row.dishGroup || '—'}</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '12%',
      minWidth: '100px',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm" className="whitespace-nowrap">
          {row.isActive ? 'Hoạt động' : 'Tạm dừng'}
        </Badge>
      ),
    },
  ];

  return (
    <WorkspaceFrame.Root className="select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        responsive
        title="Quản trị dữ liệu & Danh mục"
        breadcrumb="Hệ thống · Quản trị dữ liệu"
        contextSelectors={
          <>
            <Input
              ref={searchInput}
              type="search"
              aria-label="Tìm kiếm danh mục"
              placeholder={activeView === 'ingredients' ? 'Tìm mã, tên nguyên liệu...' : 'Tìm mã, tên món ăn...'}
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              className="h-9 w-full sm:w-60 text-sm"
            />
            <Button variant="outline" size="default" className="h-9 text-xs" aria-label="Xóa tìm kiếm danh mục" disabled={!searchKeyword} onClick={() => { setSearchKeyword(''); searchInput.current?.focus(); }}>Xóa tìm kiếm</Button>
            <WorkspaceHeader.BadgeSlot variant="metric">
              <Badge variant="neutral" size="default" className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap">
                <Num value={pageInfo?.totalCount} /> {activeView === 'ingredients' ? 'nguyên liệu' : 'món ăn'}
              </Badge>
            </WorkspaceHeader.BadgeSlot>
          </>
        }
        actions={
          <WorkspaceHeader.Actions>
            {activeView === 'ingredients' && <ActionGuard capabilityId="CAT.INGREDIENT.CREATE" roles={['Admin', 'ADMIN', 'Manager', 'MANAGER', 'Quản lý']}>
              <Button variant="default" size="default" className="h-9 text-sm font-medium" onClick={() => void openCreate()}>Thêm nguyên liệu</Button>
            </ActionGuard>}
            <Button variant="outline" size="default" onClick={() => void loadData(true)} disabled={pending} className="h-9 text-sm font-medium">
              Làm mới
            </Button>
          </WorkspaceHeader.Actions>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <span className="text-xs font-semibold text-slate-700">
            Đang xem: {activeView === 'ingredients' ? 'Danh mục nguyên liệu thực phẩm' : 'Danh mục món ăn tiêu chuẩn'}
          </span>
        }
        telemetryPills={
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-500">{keyword ? 'Phù hợp tìm kiếm:' : 'Tổng danh mục:'}</span>
            <strong className="text-slate-900 font-mono font-bold">
              <Num value={pageInfo?.totalCount} /> mục
            </strong>
          </span>
        }
      />

      {/* Zone 3: DataGrid inside WorkspaceFrame.Body */}
      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          isLoading={stateProps.isLoading || needsPageCorrection}
          hasExistingData={stateProps.hasExistingData && !needsPageCorrection && !(stateProps.error && isPreviousResult)}
          isEmpty={stateProps.isEmpty && !needsPageCorrection && !keyword}
          emptyScenario={keyword ? 'filter-empty' : 'true-empty'}
          onResetFilters={() => setSearchKeyword('')}
          actionLabel={keyword ? 'Xóa từ khóa tìm kiếm' : undefined}
          onAction={keyword ? () => setSearchKeyword('') : () => void loadData(true)}
          contextDomain="catalog"
          onRetry={() => void loadData(true)}
        >
          {(queryResult?.activeView ?? activeView) === 'ingredients' ? (
            <DataGrid<IngredientItem>
              data={items as IngredientItem[]}
              columns={ingredientColumns}
              keyExtractor={(row) => row.ingredientId}
              emptyState={
                keyword ? (
                  <div className="text-center space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Không tìm thấy danh mục phù hợp</p>
                    <p className="text-xs text-slate-500 max-w-sm leading-relaxed">Thử từ khóa khác hoặc xóa tìm kiếm.</p>
                    <div className="pt-1">
                      <Button variant="outline" size="xs" onClick={() => setSearchKeyword('')}>
                        Xóa từ khóa tìm kiếm
                      </Button>
                    </div>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <DataGrid<DishItem>
              data={items as DishItem[]}
              columns={dishColumns}
              keyExtractor={(row) => row.dishId}
              emptyState={
                keyword ? (
                  <div className="text-center space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Không tìm thấy danh mục phù hợp</p>
                    <p className="text-xs text-slate-500 max-w-sm leading-relaxed">Thử từ khóa khác hoặc xóa tìm kiếm.</p>
                    <div className="pt-1">
                      <Button variant="outline" size="xs" onClick={() => setSearchKeyword('')}>
                        Xóa từ khóa tìm kiếm
                      </Button>
                    </div>
                  </div>
                ) : undefined
              }
            />
          )}
        </StateBoundary>
      </WorkspaceFrame.Body>

      <PaginationBar
        label="Phân trang danh mục"
        page={needsPageCorrection ? canonicalPage : pageInfo?.pageNumber ?? pageNumber}
        pageSize={pageSize}
        totalCount={pageInfo?.totalCount}
        totalPages={pageInfo?.totalPages}
        hasPrev={pageInfo?.hasPrev ?? false}
        hasNext={pageInfo?.hasNext ?? false}
        pending={pending}
        onPageChange={setPageNumber}
        onPageSizeChange={setPageSize}
      />
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} closeDisabled={createPending}
        isDirty={editingIngredient
          ? newGroup !== (editingIngredient.preparationGroupCode || 'UNCLASSIFIED') || newName !== editingIngredient.ingredientName || newReferencePrice !== String(editingIngredient.referencePrice) || newFreshDaily !== Boolean(editingIngredient.isFreshDaily)
          : Boolean(newGroup !== 'UNCLASSIFIED' || newName || newUnitId || newFreshDaily || newReferencePrice !== '0')}
        title={editingIngredient ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}
        description={editingIngredient ? 'Cập nhật thông tin danh mục; mã và đơn vị được giữ nguyên.' : 'Tạo nguyên liệu để sử dụng trong định mức BOM.'}
        footer={requestClose => <>
          <Button variant="outline" onClick={requestClose} disabled={createPending}>Hủy</Button>
          <Button type="submit" form="catalog-ingredient-form" disabled={createPending || createUnknown || Boolean(unitError) || !newName.trim() || !newUnitId}>
            {createPending ? 'Đang lưu…' : editingIngredient ? 'Lưu thay đổi' : 'Thêm nguyên liệu'}
          </Button>
        </>}>
        <form id="catalog-ingredient-form" onSubmit={submitIngredient} className="space-y-4">
          {unitError && <InlineBanner variant="error" actionLabel="Tải lại đơn vị" onAction={() => void openCreate()}>{unitError}</InlineBanner>}
          {createError && <InlineBanner variant="error">{createError}</InlineBanner>}
          {createUnknown && <Button type="button" variant="outline" onClick={() => void checkUnknownIngredient()} disabled={createPending}>Kiểm tra kết quả lưu</Button>}
          {editingIngredient && <div className="flex items-center gap-2 text-xs"><span>Mã nguyên liệu:</span><IdentifierText value={editingIngredient.ingredientCode} /></div>}
          <label className="block space-y-1 text-xs font-medium">Tên nguyên liệu
            <Input aria-label="Tên nguyên liệu" value={newName} maxLength={200} onChange={event => setNewName(event.target.value)} required disabled={createPending || createUnknown} />
          </label>
          {editingIngredient ? <label className="block space-y-1 text-xs font-medium">Đơn vị tính<Input aria-label="Đơn vị tính nguyên liệu" value={editingIngredient.unitName} readOnly disabled /></label>
            : <label className="block space-y-1 text-xs font-medium">Đơn vị tính
              <SearchableCombobox aria-label="Đơn vị tính nguyên liệu" value={newUnitId} onChange={setNewUnitId} options={units.map(unit => ({ value: unit.unitId, label: unit.unitName }))} placeholder="Tìm và chọn đơn vị" maxVisibleOptions={5} listInFlow disabled={createPending || createUnknown || Boolean(unitError)} />
            </label>}
          <label className="block space-y-1 text-xs font-medium">Nhóm cung ứng
            <Select aria-label="Nhóm cung ứng" value={newGroup} onChange={event => setNewGroup(event.target.value)} disabled={createPending || createUnknown} options={[
              { value: 'UNCLASSIFIED', label: 'Chưa phân nhóm' }, { value: 'PRODUCE', label: 'Rau củ quả' },
              { value: 'FRESH_MEAT', label: 'Thịt tươi' }, { value: 'FRESH_SEAFOOD', label: 'Thủy hải sản' },
              { value: 'FROZEN', label: 'Đông lạnh' }, { value: 'SEASONING', label: 'Gia vị' },
              { value: 'RICE', label: 'Gạo' }, { value: 'NOODLES', label: 'Bún, mỳ & phở' },
              { value: 'EGGS', label: 'Trứng' }, { value: 'DAIRY', label: 'Sữa & chế phẩm' },
              { value: 'BAKERY', label: 'Bánh' }, { value: 'BEVERAGES', label: 'Nước giải khát' },
              { value: 'PACKAGING', label: 'Bao bì' }, { value: 'ICE', label: 'Nước đá' },
              { value: 'OTHER', label: 'Khác' },
            ]} />
          </label>
          <label className="block space-y-1 text-xs font-medium">Giá tham chiếu
            <Input aria-label="Giá tham chiếu" type="number" min="0" step="0.01" value={newReferencePrice} onChange={event => setNewReferencePrice(event.target.value)} required disabled={createPending || createUnknown} />
          </label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={newFreshDaily} onChange={event => setNewFreshDaily(event.target.checked)} disabled={createPending || createUnknown} />Nguyên liệu tươi nhập hằng ngày</label>
          <p className="text-xs">Giá tham chiếu bằng 0 khiến giá vốn BOM chưa đầy đủ cho đến khi cập nhật giá.</p>
        </form>
      </Modal>
    </WorkspaceFrame.Root>
  );
}
