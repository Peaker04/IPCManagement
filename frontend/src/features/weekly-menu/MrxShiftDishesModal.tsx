import { useMemo } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierText } from '../../components/ui/identifier-text';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../utils/dates';
import type { PlanSummaryItem, ShiftDishDetail } from './MrxBatchPreviewSection';

interface MrxShiftDishesModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanSummaryItem | null;
}

function resolveSlotLabel(slot?: string | null): string {
  if (!slot) return 'Món chính';
  const s = slot.toLowerCase();
  if (s.includes('soup') || s.includes('canh')) return 'Món canh';
  if (s.includes('veg') || s.includes('xào') || s.includes('rau')) return 'Món xào';
  if (s.includes('fruit') || s.includes('dessert') || s.includes('trái')) return 'Tráng miệng';
  if (s.includes('side') || s.includes('phụ')) return 'Món phụ';
  return 'Món chính';
}

function resolveSlotVariant(label: string): 'info' | 'success' | 'warning' | 'neutral' {
  if (label === 'Món chính') return 'info';
  if (label === 'Món canh') return 'success';
  if (label === 'Món xào') return 'warning';
  return 'neutral';
}

export function MrxShiftDishesModal({
  isOpen,
  onClose,
  plan,
}: MrxShiftDishesModalProps) {
  const dishes = useMemo<ShiftDishDetail[]>(() => {
    return plan?.dishesDetails || [];
  }, [plan]);

  const columns = useMemo<ColumnDef<ShiftDishDetail>[]>(() => [
    {
      id: 'stt',
      header: 'STT',
      width: '6%',
      minWidth: '50px',
      align: 'center',
      cell: (_, idx) => <span className="font-mono text-xs text-slate-500">{idx + 1}</span>,
    },
    {
      id: 'slot',
      header: 'Phân loại món',
      width: '16%',
      minWidth: '110px',
      cell: (row) => {
        const label = resolveSlotLabel(row.dishSlot);
        const variant = resolveSlotVariant(label);
        return (
          <Badge variant={variant} size="sm" className="whitespace-nowrap">
            {label}
          </Badge>
        );
      },
    },
    {
      id: 'code',
      header: 'Mã món',
      width: '16%',
      minWidth: '130px',
      cell: (row) => <IdentifierText value={row.dishCode || row.dishId} />,
    },
    {
      id: 'name',
      header: 'Tên món ăn trong ca',
      width: '32%',
      minWidth: '220px',
      cell: (row) => (
        <span className="font-semibold text-slate-900 text-sm whitespace-normal leading-snug">{row.dishName}</span>
      ),
    },
    {
      id: 'materials',
      header: 'Định mức BOM',
      width: '30%',
      minWidth: '240px',
      cell: (row) => {
        const count = row.materials?.length ?? 0;
        return (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-800">
              {count > 0 ? `${count} nguyên liệu cấu thành` : 'Chưa có dòng BOM'}
            </span>
            {count > 0 && (
              <span className="text-xs text-slate-500 whitespace-normal leading-relaxed mt-0.5">
                {row.materials.map((m) => m.ingredientName).slice(0, 4).join(', ')}
                {count > 4 ? ` (+${count - 4} NL khác)` : ''}
              </span>
            )}
          </div>
        );
      },
    },
  ], []);

  if (!plan) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-4xl"
      title={`Ma trận món ăn ca: ${plan.shift} · Ngày ${toVietnameseDate(plan.serviceDate)}`}
      description={`Kế hoạch: ${plan.planCode} · Quy mô: ${plan.servings.toLocaleString('vi-VN')} suất · ${plan.menuName}`}
      footer={
        <Button variant="default" size="sm" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="flex flex-col min-h-[300px] max-h-[60vh] -mx-4 -my-2 overflow-auto">
        <DataGrid
          data={dishes}
          columns={columns}
          keyExtractor={(row) => row.dishId || row.dishCode}
          emptyMessage="Không có món ăn nào trong ca này."
        />
      </div>
    </Modal>
  );
}
