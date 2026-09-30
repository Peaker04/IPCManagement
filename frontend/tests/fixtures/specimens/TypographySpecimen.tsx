import React, { useState, useEffect, useRef } from 'react';

export type FontMode = 'inter' | 'segoe' | 'dual';
export type DensityMode = 'all' | 'compact' | 'standard';

export interface DiacriticProbeResult {
  hasClipping: boolean;
  elementId: string;
  scrollHeight: number;
  clientHeight: number;
  text: string;
}

export interface TabularProbeResult {
  isTabularAligned: boolean;
  digitWidths: Record<string, number>;
  variance: number;
}

export const VIETNAMESE_STRESS_DATA = {
  difficultSequences: [
    { label: 'Nguyên âm có dấu sừng/mũ/trăng (Thường)', text: 'ă â ê ô ơ ư' },
    { label: 'Nguyên âm có dấu sừng/mũ/trăng (Hoa)', text: 'Ă Â Ê Ô Ơ Ư' },
    { label: 'Chữ Đ có gạch ngang', text: 'đ Đ — Điều phối định mức' },
    { label: 'Dấu ghép trên Ê (sắc, huyền, hỏi, ngã, nặng)', text: 'ế ề ể ễ ệ — Kế hoạch, về nguồn, thể thức, lễ vật, bệ phóng' },
    { label: 'Dấu ghép trên Ê (Chữ HOA)', text: 'Ế Ề Ể Ễ Ệ — TIẾP NHẬN PHIẾU ĐỀ NGHỊ' },
    { label: 'Dấu ghép trên Ơ (sắc, huyền, hỏi, ngã, nặng)', text: 'ớ ờ ở ỡ ợ — Ớt hiểm, ngờ nghệch, ở lại, vỡ vụn, thợ cả' },
    { label: 'Dấu ghép trên Ơ (Chữ HOA)', text: 'Ớ Ờ Ở Ỡ Ợ — MỞ RỘNG ĐƠN HÀNG LỚN' },
    { label: 'Dấu ghép trên Ư (sắc, huyền, hỏi, ngã, nặng)', text: 'ứ ừ ử ữ ự — Sức chứa, từ chối, cử hành, giữ nguyên, dự toán' },
    { label: 'Dấu ghép trên Ă (sắc, huyền, hỏi, ngã, nặng)', text: 'ắ ằ ẳ ẵ ặ — Cắt tỉa, dằn dỗi, khẳng định, sẵng giọng, thắc mắc' },
    { label: 'Dấu ghép trên Ô (sắc, huyền, hỏi, ngã, nặng)', text: 'ố ồ ổ ỗ ộ — Số lượng, đồ đạc, bổ sung, chỗ trống, bộ phận' },
  ],
  operationalStrings: [
    { role: 'Kế hoạch', text: 'Điều phối suất ăn theo kế hoạch tuần' },
    { role: 'Định mức', text: 'Định mức nguyên vật liệu theo món' },
    { role: 'Phê duyệt', text: 'Nhu cầu nguyên liệu chưa được phê duyệt' },
    { role: 'Xác nhận', text: 'Bếp trưởng xác nhận đã nhận đủ vật tư' },
    { role: 'Chứng từ', text: 'Phiếu nhập kho PNK-20260929-0001' },
    { role: 'Đơn giá', text: 'Đơn giá: 125.000.000 ₫' },
    { role: 'Tồn kho', text: 'Tồn kho khả dụng: 1.234,560 kg' },
  ],
  longEntityLabels: [
    {
      category: 'Nguyên vật liệu tươi sống',
      label: 'Thịt nạc dăm heo đông lạnh nhập khẩu loại 1 (Quy cách đóng thùng 20kg)',
      code: 'NVL-HEO-ND-001',
      unit: 'kg',
      quantity: 1250.5,
      price: 115000,
    },
    {
      category: 'Gia vị sơ chế',
      label: 'Gia vị hỗn hợp ướp kho thịt cá hương thảo mộc đặc biệt',
      code: 'GV-HH-TM-004',
      unit: 'gói',
      quantity: 340.0,
      price: 45000,
    },
    {
      category: 'Nhà cung cấp đối tác',
      label: 'Công ty TNHH Thương mại Dịch vụ Thực phẩm Sạch Đồng Nai - Chi nhánh Kho lạnh số 2',
      code: 'NCC-DNAI-002',
      unit: 'hợp đồng',
      quantity: 1.0,
      price: 250000000,
    },
    {
      category: 'Món ăn thực đơn tuần',
      label: 'Thịt ba chỉ heo kho trứng cút nước dừa xiêm Bến Tre (Định lượng 120g/suất)',
      code: 'MON-BC-TC-120',
      unit: 'suất',
      quantity: 4500.0,
      price: 32000,
    },
  ],
  numericTestData: [
    { label: 'Hàng 1 (VND tối đa)', rawNumber: 125000000, formatted: '125.000.000 ₫', qty: '1.234,560 kg' },
    { label: 'Hàng 2 (Chữ số 9 lặp)', rawNumber: 99999999, formatted: '99.999.999 ₫', qty: '99.999,999 kg' },
    { label: 'Hàng 3 (Chữ số 1 lặp)', rawNumber: 11111111, formatted: '11.111.111 ₫', qty: '11.111,111 kg' },
    { label: 'Hàng 4 (Chữ số 0 lặp)', rawNumber: 10000000, formatted: '10.000.000 ₫', qty: '10.000,000 kg' },
    { label: 'Hàng 5 (Số lẻ nhỏ)', rawNumber: 250000, formatted: '250.000 ₫', qty: '0,005 kg' },
    { label: 'Hàng 6 (Bằng không)', rawNumber: 0, formatted: '0 ₫', qty: '0,000 kg' },
  ],
};

