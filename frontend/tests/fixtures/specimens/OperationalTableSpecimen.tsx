import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Layers,
  Table as TableIcon,
  Eye,
  Info,
} from 'lucide-react';

export type DensityTier = 'compact' | 'standard' | 'spacious';
export type IsaTier = 1 | 2 | 3 | 4;

export interface IsaStatusMeta {
  tier: IsaTier;
  code: string;
  label: string;
  description: string;
}

export interface MaterialDemandLine {
  id: string;
  code: string;
  name: string;
  unit: string;
  bomRate: number;
  shiftDemand: number;
  allocatedWarehouse: number;
  variance: number;
  unitPrice: number;
  totalAmount: number;
  isaStatus: IsaStatusMeta;
}

export interface PurchasingOrderLine {
  id: string;
  poLineCode: string;
  itemName: string;
  supplierName: string;
  orderQty: number;
  unit: string;
  unitPrice: number;
  vatPercent: number;
  totalAmount: number;
  deliveryDate: string;
  progress: IsaStatusMeta;
}

const formatVND = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

const formatNumberVN = (value: number, minDecimals = 0, maxDecimals = 3): string =>
  new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(value);

const formatBOM = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);

export const MOCK_MATERIAL_DEMAND_DATA: MaterialDemandLine[] = [
  {
    id: 'DEM-001',
    code: 'NVL-THIT-HEO-001',
    name: 'Thịt nạc vai heo hữu cơ VietGAP kiểm định lô chuẩn loại 1',
    unit: 'kg',
    bomRate: 0.064777,
    shiftDemand: 194.331,
    allocatedWarehouse: 120.0,
    variance: -74.331,
    unitPrice: 145000,
    totalAmount: 112500000,
    isaStatus: {
      tier: 4,
      code: 'CRITICAL_SHORTAGE',
      label: 'Thiếu hụt nghiêm trọng',
      description: 'Chênh lệch vượt ngưỡng an toàn ca sản xuất, cần tạo PO khẩn cấp',
    },
  },
  {
    id: 'DEM-002',
    code: 'NVL-CA-BASA-015',
    name: 'Phi lê cá basa tươi làm sạch cấp đông sâu chuẩn xuất khẩu',
    unit: 'kg',
    bomRate: 0.125,
    shiftDemand: 375.0,
    allocatedWarehouse: 250.0,
    variance: -125.0,
    unitPrice: 85000,
    totalAmount: 108750000,
    isaStatus: {
      tier: 3,
      code: 'PENDING_APPROVAL',
      label: 'Chờ duyệt xuất',
      description: 'Đã tạo phiếu xuất kho bổ sung, đang chờ Quản lý phê duyệt',
    },
  },
  {
    id: 'DEM-003',
    code: 'NVL-DAU-AN-009',
    name: 'Dầu thực vật tinh luyện Cái Lân can 25 lít tiêu chuẩn công nghiệp',
    unit: 'lít',
    bomRate: 0.008333,
    shiftDemand: 25.0,
    allocatedWarehouse: 25.0,
    variance: 0.0,
    unitPrice: 42000,
    totalAmount: 124000000,
    isaStatus: {
      tier: 1,
      code: 'FULFILLED',
      label: 'Hoàn tất xuất kho',
      description: 'Kho đã cấp phát đủ 100% định mức theo kế hoạch',
    },
  },
  {
    id: 'DEM-004',
    code: 'NVL-RAU-CAI-042',
    name: 'Cải thìa thủy canh Đà Lạt đóng thùng carton bảo quản mát 10kg',
    unit: 'kg',
    bomRate: 0.045,
    shiftDemand: 135.0,
    allocatedWarehouse: 110.0,
    variance: -25.0,
    unitPrice: 28000,
    totalAmount: 145250000,
    isaStatus: {
      tier: 3,
      code: 'MINOR_SHORTAGE',
      label: 'Thiếu nhẹ',
      description: 'Thiếu 25kg, NCC hẹn giao bù trước 14:00',
    },
  },
  {
    id: 'DEM-005',
    code: 'NVL-GIA-VI-088',
    name: 'Hạt nêm thịt thăn xương ống Knorr gói công nghiệp 10kg',
    unit: 'gói',
    bomRate: 0.00125,
    shiftDemand: 3.75,
    allocatedWarehouse: 3.75,
    variance: 0.0,
    unitPrice: 380000,
    totalAmount: 136800000,
    isaStatus: {
      tier: 1,
      code: 'FULFILLED',
      label: 'Đã duyệt cấp phát',
      description: 'Đã bàn giao cho Bếp trưởng nhận ca sáng',
    },
  },
  {
    id: 'DEM-006',
    code: 'NVL-HANH-TIM-021',
    name: 'Hành tím Vĩnh Châu bóc vỏ chọn lọc đóng gói chân không 1kg',
    unit: 'kg',
    bomRate: 0.00045,
    shiftDemand: 1.35,
    allocatedWarehouse: 0.0,
    variance: -1.35,
    unitPrice: 65000,
    totalAmount: 104500000,
    isaStatus: {
      tier: 2,
      code: 'IN_TRANSIT',
      label: 'Đang vận chuyển',
      description: 'Xe trung chuyển đang di chuyển từ kho tổng sang bếp chế biến',
    },
  },
];

