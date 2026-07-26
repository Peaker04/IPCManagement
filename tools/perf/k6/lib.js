// ============================================================
// lib.js — dùng chung cho các kịch bản k6 của IPCManagement
// ============================================================
import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8001';
export const USERNAME = __ENV.K6_USERNAME || 'admin';
export const PASSWORD = __ENV.K6_PASSWORD || '';

// Danh mục endpoint đo hiệu năng.
// "name" dùng làm tag để đặt threshold riêng cho từng endpoint.
// "target" (ms) lấy từ mục 5 — Ngưỡng mục tiêu đề xuất, .docs/ipc-hieu-nang-mysql.md
export const ENDPOINTS = [
  { name: 'list-current-stock',     method: 'GET', path: '/api/workflow-reports/current-stock/page?pageNumber=1&pageSize=20',            target: 800 },
  { name: 'list-stock-movements',   method: 'GET', path: '/api/workflow-reports/stock-movements/page?pageNumber=1&pageSize=20',          target: 800 },
  { name: 'list-purchase-requests', method: 'GET', path: '/api/purchase-requests/page?pageNumber=1&pageSize=20',                          target: 800 },
  { name: 'list-dishes',            method: 'GET', path: '/api/Dishes?pageNumber=1&pageSize=20',                                          target: 800 },
  { name: 'search-dishes',          method: 'GET', path: '/api/Dishes?pageNumber=1&pageSize=20&searchKeyword=' + encodeURIComponent(__ENV.K6_SEARCH || 'ga'), target: 500 },
  { name: 'coordination-customers', method: 'GET', path: '/api/coordination/customers',                                                   target: 500 },
  // orders bắt buộc có dayOfWeek (t2..cn) và shiftName (MORNING/AFTERNOON) — thiếu sẽ 422
  { name: 'coordination-orders',    method: 'GET', path: '/api/coordination/orders?dayOfWeek=' + (__ENV.K6_DAY || 't2') + '&shiftName=' + (__ENV.K6_SHIFT || 'MORNING'), target: 1000 },
  { name: 'report-price-variance',  method: 'GET', path: '/api/workflow-reports/price-variance/by-supplier/page?pageNumber=1&pageSize=20', target: 3000 },
  { name: 'report-kpis',            method: 'GET', path: '/api/workflow-reports/operational-kpis',                                        target: 3000 },
];

// Sinh object thresholds cho options từ danh mục trên:
//   p(95) của từng endpoint phải dưới ngưỡng mục tiêu.
export function buildThresholds(extra) {
  const t = Object.assign({
    http_req_failed: ['rate<0.01'],   // dưới 1% lỗi
    checks: ['rate>0.99'],
  }, extra || {});
  for (const ep of ENDPOINTS) {
    t[`http_req_duration{name:${ep.name}}`] = [`p(95)<${ep.target}`];
  }
  return t;
}

// Đăng nhập, trả về access token.
// LƯU Ý: /api/auth/login có rate limit 5 lần/phút theo IP (auth-strict),
// nên chỉ gọi login trong setup(), KHÔNG login trong vòng lặp VU.
export function login() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth-login' } },
  );

  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
  });
  if (!ok) {
    fail(`Đăng nhập thất bại (status ${res.status}). Kiểm tra K6_USERNAME/K6_PASSWORD và backend đã chạy ở ${BASE_URL} chưa. Body: ${String(res.body).slice(0, 300)}`);
  }

  const body = res.json();
  // ApiResponse<LoginResponseDto>: { success, message, data: { accessToken | token ... } }
  const data = body.data || body.Data || {};
  const token = data.accessToken || data.AccessToken || data.token || data.Token;
  if (!token) {
    fail('Không tìm thấy access token trong response login. Kiểm tra lại cấu trúc LoginResponseDto.');
  }
  return token;
}

export function authParams(token, name) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    tags: { name },
  };
}

// Gọi một endpoint trong danh mục và check kết quả.
export function hitEndpoint(token, ep) {
  const res = http.get(`${BASE_URL}${ep.path}`, authParams(token, ep.name));
  check(res, {
    [`${ep.name}: status 200`]: (r) => r.status === 200,
    [`${ep.name}: không bị rate-limit (429)`]: (r) => r.status !== 429,
  });
  return res;
}