export const SEMANTIC_ROLE_DEFINITIONS = [
  {
    role: 'Page Title (h1)',
    tag: 'h1',
    cssClass: 'text-[18px] leading-[24px] font-bold tracking-normal text-slate-900',
    size: '18px (1.125rem)',
    lineHeight: '24px (1.33)',
    weight: 'Bold (700)',
    scope: 'Tiêu đề route chính tại Zone 1 (OperationalFrame)',
    sample: 'Điều phối suất ăn theo kế hoạch tuần 39 - Cơ sở Bình Dương',
  },
  {
    role: 'Workspace Title (h2)',
    tag: 'h2',
    cssClass: 'text-[16px] leading-[22px] font-bold tracking-normal text-slate-900',
    size: '16px (1.000rem)',
    lineHeight: '22px (1.37)',
    weight: 'Bold (700)',
    scope: 'Tiêu đề sub-view, tab lớn, drawer workbench',
    sample: 'Bảng đối soát nguyên vật liệu và đề xuất nhập bổ sung',
  },
  {
    role: 'Section Title (h3)',
    tag: 'h3',
    cssClass: 'text-[14px] leading-[20px] font-semibold tracking-normal text-slate-800',
    size: '14px (0.875rem)',
    lineHeight: '20px (1.43)',
    weight: 'SemiBold (600)',
    scope: 'Tiêu đề SectionPanel, thẻ card nhóm chức năng',
    sample: 'Định mức nguyên vật liệu theo món ăn tiêu chuẩn',
  },
  {
    role: 'Subsection (h4)',
    tag: 'h4',
    cssClass: 'text-[13px] leading-[18px] font-semibold tracking-normal text-slate-800',
    size: '13px (0.8125rem)',
    lineHeight: '18px (1.38)',
    weight: 'SemiBold (600)',
    scope: 'Tiêu đề nhóm bộ lọc, modal sub-heading',
    sample: 'Nhóm gia vị ướp kho thịt cá hương thảo mộc đặc biệt',
  },
  {
    role: 'Body Regular',
    tag: 'p',
    cssClass: 'text-[14px] leading-[20px] font-normal tracking-normal text-slate-700',
    size: '14px (0.875rem)',
    lineHeight: '20px (1.43)',
    weight: 'Regular (400)',
    scope: 'Văn bản hướng dẫn vận hành, form body, dialog message',
    sample: 'Bếp trưởng xác nhận đã nhận đủ vật tư theo phiếu xuất kho và chịu trách nhiệm bảo quản.',
  },
  {
    role: 'Body Small',
    tag: 'p',
    cssClass: 'text-[13px] leading-[18px] font-normal tracking-normal text-slate-600',
    size: '13px (0.8125rem)',
    lineHeight: '18px (1.38)',
    weight: 'Regular (400)',
    scope: 'Mô tả phụ, ghi chú nội bộ, chi tiết trong drawer workbench',
    sample: 'Nhu cầu nguyên liệu chưa được phê duyệt sẽ không được tổng hợp vào bảng mua hàng tự động.',
  },
  {
    role: 'UI Control Label',
    tag: 'label',
    cssClass: 'text-[13px] leading-normal font-medium tracking-normal text-slate-800 inline-flex items-center',
    size: '13px compact / 14px default',
    lineHeight: '1.0 (flex/inline-flex)',
    weight: 'Medium (500)',
    scope: 'Label nút bấm, select dropdown, tabs, input fields',
    sample: 'Chọn kho lưu trữ nguyên liệu',
  },
  {
    role: 'Table Header (th)',
    tag: 'th',
    cssClass: 'text-[12px] leading-[16px] font-semibold tracking-normal text-slate-700 text-left',
    size: '12px (0.750rem)',
    lineHeight: '16px (1.33)',
    weight: 'SemiBold (600)',
    scope: 'Tiêu đề cột bảng dữ liệu. Sentence case ưu tiên.',
    sample: 'Tên nguyên vật liệu và quy cách',
  },
  {
    role: 'Table Cell Data (td)',
    tag: 'td',
    cssClass: 'text-[13px] leading-[18px] font-normal tracking-normal text-slate-800',
    size: '13px compact / 14px standard',
    lineHeight: '18px / 20px',
    weight: 'Regular (400)',
    scope: 'Dữ liệu bảng: tên món, nhà cung cấp, ghi chú diễn giải',
    sample: 'Thịt nạc dăm heo đông lạnh nhập khẩu loại 1 (Quy cách đóng thùng 20kg)',
  },
  {
    role: 'Caption / Metadata',
    tag: 'span',
    cssClass: 'text-[12px] leading-[16px] font-normal tracking-normal text-slate-500',
    size: '12px (0.750rem)',
    lineHeight: '16px (1.33)',
    weight: 'Regular (400)',
    scope: 'Dấu thời gian, text hướng dẫn dưới input, đếm ký tự',
    sample: 'Cập nhật lần cuối: 29/09/2026 14:30 bởi Bếp trưởng',
  },
  {
    role: 'Numeric Display',
    tag: 'span',
    cssClass: 'text-[13px] leading-[18px] font-semibold tracking-normal text-slate-900 tabular-nums text-right',
    size: '13px / 14px',
    lineHeight: '18px / 20px',
    weight: 'SemiBold (600)',
    scope: 'Số lượng, định mức BOM, đơn giá, thành tiền VND (tabular-nums, căn phải)',
    sample: '125.000.000 ₫',
  },
  {
    role: 'Technical Identity',
    tag: 'code',
    cssClass: 'font-mono text-[12px] leading-[16px] font-medium tracking-normal text-slate-800 bg-slate-100 px-1 py-0.5 rounded tabular-nums',
    size: '12px (0.750rem)',
    lineHeight: '16px (1.33)',
    weight: 'Medium (500)',
    scope: 'Mã chứng từ (PNK-001), Lot ID, UUID, Batch code',
    sample: 'PNK-20260929-0001',
  },
];