export function IsaStatusCell({ status }: { status: IsaStatusMeta }) {
  switch (status.tier) {
    case 1:
      return (
        <span className="text-slate-600 font-normal text-xs whitespace-nowrap" title={status.description}>
          {status.label}
        </span>
      );
    case 2:
      return (
        <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium text-xs whitespace-nowrap" title={status.description}>
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
          <span>{status.label}</span>
        </span>
      );
    case 3:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold whitespace-nowrap" title={status.description}>
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-700" aria-hidden="true" />
          <span>{status.label}</span>
        </span>
      );
    case 4:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[3px] bg-red-700 text-white text-xs font-bold whitespace-nowrap shadow-2xs" title={status.description}>
          <span>{status.label}</span>
        </span>
      );
  }
}

export const DENSITY_MAP: Record<
  DensityTier,
  {
    name: string;
    controlHeight: string;
    rowHeight: string;
    fontSize: string;
    lineHeight: string;
    thClass: string;
    tdClass: string;
  }
> = {
  compact: {
    name: 'Compact (32px / 13px)',
    controlHeight: '32px',
    rowHeight: '32px – 36px',
    fontSize: '13px',
    lineHeight: '18px',
    thClass: 'h-8 px-2 py-1 text-xs font-semibold normal-case tracking-normal',
    tdClass: 'h-8 px-2 py-1 text-[13px] leading-[18px]',
  },
  standard: {
    name: 'Standard (36px / 14px)',
    controlHeight: '36px',
    rowHeight: '40px – 44px',
    fontSize: '14px',
    lineHeight: '20px',
    thClass: 'h-9 px-3 py-2 text-xs font-semibold normal-case tracking-normal',
    tdClass: 'h-10 px-3 py-2.5 text-[14px] leading-[20px]',
  },
  spacious: {
    name: 'Spacious (40px / 14px)',
    controlHeight: '40px',
    rowHeight: '48px – 56px',
    fontSize: '14px',
    lineHeight: '22px',
    thClass: 'h-11 px-4 py-3 text-xs font-semibold normal-case tracking-normal',
    tdClass: 'h-12 px-4 py-3.5 text-[14px] leading-[22px]',
  },
};

