import React, { useState } from 'react';
import {
  Info,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Check,
  Sliders,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Lock,
} from 'lucide-react';

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex: string): number {
  try {
    const [r, g, b] = parseHex(hex);
    return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
  } catch {
    return 0;
  }
}

function getContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = getRelativeLuminance(fgHex);
  const l2 = getRelativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface WcagEvaluation {
  ratio: number;
  normalTextAA: boolean;
  normalTextAAA: boolean;
  uiComponentAA: boolean;
  statusBadge: 'AAA' | 'AA' | 'UI-PASS' | 'FAIL';
}

function evaluateContrast(fgHex: string, bgHex: string): WcagEvaluation {
  const ratio = getContrastRatio(fgHex, bgHex);
  const normalTextAA = ratio >= 4.5;
  const normalTextAAA = ratio >= 7.0;
  const uiComponentAA = ratio >= 3.0;

  let statusBadge: 'AAA' | 'AA' | 'UI-PASS' | 'FAIL' = 'FAIL';
  if (normalTextAAA) statusBadge = 'AAA';
  else if (normalTextAA) statusBadge = 'AA';
  else if (uiComponentAA) statusBadge = 'UI-PASS';

  return { ratio, normalTextAA, normalTextAAA, uiComponentAA, statusBadge };
}

const CONTRAST_AUDIT_PAIRS = [
  { id: 'c1', role: 'Văn bản chính trên thẻ trắng (Primary Text on White)', fgHex: '#0f172a', bgHex: '#ffffff', targetRule: 'WCAG AAA (>= 7.0:1)' },
  { id: 'c2', role: 'Văn bản phụ trên thẻ trắng (Secondary Text on White)', fgHex: '#334155', bgHex: '#ffffff', targetRule: 'WCAG AAA (>= 7.0:1)' },
  { id: 'c3', role: 'Văn bản mờ trên thẻ trắng (Muted Text on White)', fgHex: '#475569', bgHex: '#ffffff', targetRule: 'WCAG AAA (>= 7.0:1)' },
  { id: 'c4', role: 'Văn bản mờ trên nền canvas (Muted Text on Canvas)', fgHex: '#475569', bgHex: '#f1f5f9', targetRule: 'WCAG AA (>= 4.5:1)' },
  { id: 'c5', role: 'Chữ nút chính trên nền Navy (Action Text on Navy)', fgHex: '#ffffff', bgHex: '#164e87', targetRule: 'WCAG AAA (>= 7.0:1)' },
  { id: 'c6', role: 'Chữ Info trên nền mờ Cerulean (Info Text on Tint)', fgHex: '#0369a1', bgHex: '#f0f9ff', targetRule: 'WCAG AA (>= 4.5:1)' },
  { id: 'c7', role: 'Chữ Success trên nền mờ Teal (Success Text on Tint)', fgHex: '#0f766e', bgHex: '#f0fdfa', targetRule: 'WCAG AA (>= 4.5:1)' },
  { id: 'c8', role: 'Chữ Warning trên nền mờ Amber (Warning Text on Tint)', fgHex: '#92400e', bgHex: '#fffbeb', targetRule: 'WCAG AAA (>= 7.0:1)' },
  { id: 'c9', role: 'Chữ Danger trên nền mờ Crimson (Danger Text on Tint)', fgHex: '#b91c1c', bgHex: '#fef2f2', targetRule: 'WCAG AA (>= 4.5:1)' },
  { id: 'c10', role: 'Viền điều khiển form trên thẻ trắng (Border Strong on White)', fgHex: '#64748b', bgHex: '#ffffff', targetRule: 'SC 1.4.11 UI (>= 3.0:1)', isNonTextUi: true },
  { id: 'c11', role: 'Viền điều khiển form trên canvas (Border Strong on Canvas)', fgHex: '#64748b', bgHex: '#f1f5f9', targetRule: 'SC 1.4.11 UI (>= 3.0:1)', isNonTextUi: true },
  { id: 'c12', role: 'Viền focus bàn phím trên thẻ trắng (Focus Ring on White)', fgHex: '#2d7acf', bgHex: '#ffffff', targetRule: 'SC 1.4.11 UI (>= 3.0:1)', isNonTextUi: true },
];

