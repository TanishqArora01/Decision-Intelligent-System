// Mock analytics API endpoint
export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse query parameters to determine which analytics endpoint to mock
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const path = url.pathname;
  const hours = url.searchParams.get('hours');
  const granularity = url.searchParams.get('granularity');

  let mockData;

  if (path.includes('overview')) {
    mockData = {
      total_decisions: 15420,
      block_rate_pct: 2.3,
      avg_p_fraud: 0.127,
      p95_latency_ms: 145,
      approved: 14989,
      blocked: 342,
      step_up: 89,
      manual_review: 0
    };
  } else if (path.includes('fraud-rate')) {
    const hoursNum = parseInt(hours) || 24;
    mockData = {
      data: Array.from({ length: hoursNum }, (_, i) => ({
        bucket: new Date(Date.now() - (hoursNum - i) * 3600000).toISOString(),
        block_rate_pct: Math.random() * 3 + 1
      }))
    };
  } else if (path.includes('actions')) {
    mockData = {
      data: [
        { action: 'APPROVE', count: 14989 },
        { action: 'BLOCK', count: 342 },
        { action: 'STEP_UP_AUTH', count: 89 },
        { action: 'MANUAL_REVIEW', count: 0 }
      ]
    };
  } else if (path.includes('top-risk')) {
    mockData = {
      data: [
        { txn_id: 'TXN001', customer_id: 'CUST001', amount: 5120, action: 'BLOCK', p_fraud: 0.92, latency_ms: 145 },
        { txn_id: 'TXN002', customer_id: 'CUST002', amount: 3420, action: 'BLOCK', p_fraud: 0.78, latency_ms: 132 },
        { txn_id: 'TXN003', customer_id: 'CUST003', amount: 2890, action: 'STEP_UP_AUTH', p_fraud: 0.65, latency_ms: 156 },
        { txn_id: 'TXN004', customer_id: 'CUST004', amount: 1750, action: 'APPROVE', p_fraud: 0.35, latency_ms: 98 },
        { txn_id: 'TXN005', customer_id: 'CUST005', amount: 980, action: 'APPROVE', p_fraud: 0.18, latency_ms: 87 }
      ]
    };
  } else if (path.includes('latency')) {
    mockData = {
      data: Array.from({ length: 60 }, (_, i) => ({
        bucket: new Date(Date.now() - (60 - i) * 60000).toISOString(),
        p50_latency_ms: 85 + Math.random() * 20,
        p95_latency_ms: 120 + Math.random() * 40,
        p99_latency_ms: 180 + Math.random() * 60
      }))
    };
  } else {
    mockData = {};
  }

  res.status(200).json({
    success: true,
    data: mockData
  });
}
