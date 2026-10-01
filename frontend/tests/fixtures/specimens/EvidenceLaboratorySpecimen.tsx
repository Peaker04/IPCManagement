import { useState } from 'react';
import { Cpu, Terminal } from 'lucide-react';

interface ContrastPair {
  id: string;
  fgName: string;
  fgHex: string;
  bgName: string;
  bgHex: string;
  targetRatio: number;
  wcagLevel: 'AA' | 'AAA' | 'UI-3.0:1';
}

const CONTRAST_TEST_PAIRS: ContrastPair[] = [
  { id: 'C1', fgName: 'Text Primary', fgHex: '#0f172a', bgName: 'Card White', bgHex: '#ffffff', targetRatio: 7, wcagLevel: 'AAA' },
  { id: 'C2', fgName: 'Text Secondary', fgHex: '#334155', bgName: 'Card White', bgHex: '#ffffff', targetRatio: 7, wcagLevel: 'AAA' },
  { id: 'C3', fgName: 'Text Muted', fgHex: '#475569', bgName: 'Card White', bgHex: '#ffffff', targetRatio: 4.5, wcagLevel: 'AA' },
  { id: 'C4', fgName: 'Primary Navy', fgHex: '#164e87', bgName: 'Card White', bgHex: '#ffffff', targetRatio: 4.5, wcagLevel: 'AA' },
  { id: 'C5', fgName: 'Button Text White', fgHex: '#ffffff', bgName: 'Primary Navy', bgHex: '#164e87', targetRatio: 4.5, wcagLevel: 'AA' },
  { id: 'C6', fgName: 'Warning Text', fgHex: '#92400e', bgName: 'Amber Bg', bgHex: '#fffbeb', targetRatio: 4.5, wcagLevel: 'AA' },
  { id: 'C7', fgName: 'Danger Text', fgHex: '#b91c1c', bgName: 'Crimson Bg', bgHex: '#fef2f2', targetRatio: 4.5, wcagLevel: 'AA' },
  { id: 'C8', fgName: 'Info Text', fgHex: '#0369a1', bgName: 'Sky Bg', bgHex: '#f0f9ff', targetRatio: 4.5, wcagLevel: 'AA' },
  { id: 'C9', fgName: 'Form Border Strong', fgHex: '#64748b', bgName: 'Card White', bgHex: '#ffffff', targetRatio: 3, wcagLevel: 'UI-3.0:1' },
  { id: 'C10', fgName: 'Form Border Strong', fgHex: '#64748b', bgName: 'Slate Canvas', bgHex: '#f1f5f9', targetRatio: 3, wcagLevel: 'UI-3.0:1' },
  { id: 'C11', fgName: 'Focus Ring Cerulean', fgHex: '#2d7acf', bgName: 'Card White', bgHex: '#ffffff', targetRatio: 3, wcagLevel: 'UI-3.0:1' },
  { id: 'C12', fgName: 'Sidebar Text', fgHex: '#334155', bgName: 'Sidebar Rail', bgHex: '#f8fafc', targetRatio: 4.5, wcagLevel: 'AA' },
];

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

const contrastResults = CONTRAST_TEST_PAIRS.map((pair) => {
  const foreground = luminance(pair.fgHex);
  const background = luminance(pair.bgHex);
  const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  return { ...pair, ratio, passes: ratio >= pair.targetRatio };
});
const passingPairs = contrastResults.filter((pair) => pair.passes).length;
const allContrastPass = passingPairs === contrastResults.length;

const probeTabs = [
  { id: 'all', label: 'Tất cả thiết bị đo' },
  { id: 'contrast', label: 'Máy đo Tương phản (WCAG 2.2)' },
  { id: 'diacritics', label: 'Cảm biến Cắt dấu Tiếng Việt' },
  { id: 'tabular', label: 'Máy đo Vi sai Số liệu (tnum)' },
  { id: 'reflow', label: 'Mô phỏng Co giãn 320px' },
] as const;

