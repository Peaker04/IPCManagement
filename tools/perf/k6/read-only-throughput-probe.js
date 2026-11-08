// D04 read-only throughput probe. This is not the 80/20 qualification workload.
import { sleep } from 'k6';
import { ENDPOINTS, buildThresholds, login, hitEndpoint } from './lib.js';

const byName = Object.fromEntries(ENDPOINTS.map((endpoint) => [endpoint.name, endpoint]));
const journey = ENDPOINTS.map((endpoint) => endpoint.name);

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '15m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
    burst: {
      executor: 'constant-arrival-rate',
      startTime: '15m30s',
      rate: 30,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 30,
      maxVUs: 50,
    },
  },
  thresholds: buildThresholds({ dropped_iterations: ['count==0'] }),
};

export function setup() {
  if (!__ENV.K6_RUN_ID || !/^[A-Za-z0-9_-]+$/.test(__ENV.K6_RUN_ID)) {
    throw new Error('K6_RUN_ID is required for a run-unique result file.');
  }
  return { token: login() };
}

export default function (data) {
  const name = journey[Math.floor(Math.random() * journey.length)];
  hitEndpoint(data.token, byName[name]);
  sleep(0.05);
}

export function handleSummary(data) {
  return {
    stdout: '\nD04 read-only throughput probe complete. This does not certify authenticated-user count, active workers, write mix, imports or business invariants.\n',
    [`results-readonly-${__ENV.K6_RUN_ID}.json`]: JSON.stringify(data, null, 2),
  };
}