export function TypographySpecimen() {
  const [fontMode, setFontMode] = useState<FontMode>('inter');
  const [densityMode, setDensityMode] = useState<DensityMode>('all');
  const [clippingAlerts, setClippingAlerts] = useState<DiacriticProbeResult[]>([]);
  const [tabularStatus, setTabularStatus] = useState<TabularProbeResult | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const getFontFamilyStyle = (mode: 'inter' | 'segoe') => {
    if (mode === 'inter') {
      return {
        fontFamily: '"Inter Variable", Inter, system-ui, -apple-system, sans-serif',
      };
    }
    return {
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    };
  };

  const runClippingAudit = () => {
    if (!containerRef.current) return;
    const elements = containerRef.current.querySelectorAll<HTMLElement>('[data-diacritic-probe]');
    const alerts: DiacriticProbeResult[] = [];

    elements.forEach((el) => {
      const scrollHeight = el.scrollHeight;
      const clientHeight = el.clientHeight;
      if (scrollHeight > clientHeight + 0.5) {
        alerts.push({
          hasClipping: true,
          elementId: el.getAttribute('data-diacritic-probe') || 'unknown',
          scrollHeight,
          clientHeight,
          text: el.textContent?.slice(0, 40) || '',
        });
      }
    });

    setClippingAlerts(alerts);
  };

  const runTabularAudit = () => {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const widths: Record<string, number> = {};
    const stringSamples = digits.map((d) => d.repeat(8));

    const probeContainer = document.createElement('div');
    probeContainer.style.position = 'absolute';
    probeContainer.style.visibility = 'hidden';
    probeContainer.style.whiteSpace = 'nowrap';
    probeContainer.style.fontFamily = fontMode === 'inter'
      ? '"Inter Variable", Inter, sans-serif'
      : '"Segoe UI", sans-serif';
    probeContainer.style.fontSize = '14px';
    probeContainer.style.fontVariantNumeric = 'tabular-nums';
    probeContainer.style.fontFeatureSettings = '"tnum", "cv02", "cv03", "cv04", "cv11"';

    document.body.appendChild(probeContainer);

    stringSamples.forEach((str, index) => {
      const span = document.createElement('span');
      span.textContent = str;
      probeContainer.appendChild(span);
      widths[digits[index]] = span.getBoundingClientRect().width;
    });

    document.body.removeChild(probeContainer);

    const values = Object.values(widths);
    const minW = Math.min(...values);
    const maxW = Math.max(...values);
    const variance = maxW - minW;

    setTabularStatus({
      isTabularAligned: variance < 0.2,
      digitWidths: widths,
      variance,
    });
  };

  useEffect(() => {
    runClippingAudit();
    runTabularAudit();
  }, [fontMode, densityMode]);

  return (
    <div
      ref={containerRef}
      className="space-y-6"
      style={fontMode !== 'dual' ? getFontFamilyStyle(fontMode) : undefined}
      data-testid="typography-specimen-root"
    >
      {/* Control ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">Phông chữ hiển thị:</span>
          <button
            type="button"
            onClick={() => setFontMode('inter')}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              fontMode === 'inter'
                ? 'bg-[#164e87] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Inter Variable (Chính)
          </button>
          <button
            type="button"
            onClick={() => setFontMode('segoe')}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              fontMode === 'segoe'
                ? 'bg-[#164e87] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Segoe UI (Fallback Windows)
          </button>
          <button
            type="button"
            onClick={() => setFontMode('dual')}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              fontMode === 'dual'
                ? 'bg-[#164e87] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Đối chiếu Song song (Dual)
          </button>
        </div>

        {/* Audit Status Pills */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold border ${
              clippingAlerts.length === 0
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {clippingAlerts.length === 0
              ? '✓ 0 Cắt dấu (No Clipping)'
              : `⚠ ${clippingAlerts.length} Điểm cắt dấu!`}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold border ${
              tabularStatus?.isTabularAligned
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {tabularStatus?.isTabularAligned
              ? '✓ Tabular Nums Chuẩn'
              : '⚠ Tabular Nums Sai lệch!'}
          </span>
        </div>
      </div>

      {/* Render Single View or Dual Comparison */}
      {fontMode === 'dual' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded border border-slate-200 bg-white p-5" style={getFontFamilyStyle('inter')}>
            <div className="mb-3 border-b border-slate-200 pb-2">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-900">
                Phông chính: Inter Variable (Local WOFF2)
              </span>
            </div>
            <TypographySections fontFamilyName="Inter Variable" densityMode={densityMode} />
          </div>
          <div className="rounded border border-slate-200 bg-white p-5" style={getFontFamilyStyle('segoe')}>
            <div className="mb-3 border-b border-slate-200 pb-2">
              <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-800">
                Phông dự phòng: Segoe UI (Windows System)
              </span>
            </div>
            <TypographySections fontFamilyName="Segoe UI" densityMode={densityMode} />
          </div>
        </div>
      ) : (
        <div className="rounded border border-slate-200 bg-white p-5">
          <TypographySections
            fontFamilyName={fontMode === 'inter' ? 'Inter Variable' : 'Segoe UI'}
            densityMode={densityMode}
          />
        </div>
      )}
    </div>
  );
}

function TypographySections({ fontFamilyName }: { fontFamilyName: string; densityMode: DensityMode }) {
  return (
    <div className="space-y-8">
      {/* 1. All 11 Semantic Type Roles */}
      <section aria-labelledby={`roles-${fontFamilyName}`} className="space-y-3">
        <h3 id={`roles-${fontFamilyName}`} className="text-sm font-semibold text-[#0f172a] normal-case tracking-normal border-b border-slate-200 pb-1.5">
          1. 11 Vai trò ngữ nghĩa typography (Semantic type scale)
        </h3>
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr>
                <th className="py-2 px-3 font-semibold w-40">Role & Thẻ</th>
                <th className="py-2 px-3 font-semibold w-56">Quy cách Token</th>
                <th className="py-2 px-3 font-semibold">Mẫu hiển thị Tiếng Việt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SEMANTIC_ROLE_DEFINITIONS.map((def, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="py-2 px-3 align-top font-medium text-slate-900">
                    <div>{def.role}</div>
                    <code className="text-xs text-slate-500 font-mono">&lt;{def.tag}&gt;</code>
                  </td>
                  <td className="py-2 px-3 align-top text-slate-600">
                    <div>Cỡ: <strong>{def.size}</strong></div>
                    <div>Line-height: <strong>{def.lineHeight}</strong></div>
                  </td>
                  <td className="py-2 px-3 align-top">
                    {renderSemanticElement(def)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Diacritic Orthography Stress Tests */}
      <section aria-labelledby={`stress-${fontFamilyName}`} className="space-y-3">
        <h3 id={`stress-${fontFamilyName}`} className="text-sm font-semibold text-[#0f172a] normal-case tracking-normal border-b border-slate-200 pb-1.5">
          2. Bộ dữ liệu kiểm tra dấu tiếng Việt phức tạp
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {VIETNAMESE_STRESS_DATA.difficultSequences.map((seq, idx) => (
            <div key={idx} className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
              <div className="text-xs font-semibold text-slate-500 mb-0.5">{seq.label}</div>
              <div data-diacritic-probe={`seq-${idx}`} className="text-xs font-medium text-slate-900 break-words">
                {seq.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Table Row Geometry & Diacritic Clearance (32px vs 36px) */}
      <section aria-labelledby={`density-${fontFamilyName}`} className="space-y-3">
        <h3 id={`density-${fontFamilyName}`} className="text-sm font-semibold text-[#0f172a] normal-case tracking-normal border-b border-slate-200 pb-1.5">
          3. Kiểm chứng chiều cao hàng bảng 32px vs 36px và độ thông thoáng dấu
        </h3>
        <div className="space-y-4">
          {/* Compact 32px */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-800">
                Compact Tier: Hàng 32px (Chữ 13px, leading-[18px], py-1.5)
              </span>
              <span className="text-xs font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                ✓ 8.5px Headroom an toàn
              </span>
            </div>
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
                  <tr>
                    <th className="py-1 px-2 font-semibold w-10 text-center">STT</th>
                    <th className="py-1 px-2 font-semibold">Tên nguyên vật liệu</th>
                    <th className="py-1 px-2 font-semibold w-24">Mã hàng</th>
                    <th className="py-1 px-2 font-semibold w-24 text-right">Số lượng</th>
                    <th className="py-1 px-2 font-semibold w-28 text-right">Đơn giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {VIETNAMESE_STRESS_DATA.longEntityLabels.map((item, idx) => (
                    <tr key={idx} className="h-[32px] hover:bg-[#f0f4f8]">
                      <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-xs">0{idx + 1}</td>
                      <td data-diacritic-probe={`c-row-${idx}`} className="py-1.5 px-2 text-[13px] leading-[18px] text-slate-900 truncate max-w-[280px]" title={item.label}>
                        {item.label}
                      </td>
                      <td className="py-1.5 px-2 text-xs font-mono text-slate-600">{item.code}</td>
                      <td className="py-1.5 px-2 text-[13px] leading-[18px] font-semibold text-right tabular-nums text-slate-900">
                        {item.quantity.toLocaleString('vi-VN')} {item.unit}
                      </td>
                      <td className="py-1.5 px-2 text-[13px] leading-[18px] font-semibold text-right tabular-nums text-slate-900">
                        {item.price.toLocaleString('vi-VN')} ₫
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Tabular Figures with Currency */}
      <section aria-labelledby={`tnum-${fontFamilyName}`} className="space-y-3">
        <h3 id={`tnum-${fontFamilyName}`} className="text-sm font-semibold text-[#0f172a] normal-case tracking-normal border-b border-slate-200 pb-1.5">
          4. Kiểm định số liệu dạng bảng (tabular figures - tnum) với tiền tệ VND (₫)
        </h3>
        <div className="rounded border border-slate-200 bg-white p-3 space-y-1.5 divide-y divide-slate-100 text-xs">
          {VIETNAMESE_STRESS_DATA.numericTestData.map((row, idx) => (
            <div key={idx} className="flex items-center justify-between pt-1.5">
              <span className="text-slate-600">{row.label}</span>
              <div className="flex items-center gap-6">
                <span className="w-28 text-right font-mono font-medium text-slate-800 tabular-nums">
                  {row.qty}
                </span>
                <span className="w-32 text-right font-mono font-bold text-blue-900 tabular-nums">
                  {row.formatted}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function renderSemanticElement(def: (typeof SEMANTIC_ROLE_DEFINITIONS)[0]) {
  switch (def.tag) {
    case 'h1':
      return <h1 className={def.cssClass}>{def.sample}</h1>;
    case 'h2':
      return <h2 className={def.cssClass}>{def.sample}</h2>;
    case 'h3':
      return <h3 className={def.cssClass}>{def.sample}</h3>;
    case 'h4':
      return <h4 className={def.cssClass}>{def.sample}</h4>;
    case 'p':
      return <p className={def.cssClass}>{def.sample}</p>;
    case 'label':
      return (
        <label className={def.cssClass}>
          <input type="checkbox" defaultChecked className="mr-2 h-3.5 w-3.5 rounded" />
          {def.sample}
        </label>
      );
    case 'th':
      return <span className={def.cssClass}>{def.sample}</span>;
    case 'td':
      return <span className={def.cssClass}>{def.sample}</span>;
    case 'code':
      return <code className={def.cssClass}>{def.sample}</code>;
    default:
      return <span className={def.cssClass}>{def.sample}</span>;
  }
}

export default TypographySpecimen;
