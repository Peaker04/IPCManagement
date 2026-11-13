// ============================================================
// mrx-concurrency.js — Multi-user concurrent load test for MRX
// ============================================================
import { sleep } from 'k6';
import { MRX_ENDPOINTS, buildMrxThresholds, login, hitEndpoint } from './lib.js';

export const options = {
  scenarios: {
    mrx_concurrent_readers: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 20 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: buildMrxThresholds(),
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  for (const ep of MRX_ENDPOINTS) {
    hitEndpoint(data.token, ep);
  }
  sleep(0.2);
}
