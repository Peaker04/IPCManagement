// ============================================================
// stress.js — BƯỚC 3: tìm điểm gãy (breaking point)
// Tăng dần lượng request/giây tới khi hệ thống bắt đầu lỗi hoặc
// thời gian phản hồi tăng vọt. KHÔNG đặt threshold từng endpoint —
// mục tiêu là quan sát hệ thống suy giảm ở mức tải nào.
//
// ⚠ Nhớ nới rate limit trước khi chạy (xem RUNBOOK.md).
// Chạy:  k6 run stress.js
// Env:   BASE_URL, K6_USERNAME, K6_PASSWORD, K6_START_RATE, K6_PEAK_RATE
// ============================================================
import { sleep } from 'k6';
import { ENDPOINTS, login, hitEndpoint } from './lib.js';

const START_RATE = Number(__ENV.K6_START_RATE || 5);   // request/giây khởi điểm
const PEAK_RATE = Number(__ENV.K6_PEAK_RATE || 60);    // request/giây đỉnh

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    ramp_rps: {
      executor: 'ramping-arrival-rate',
      startRate: START_RATE,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '1m', target: START_RATE },
        { duration: '4m', target: PEAK_RATE },   // tăng tuyến tính tới đỉnh
        { duration: '1m', target: PEAK_RATE },   // giữ đỉnh
      ],
    },
  },
  thresholds: Object.assign(
    {
      // Chỉ giữ ngưỡng an toàn tổng quát để k6 báo FAIL khi hệ thống sập hẳn
      http_req_failed: ['rate<0.10'],
    },
    // Ngưỡng "rộng" 60s cho từng endpoint: không nhằm PASS/FAIL,
    // chỉ để k6 tạo sub-metric theo tên endpoint cho phần summary.
    Object.fromEntries(
      ENDPOINTS.map((ep) => [`http_req_duration{name:${ep.name}}`, ['p(95)<60000']]),
    ),
  ),
};

export function setup() {
  return { token: login() };
}

// Trộn đều các endpoint theo vòng tròn để tải phủ toàn hệ thống
let cursor = 0;

export default function (data) {
  const ep = ENDPOINTS[cursor % ENDPOINTS.length];
  cursor += 1;
  hitEndpoint(data.token, ep);
}

export function handleSummary(data) {
  let out = '\n===== KẾT QUẢ STRESS TEST =====\n';
  out += 'Xem results-stress.json và console k6 để xác định mức RPS mà:\n';
  out += ' - http_req_failed bắt đầu > 1%\n';
  out += ' - p95 của các endpoint danh sách vượt 800ms\n';
  out += 'Đó chính là năng lực tối đa hiện tại của hệ thống.\n\n';
  for (const ep of ENDPOINTS) {
    const m = data.metrics[`http_req_duration{name:${ep.name}}`];
    if (!m) continue;
    out += `${ep.name.padEnd(24)} p95=${(m.values['p(95)'] || 0).toFixed(0)}ms  p99=${(m.values['p(99)'] || 0).toFixed(0)}ms  max=${(m.values.max || 0).toFixed(0)}ms\n`;
  }
  return {
    stdout: out,
    'results-stress.json': JSON.stringify(data, null, 2),
  };
}
