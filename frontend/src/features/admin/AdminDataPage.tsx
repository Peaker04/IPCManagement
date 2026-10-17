import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Button } from '../../components/ui/button';
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
  const activeTab = searchParams.get('view') === 'dishes' ? 'dishes' : 'ingredients';
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ings, dshs] = await Promise.all([
        adminApi.getIngredients(),
        adminApi.getDishes(),
      ]);
      setIngredients(ings);
      setDishes(dshs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể tải danh mục dữ liệu nền.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const [ings, dshs] = await Promise.all([
          adminApi.getIngredients(),
          adminApi.getDishes(),
        ]);
        if (!ignore) {
          setIngredients(ings);
          setDishes(dshs);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err : new Error('Không thể tải danh mục dữ liệu nền.'));
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, []);

  const ingredientColumns: ColumnDef<IngredientItem>[] = [
    {
      id: 'code',
      header: 'Mã nguyên liệu',
      width: '18%',
      cell: (row) => <IdentifierText value={row.ingredientCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '32%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.ingredientName}</span>,
    },
    {
      id: 'category',
      header: 'Nhóm thực phẩm',
      width: '18%',
      cell: (row) => <span className="text-slate-600 text-sm">{row.categoryName}</span>,
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '12%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.unitName}</span>,
    },
    {
      id: 'price',
      header: 'Đơn giá tham chiếu',
      width: '18%',
      align: 'right',
      cell: (row) => <Num value={row.referencePrice} format="currency" className="font-bold text-slate-900 text-sm" />,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">
          {row.isActive ? 'Đang áp dụng' : 'Tạm khóa'}
        </Badge>
      ),
    },
  ];

  const dishColumns: ColumnDef<DishItem>[] = [
    {
      id: 'code',
      header: 'Mã món',
      width: '20%',
      cell: (row) => <IdentifierText value={row.dishCode} />,
    },
    {
      id: 'name',
      header: 'Tên món ăn tiêu chuẩn',
      width: '40%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.dishName}</span>,
    },
    {
      id: 'group',
      header: 'Nhóm phân loại',
      width: '24%',
      cell: (row) => <span className="text-slate-600 text-sm">{row.dishGroup}</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '16%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">
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
          <Badge variant="neutral" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
            {ingredients.length} nguyên liệu · {dishes.length} món ăn
          </Badge>
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
            Đang xem: {activeTab === 'ingredients' ? 'Danh mục nguyên liệu' : 'Danh mục món ăn'}
          </span>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng danh mục:</span>
              <strong className="text-slate-900 font-mono font-bold">
                {activeTab === 'ingredients' ? ingredients.length : dishes.length} mặt hàng
              </strong>
            </span>
          </>
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={loadData}
        isEmpty={activeTab === 'ingredients' ? ingredients.length === 0 : dishes.length === 0}
      >
        {activeTab === 'ingredients' ? (
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

    </div>
  );
}
