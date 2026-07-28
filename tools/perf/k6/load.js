// ============================================================
// load.js — BƯỚC 2: kiểm thử tải với số người dùng đồng thời thực tế
// Mô phỏng nhiều nhân viên cùng thao tác: xem danh sách, tìm kiếm,
// mở báo cáo. Threshold p95 theo từng endpoint (mục 5 tài liệu hiệu năng).
//
// ⚠ QUAN TRỌNG: backend đang giới hạn 100 request/phút cho MỖI user
//   (policy "api-general" trong Program.cs). Toàn bộ VU dùng chung một
//   tài khoản nên sẽ dính 429 ngay ở mức tải thấp.
//   → Trước khi chạy load test, tăng tạm PermitLimit lên 100000
//     (xem RUNBOOK.md mục "Nới rate limit khi đo tải").
//
// Chạy:  k6 run load.js
// Env:   BASE_URL, K6_USERNAME, K6_PASSWORD, K6_MAX_VUS (mặc định 20)
// ============================================================
import { sleep } from 'k6';
import { ENDPOINTS, buildThresholds, login, hitEndpoint } from './lib.js';

const MAX_VUS = Number(__ENV.K6_MAX_VUS || 20);

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    office_hours: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.ceil(MAX_VUS / 2) }, // khởi động
        { duration: '3m', target: MAX_VUS },                // tải ổn định
        { duration: '1m', target: 0 },                      // hạ tải
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: buildThresholds(),
};

export function setup() {
  return { token: login() };
}

// Tỷ trọng thao tác mô phỏng một phiên làm việc thực tế:
// mở danh sách nhiều nhất, tìm kiếm vừa phải, báo cáo ít hơn.
const JOURNEY = [
  'list-current-stock',
  'list-purchase-requests',
  'list-dishes',
  'search-dishes',
  'list-stock-movements',
  'coordination-orders',
  'report-price-variance',
  'report-kpis',
];

const byName = Object.fromEntries(ENDPOINTS.map((e) => [e.name, e]));

export default function (data) {
  // Mỗi vòng lặp = một chuỗi thao tác của một nhân viên, kèm think-time
  for (const name of JOURNEY) {
    hitEndpoint(data.token, byName[name]);
    sleep(0.5 + Math.random() * 1.5); // người thật dừng 0.5–2s giữa các thao tác
  }
}

export function handleSummary(data) {
  let out = '\n===== KẾT QUẢ LOAD TEST (p95 so với ngưỡng) =====\n';
  for (const ep of ENDPOINTS) {
    const m = data.metrics[`http_req_duration{name:${ep.name}}`];
    if (!m) continue;
    const p95 = m.values['p(95)'];
    const verdict = p95 <= ep.target ? 'ĐẠT ' : 'VƯỢT';
    out += `${verdict}  ${ep.name.padEnd(24)} p95=${p95.toFixed(0)}ms  p99=${(m.values['p(99)'] || 0).toFixed(0)}ms  (ngưỡng ${ep.target}ms)\n`;
  }
  const failed = data.metrics.http_req_failed;
  if (failed) out += `\nTỷ lệ request lỗi: ${(failed.values.rate * 100).toFixed(2)}%\n`;
  return {
    stdout: out,
    'results-load.json': JSON.stringify(data, null, 2),
  };
}
