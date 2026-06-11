'use client';
import React, { useState, useCallback } from 'react';
import { FileSearch, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { DecisionBadge, FraudScoreBar, Spinner, EmptyState } from '../../components/index';
import { format, parseISO } from 'date-fns';

const ACTIONS = ['', 'APPROVE', 'BLOCK', 'STEP_UP_AUTH', 'MANUAL_REVIEW'];

export default function AuditPage() {
  const [txnId,      setTxnId]      = useState('');
  const [customerId, setCustomerId] = useState('');
  const [action,     setAction]     = useState('');
  const [pFraudMin,  setPFraudMin]  = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);
  const [results,    setResults]    = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  const search = useCallback(async (pg = 1) => {
    setLoading(true); setSearched(true); setPage(pg);
    const params: any = { page: pg, page_size: 25 };
    if (txnId)      params.txn_id      = txnId;
    if (customerId) params.customer_id = customerId;
    if (action)     params.action      = action;
    if (pFraudMin)  params.p_fraud_min = pFraudMin;
    if (dateFrom)   params.date_from   = dateFrom;
    if (dateTo)     params.date_to     = dateTo;
    try {
      const data = await api.decisions.list(params);
      setResults(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [txnId, customerId, action, pFraudMin, dateFrom, dateTo]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); search(1); };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileSearch className="w-6 h-6 text-blue-600" />
          Audit Trail
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Search all fraud decisions with full audit history</p>
      </div>

      {/* Search form */}
      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Transaction ID</label>
            <input value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="txn-001…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer ID</label>
            <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="cust-001…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select value={action} onChange={e => setAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {ACTIONS.map(a => (
                <option key={a} value={a}>{a || 'All actions'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min P(fraud)</label>
            <input type="number" min="0" max="1" step="0.01"
              value={pFraudMin} onChange={e => setPFraudMin(e.target.value)}
              placeholder="0.70"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <button type="submit"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Search className="w-4 h-4" /> Search Decisions
        </button>
      </form>

      {/* Results */}
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {!loading && searched && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{total.toLocaleString()} decisions found</p>

          {results.length === 0 ? (
            <EmptyState title="No decisions found" description="Try different search criteria" icon={FileSearch} />
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Timestamp</th>
                      <th className="px-4 py-3 text-left">Transaction</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Action</th>
                      <th className="px-4 py-3 text-left w-32">P(fraud)</th>
                      <th className="px-4 py-3 text-right">Latency</th>
                      <th className="px-4 py-3 text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((r: any) => (
                      <React.Fragment key={r.txn_id}>
                        <tr className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpanded(expanded === r.txn_id ? null : r.txn_id)}>
                          <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {r.decided_at ? format(parseISO(r.decided_at), 'MMM dd HH:mm:ss') : '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                            {(r.txn_id ?? '').slice(0,12)}…
                          </td>
                          <td className="px-4 py-2.5 text-xs">{r.customer_id}</td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            {r.currency} {Number(r.amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <DecisionBadge action={r.action} size="xs" />
                          </td>
                          <td className="px-4 py-2.5 w-32">
                            <FraudScoreBar score={r.p_fraud ?? 0} />
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-gray-400 font-mono">
                            {Number(r.latency_ms).toFixed(0)}ms
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-blue-600">
                            {expanded === r.txn_id ? '▲' : '▼'}
                          </td>
                        </tr>
                        {expanded === r.txn_id && (
                          <tr>
                            <td colSpan={8} className="bg-blue-50 px-6 py-4">
                              <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Signals</p>
                                  <dl className="text-xs space-y-1">
                                    <div className="flex justify-between"><dt className="text-gray-500">Graph risk</dt><dd>{(r.graph_risk_score*100).toFixed(1)}%</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">Anomaly score</dt><dd>{(r.anomaly_score*100).toFixed(1)}%</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">Confidence</dt><dd>{(r.confidence*100).toFixed(1)}%</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">Optimal cost</dt><dd>${r.optimal_cost?.toFixed(2)}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">A/B variant</dt><dd>{r.ab_variant || '—'}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">Model</dt><dd className="font-mono">{r.model_version || '—'}</dd></div>
                                  </dl>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Explanation</p>
                                  <dl className="text-xs space-y-1.5">
                                    {Object.entries(r.explanation ?? {}).slice(0,4).map(([k,v]: any) => (
                                      <div key={k}>
                                        <dt className="text-gray-400 capitalize">{k.replace(/_/g,' ')}</dt>
                                        <dd className="text-gray-700">{v}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => search(page - 1)} disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40 hover:bg-gray-50">
                    Previous
                  </button>
                  <span className="text-xs text-gray-500">Page {page} of {pages}</span>
                  <button onClick={() => search(page + 1)} disabled={page === pages}
                    className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40 hover:bg-gray-50">
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
