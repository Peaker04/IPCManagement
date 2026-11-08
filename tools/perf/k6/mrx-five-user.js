import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const run = __ENV.MRX_EVIDENCE_RUN_ID;
const database = __ENV.MRX_E2E_DATABASE;
const base = __ENV.MRX_E2E_BASE_URL;
if (!run || database !== `ipc_mrx_evidence_${run}` || base !== 'http://127.0.0.1:5174' || __ENV.MRX_E2E_PROFILE !== 'qualification') throw new Error('HTTP diagnostic requires the exact governed MRX clone/runtime.');
const credentials = JSON.parse(open(__ENV.MRX_E2E_CREDENTIALS_FILE).replace(/^\uFEFF/, ''));
const scope = JSON.parse(open(`${__ENV.MRX_E2E_ARTIFACT_DIRECTORY}/measurement-scope.json`));
const roles = ['admin', 'dieuphoi', 'thukho', 'beptruong', 'manager'];
export const options = {
  scenarios: { mrx: { executor: 'constant-vus', vus: 5, duration: '10m', gracefulStop: '10s' } },
  thresholds: { http_req_failed: ['rate==0'], checks: ['rate==1'], http_req_duration: ['p(75)<=300','p(95)<800'] },
};
export function setup() {
  const sessions = [];
  for (const role of roles) {
    const response = http.post(`${base}/api/auth/login`, JSON.stringify(credentials[role]), { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login', role } });
    if (response.status !== 200) throw new Error(`Real ${role} login failed: HTTP${response.status}; no limit bypass/retry.`);
    const data = response.json('data');
    const token = data.accessToken;
    if (!token) throw new Error('Actual login did not return an access token.');
    const headers = { Authorization: `Bearer ${token}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' };
    const mode = http.get(`${base}/api/system-operation-mode`, { headers });
    const profile = http.get(`${base}/api/Auth/me`, { headers });
    if (mode.status !== 200 || mode.json('data.mode') !== 'MATERIAL_RECONCILIATION' || profile.status !== 200) throw new Error('Actual HTTP identity/mode admission failed.');
    sessions.push({ role, headers, userId: profile.json('data.user.userId') });
    sleep(13);
  }
  if (new Set(sessions.map((item) => item.userId)).size !== 5) throw new Error('Five distinct identities required.');
  return sessions;
}
export default function (sessions) {
  const session = sessions[exec.vu.idInTest - 1];
  const routes = {
    admin: ['/api/reconciliation/reports/operational-summary', '/api/reconciliation/reports/transactions-history?pageSize=20'],
    dieuphoi: ['/api/reconciliation/batches?pageSize=20'],
    thukho: [`/api/reconciliation/batches/${scope.batchId}/warehouse-daily`],
    beptruong: [`/api/reconciliation/batches/${scope.batchId}/kitchen-cooking`],
    manager: ['/api/reconciliation/reports/operational-summary', '/api/reconciliation/reports/completed-register?pageSize=20'],
  };
  const choices = routes[session.role];
  const route = choices[exec.vu.iterationInScenario % choices.length];
  const response = http.get(`${base}${route}`, { headers: session.headers, tags: { role: session.role, name: route.split('?')[0] }, timeout: '10s' });
  check(response, { 'real authorized MRX200': (result) => result.status === 200 });
  if (response.status === 429 || response.status >= 500) exec.test.abort(`Health/rate safety stop HTTP${response.status}; not reducing load.`);
  sleep(2 + exec.vu.iterationInScenario % 4);
}
export function handleSummary(data) {
  return { [`${__ENV.MRX_E2E_ARTIFACT_DIRECTORY}/k6-summary.json`]: JSON.stringify({ runId: run, vus: 5, durationSeconds: 600, metrics: data.metrics, limitation: 'Read-only local Release diagnostic, separate from browser/write evidence.' }, null, 2) };
}
