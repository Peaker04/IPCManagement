import { MRX_STATUS_LABELS } from '../constants/mrxConstants';

export function formatNumber(
  value: number | string | null | undefined,
  format: 'currency' | 'quantity' | 'percent' | 'rate' | 'plain' = 'plain',
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
    case 'rate': {
      return new Intl.NumberFormat('vi-VN', {
        maximumSignificantDigits: 15,
      }).format(num);
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
    case 'PHYSICAL_RETURN':
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
  const normalized = actor.trim().toLowerCase();
  if (normalized === '10000000-0000-0000-0000-000000000001' || normalized === 'admin') return 'Quản trị viên (Admin)';
  if (normalized === '10000000-0000-0000-0000-000000000002' || normalized === 'manager') return 'Quản lý (Manager)';
  if (normalized === '10000000-0000-0000-0000-000000000003' || normalized === 'coordinator') return 'Điều phối viên (Coordinator)';
  if (normalized === '10000000-0000-0000-0000-000000000004' || normalized === 'warehouse') return 'Thủ kho (Warehouse)';
  if (normalized === '10000000-0000-0000-0000-000000000005' || normalized === 'purchasing') return 'Mua hàng (Purchasing)';
  if (normalized === '10000000-0000-0000-0000-000000000006' || normalized === 'headchef') return 'Bếp trưởng (Head Chef)';
  if (actor.includes('admin')) {
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
    case 'inventory':
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
    case 'QuantityImportBatch': return 'Đợt nhập số suất';
    case 'MealQuantityPlanLine': return 'Số suất theo món và ca';
    case 'MenuVersion': return 'Phiên bản thực đơn';
    case 'MenuAmendment': return 'Điều chỉnh thực đơn';
    case 'MenuAmendmentScheduleLine': return 'Dòng điều chỉnh lịch ăn';
    case 'BomAdjustment': return 'Điều chỉnh BOM';
    case 'DishBom': return 'Định mức món ăn';
    case 'Menu': return 'Thực đơn';
    case 'MenuItem': return 'Món trong thực đơn';
    case 'ReconciliationDailyDisposition': return 'Xử lý chênh lệch';
    case 'ReconciliationSourceRevision': return 'Phiên bản nguồn đối soát';
    case 'InventoryIssueLine': return 'Dòng xuất kho';
    case 'InventoryReturn': return 'Phiếu hoàn trả kho';
    case 'InventoryReturnLine': return 'Dòng hoàn trả kho';
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
    case 'FinalServings': return 'Số suất chốt';
    case 'VegetarianServings': return 'Số suất chay';
    case 'SavoryServings': return 'Số suất mặn';
    case 'DishId': return 'Món ăn';
    case 'Commit': return 'Xác nhận nguồn số suất';
    case 'IssuedQty': return 'Số lượng thực xuất';
    case 'ReceivedAt': return 'Xác nhận nhận hàng';
    case 'Category': return 'Phân loại giải trình';
    case 'Validity': return 'Hiệu lực giải trình';
    case 'SourceVersion': return 'Phiên bản nguồn';
    case 'MenuAndServings': return 'Thực đơn & số suất';
    case 'QuantityAndWaste': return 'Định lượng & hao hụt';
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

export function formatAuditValue(field?: string | null, value?: string | null): string {
  if (!value) return '—';
  if (field === 'Commit') return 'Đã xác nhận dữ liệu nguồn';
  if (field === 'Status') return MRX_STATUS_LABELS[value] ?? value;
  if (field === 'DishId' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) return `Mã món ${value}`;
  if (['FinalServings', 'VegetarianServings', 'SavoryServings', 'Servings'].includes(field ?? '') && /^\d+(?:\.\d+)?$/.test(value))
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 }).format(Number(value))} suất`;
  if (['IssuedQty', 'Quantity'].includes(field ?? '') && /^\d+(?:\.\d+)?$/.test(value))
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 }).format(Number(value));
  return value;
}

