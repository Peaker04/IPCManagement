import type { WarehouseDto } from '@/api/workflowApiTypes';

export type OperationalWarehouseContext =
  | { state: 'ready'; warehouse: WarehouseDto; blocker: null }
  | { state: 'blocked'; warehouse: undefined; blocker: string };

export const resolveOperationalWarehouseContext = (
  warehouses: readonly WarehouseDto[],
): OperationalWarehouseContext => warehouses.length === 1
  ? { state: 'ready', warehouse: warehouses[0], blocker: null }
  : {
      state: 'blocked',
      warehouse: undefined,
      blocker: warehouses.length === 0
        ? 'Chưa có kho vận hành. Mọi thao tác kho đang bị khóa.'
        : 'Dữ liệu kho vận hành không hợp lệ. Mọi thao tác kho đang bị khóa.',
    };
