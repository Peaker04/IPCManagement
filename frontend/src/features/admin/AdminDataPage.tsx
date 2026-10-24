import { useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import {
  adminApi,
  type IngredientItem,
  type DishItem,
} from '../../api/adminApi';

export function AdminDataPage() {
  const [searchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'dishes' ? 'dishes' : 'ingredients';
  const [pageNumber, setPageNumber] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [prevView, setPrevView] = useState(activeView);

  // Synchronize pageNumber on view change without effect cascading render
  if (prevView !== activeView) {
    setPrevView(activeView);
    setPageNumber(1);
  }

  const [pageInfo, setPageInfo] = useState({
    totalCount: 0,
    pageNumber: 1,
    pageSize: 25,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  });
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const keyword = searchKeyword.trim() || undefined;
      if (activeView === 'ingredients') {
        const result = await adminApi.getIngredients({ pageNumber, pageSize: 25, searchKeyword: keyword });
        setIngredients(result.items);
        setPageInfo(result);
      } else {
        const result = await adminApi.getDishes({ pageNumber, pageSize: 25, searchKeyword: keyword });
        setDishes(result.items);
        setPageInfo(result);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể tải danh mục dữ liệu nền.'));
    } finally {
      setIsLoading(false);
    }
  }, [activeView, pageNumber, searchKeyword]);

  useEffect(() => {
    let ignore = false;
    const keyword = searchKeyword.trim() || undefined;

    const request = activeView === 'ingredients'
      ? adminApi.getIngredients({ pageNumber, pageSize: 25, searchKeyword: keyword })
      : adminApi.getDishes({ pageNumber, pageSize: 25, searchKeyword: keyword });

    request
      .then((result) => {
        if (ignore) return;
        if (activeView === 'ingredients') {
          setIngredients(result.items as IngredientItem[]);
        } else {
          setDishes(result.items as DishItem[]);
        }
        setPageInfo(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err : new Error('Không thể tải danh mục dữ liệu nền.'));
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeView, pageNumber, searchKeyword]);

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
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Quản trị dữ liệu & Danh mục"
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
            <Badge variant="neutral" size="default" className="h-9 px-3 text-sm font-medium flex items-center whitespace-nowrap">
              {pageInfo.totalCount} {activeView === 'ingredients' ? 'nguyên liệu' : 'món ăn'}
            </Badge>
          </>
        }
        actions={
          <Button variant="outline" size="default" onClick={loadData} className="h-9 text-sm font-medium">
            Làm mới
          </Button>
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

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        isFetching={isLoading}
        hasExistingData={activeView === 'ingredients' ? ingredients.length > 0 : dishes.length > 0}
        error={error}
        onRetry={loadData}
        isEmpty={!isLoading && !error && (activeView === 'ingredients' ? ingredients.length === 0 : dishes.length === 0)}
        emptyTitle={activeView === 'ingredients' ? 'Chưa có danh mục nguyên liệu' : 'Chưa có danh mục món ăn'}
        emptyDescription="Chưa có dữ liệu danh mục cho phân hệ này."
      >
        {activeView === 'ingredients' ? (
          <DataGrid<IngredientItem>
            data={ingredients}
            columns={ingredientColumns}
            keyExtractor={(row) => row.ingredientId}
          />
        ) : (
          <DataGrid<DishItem>
            data={dishes}
            columns={dishColumns}
            keyExtractor={(row) => row.dishId}
          />
        )}
      </StateBoundary>

      {/* Server Pagination Navigation */}
      {pageInfo.totalPages > 1 && (
        <nav aria-label="Phân trang danh mục" className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2">
          <span className="text-xs text-slate-500">
            Trang {pageInfo.pageNumber}/{pageInfo.totalPages} ({pageInfo.totalCount} mục)
          </span>
          <Button
            variant="outline"
            size="xs"
            disabled={!pageInfo.hasPrev || isLoading}
            onClick={() => {
              setIsLoading(true);
              setError(null);
              setPageNumber((p) => p - 1);
            }}
          >
            Trang trước
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={!pageInfo.hasNext || isLoading}
            onClick={() => {
              setIsLoading(true);
              setError(null);
              setPageNumber((p) => p + 1);
            }}
          >
            Trang sau
          </Button>
        </nav>
      )}
    </div>
  );
}
