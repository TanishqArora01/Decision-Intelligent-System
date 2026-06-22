// Mock transactions API endpoint
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

  // Mock transaction data
  const mockTransactions = [
    {
      id: 'TXN001',
      amount: 1250.00,
      merchant: 'Amazon',
      timestamp: '2024-01-15T10:30:00Z',
      status: 'approved',
      riskScore: 0.15,
      category: 'retail'
    },
    {
      id: 'TXN002',
      amount: 3420.50,
      merchant: 'Apple Store',
      timestamp: '2024-01-15T11:45:00Z',
      status: 'flagged',
      riskScore: 0.78,
      category: 'electronics'
    },
    {
      id: 'TXN003',
      amount: 89.99,
      merchant: 'Netflix',
      timestamp: '2024-01-15T12:00:00Z',
      status: 'approved',
      riskScore: 0.05,
      category: 'subscription'
    },
    {
      id: 'TXN004',
      amount: 5120.00,
      merchant: 'Unknown Merchant',
      timestamp: '2024-01-15T13:15:00Z',
      status: 'blocked',
      riskScore: 0.92,
      category: 'other'
    },
    {
      id: 'TXN005',
      amount: 450.00,
      merchant: 'Uber',
      timestamp: '2024-01-15T14:30:00Z',
      status: 'approved',
      riskScore: 0.12,
      category: 'transportation'
    }
  ];

  res.status(200).json({
    success: true,
    data: mockTransactions,
    total: mockTransactions.length
  });
}
