// ============================================================
// smoke.js — BƯỚC 1: baseline 1 người dùng
// Đo thời gian phản hồi từng endpoint khi KHÔNG có tải,
// đồng thời xác nhận toàn bộ endpoint trả 200 với tài khoản test.
//
// Chạy:  k6 run smoke.js
// Env:   BASE_URL, K6_USERNAME, K6_PASSWORD
// ============================================================
import { sleep } from 'k6';
import { ENDPOINTS, buildThresholds, login, hitEndpoint } from './lib.js';

export const options = {
  vus: 1,
  iterations: 5, // lặp 5 vòng để lấy p95 tương đối ổn định
  thresholds: buildThresholds(),
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  for (const ep of ENDPOINTS) {
    hitEndpoint(data.token, ep);
    sleep(0.3);
  }
}

export function handleSummary(data) {
  // In bảng so sánh với ngưỡng mục tiêu ngay trên console
  let out = '\n===== BASELINE 1 NGƯỜI DÙNG (p95 so với ngưỡng) =====\n';
  for (const ep of ENDPOINTS) {
    const m = data.metrics[`http_req_duration{name:${ep.name}}`];
    if (!m) continue;
    const p95 = m.values['p(95)'];
    const verdict = p95 <= ep.target ? 'ĐẠT ' : 'VƯỢT';
    out += `${verdict}  ${ep.name.padEnd(24)} p95=${p95.toFixed(0)}ms  (ngưỡng ${ep.target}ms)\n`;
  }
  return {
    stdout: out,
    'results-smoke.json': JSON.stringify(data, null, 2),
  };
}
