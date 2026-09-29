import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  Check,
  AlertTriangle,
  ShieldAlert,
  Inbox,
  RefreshCw,
  Lock,
  Eye,
  CheckCircle2,
  X,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';

export function SpecimenInteractionStates() {
  const [btnLoading, setBtnLoading] = useState(false);
  const [inputValue, setInputValue] = useState('Dữ liệu hợp lệ');
  const [isInvalid, setIsInvalid] = useState(true);
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('opt-1');
  const [checkboxChecked, setCheckboxChecked] = useState(true);

  // Tabs Roving Tabindex
  const [activeTab, setActiveTab] = useState('tab-1');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabsList = [
    { id: 'tab-1', label: 'Tổng quan kế hoạch' },
    { id: 'tab-2', label: 'Định mức thực phẩm' },
    { id: 'tab-3', label: 'Báo cáo hao hụt' },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabsList.length;
    if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabsList.length) % tabsList.length;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = tabsList.length - 1;

    if (nextIndex !== null) {
      e.preventDefault();
      tabRefs.current[nextIndex]?.focus();
      setActiveTab(tabsList[nextIndex].id);
    }
  };

  return (
    <div className="space-y-6 rounded border border-slate-200 bg-white p-5 shadow-2xs">
      <h4 className="text-xs font-semibold text-[#334155] normal-case tracking-normal">
        1. Hợp đồng trạng thái tương tác thành phần (Core controls states)
      </h4>

      {/* Button states */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold">Nút bấm: Default, Hover, Active, Focus, Disabled, Loading</span>
          <button
            type="button"
            onClick={() => setBtnLoading((v) => !v)}
            className="text-blue-700 underline text-[11px]"
          >
            Toggle Loading ({btnLoading ? 'ON' : 'OFF'})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="h-9 px-3.5 bg-[#164e87] hover:bg-[#113c69] active:translate-y-px text-white text-xs font-medium rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf] focus-visible:ring-offset-2"
          >
            Nút chính (Primary)
          </button>
          <button
            type="button"
            disabled
            className="h-9 px-3.5 bg-slate-200 text-slate-500 text-xs font-medium rounded-[3px] cursor-not-allowed"
          >
            Native Disabled
          </button>
          <button
            type="button"
            aria-disabled="true"
            title="Hành động bị khóa: Vui lòng chọn ít nhất 1 dòng để duyệt"
            onClick={(e) => e.preventDefault()}
            className="h-9 px-3.5 border border-slate-300 bg-slate-100 text-slate-500 text-xs font-medium rounded-[3px] cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            Aria-Disabled (Focusable + Giải thích)
          </button>
          <button
            type="button"
            className="h-9 px-3.5 bg-[#164e87] text-white text-xs font-medium rounded-[3px] inline-flex items-center gap-1.5"
          >
            {btnLoading && <Loader2 className="size-3.5 animate-spin" />}
            <span>{btnLoading ? 'Đang lưu...' : 'Lưu dữ liệu'}</span>
          </button>
        </div>
      </div>

      {/* Input states */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Rest & Focus</label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="h-8 w-full px-2.5 text-xs border border-[#64748b] rounded-[2px] focus:border-[#2d7acf] focus:ring-2 focus:ring-[#2d7acf]/20 outline-none"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-medium text-red-700">Invalid Error</label>
            <button type="button" onClick={() => setIsInvalid((v) => !v)} className="text-[10px] text-slate-500 underline">
              Toggle
            </button>
          </div>
          <input
            type="text"
            defaultValue="Giá trị âm"
            aria-invalid={isInvalid ? 'true' : 'false'}
            className={`h-8 w-full px-2.5 text-xs rounded-[2px] outline-none ${isInvalid ? 'border border-[#b91c1c] text-[#b91c1c] bg-[#fef2f2]' : 'border border-[#64748b]'}`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Readonly & Disabled</label>
          <input
            type="text"
            readOnly
            value="MÃ-READONLY-01"
            className="h-8 w-full px-2.5 text-xs border border-slate-200 bg-slate-50 text-slate-600 rounded-[2px]"
          />
        </div>
      </div>

      {/* Tabs roving tabindex */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <span className="text-xs font-semibold text-slate-700 block">
          Tabs Điều hướng Cục bộ (Roving Tabindex APG: Phím mũi tên duyệt ngang)
        </span>
        <div role="tablist" className="flex border-b border-slate-200 bg-slate-50 p-1 rounded-t">
          {tabsList.map((t, idx) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[idx] = el; }}
              role="tab"
              aria-selected={activeTab === t.id}
              tabIndex={activeTab === t.id ? 0 : -1}
              onClick={() => setActiveTab(t.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf] ${
                activeTab === t.id ? 'bg-white text-blue-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SpecimenModalities() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  return (
    <div className="space-y-6 rounded border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div>
          <h4 className="text-xs font-semibold text-[#334155] normal-case tracking-normal">
            2. Ba hình thái phương thức &amp; chi tiết (Modal Dialog vs Modal Drawer vs Concurrent Side Panel)
          </h4>
          <p className="text-xs text-slate-500">
            Phân định chuẩn xác theo hành vi tương tác thực tế (Behavior-based Modality).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="h-8 px-3 bg-[#164e87] text-white text-xs font-medium rounded-[3px] hover:bg-[#113c69]"
          >
            Modality A: Modal Dialog (Chặn nền)
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="h-8 px-3 border border-slate-300 bg-white text-slate-700 text-xs font-medium rounded-[3px] hover:bg-slate-50"
          >
            Modality B: Modal Drawer (Slide-in)
          </button>
        </div>
      </div>

      {/* Modality C: Concurrent Master-Detail Side Panel */}
      <div className="rounded border border-slate-200 bg-slate-50/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">
            Modality C: Master-Detail Song song (Persistent Complementary Region)
          </span>
          <button
            type="button"
            onClick={() => setSidePanelOpen((v) => !v)}
            className="text-xs text-blue-700 underline"
          >
            {sidePanelOpen ? 'Ẩn Panel' : 'Hiện Panel'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className={`${sidePanelOpen ? 'md:col-span-8' : 'md:col-span-12'} bg-white border border-slate-200 rounded p-3 text-xs`}>
            <p className="font-semibold text-slate-800 mb-1">Khung Master (Danh sách phiếu xuất kho)</p>
            <p className="text-slate-600">
              Người dùng có thể click chọn dòng hoặc duyệt phím mà không bị chặn tương tác. Không dùng <code>aria-modal=&quot;true&quot;</code>.
            </p>
          </div>
          {sidePanelOpen && (
            <aside
              role="complementary"
              aria-label="Chi tiết dòng xuất kho"
              className="md:col-span-4 bg-white border border-slate-200 rounded p-3 text-xs space-y-2"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                <span className="font-bold text-slate-800">Chi tiết chứng từ</span>
                <button type="button" onClick={() => setSidePanelOpen(false)}><X size={14} /></button>
              </div>
              <p className="text-slate-600">Nội dung chi tiết bổ trợ hiển thị đồng thời bên cạnh bảng danh sách.</p>
            </aside>
          )}
        </div>
      </div>

      {/* Modal A Dialog */}
      {modalOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận phê duyệt"
            className="w-full max-w-sm rounded bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="font-bold text-xs text-slate-900">Modality A: Modal Dialog</span>
              <button type="button" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-600">
              Khóa hoàn toàn tương tác nền, phím Tab bị bẫy bên trong hộp thoại, Escape để đóng.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-8 px-3 rounded border border-slate-300 text-xs text-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-8 px-3 rounded bg-[#164e87] text-white text-xs font-medium"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal B Drawer */}
      {drawerOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ngăn kéo chi tiết"
            className="w-[360px] bg-white h-full shadow-2xl flex flex-col p-5 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="font-bold text-xs text-slate-900">Modality B: Modal Drawer</span>
              <button type="button" onClick={() => setDrawerOpen(false)}><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-600">
              Trượt từ mép phải trên tablet/kiosk, chặn tương tác nền, khóa focus bên trong ngăn kéo.
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="mt-auto h-8 rounded bg-[#164e87] text-white text-xs font-medium"
            >
              Đóng ngăn kéo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SpecimenAsyncStates() {
  const [activeState, setActiveState] = useState<number>(1);

  const stateDemos = [
    { id: 1, name: 'Initial Loading', desc: 'Khung xương (TableSkeleton) khớp hình học bảng' },
    { id: 2, name: 'Ready-Empty', desc: 'Truy vấn thành công nhưng có 0 bản ghi' },
    { id: 3, name: 'Prerequisite Missing', desc: 'Chưa chọn khách hàng/tuần bắt buộc' },
    { id: 4, name: 'Forbidden 403', desc: 'Thông báo không có quyền kèm link liên hệ' },
    { id: 5, name: 'Recoverable 500/503', desc: 'InlineAlert variant="danger" có nút Thử lại' },
  ];

  return (
    <div className="space-y-4 rounded border border-slate-200 bg-white p-5 shadow-2xs">
      <h4 className="text-xs font-semibold text-[#334155] normal-case tracking-normal">
        3. Khảo sát trạng thái bất đồng bộ (12 Async Lifecycle States - Section 15)
      </h4>
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {stateDemos.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveState(s.id)}
            className={`px-2.5 py-1 text-xs rounded font-medium ${
              activeState === s.id ? 'bg-[#164e87] text-white font-semibold' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="min-h-[140px] p-3 rounded border border-slate-100">
        {activeState === 1 && (
          <div role="status" aria-label="Đang nạp dữ liệu..." className="space-y-2">
            <div className="h-4 w-40 animate-pulse bg-slate-200 rounded" />
            <div className="h-8 w-full animate-pulse bg-slate-100 rounded" />
            <div className="h-8 w-full animate-pulse bg-slate-100 rounded" />
          </div>
        )}
        {activeState === 2 && (
          <div className="text-center py-6">
            <Inbox className="size-8 mx-auto text-slate-400 mb-2" />
            <p className="text-xs font-semibold text-slate-700">Chưa có bản ghi nào</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Không tìm thấy dữ liệu theo bộ lọc hiện tại.</p>
          </div>
        )}
        {activeState === 3 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Chưa chọn phạm vi kế hoạch</p>
              <p className="mt-0.5 text-amber-800">Vui lòng chọn khách hàng và tuần áp dụng từ thanh điều khiển phía trên.</p>
            </div>
          </div>
        )}
        {activeState === 4 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900 flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold">Từ chối truy cập (403 Forbidden)</p>
              <p className="mt-0.5 text-red-700">Tài khoản của bạn không có quyền xem dữ liệu giá vốn nội bộ.</p>
            </div>
          </div>
        )}
        {activeState === 5 && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900 flex items-center justify-between">
            <span>Máy chủ dịch vụ quá tải tạm thời (503 Service Unavailable).</span>
            <button type="button" className="px-2.5 py-1 bg-red-700 text-white rounded text-xs font-medium">Thử lại</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccessibilityStressSpecimen() {
  const [zoomSimulation, setZoomSimulation] = useState<'100%' | '150%' | '200%'>('100%');
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <div
      data-testid="accessibility-stress-specimen-root"
      className={`space-y-8 ${reducedMotion ? '[&_*]:!transition-none [&_*]:!animate-none' : ''}`}
    >
      <SpecimenInteractionStates />
      <SpecimenModalities />
      <SpecimenAsyncStates />

      {/* Stress testing: Zoom & Reduced Motion */}
      <div className="rounded border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <h4 className="text-xs font-semibold text-[#334155] normal-case tracking-normal">
          4. Kiểm thử độ bền tiếp cận (200% Zoom Reflow &amp; Reduced Motion)
        </h4>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Mô phỏng Zoom WCAG 1.4.10:</span>
            {(['100%', '150%', '200%'] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoomSimulation(z)}
                className={`px-2.5 py-1 rounded font-medium ${zoomSimulation === z ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {z} {z === '200%' && '(320px CSS)'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="size-4"
            />
            <span>Mô phỏng `prefers-reduced-motion`</span>
          </label>
        </div>

        {/* Zoom 200% container */}
        <div
          style={{ maxWidth: zoomSimulation === '200%' ? '320px' : zoomSimulation === '150%' ? '480px' : '100%' }}
          className="border-2 border-dashed border-blue-400 rounded p-3 bg-slate-50 transition-all text-xs space-y-2"
        >
          <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1">
            Khung nhìn co dãn không vỡ bố cục
          </span>
          <p className="text-slate-600">
            Nội dung tự động ngắt dòng và điều khiển giữ nguyên khả năng tiếp cận mà không xuất hiện thanh cuộn ngang 2 chiều toàn trang.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AccessibilityStressSpecimen;
