import React, { useState } from 'react';
import {
  // Tier 1 System Icons (Mechanics)
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  Plus,
  Trash2,
  Pencil,
  Download,
  Upload,
  Copy,
  RefreshCw,
  RotateCcw,
  Check,
  TriangleAlert,
  CircleAlert,
  Info,
  ShieldAlert,
  // Tier 2 Curated Domain Icon Vocabulary
  ChefHat,
  CookingPot,
  Warehouse,
  PackageCheck,
  PackageMinus,
  Scale,
  ArrowRightLeft,
  Boxes,
  BookOpen,
  Calculator,
  ReceiptText,
  Handshake,
  FolderTree,
  Utensils,
  CalendarClock,
  ClipboardCheck,
  PlusCircle,
  Coins,
  TrendingUp,
  Weight,
  Flame,
  LayoutDashboard,
} from 'lucide-react';

export function IconographySpecimen() {
  const [activeTab, setActiveTab] = useState<'all' | 'tier1' | 'tier2' | 'conflicts'>('all');
  const [iconSize, setIconSize] = useState<'16' | '20'>('16');

  const systemMechanics = [
    { name: 'Search', icon: Search, role: 'Tìm kiếm dữ liệu', rule: 'size-4 (16px) trong input / toolbar' },
    { name: 'X', icon: X, role: 'Đóng modal / Hủy bộ lọc', rule: 'size-4 (16px) trên nút đóng' },
    { name: 'ChevronDown', icon: ChevronDown, role: 'Mở rộng khối / Dropdown', rule: 'Xoay 180° khi mở' },
    { name: 'ChevronRight', icon: ChevronRight, role: 'Duyệt bước / Phân trang tới', rule: 'Trỏ tới trong stepper / table' },
    { name: 'Filter', icon: Filter, role: 'Mở bộ lọc phạm vi', rule: 'Gắn trên CommandBar' },
    { name: 'Plus', icon: Plus, role: 'Thêm mới thực thể', rule: 'Đi kèm nhãn text rõ ràng' },
    { name: 'Trash2', icon: Trash2, role: 'Xóa bản ghi (Destructive)', rule: 'Kèm xác nhận ConfirmDialog' },
    { name: 'Pencil', icon: Pencil, role: 'Chỉnh sửa dữ liệu', rule: 'Thay thế cho Edit / Edit2' },
    { name: 'Download', icon: Download, role: 'Xuất file Excel / CSV', rule: 'Thay thế cho FileDown' },
    { name: 'Upload', icon: Upload, role: 'Nạp file Excel thực đơn', rule: 'Kèm thanh tiến trình nạp' },
    { name: 'Copy', icon: Copy, role: 'Sao chép mã chứng từ', rule: 'Kèm phản hồi toast đã chép' },
    { name: 'RefreshCw', icon: RefreshCw, role: 'Tải lại dữ liệu / Thử lại', rule: 'Không dùng cho hoàn hàng' },
    { name: 'RotateCcw', icon: RotateCcw, role: 'Đặt lại bộ lọc (Reset)', rule: 'Dành riêng cho UI reset' },
    { name: 'Check', icon: Check, role: 'Đã chọn / Hoàn thành', rule: 'Dấu tích trong bảng / checkbox' },
    { name: 'TriangleAlert', icon: TriangleAlert, role: 'Cảnh báo rủi ro (Warning)', rule: 'Màu Amber Ochre #92400e' },
    { name: 'CircleAlert', icon: CircleAlert, role: 'Lỗi chặn vận hành (Danger)', rule: 'Màu Crimson Red #b91c1c' },
    { name: 'Info', icon: Info, role: 'Thông tin hướng dẫn (Info)', rule: 'Màu Cerulean Sky #0369a1' },
    { name: 'ShieldAlert', icon: ShieldAlert, role: 'Từ chối quyền 403 / Bảo mật', rule: 'size-5 (20px) trong Error Banner' },
  ];

  const domainVocabulary = [
    { domain: 'Thương hiệu Hệ thống', icon: ChefHat, status: 'KEEP', note: 'CURRENT PRODUCT MARK: Dấu hiệu nhận diện sản phẩm hiện hành; cấm dùng cho route Bếp' },
    { domain: 'Bếp & Chế biến', icon: CookingPot, status: 'KEEP', note: 'CANONICAL: Giải quyết triệt để va chạm ChefHat; đại diện cho tuyến đường Bếp' },
    { domain: 'Kho nguyên liệu', icon: Warehouse, status: 'KEEP', note: 'CANONICAL: Kho bãi lưu trữ trung tâm, vị trí kho thực tế' },
    { domain: 'Nhập kho NCC', icon: PackageCheck, status: 'KEEP', note: 'CANONICAL: Nghiệm thu hàng hóa tại dock và lập phiếu nhập kho' },
    { domain: 'Xuất kho sản xuất', icon: PackageMinus, status: 'KEEP', note: 'CANONICAL: Khấu trừ nguyên liệu và cấp phát sang bếp' },
    { domain: 'Bàn giao kho sang bếp', icon: ArrowRightLeft, status: 'KEEP', note: 'CANONICAL: Chuyển giao trách nhiệm nguyên liệu giữa Thủ kho và Bếp' },
    { domain: 'Tồn kho & Sổ kho', icon: Boxes, status: 'KEEP', note: 'CANONICAL: Tồn kho khả dụng và thẻ kho luân chuyển' },
    { domain: 'Đối chiếu nguyên liệu', icon: Scale, status: 'KEEP', note: 'PROTECTED 1-1: Scale CHỈ dùng cho đối chiếu sai lệch & cân đối tài khoản' },
    { domain: 'Công thức & BOM món', icon: BookOpen, status: 'KEEP', note: 'CANONICAL: BookOpen đại diện cho công thức nấu và định mức BOM' },
    { domain: 'Giá vốn & Tài chính', icon: Coins, status: 'KEEP', note: 'CANONICAL: Coins đại diện cho tính toán giá vốn và biên lợi nhuận' },
    { domain: 'Cân khối lượng thực tế', icon: Weight, status: 'KEEP', note: 'CANONICAL: Weight đại diện cho cân trọng lượng thực phẩm thừa tại dock' },
    { domain: 'Nhu cầu nguyên liệu', icon: Calculator, status: 'KEEP', note: 'CANONICAL: Nổ BOM và tính toán nhu cầu nguyên liệu theo ca' },
    { domain: 'Đơn mua hàng (PO)', icon: ReceiptText, status: 'KEEP', note: 'CANONICAL: Chứng từ đơn mua hàng thương mại B2B' },
    { domain: 'Hợp đồng & Báo giá NCC', icon: Handshake, status: 'KEEP', note: 'CANONICAL: Thỏa thuận giá cung ứng với nhà cung cấp' },
    { domain: 'Điều phối suất ăn', icon: Utensils, status: 'KEEP', note: 'CANONICAL: Phân bổ suất ăn theo hợp đồng đối tác và ca phục vụ' },
    { domain: 'Duyệt vận hành', icon: ClipboardCheck, status: 'OPTIONAL', note: 'OPTIONAL: Hàng đợi phê duyệt chứng từ và ký duyệt chi phí' },
    { domain: 'Lập lịch tuần', icon: CalendarClock, status: 'OPTIONAL', note: 'OPTIONAL: Lịch trình thực đơn 6 ngày trong tuần' },
    { domain: 'Cây danh mục', icon: FolderTree, status: 'OPTIONAL', note: 'OPTIONAL: Cây định mức nguyên vật liệu phân cấp' },
    { domain: 'Bàn điều hành', icon: LayoutDashboard, status: 'OPTIONAL', note: 'OPTIONAL: Tổng quan trạm điều hành ca' },
    { domain: 'Thêm dòng phát sinh', icon: PlusCircle, status: 'MERGE_SEMANTICALLY', note: 'MERGE: Khuyến nghị dùng Plus (Tier 1) kèm nhãn chữ thay vì tạo thêm icon' },
    { domain: 'Biến động chi phí', icon: TrendingUp, status: 'MERGE_SEMANTICALLY', note: 'MERGE: Khuyến nghị dùng Coins hoặc nhãn văn bản trực tiếp' },
    { domain: 'Nhiệt độ chế biến', icon: Flame, status: 'NEEDS_EVIDENCE', note: 'NEEDS_EVIDENCE: Chờ phân hệ giám sát an toàn HACCP hoàn thiện' },
  ];

  return (
    <div data-testid="iconography-specimen-root" className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">
            Hệ thống Biểu tượng Hai tầng (Two-Tier Icon Architecture)
          </h3>
          <p className="text-xs text-[#475569]">
            Phân định giữa Biểu tượng Cơ học Giao diện (Tier 1 - Lucide) và Danh mục Biểu tượng Nghiệp vụ Chọn lọc (Tier 2 - Curated Domain Icon Vocabulary).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Size switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-xs">
            <span className="text-slate-500 px-1 font-medium">Cỡ:</span>
            <button
              type="button"
              onClick={() => setIconSize('16')}
              className={`px-2 py-0.5 rounded font-medium ${iconSize === '16' ? 'bg-white text-blue-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              16px (size-4)
            </button>
            <button
              type="button"
              onClick={() => setIconSize('20')}
              className={`px-2 py-0.5 rounded font-medium ${iconSize === '20' ? 'bg-white text-blue-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              20px (size-5)
            </button>
          </div>

          {/* Section filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded font-medium ${activeTab === 'all' ? 'bg-white text-blue-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tier1')}
              className={`px-2.5 py-1 rounded font-medium ${activeTab === 'tier1' ? 'bg-white text-blue-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Tier 1: Cơ học
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tier2')}
              className={`px-2.5 py-1 rounded font-medium ${activeTab === 'tier2' ? 'bg-white text-blue-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Tier 2: Nghiệp vụ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('conflicts')}
              className={`px-2.5 py-1 rounded font-medium ${activeTab === 'conflicts' ? 'bg-white text-blue-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Giải quyết Va chạm
            </button>
          </div>
        </div>
      </div>

      {/* RESOLUTION SPOTLIGHT: CHEFHAT & SCALE */}
      {(activeTab === 'all' || activeTab === 'conflicts') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ChefHat Resolution */}
          <div className="p-4 bg-white border border-[#cbd5e1] rounded-[3px] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Giải quyết Va chạm Thương hiệu ChefHat</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center space-y-1">
                <ChefHat className="size-6 mx-auto text-[#164e87]" />
                <span className="font-semibold text-slate-800 block">ChefHat</span>
                <span className="text-[10px] text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 inline-block">
                  Current Product Mark
                </span>
                <p className="text-[10px] text-slate-500">Logo nhận diện sản phẩm hiện hành trên đỉnh Sidebar &amp; Login</p>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center space-y-1">
                <CookingPot className="size-6 mx-auto text-emerald-700" />
                <span className="font-semibold text-slate-800 block">CookingPot</span>
                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 inline-block">
                  Tuyến đường Bếp trưởng
                </span>
                <p className="text-[10px] text-slate-500">Phân hệ Bếp chế biến trên Sidebar &amp; phân quyền actor</p>
              </div>
            </div>
          </div>

          {/* Scale Resolution */}
          <div className="p-4 bg-white border border-[#cbd5e1] rounded-[3px] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Tháo dỡ Nạp chồng 6-Hướng của Biểu tượng Scale</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-xs text-center">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded space-y-1">
                <Scale className="size-5 mx-auto text-blue-900" />
                <span className="font-semibold text-[11px] text-slate-800 block">Scale</span>
                <span className="text-[9px] text-slate-600 block">Đối chiếu NVL (1-1)</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded space-y-1">
                <BookOpen className="size-5 mx-auto text-slate-700" />
                <span className="font-semibold text-[11px] text-slate-800 block">BookOpen</span>
                <span className="text-[9px] text-slate-600 block">Định mức BOM</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded space-y-1">
                <Coins className="size-5 mx-auto text-amber-700" />
                <span className="font-semibold text-[11px] text-slate-800 block">Coins</span>
                <span className="text-[9px] text-slate-600 block">Giá vốn &amp; Lãi</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIER 1: SYSTEM MECHANICS ICONS */}
      {(activeTab === 'all' || activeTab === 'tier1') && (
        <section className="bg-white border border-[#cbd5e1] rounded-[3px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Tier 1: Biểu tượng Cơ học Giao diện (System Mechanics Icons)
            </h4>
            <span className="text-xs text-slate-500 font-mono">Lucide v1 Standard &bull; Stroke: 2.0px</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {systemMechanics.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.name} className="p-2 bg-slate-50/70 border border-slate-200 rounded-[2px] flex items-center gap-2">
                  <div className="p-1 bg-white border border-slate-200 rounded shrink-0 text-[#164e87]">
                    <Icon size={iconSize === '16' ? 16 : 20} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-xs text-slate-900 block truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{item.role}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TIER 2: CURATED DOMAIN ICON VOCABULARY */}
      {(activeTab === 'all' || activeTab === 'tier2') && (
        <section className="bg-white border border-[#cbd5e1] rounded-[3px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Tier 2: Danh mục Biểu tượng Nghiệp vụ Chọn lọc (Curated Domain Icon Vocabulary)
            </h4>
            <span className="text-xs text-slate-500 font-mono">Curated Lucide Metaphors &bull; Conflict-Free</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {domainVocabulary.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.domain} className="p-3 bg-white border border-slate-200 rounded-[2px] space-y-1.5 hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 bg-blue-50 border border-blue-100 rounded text-[#164e87]">
                      <Icon size={iconSize === '16' ? 16 : 20} strokeWidth={2} />
                    </div>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${
                      item.status === 'KEEP'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : item.status === 'OPTIONAL'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : item.status === 'MERGE_SEMANTICALLY'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <span className="font-semibold text-xs text-slate-900 block">{item.domain}</span>
                  <p className="text-[11px] text-slate-500 leading-tight">{item.note}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default IconographySpecimen;
