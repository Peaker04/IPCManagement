import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Building2,
  FileSpreadsheet,
  Sparkles,
  Clock,
  Send,
  ReceiptText,
} from 'lucide-react';

interface MaterialDemandRow {
  id: string;
  code: string;
  name: string;
  category: string;
  uom: string;
  bomRate: number; // 6 decimals
  plannedPortions: number;
  grossDemand: number;
  availableStock: number;
  shortage: number;
  unitCost: number;
  totalCostVnd: number;
  status: 'FULFILLED' | 'PENDING_PO' | 'CRITICAL_SHORTAGE';
  supplier: string;
}

const SAMPLE_DEMAND_DATA: MaterialDemandRow[] = [
  {
    id: 'MAT-001',
    code: 'NVL-THIT-01',
    name: 'Thịt nạc vai heo VietGAP',
    category: 'Thực phẩm tươi',
    uom: 'kg',
    bomRate: 0.125000,
    plannedPortions: 2450,
    grossDemand: 306.25,
    availableStock: 350.00,
    shortage: 0,
    unitCost: 115000,
    totalCostVnd: 35218750,
    status: 'FULFILLED',
    supplier: 'CP Việt Nam - CN Bình Dương',
  },
  {
    id: 'MAT-002',
    code: 'NVL-GAO-02',
    name: 'Gạo thơm ST25 Thượng hạng',
    category: 'Lương thực khô',
    uom: 'kg',
    bomRate: 0.150000,
    plannedPortions: 2450,
    grossDemand: 367.50,
    availableStock: 200.00,
    shortage: 167.50,
    unitCost: 32000,
    totalCostVnd: 11760000,
    status: 'CRITICAL_SHORTAGE',
    supplier: 'Đại lý Lương thực Miền Nam',
  },
  {
    id: 'MAT-003',
    code: 'NVL-DAU-03',
    name: 'Dầu thực vật Cái Lân Can 25L',
    category: 'Gia vị & Dầu ăn',
    uom: 'lít',
    bomRate: 0.015000,
    plannedPortions: 2450,
    grossDemand: 36.75,
    availableStock: 40.00,
    shortage: 0,
    unitCost: 45000,
    totalCostVnd: 1653750,
    status: 'FULFILLED',
    supplier: 'Công ty Dầu thực vật Cái Lân',
  },
  {
    id: 'MAT-004',
    code: 'NVL-HANH-04',
    name: 'Hành tím củ Lý Sơn loại 1',
    category: 'Rau củ gia vị',
    uom: 'kg',
    bomRate: 0.008500,
    plannedPortions: 2450,
    grossDemand: 20.825,
    availableStock: 15.00,
    shortage: 5.825,
    unitCost: 65000,
    totalCostVnd: 1353625,
    status: 'PENDING_PO',
    supplier: 'HTX Nông sản Xanh Quảng Ngãi',
  },
  {
    id: 'MAT-005',
    code: 'NVL-MAM-05',
    name: 'Nước mắm Phan Thiết 35 độ đạm',
    category: 'Gia vị & Dầu ăn',
    uom: 'lít',
    bomRate: 0.007500,
    plannedPortions: 2450,
    grossDemand: 18.375,
    availableStock: 25.00,
    shortage: 0,
    unitCost: 78000,
    totalCostVnd: 1433250,
    status: 'FULFILLED',
    supplier: 'Nước mắm Cà Ná - Phan Thiết',
  },
  {
    id: 'MAT-006',
    code: 'NVL-CAI-06',
    name: 'Cải ngọt VietGAP Đà Lạt',
    category: 'Rau củ tươi',
    uom: 'kg',
    bomRate: 0.080000,
    plannedPortions: 2450,
    grossDemand: 196.00,
    availableStock: 120.00,
    shortage: 76.00,
    unitCost: 22000,
    totalCostVnd: 4312000,
    status: 'PENDING_PO',
    supplier: 'HTX Nông trại Đà Lạt Fresh',
  },
];

