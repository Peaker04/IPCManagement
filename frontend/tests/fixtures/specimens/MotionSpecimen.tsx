import React, { useState } from 'react';
import {
  Loader2,
  Check,
  ChevronDown,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';

export function MotionSpecimen() {
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'audit'>('overview');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(true);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(1);
  const [isChecked, setIsChecked] = useState(false);
  const [reducedMotionSim, setReducedMotionSim] = useState(false);

  return (
    <div
      data-testid="motion-specimen-root"
      className={`space-y-6 ${reducedMotionSim ? '[&_*]:!transition-none [&_*]:!animate-none' : ''}`}
    >
      {/* Sub-navigation & reduced-motion simulator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">
            Hệ thống Chuyển động Vận hành (IPC Motion System)
          </h3>
          <p className="text-xs text-[#475569]">
            Thời lượng tối đa 150ms–200ms; chuyển động định hướng không gây reflow layout; triệt tiêu 100% khi bật reduced-motion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 bg-white border border-[#cbd5e1] px-3 py-1.5 rounded-[3px] shadow-2xs">
            <input
              type="checkbox"
              checked={reducedMotionSim}
              onChange={(e) => setReducedMotionSim(e.target.checked)}
              className="size-4 text-blue-900 rounded"
            />
            <span>Mô phỏng `prefers-reduced-motion` ({reducedMotionSim ? 'BẬT - 0ms' : 'TẮT'})</span>
          </label>
        </div>
      </div>

      {/* Grid of live interactive motion specimens */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Button Tactile Press */}
        <div className="p-4 bg-white border border-[#cbd5e1] rounded-[3px] space-y-2.5">
          <span className="text-xs font-bold text-slate-900 block">1. Nút Bấm: Micro-Tactile Press (100ms)</span>
          <p className="text-[11px] text-slate-500">100ms standard curve, dịch chuyển 1px khi bấm xuống.</p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              data-testid="motion-primary-btn"
              className="h-9 px-3.5 bg-[#164e87] text-white text-xs font-medium rounded-[3px] hover:bg-[#113c69] active:translate-y-px transition-[transform,background-color] duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf]"
            >
              Primary Action
            </button>
            <button
              type="button"
              className="h-9 px-3.5 border border-slate-300 bg-white text-slate-700 text-xs font-medium rounded-[3px] hover:bg-slate-50 active:translate-y-px transition-[transform,background-color] duration-100 ease-[cubic-bezier(0.16,1,0.3,1)]"
            >
              Outline Action
            </button>
          </div>
        </div>

        {/* 2. Checkbox Tactile Check */}
        <div className="p-4 bg-white border border-[#cbd5e1] rounded-[3px] space-y-2.5">
          <span className="text-xs font-semibold text-slate-900 block">2. Checkbox: Subtle Tactile Check (100ms)</span>
          <p className="text-[11px] text-slate-500">Native checkbox với scale 0.85 ──► 1.0 dứt khoát, không nảy lò xo.</p>
          <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-800">
            <input
              type="checkbox"
              data-testid="motion-checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              style={{ transition: 'transform 100ms cubic-bezier(0.16, 1, 0.3, 1)' }}
              className="size-4 rounded-[2px] border-[#64748b] text-[#164e87] focus:ring-2 focus:ring-[#2d7acf] cursor-pointer active:scale-90"
            />
            <span className="font-medium">Chọn dòng nguyên liệu xuất kho</span>
          </label>
        </div>

        {/* 3. Sidebar Disclosure Accordion */}
        <div className="p-4 bg-white border border-[#cbd5e1] rounded-[3px] space-y-2.5">
          <span className="text-xs font-semibold text-slate-900 block">3. Sidebar Accordion: Bounded Layout Transition (150ms)</span>
          <p className="text-[11px] text-slate-500">Chuyển đổi CSS Grid row 0fr ──► 1fr giới hạn trong vùng container cục bộ.</p>
          <div className="border border-slate-200 rounded-[2px] overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              className="w-full flex items-center justify-between p-2 font-medium bg-slate-50 hover:bg-slate-100 cursor-pointer"
            >
              <span>Kho nguyên liệu (4)</span>
              <ChevronDown
                size={15}
                className={`text-slate-400 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isAccordionOpen ? 'rotate-180 text-slate-700' : ''
                }`}
              />
            </button>
            <div
              data-testid="motion-accordion-grid"
              className={`grid transition-[grid-template-rows] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isAccordionOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="p-2 space-y-1 bg-white border-t border-slate-100 text-[11px] text-slate-600">
                  <div className="px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer">Nhập kho NCC</div>
                  <div className="px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer">Xuất kho sản xuất</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Tabs Indicator Transition */}
        <div className="p-4 bg-white border border-[#cbd5e1] rounded-[3px] space-y-2.5">
          <span className="text-xs font-bold text-slate-900 block">4. Tabs Indicator: Linear Slide (150ms)</span>
          <p className="text-[11px] text-slate-500">Chuyển viền dưới mượt mà 150ms không làm giật nội dung.</p>
          <div className="flex border-b border-slate-200 text-xs font-medium">
            {(['overview', 'metrics', 'audit'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 border-b-2 transition-[color,border-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  activeTab === t
                    ? 'border-[#164e87] text-[#164e87] font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t === 'overview' ? 'Tổng quan' : t === 'metrics' ? 'Chỉ số' : 'Kiểm toán'}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Modal Dialog Scale & Fade */}
        <div className="p-4 bg-white border border-[#cbd5e1] rounded-[3px] space-y-2.5">
          <span className="text-xs font-bold text-slate-900 block">5. Modal Dialog: Scale &amp; Fade (200ms)</span>
          <p className="text-[11px] text-slate-500">200ms overlay enter (scale 0.98 ──► 1.0, opacity 0 ──► 1).</p>
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="h-8 px-3 bg-slate-900 text-white text-xs font-medium rounded-[3px] hover:bg-slate-800 cursor-pointer"
          >
            Mở Dialog mẫu
          </button>
        </div>

        {/* 6. Toast Notification Entrance */}
        <div className="p-4 bg-white border border-[#cbd5e1] rounded-[3px] space-y-2.5">
          <span className="text-xs font-bold text-slate-900 block">6. Toast: Translate-Y &amp; Fade (150ms)</span>
          <p className="text-[11px] text-slate-500">150ms slide up (translateY 8px ──► 0px).</p>
          <button
            type="button"
            onClick={() => {
              setIsToastVisible(true);
              setTimeout(() => setIsToastVisible(false), 3000);
            }}
            className="h-8 px-3 border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-[3px] hover:bg-emerald-100 cursor-pointer"
          >
            Kích hoạt Toast (3s)
          </button>
        </div>
      </div>

      {/* Floating Dialog Demo */}
      {isDialogOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-[4px] border border-slate-200 bg-white p-5 shadow-2xl transition-[transform,opacity] duration-200 ease-[cubic-bezier(0,0,0.2,1)]"
          >
            <h4 className="text-sm font-bold text-slate-900 mb-1">Xác nhận chuyển giao ca</h4>
            <p className="text-xs text-slate-600 mb-4">
              Toàn bộ số lượng nguyên liệu thừa sẽ được kết xuất vào phiếu trả kho.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="h-8 px-3 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="h-8 px-3 rounded bg-[#164e87] text-white text-xs font-medium hover:bg-[#113c69] cursor-pointer"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Floating Alert */}
      {isToastVisible && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f172a] text-white px-4 py-2.5 rounded shadow-xl text-xs flex items-center gap-2 border border-slate-700 animate-in slide-in-from-bottom-2 duration-150">
          <Check size={15} className="text-emerald-400" />
          <span>Đã lưu thành công dữ liệu ca điều phối</span>
        </div>
      )}
    </div>
  );
}

export default MotionSpecimen;
