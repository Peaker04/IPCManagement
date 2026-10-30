export function formatNumber(
  value: number | string | null | undefined,
  format: 'currency' | 'quantity' | 'percent' | 'plain' = 'plain',
  decimals?: number
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num)) return '—';

  switch (format) {
    case 'currency': {
      const rounded = Math.round(num);
      const formatted = new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: decimals ?? 0,
        minimumFractionDigits: decimals ?? 0,
      }).format(rounded);
      return `${formatted} ₫`;
    }
    case 'quantity': {
      const maxDec = decimals ?? (num % 1 === 0 ? 0 : 2);
      const minDec = decimals !== undefined ? decimals : 0;
      return new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: maxDec,
        minimumFractionDigits: minDec,
      }).format(num);
    }
    case 'percent': {
      const dec = decimals ?? 1;
      return `${new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: dec,
        minimumFractionDigits: dec,
      }).format(num)}%`;
    }
    case 'plain':
    default: {
      return new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: decimals ?? 2,
      }).format(num);
    }
  }
}

export function formatTransactionType(type?: string | null): string {
  if (!type) return '—';
  switch (type.toUpperCase()) {
    case 'INITIAL_ISSUE':
      return 'Xuất ban đầu';
    case 'SUPPLEMENTAL_ISSUE':
      return 'Xuất bổ sung';
    case 'RETURN':
      return 'Hoàn trả';
    default:
      return type;
  }
}

export function formatUnitName(unit?: string | null): string {
  if (!unit) return 'kg';
  const u = unit.toLowerCase().trim();
  if (u === 'kilogram' || u === 'kg') return 'kg';
  if (u === 'gram' || u === 'g') return 'g';
  if (u === 'piece' || u === 'cái') return 'cái';
  return unit;
}

export function formatMaterialName(name?: string | null): string {
  if (!name) return '—';
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function formatAuditActor(actor?: string | null): string {
  if (!actor) return 'Hệ thống';
  if (actor.includes('10000000-0000-0000-0000-000000000001') || actor.includes('admin') || actor.includes('10000000-')) {
    return 'Quản trị viên (Admin)';
  }
  return actor;
}

export function formatAuditArea(area?: string | null): string {
  if (!area) return 'Hệ thống';
  switch (area.toLowerCase()) {
    case 'coordination':
      return 'Điều phối';
    case 'reconciliation':
      return 'Đối soát';
    case 'warehouse':
      return 'Kho';
    case 'planning':
      return 'Kế hoạch';
    default:
      return area;
  }
}

export function formatAuditEntity(entity?: string | null): string {
  if (!entity) return '—';
  switch (entity) {
    case 'MealQuantityPlan':
      return 'Kế hoạch suất ăn';
    case 'MenuSchedule':
      return 'Lịch thực đơn';
    case 'ReconciliationBatch':
      return 'Lô đối soát';
    case 'InventoryIssue':
      return 'Phiếu xuất kho';
    default:
      return entity;
  }
}

export function formatAuditField(field?: string | null): string {
  if (!field) return '—';
  switch (field) {
    case 'QuickCompleteServings':
      return 'Chốt số suất ca';
    case 'Status':
      return 'Trạng thái';
    case 'Quantity':
      return 'Số lượng';
    case 'Servings':
      return 'Số suất';
    default:
      return field;
  }
}

