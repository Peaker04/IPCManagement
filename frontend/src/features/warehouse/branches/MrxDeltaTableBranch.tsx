import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import type { MrxSourceDelta } from '../../../api/mrxApi';

export interface MrxDeltaTableBranchProps {
  items: readonly MrxSourceDelta[];
  columns: ColumnDef<MrxSourceDelta>[];
  selectedDelta: MrxSourceDelta | null;
  onCloseModal: () => void;
  processingId: string | null;
  actualQuantity: string;
  onChangeActualQuantity: (val: string) => void;
  varianceReason: string;
  onChangeVarianceReason: (val: string) => void;
  hasDiscrepancy: boolean;
  canConfirm: boolean;
  onExecute: (delta: MrxSourceDelta) => void | Promise<void>;
}

export function MrxDeltaTableBranch({
  items,
  columns,
  selectedDelta,
  onCloseModal,
  processingId,
  actualQuantity,
  onChangeActualQuantity,
  varianceReason,
  onChangeVarianceReason,
  hasDiscrepancy,
  canConfirm,
  onExecute,
}: MrxDeltaTableBranchProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DataGrid data={items} columns={columns} keyExtractor={(delta) => delta.sourceDeltaId} />

      <Modal
        isOpen={Boolean(selectedDelta)}
        onClose={onCloseModal}
        title="Xác nhận xử lý thay đổi nguồn"
        description={selectedDelta ? `${selectedDelta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'Xuất bổ sung' : 'Hoàn trả vật lý'} cho ${selectedDelta.ingredientName ?? selectedDelta.ingredientCode ?? selectedDelta.ingredientId}` : ''}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCloseModal}>Quay lại</Button>
            <Button
              size="sm"
              disabled={processingId !== null || !canConfirm || Number(actualQuantity) <= 0}
              onClick={() => {
                if (selectedDelta) void onExecute(selectedDelta);
              }}
            >
              {processingId ? 'Đang xử lý...' : 'Xác nhận xử lý'}
            </Button>
          </div>
        }
      >
        {selectedDelta && (
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="actual-quantity-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Số lượng thực tế ({selectedDelta.canonicalUnitName ?? 'ĐVT'})
              </label>
              <Input
                id="actual-quantity-input"
                type="number"
                step="any"
                aria-label="Số lượng thực tế"
                value={actualQuantity}
                onChange={(e) => onChangeActualQuantity(e.target.value)}
              />
            </div>
            {hasDiscrepancy && (
              <div>
                <label htmlFor="variance-reason-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do chênh lệch thực tế <span className="text-rose-600">*</span>
                </label>
                <Input
                  id="variance-reason-input"
                  type="text"
                  aria-label="Lý do chênh lệch thực tế"
                  placeholder="Nêu lý do thực xuất/thực nhận lệch số lượng delta..."
                  value={varianceReason}
                  onChange={(e) => onChangeVarianceReason(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Gợi ý lý do chênh lệch cửa kho">
                  {[
                    'Hao hụt rã đông/rơi vãi',
                    'Bếp giữ lại dùng ca sau',
                    'Sai lệch bao bì cân đong',
                    'Giao thiếu so với phiếu',
                  ].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => onChangeVarianceReason(preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