export function OperationalTableSpecimen() {
  const [activeDensity, setActiveDensity] = useState<DensityTier>('compact');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const checkScrollCues = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScrollCues();
    window.addEventListener('resize', checkScrollCues);
    return () => window.removeEventListener('resize', checkScrollCues);
  }, [checkScrollCues, activeDensity]);

  const onToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const d = DENSITY_MAP[activeDensity];

  return (
    <div
      data-testid="operational-table-specimen-root"
      className="w-full space-y-6 text-slate-800"
    >
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Kiểm định Bảng Vận hành Dày đặc & Mật độ (Data-Dense Table)
          </h3>
          <p className="text-xs text-slate-500">
            Thử nghiệm 3 mật độ (Compact/Standard/Spacious), định mức BOM 6 chữ số thập phân, tiền tệ &gt;100M VND căn phải, và phân cấp ISA-101.
          </p>
        </div>

        {/* Density switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded border border-slate-200 text-xs">
          <span className="font-semibold text-slate-600 px-1">Mật độ:</span>
          {(['compact', 'standard', 'spacious'] as DensityTier[]).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setActiveDensity(tier)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                activeDensity === tier ? 'bg-white text-blue-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table container with scroll cues */}
      <div className="bg-white border border-slate-200 rounded-[3px] shadow-2xs overflow-hidden relative">
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-900/10 to-transparent z-30 transition-opacity ${
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-900/10 to-transparent z-30 transition-opacity ${
            canScrollRight ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />

        <div
          ref={containerRef}
          onScroll={checkScrollCues}
          className="overflow-x-auto max-h-[500px] overflow-y-auto overscroll-x-contain"
        >
          <table className="w-full border-collapse text-left border-b border-slate-200 min-w-[1180px]">
            <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300 text-slate-700 shadow-2xs">
              <tr>
                <th
                  scope="col"
                  className={`sticky left-0 z-30 bg-slate-100 border-r border-slate-200 text-left ${d.thClass}`}
                  style={{ width: '180px', minWidth: '180px' }}
                >
                  Mã NVL
                </th>
                <th scope="col" className={d.thClass} style={{ width: '300px', minWidth: '300px' }}>
                  Tên nguyên vật liệu
                </th>
                <th scope="col" className={`${d.thClass} text-center`} style={{ width: '60px' }}>
                  ĐVT
                </th>
                <th scope="col" className={`${d.thClass} text-right`} style={{ width: '120px' }}>
                  Định mức BOM
                </th>
                <th scope="col" className={`${d.thClass} text-right`} style={{ width: '110px' }}>
                  Nhu cầu ca
                </th>
                <th scope="col" className={`${d.thClass} text-right`} style={{ width: '110px' }}>
                  Đã cấp kho
                </th>
                <th scope="col" className={`${d.thClass} text-right`} style={{ width: '120px' }}>
                  Chênh lệch
                </th>
                <th scope="col" className={`${d.thClass} text-right`} style={{ width: '120px' }}>
                  Đơn giá
                </th>
                <th scope="col" className={`${d.thClass} text-right`} style={{ width: '140px' }}>
                  Thành tiền VND
                </th>
                <th scope="col" className={d.thClass} style={{ width: '160px' }}>
                  Trạng thái (ISA-101)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {MOCK_MATERIAL_DEMAND_DATA.map((row) => {
                const isSelected = selectedIds.has(row.id);
                const isShortage = row.variance < 0;

                return (
                  <tr
                    key={row.id}
                    onClick={() => onToggleRow(row.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td
                      className={`sticky left-0 z-10 border-r border-slate-200 font-mono text-slate-900 font-semibold whitespace-nowrap ${d.tdClass} ${
                        isSelected ? 'bg-blue-50/95' : 'bg-white'
                      }`}
                    >
                      {row.code}
                    </td>
                    <td className={`${d.tdClass} font-medium text-slate-800`}>
                      <div className="truncate max-w-[290px]" title={row.name}>
                        {row.name}
                      </div>
                    </td>
                    <td className={`${d.tdClass} text-center text-slate-600 font-medium`}>
                      {row.unit}
                    </td>
                    <td className={`${d.tdClass} text-right font-mono tabular-nums text-slate-700`}>
                      {formatBOM(row.bomRate)}
                    </td>
                    <td className={`${d.tdClass} text-right font-mono tabular-nums text-slate-900 font-medium`}>
                      {formatNumberVN(row.shiftDemand, 3, 3)}
                    </td>
                    <td className={`${d.tdClass} text-right font-mono tabular-nums text-slate-700`}>
                      {formatNumberVN(row.allocatedWarehouse, 3, 3)}
                    </td>
                    <td
                      className={`${d.tdClass} text-right font-mono tabular-nums font-semibold ${
                        isShortage ? 'text-red-700' : 'text-slate-600'
                      }`}
                    >
                      {formatNumberVN(row.variance, 3, 3)}
                    </td>
                    <td className={`${d.tdClass} text-right font-mono tabular-nums text-slate-700`}>
                      {formatVND(row.unitPrice)}
                    </td>
                    <td className={`${d.tdClass} text-right font-mono tabular-nums font-bold text-slate-900`}>
                      {formatVND(row.totalAmount)}
                    </td>
                    <td className={d.tdClass}>
                      <IsaStatusCell status={row.isaStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default OperationalTableSpecimen;
