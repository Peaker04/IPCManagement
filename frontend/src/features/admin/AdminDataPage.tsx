import { useState, useEffect } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Tabs } from '../../components/ui/tabs';
import { Modal } from '../../components/ui/modal';
import { Input } from '../../components/ui/input';
import {
  adminApi,
  type IngredientItem,
  type DishItem,
} from '../../api/adminApi';

export function AdminDataPage() {
  const [activeTab, setActiveTab] = useState<'ingredients' | 'dishes'>('ingredients');
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Ingredient Modal
  const [isNewIngOpen, setIsNewIngOpen] = useState(false);
  const [ingCode, setIngCode] = useState('');
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState('Kilogram');
  const [ingPrice, setIngPrice] = useState(45000);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError(err instanceof Error ? err.message : 'Không thể tải danh mục dữ liệu nền.');
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
          setError(err instanceof Error ? err.message : 'Không thể tải danh mục dữ liệu nền.');
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateIngredient = async () => {
    if (!ingCode || !ingName) {
      alert('Vui lòng nhập đầy đủ mã và tên nguyên liệu');
      return;
    }
    setIsSubmitting(true);
    try {
      await adminApi.createIngredient({
        ingredientCode: ingCode,
        ingredientName: ingName,
        unitName: ingUnit,
        referencePrice: ingPrice,
      });
      setIsNewIngOpen(false);
      setIngCode('');
      setIngName('');
      await loadData();
      alert('Đã thêm nguyên liệu mới vào danh mục thành công!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Thêm nguyên liệu thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const TAB_ITEMS = [
    { id: 'ingredients', label: 'Danh mục nguyên liệu', count: ingredients.length },
    { id: 'dishes', label: 'Danh mục món ăn tiêu chuẩn', count: dishes.length },
  ];

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
            <Button
              variant="default"
              size="default"
              onClick={() => setIsNewIngOpen(true)}
              className="h-9 text-sm font-medium"
            >
              Thêm nguyên liệu mới
            </Button>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={TAB_ITEMS}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as 'ingredients' | 'dishes')}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng danh mục:</span>
              <strong className="text-slate-900 font-mono font-bold">
                {activeTab === 'ingredients' ? ingredients.length : dishes.length} mặt hàng
              </strong>
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="success" size="sm">
              Đạt chuẩn HACCP: 100%
            </Badge>
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

      {/* New Ingredient Modal */}
      <Modal
        isOpen={isNewIngOpen}
        onClose={() => setIsNewIngOpen(false)}
        title="Thêm nguyên liệu thực phẩm mới"
        description="Đăng ký mặt hàng mới vào danh mục định mức của hệ thống"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsNewIngOpen(false)}>
              Hủy bỏ
            </Button>
            <Button variant="default" size="sm" disabled={isSubmitting} onClick={handleCreateIngredient}>
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận thêm'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Mã nguyên liệu</label>
            <Input
              placeholder="Ví dụ: NL-THIT-99"
              value={ingCode}
              onChange={(e) => setIngCode(e.target.value)}
              className="h-9 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Tên nguyên liệu thực phẩm</label>
            <Input
              placeholder="Ví dụ: Sườn non bò Úc đông lạnh"
              value={ingName}
              onChange={(e) => setIngName(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Đơn vị tính (ĐVT)</label>
              <Input
                value={ingUnit}
                onChange={(e) => setIngUnit(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Đơn giá tham chiếu (₫)</label>
              <Input
                type="number"
                value={ingPrice}
                onChange={(e) => setIngPrice(parseFloat(e.target.value) || 0)}
                className="h-9"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