export function ColorSurfaceSpecimen() {
  const [selectedDemoTab, setSelectedDemoTab] = useState<'all' | 'buttons' | 'inputs' | 'differentiation' | 'borders' | 'matrix'>('all');

  return (
    <div
      data-testid="color-surface-specimen-root"
      className="w-full space-y-8 text-slate-800 antialiased"
    >
      {/* Sub-navigation for Color Specimen */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] normal-case tracking-normal">
            Kiểm định màu sắc, bề mặt &amp; token ngữ nghĩa (Gate 2 Calibration)
          </h3>
          <p className="text-xs text-slate-500">
            Thử nghiệm trực quan Marine Navy (#164e87) vs Info Blue (#0369a1), viền form (#64748b), và bảng tương phản toán học WCAG 2.2.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setSelectedDemoTab('all')}
            className={`px-2.5 py-1 font-medium rounded transition-colors ${selectedDemoTab === 'all' ? 'bg-white text-blue-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setSelectedDemoTab('differentiation')}
            className={`px-2.5 py-1 font-medium rounded transition-colors ${selectedDemoTab === 'differentiation' ? 'bg-white text-blue-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Navy vs Info Blue
          </button>
          <button
            type="button"
            onClick={() => setSelectedDemoTab('borders')}
            className={`px-2.5 py-1 font-medium rounded transition-colors ${selectedDemoTab === 'borders' ? 'bg-white text-blue-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Viền Form (#64748b)
          </button>
          <button
            type="button"
            onClick={() => setSelectedDemoTab('matrix')}
            className={`px-2.5 py-1 font-medium rounded transition-colors ${selectedDemoTab === 'matrix' ? 'bg-white text-blue-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Tương phản Toán học
          </button>
        </div>
      </div>

      {/* SECTION: BUTTON INTERACTION STATES */}
      {(selectedDemoTab === 'all' || selectedDemoTab === 'buttons') && (
        <section aria-labelledby="button-matrix-heading" className="space-y-3">
          <h4 id="button-matrix-heading" className="text-xs font-semibold text-[#334155] normal-case tracking-normal">
            1. Ma trận trạng thái tương tác nút bấm (Button states &amp; hierarchy)
          </h4>
          <div className="overflow-x-auto rounded border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Primary Rest */}
              <button
                type="button"
                className="h-9 px-3.5 bg-[#164e87] hover:bg-[#113c69] active:bg-[#0c2b4c] text-white font-medium rounded-[3px] inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf] focus-visible:ring-offset-2 cursor-pointer"
              >
                <Check className="size-3.5" />
                <span>Primary Rest (#164e87)</span>
              </button>

              {/* Primary Hover Preview */}
              <div className="h-9 px-3.5 bg-[#113c69] text-white font-medium rounded-[3px] inline-flex items-center gap-1.5 shadow-inner">
                <Check className="size-3.5" />
                <span>Primary Hover (#113c69)</span>
              </div>

              {/* Primary Active Pressed */}
              <div className="h-9 px-3.5 bg-[#0c2b4c] text-white font-medium rounded-[3px] inline-flex items-center gap-1.5 translate-y-px shadow-inner">
                <Check className="size-3.5" />
                <span>Active Pressed (translate-y-px)</span>
              </div>

              {/* Focus Ring Forced */}
              <div className="h-9 px-3.5 bg-[#164e87] text-white font-medium rounded-[3px] inline-flex items-center gap-1.5 ring-2 ring-[#2d7acf] ring-offset-2">
                <span>Focus-Visible (2px Ring)</span>
              </div>

              {/* Disabled */}
              <button
                type="button"
                disabled
                className="h-9 px-3.5 bg-slate-300 text-slate-500 font-medium rounded-[3px] inline-flex items-center gap-1.5 cursor-not-allowed opacity-60"
              >
                <Lock className="size-3.5" />
                <span>Disabled Action</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* SECTION: NAVY VS INFO BLUE DIFFERENTIATION */}
      {(selectedDemoTab === 'all' || selectedDemoTab === 'differentiation') && (
        <section aria-labelledby="diff-heading" className="space-y-3">
          <h4 id="diff-heading" className="text-xs font-semibold text-[#334155] normal-case tracking-normal">
            2. Thử nghiệm phân biệt: Primary Action Navy (#164e87) vs Status Info Blue (#0369a1)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Visual Example in Context */}
            <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
              <span className="text-xs font-semibold text-slate-700 block border-b border-slate-100 pb-1.5">
                Hiển thị Cạnh nhau trong Thẻ Vận hành Thực tế
              </span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-800">Mã đơn: PO-2026-0812</span>
                  {/* Status Info Lozenge */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-[#f0f9ff] border border-[#bae6fd] text-[#0369a1] text-xs font-semibold">
                    <Info className="size-3" />
                    <span>Đang chờ đồng bộ</span>
                  </span>
                </div>
                {/* Primary Action Button */}
                <button
                  type="button"
                  className="h-8 px-3 bg-[#164e87] hover:bg-[#113c69] text-white text-xs font-medium rounded-[3px] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Phê duyệt đơn mua</span>
                  <ArrowRight className="size-3" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Action Navy (#164e87) là khối đặc cam kết hành động; Info Blue (#0369a1) là viền mỏng hairline thụ động.
              </p>
            </div>

            {/* Metrics comparison */}
            <div className="rounded border border-slate-200 bg-white p-4 space-y-2 text-xs">
              <span className="text-xs font-semibold text-slate-700 block border-b border-slate-100 pb-1.5">
                Chỉ số Quang học & Tương phản So sánh
              </span>
              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Action Navy (#164e87):</span>
                  <span className="font-mono font-semibold text-blue-950">Luminance 0.068 &bull; Contrast ~8.5:1 (AAA)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Info Blue (#0369a1):</span>
                  <span className="font-mono font-semibold text-blue-700">Luminance 0.126 &bull; Contrast ~5.9:1 (AA)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Khoảng cách màu sắc (&Delta;E):</span>
                  <span className="font-mono font-bold text-emerald-700">&Delta;E &approx; 14 (Rõ nét bằng mắt)</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION: FORM BORDER VISIBILITY */}
      {(selectedDemoTab === 'all' || selectedDemoTab === 'borders') && (
        <section aria-labelledby="borders-heading" className="space-y-3">
          <h4 id="borders-heading" className="text-xs font-semibold text-[#334155] normal-case tracking-normal">
            3. Độ rõ nét viền điều khiển (#64748b trên thẻ trắng vs nền canvas slate)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* White surface */}
            <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="text-xs font-semibold text-slate-800">Trên Thẻ Trắng (#ffffff)</span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Contrast: 4.76:1 (SC 1.4.11 PASS)
                </span>
              </div>
              <input
                type="text"
                defaultValue="Viền chuẩn --color-border-strong (#64748b)"
                className="h-8 w-full px-2.5 text-xs text-slate-900 bg-white border border-[#64748b] rounded-[2px] outline-none"
              />
            </div>

            {/* Slate canvas */}
            <div className="rounded border border-slate-200 bg-[#f1f5f9] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <span className="text-xs font-semibold text-slate-800">Trên Nền Canvas Slate (#f1f5f9)</span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Contrast: 4.34:1 (SC 1.4.11 PASS)
                </span>
              </div>
              <input
                type="text"
                defaultValue="Viền chuẩn trên nền slate (#64748b)"
                className="h-8 w-full px-2.5 text-xs text-slate-900 bg-white border border-[#64748b] rounded-[2px] outline-none"
              />
            </div>
          </div>
        </section>
      )}

      {/* SECTION: MATHEMATICAL CONTRAST ENGINE TABLE */}
      {(selectedDemoTab === 'all' || selectedDemoTab === 'matrix') && (
        <section aria-labelledby="matrix-heading" className="space-y-3">
          <h4 id="matrix-heading" className="text-xs font-semibold text-[#334155] normal-case tracking-normal">
            4. Bảng kiểm tra tương phản toán học tự động (WCAG 2.2 AA / AAA)
          </h4>
          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="py-2 px-3 font-semibold">Cặp màu kiểm định & Vai trò</th>
                  <th className="py-2 px-3 font-semibold w-24">Chữ (FG)</th>
                  <th className="py-2 px-3 font-semibold w-24">Nền (BG)</th>
                  <th className="py-2 px-3 font-semibold w-24">Mẫu</th>
                  <th className="py-2 px-3 font-semibold w-28">Tỷ lệ tương phản</th>
                  <th className="py-2 px-3 font-semibold w-28 text-center">Kết luận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CONTRAST_AUDIT_PAIRS.map((pair) => {
                  const evalResult = evaluateContrast(pair.fgHex, pair.bgHex);
                  const isPass = pair.isNonTextUi ? evalResult.uiComponentAA : evalResult.normalTextAA;
                  return (
                    <tr key={pair.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-medium text-slate-800">{pair.role}</td>
                      <td className="py-2 px-3 font-mono text-xs">{pair.fgHex}</td>
                      <td className="py-2 px-3 font-mono text-xs">{pair.bgHex}</td>
                      <td className="py-2 px-3">
                        <span
                          style={{ backgroundColor: pair.bgHex, color: pair.fgHex }}
                          className="px-1.5 py-0.5 rounded border border-slate-200 text-xs font-semibold"
                        >
                          Aa 123
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                        {evalResult.ratio.toFixed(2)}:1
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded border ${
                            isPass
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          <ShieldCheck className="size-3" />
                          <span>{evalResult.statusBadge}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default ColorSurfaceSpecimen;
