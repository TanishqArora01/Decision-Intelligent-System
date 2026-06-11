import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5000 },  // Ramp up
    { duration: '1m', target: 50000 }, // Sustained load simulating 50k TPS (via virtual users)
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<100'], // 95% of requests must complete below 100ms
    'http_req_failed': ['rate<0.01'],   // Error rate must be less than 1%
  },
};

const BASE_URL = 'http://localhost:8000';

export default function () {
  const payload = JSON.stringify({
    org_id: 'org_enterprise_01',
    customer_id: `cust_${Math.floor(Math.random() * 100000)}`,
    amount: Math.random() * 1000,
    currency: 'USD',
    merchant_category: 'retail',
    country_code: 'US',
    is_new_device: Math.random() > 0.9,
    is_new_ip: Math.random() > 0.9,
    is_fraud: false,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': `k6-test-${__VU}-${__ITER}`,
    },
  };

  const res = http.post(`${BASE_URL}/decision`, payload, params);

  check(res, {
    'is status 200': (r) => r.status === 200,
    'has decision': (r) => r.json().action !== undefined,
  });
  
  sleep(0.01);
}