export function EvidenceLaboratorySpecimen() {
  const [activeTab, setActiveTab] = useState<(typeof probeTabs)[number]['id']>('all');
  // Samples are not measurements. Independent browser runs own geometry/zoom evidence.
  const telemetryData = {
    schemaVersion: 3,
    surface: 'Technical Evidence Laboratory',
    scope: 'DECLARED_COLOR_PAIRS_AND_UNMEASURED_PROBES',
    gates: {
      gate1_diacriticClipping: {
        status: 'NEEDS_EVIDENCE', clippedElementsCount: null, maxHeadroomPx: null,
        reason: 'Requires rendered glyph inspection and nonzero DOM geometry; scrollHeight alone is not glyph proof.',
      },
      gate2_mathematicalContrast: {
        status: allContrastPass ? 'PASS' : 'FAIL',
        method: 'sRGB relative luminance of declared hex pairs, not computed page colors',
        pairsEvaluated: contrastResults.length, passingPairs,
        formBorderRatio: contrastResults.find((pair) => pair.id === 'C9')?.ratio ?? null,
        pairs: contrastResults,
      },
      gate3_tabularVariance: {
        status: 'NEEDS_EVIDENCE', measuredVariancePx: null,
        reason: 'Requires loaded fonts and positive measured digit widths in a browser.',
      },
      gate4_reflowSimulation: {
        status: 'NEEDS_EVIDENCE', viewportCssWidthPx: null, horizontalScrollDetected: null,
        sampleMaxWidthPx: 320,
        reason: 'A constrained CSS sample is not real 200% browser zoom or a whole-page reflow measurement.',
      },
    },
  };

  return (
    <div data-testid="evidence-laboratory-root" className="space-y-6">
      <header className="bg-[#0f172a] text-white p-5 rounded-[4px] border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="size-5 text-sky-400" aria-hidden="true" />
          <h2 style={{ color: '#ffffff' }} className="text-base font-bold">Phòng Thí nghiệm Đo lường Kỹ thuật</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Chỉ tương phản của các cặp màu khai báo được tính tại đây. Các mẫu chữ, số và khung co giãn
          cần bằng chứng từ một lần đo trình duyệt độc lập; không chứng nhận UI production, FR/NFR hay hiệu năng.
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            ['Dấu tiếng Việt', 'Chưa đo — NEEDS_EVIDENCE'],
            ['Tương phản cặp màu khai báo', `${passingPairs}/${contrastResults.length} đạt ngưỡng khai báo — ${allContrastPass ? 'PASS' : 'FAIL'}`],
            ['Vi sai tabular nums', 'Chưa đo — NEEDS_EVIDENCE'],
            ['Reflow / zoom trình duyệt', 'Chưa đo — NEEDS_EVIDENCE'],
          ].map(([name, result]) => (
            <div key={name} className="p-3 border border-slate-700 rounded space-y-1">
              <dt className="text-slate-300">{name}</dt>
              <dd className="font-medium">{result}</dd>
            </div>
          ))}
        </dl>
      </header>

      <nav aria-label="Nhóm probe Evidence Lab" className="flex flex-wrap gap-1 border-b border-slate-200 text-xs">
        {probeTabs.map((tab) => (
          <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 border-b-2 font-semibold focus-visible:outline-2 focus-visible:outline-[#2d7acf] ${activeTab === tab.id ? 'border-[#164e87] text-[#164e87] bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {(activeTab === 'all' || activeTab === 'contrast') && (
        <section aria-labelledby="lab-contrast-heading" className="bg-white border border-[#cbd5e1] rounded-[3px] p-5 space-y-3">
          <h3 id="lab-contrast-heading" className="text-sm font-semibold">Tương phản toán học của cặp màu</h3>
          <p className="text-xs text-slate-600">So tỷ lệ chưa làm tròn với ngưỡng: AA 4,5:1; AAA 7:1; UI 3:1. Không suy ra contrast của toàn trang.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Mã kiểm', 'Cặp màu', 'Chữ (hex)', 'Nền (hex)', 'Tỷ lệ', 'Ngưỡng', 'Kết quả'].map((label) => (
                  <th key={label} scope="col" className="py-2 px-3">{label}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contrastResults.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 px-3">{row.id}</td>
                    <td className="py-2 px-3">{row.fgName} trên {row.bgName}</td>
                    <td className="py-2 px-3 font-mono">{row.fgHex}</td>
                    <td className="py-2 px-3 font-mono">{row.bgHex}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{row.ratio.toFixed(2)}:1</td>
                    <td className="py-2 px-3">{row.wcagLevel} ({row.targetRatio}:1)</td>
                    <td className="py-2 px-3 font-semibold">{row.passes ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'diacritics') && (
        <section aria-labelledby="lab-diacritics-heading" className="bg-white border border-[#cbd5e1] rounded-[3px] p-5 space-y-3">
          <h3 id="lab-diacritics-heading" className="text-sm font-semibold">Mẫu dấu tiếng Việt — chưa đo clipping/headroom</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {['Điều phối định mức nguyên vật liệu ca trưa', 'Phiếu kiểm nghiệm tiếp nhận thịt nạc vai heo',
              'Xác nhận quyết toán chi phí thực phẩm phát sinh', 'Sổ theo dõi kiểm kê định kỳ kho lạnh số 2',
              'Định mức suất ăn công nhân ca đêm', 'Hợp đồng cung ứng rau củ sạch tươi Đà Lạt',
              'Báo cáo đối chiếu chênh lệch xuất nhập tồn kho', 'Tiêu chuẩn an toàn vệ sinh thực phẩm bếp ăn',
              'Tổng hợp bảng kê nguyên vật liệu thiếu hụt', 'Đề xuất lập đơn mua hàng bổ sung'].map((text, index) => (
              <div key={text} data-diacritic-probe={`probe-${index}`} className="h-8 px-3 bg-slate-50 border border-slate-200 rounded flex items-center text-xs overflow-hidden">
                <span className="truncate font-medium" title={text}>{text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'tabular') && (
        <section aria-labelledby="lab-tabular-heading" className="bg-white border border-[#cbd5e1] rounded-[3px] p-5 space-y-3">
          <h3 id="lab-tabular-heading" className="text-sm font-semibold">Mẫu số — chưa đo độ rộng và vi sai</h3>
          <p className="text-xs text-slate-600">Runner phải chờ font và đo từng chuỗi có độ rộng dương; không dùng độ rộng của ô chứa làm độ rộng chữ.</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-center">
            {Array.from({ length: 10 }, (_, digit) => String(digit).repeat(8)).map((number) => (
              <div key={number} className="p-2 bg-slate-50 border border-slate-200 rounded">
                <span data-tabular-probe={number} className="inline-block tabular-nums font-semibold">{number}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'reflow') && (
        <section aria-labelledby="lab-reflow-heading" className="bg-white border border-[#cbd5e1] rounded-[3px] p-5 space-y-3">
          <h3 id="lab-reflow-heading" className="text-sm font-semibold">Mẫu co giãn CSS — chưa đo reflow</h3>
          <p className="text-xs text-slate-600">Giới hạn rộng 320px không phải phép đo zoom trình duyệt. Zoom 200% thật cần bằng chứng riêng.</p>
          <div data-testid="lab-reflow-sample" className="max-w-[320px] border border-slate-300 p-3 text-xs leading-relaxed">
            Kiểm tra khả năng ngắt dòng của thông tin điều phối nguyên vật liệu. Khung này không mô phỏng toàn bộ trang hoặc thiết bị.
          </div>
        </section>
      )}

      <section aria-label="Dữ liệu Evidence Lab" className="bg-slate-950 border border-slate-800 rounded-[3px] p-4 space-y-2">
        <h3 style={{ color: '#7dd3fc' }} className="flex items-center gap-2 text-xs text-sky-300"><Terminal size={14} aria-hidden="true" />JSON tham chiếu — không phải chứng nhận CI</h3>
        <pre id="specimen-telemetry-output" className="text-xs text-slate-300 bg-slate-900 p-3 rounded overflow-auto max-h-48 border border-slate-800" tabIndex={0} aria-label="JSON Evidence Lab">
          {JSON.stringify(telemetryData, null, 2)}
        </pre>
      </section>
    </div>
  );
}

export default EvidenceLaboratorySpecimen;