export function MaterialDemandWorkspaceSpecimen() {
  const [selectedRowId, setSelectedRowId] = useState<string | null>('MAT-002');
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedItems, setSelectedItems] = useState<string[]>(['MAT-002']);

  const selectedRow = SAMPLE_DEMAND_DATA.find((r) => r.id === selectedRowId);

  const filteredData = SAMPLE_DEMAND_DATA.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.code.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredData.map((d) => d.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalDemandVnd = filteredData.reduce((acc, curr) => acc + curr.totalCostVnd, 0);
  const totalShortages = filteredData.filter((d) => d.shortage > 0).length;

  return (
    <div
      data-testid="material-demand-workspace"
      className="space-y-4 text-[#0f172a]"
    >
      {/* ZONE 1: OPERATIONAL FRAME WORKSPACE IDENTITY */}
      <div className="bg-white border border-[#cbd5e1] rounded-[3px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#475569] mb-1">
            <span className="font-medium text-slate-800">Kế hoạch &amp; Điều phối</span>
            <span className="text-slate-300">/</span>
            <span>Nhu cầu nguyên vật liệu</span>
          </div>
          <h2 className="text-lg font-bold text-[#0f172a] tracking-tight">
            Tính toán Nhu cầu &amp; Cân đối Tồn kho Nguyên liệu
          </h2>
          <p className="text-xs text-[#475569] mt-0.5">
            Áp dụng định mức BOM tuần 42 cho 2.450 suất ăn &bull; Hợp đồng: FPT Software Complex
          </p>
        </div>

        {/* Operational Telemetry Summary */}
        <div className="flex items-center gap-5 text-xs">
          <div className="text-right">
            <span className="text-[11px] text-[#475569] block">Tổng chi phí dự kiến</span>
            <span className="font-semibold text-slate-900 font-mono text-sm tabular-nums">
              {totalDemandVnd.toLocaleString('vi-VN')} ₫
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-right">
            <span className="text-[11px] text-[#475569] block">Mặt hàng thiếu hụt</span>
            <span className="font-semibold text-rose-700 font-mono text-sm tabular-nums">
              {totalShortages} mặt hàng
            </span>
          </div>
        </div>
      </div>

      {/* ZONE 2: COMMAND BAR (SCOPE / FILTER / ACTIONS) */}
      <div className="bg-white border border-[#cbd5e1] rounded-[3px] p-2.5 px-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* GROUP A: SCOPE SELECTION (No artificial heavy card boxes) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-[2px]">
            <Building2 size={13} className="text-[#164e87]" />
            <span>FPT Complex (Khu CNC)</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 font-medium bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-[2px]">
            <Calendar size={13} className="text-slate-500" />
            <span>Tuần 42 (19/10 - 24/10)</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 font-medium bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-[2px]">
            <Clock size={13} className="text-slate-500" />
            <span>Thứ Tư &bull; Ca trưa (11:00)</span>
          </div>
        </div>

        {/* GROUP B: FIND & FILTER CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative w-56">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã NVL, tên..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 bg-white border border-[#64748b] rounded-[2px] text-xs outline-none focus:border-[#164e87] focus:ring-1 focus:ring-[#164e87]"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 px-2 bg-white border border-[#64748b] rounded-[2px] text-xs text-slate-800 outline-none focus:border-[#164e87]"
          >
            <option value="ALL">Tất cả phân loại</option>
            <option value="Thực phẩm tươi">Thực phẩm tươi</option>
            <option value="Lương thực khô">Lương thực khô</option>
            <option value="Gia vị & Dầu ăn">Gia vị & Dầu ăn</option>
            <option value="Rau củ gia vị">Rau củ gia vị</option>
            <option value="Rau củ tươi">Rau củ tươi</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2 bg-white border border-[#64748b] rounded-[2px] text-xs text-slate-800 outline-none focus:border-[#164e87]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="FULFILLED">Đủ kho</option>
            <option value="PENDING_PO">Chờ mua PO</option>
            <option value="CRITICAL_SHORTAGE">Thiếu cấp bách</option>
          </select>

          {/* Primary action belongs to the scoped command bar */}
          <button
            type="button"
            className="h-8 px-3.5 bg-[#164e87] text-white text-xs font-semibold rounded-[3px] hover:bg-[#113c69] active:translate-y-px transition-[transform,background-color] duration-100 flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={13} />
            <span>Nổ định mức ca</span>
          </button>
          {/* Export Action */}
          <button
            type="button"
            className="h-8 px-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-[2px] flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <FileSpreadsheet size={13} className="text-emerald-700" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* ZONE 3 & 4: DATA TABLE AND COMPLEMENTARY ASIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Operational Table (8 cols on lg) */}
        <div className="lg:col-span-8 bg-white border border-[#cbd5e1] rounded-[3px] overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] text-[#475569] font-semibold">
                  <th className="py-2.5 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredData.length && filteredData.length > 0}
                      onChange={toggleSelectAll}
                      aria-label="Chọn tất cả nguyên vật liệu"
                      className="size-3.5 rounded-[2px] border-[#64748b] text-[#164e87] cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">Mã NVL</th>
                  <th className="py-2.5 px-3">Tên nguyên vật liệu</th>
                  <th className="py-2.5 px-2 text-center">ĐVT</th>
                  <th className="py-2.5 px-3 text-right">Định mức BOM</th>
                  <th className="py-2.5 px-3 text-right">Nhu cầu ca</th>
                  <th className="py-2.5 px-3 text-right">Tồn khả dụng</th>
                  <th className="py-2.5 px-3 text-right">Thiếu hụt</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row) => {
                  const isSelected = selectedRowId === row.id;
                  const isChecked = selectedItems.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRowId(row.id)}
                      className={`cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-[#f0f5fc]'
                          : 'hover:bg-slate-50/80 text-slate-800'
                      }`}
                    >
                      <td
                        className="py-2 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectItem(row.id)}
                          aria-label={`Chọn ${row.name}`}
                          className="size-3.5 rounded-[2px] border-[#64748b] text-[#164e87] cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {row.code}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900 block">{row.name}</span>
                        <span className="text-[10px] text-slate-500">{row.category}</span>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-600 font-mono">
                        {row.uom}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {row.bomRate.toFixed(6)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {row.grossDemand.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {row.availableStock.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {row.shortage > 0 ? (
                          <span className="text-rose-700 font-bold">
                            -{row.shortage.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-400">0.00</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {/* ISA-101 Sparse escalation status */}
                        {row.status === 'FULFILLED' && (
                          <span className="text-[11px] text-slate-500 font-normal">Đủ kho</span>
                        )}
                        {row.status === 'PENDING_PO' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#fffbeb] text-[#92400e] border border-[#fde68a]">
                            Chờ mua PO
                          </span>
                        )}
                        {row.status === 'CRITICAL_SHORTAGE' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
                            Thiếu cấp bách
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="bg-[#f8fafc] border-t border-[#cbd5e1] p-2.5 px-4 text-xs text-[#475569] flex justify-between items-center">
            <span>Hiển thị {filteredData.length} / 6 mặt hàng &bull; Đã chọn {selectedItems.length}</span>
            <div className="flex gap-4 font-mono">
              <span>Định mức tổng: <strong className="text-slate-900">1.139,70 kg/lít</strong></span>
            </div>
          </div>
        </div>

        {/* Complementary Detail Aside (4 cols on lg) */}
        <div className="lg:col-span-4 bg-white border border-[#cbd5e1] rounded-[3px] p-4 flex flex-col justify-between">
          {selectedRow ? (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block whitespace-nowrap">{selectedRow.code}</span>
                  <h4 className="text-sm font-bold text-slate-900">{selectedRow.name}</h4>
                  <span className="text-xs text-slate-500">{selectedRow.category}</span>
                </div>
                {selectedRow.shortage > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] font-bold">
                    Thiếu hụt
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                    Khả dụng
                  </span>
                )}
              </div>

              {/* Calculations breakdown equation */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Định mức BOM/suất:</span>
                  <span className="font-mono font-medium">{selectedRow.bomRate.toFixed(6)} {selectedRow.uom}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Suất ăn phục vụ:</span>
                  <span className="font-mono font-medium">{selectedRow.plannedPortions.toLocaleString('vi-VN')} suất</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Tổng nhu cầu ca:</span>
                  <span className="font-mono font-semibold text-[#164e87]">
                    {selectedRow.grossDemand.toFixed(2)} {selectedRow.uom}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Tồn kho thực tế:</span>
                  <span className="font-mono font-medium">{selectedRow.availableStock.toFixed(2)} {selectedRow.uom}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Số lượng cần mua:</span>
                  <span className="font-mono font-bold text-rose-700">
                    {selectedRow.shortage.toFixed(2)} {selectedRow.uom}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Đơn giá hợp đồng:</span>
                  <span className="font-mono font-medium">{selectedRow.unitCost.toLocaleString('vi-VN')} ₫/{selectedRow.uom}</span>
                </div>
                <div className="flex justify-between py-1 pt-1.5">
                  <span className="font-semibold text-slate-800">Thành tiền dự kiến:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {selectedRow.totalCostVnd.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>

              {/* Supplier card */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[2px] space-y-1 text-xs">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Nhà cung cấp được chỉ định
                </span>
                <span className="font-semibold text-slate-900 block">{selectedRow.supplier}</span>
                <p className="text-[11px] text-slate-500">Thời gian giao hàng chuẩn: 04:30 sáng hàng ngày</p>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex flex-col gap-2">
                {selectedRow.shortage > 0 ? (
                  <button
                    type="button"
                    className="w-full h-8 bg-rose-700 text-white rounded-[2px] text-xs font-semibold hover:bg-rose-800 active:translate-y-px transition-[transform,background-color] duration-100 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ReceiptText size={13} />
                    <span>Lập đề xuất mua hàng (PO) khẩn</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full h-8 bg-[#164e87] text-white rounded-[2px] text-xs font-semibold hover:bg-[#113c69] active:translate-y-px transition-[transform,background-color] duration-100 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Xuất phiếu cấp phát kho</span>
                  </button>
                )}
                <button
                  type="button"
                  className="w-full h-8 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-[2px] text-xs font-medium cursor-pointer"
                >
                  Xem lịch sử xuất nhập NVL này
                </button>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              Chọn một dòng nguyên liệu để xem chi tiết tính toán
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MaterialDemandWorkspaceSpecimen;
