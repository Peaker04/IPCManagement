import { useState } from 'react';
import { useUrlWorkbenchState } from '../../../hooks/useUrlWorkbenchState';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { WorkspaceFrame } from '../../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { StateBoundary } from '../../../components/workbench/StateBoundary';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';
import {
  adminApi,
  type IngredientItem,
  type DishItem,
} from '../../../api/adminApi';

export interface AdminCatalogBranchProps {
  activeView: 'ingredients' | 'dishes';
}

export function AdminCatalogBranch({ activeView }: AdminCatalogBranchProps) {
  const {
    q: urlQ,
    setQ,
    page: pageNumber,
    setPage: setPageNumber,
  } = useUrlWorkbenchState({ defaultView: 'ingredients' });

  const [searchKeyword, setSearchKeywordState] = useState(() => urlQ || '');

  const setSearchKeyword = (newVal: string) => {
    setSearchKeywordState(newVal);
    setQ(newVal);
  };

  const {
    data: queryResult,
    stateProps,
    refetch: loadData,
  } = useWorkbenchQuery<{ items: any[]; pageInfo: any }>({
    scopeKey: `admin_${activeView}`,
    cacheKey: `admin_${activeView}_${pageNumber}_${searchKeyword.trim()}`,
    snapshotKey: `snapshot:admin_${activeView}`,
    queryFn: async () => {
      const keyword = searchKeyword.trim() || undefined;
      if (activeView === 'ingredients') {
        const result = await adminApi.getIngredients({ pageNumber, pageSize: 25, searchKeyword: keyword });
        return { items: result.items, pageInfo: result };
      } else {
        const result = await adminApi.getDishes({ pageNumber, pageSize: 25, searchKeyword: keyword });
        return { items: result.items, pageInfo: result };
      }
    },
    isDatasetEmpty: (res) => !res || !res.items || res.items.length === 0,
    emptyTitle: activeView === 'ingredients' ? 'Chưa có danh mục nguyên liệu' : 'Chưa có danh mục món ăn',
    emptyDescription: 'Chưa có dữ liệu danh mục cho phân hệ này.',
  });

  const items = queryResult?.items ?? [];
  const pageInfo = queryResult?.pageInfo ?? {
    totalCount: 0,
    pageNumber: 1,
    pageSize: 25,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  };

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
        title="Quản trị dữ liệu & Danh mục"
        breadcrumb="Hệ thống · Quản trị dữ liệu"
        contextSelectors={
          <>
            <Input
              type="search"
              aria-label="Tìm kiếm danh mục"
              placeholder={activeView === 'ingredients' ? 'Tìm mã, tên nguyên liệu...' : 'Tìm mã, tên món ăn...'}
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setPageNumber(1);
              }}
              className="h-9 w-60 text-sm"
            />
            <WorkspaceHeader.BadgeSlot variant="metric">
              <Badge variant="neutral" size="default" className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap animate-in fade-in duration-150">
                {pageInfo.totalCount} {activeView === 'ingredients' ? 'nguyên liệu' : 'món ăn'}
              </Badge>
            </WorkspaceHeader.BadgeSlot>
          </>
        }
        actions={
          <WorkspaceHeader.Actions>
            <Button variant="outline" size="default" onClick={() => void loadData(true)} className="h-9 text-sm font-medium">
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
            <span className="text-slate-500">Tổng danh mục:</span>
            <strong className="text-slate-900 font-mono font-bold">
              {pageInfo.totalCount} mặt hàng chính thức
            </strong>
          </span>
        }
      />

      {/* Zone 3: DataGrid inside WorkspaceFrame.Body */}
      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          emptyScenario={searchKeyword.trim() ? 'filter-empty' : 'true-empty'}
          onResetFilters={() => { setSearchKeyword(''); setPageNumber(1); }}
          actionLabel={searchKeyword.trim() ? 'Xóa từ khóa tìm kiếm' : undefined}
          onAction={searchKeyword.trim() ? () => { setSearchKeyword(''); setPageNumber(1); } : () => void loadData(true)}
          contextDomain="catalog"
          onRetry={() => void loadData(true)}
        >
          {activeView === 'ingredients' ? (
            <DataGrid<IngredientItem>
              data={items as IngredientItem[]}
              columns={ingredientColumns}
              keyExtractor={(row) => row.ingredientId}
            />
          ) : (
            <DataGrid<DishItem>
              data={items as DishItem[]}
              columns={dishColumns}
              keyExtractor={(row) => row.dishId}
            />
          )}
        </StateBoundary>
      </WorkspaceFrame.Body>

      {/* Server Pagination Navigation */}
      {pageInfo.totalPages > 1 && (
        <nav aria-label="Phân trang danh mục" className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2 shrink-0 bg-white">
          <span className="text-xs text-slate-500">
            Trang {pageInfo.pageNumber}/{pageInfo.totalPages} ({pageInfo.totalCount} mục)
          </span>
          <Button
            variant="outline"
            size="xs"
            disabled={!pageInfo.hasPrev || stateProps.isFetching}
            onClick={() => setPageNumber((p) => p - 1)}
          >
            Trang trước
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={!pageInfo.hasNext || stateProps.isFetching}
            onClick={() => setPageNumber((p) => p + 1)}
          >
            Trang sau
          </Button>
        </nav>
      )}
    </WorkspaceFrame.Root>
  );
}
