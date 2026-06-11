'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Clock, Shield, TrendingUp, XCircle, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { KpiCard, DecisionBadge, Spinner } from '../../components/index';
import { format, parseISO } from 'date-fns';

const ACTION_COLORS: Record<string, string> = {
  APPROVE: '#22c55e', BLOCK: '#ef4444',
  STEP_UP_AUTH: '#f59e0b', MANUAL_REVIEW: '#8b5cf6',
};

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export default function DashboardPage() {
  const [overview,   setOverview]   = useState<any>(null);
  const [rateData,   setRateData]   = useState<any[]>([]);
  const [actionData, setActionData] = useState<any[]>([]);
  const [topRisk,    setTopRisk]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    try {
      const [ov, rate, actions, risk] = await Promise.all([
        api.analytics.overview(),
        api.analytics.fraudRate(24, 'hour'),
        api.analytics.actions(24),
        api.analytics.topRisk(1),
      ]);
      setOverview(ov);
      setRateData((rate.data ?? []).map((r: any) => ({
        ...r,
        time: r.bucket ? format(parseISO(r.bucket), 'HH:mm') : '',
      })));
      setActionData(actions.data ?? []);
      setTopRisk(risk.data ?? []);
    } catch { /* backend may not be available in dev */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Spinner className="w-8 h-8" />
    </div>
  );

  const ov = overview ?? {};

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
      <div className="border-b border-gray-300 pb-2">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 uppercase">Risk & Decision Operations</h1>
        <p className="text-gray-500 text-xs mt-1 font-mono">LIVE FEED · AUTO-REFRESH 30S · LAST 24 HOURS</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Decisions"  value={fmtNum(ov.total_decisions ?? 0)} icon={Shield}      color="blue"   />
        <KpiCard title="Block Rate"       value={`${ov.block_rate_pct ?? 0}%`}    icon={XCircle}    color="red"    sub="fraud actions" />
        <KpiCard title="Avg P(fraud)"     value={(ov.avg_p_fraud ?? 0).toFixed(3)} icon={TrendingUp}  color="amber"  />
        <KpiCard title="p95 Latency"      value={`${ov.p95_latency_ms ?? 0}ms`}   icon={Zap}        color="green"  />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Approved"     value={fmtNum(ov.approved      ?? 0)} icon={CheckCircle}  color="green"  />
        <KpiCard title="Blocked"      value={fmtNum(ov.blocked       ?? 0)} icon={XCircle}      color="red"    />
        <KpiCard title="Step-Up Auth" value={fmtNum(ov.step_up       ?? 0)} icon={Activity}     color="amber"  />
        <KpiCard title="Manual Review"value={fmtNum(ov.manual_review ?? 0)} icon={AlertTriangle} color="purple" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Fraud rate trend */}
        <div className="lg:col-span-2 bg-white border border-gray-300 shadow-sm">
          <div className="bg-gray-50 border-b border-gray-300 px-4 py-2">
            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Fraud Rate Trend (24h)</h2>
          </div>
          <div className="p-4">
            {rateData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={rateData}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={{stroke: '#d1d5db'}} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Block rate']} contentStyle={{ fontSize: '11px', borderRadius: '2px' }} />
                  <Line type="monotone" dataKey="block_rate_pct" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-xs uppercase tracking-widest">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Action pie */}
        <div className="bg-white border border-gray-300 shadow-sm">
          <div className="bg-gray-50 border-b border-gray-300 px-4 py-2">
            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Action Distribution</h2>
          </div>
          <div className="p-4">
            {actionData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={actionData} dataKey="count" nameKey="action"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={40} label={({ action, pct }: any) => `${pct}%`}
                    labelStyle={{ fontSize: '10px', fontWeight: 'bold' }}>
                    {actionData.map((entry: any) => (
                      <Cell key={entry.action} fill={ACTION_COLORS[entry.action] ?? '#94a3b8'} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '2px' }} />
                  <Legend formatter={(val) => <span className="text-[10px] uppercase font-bold tracking-wider">{val.replace('_', ' ')}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-xs uppercase tracking-widest">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Top risk */}
      <div className="bg-white border border-gray-300 shadow-sm">
        <div className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex justify-between items-center">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">High Risk Transactions (T-60m)</h2>
          <span className="text-[10px] text-gray-500 font-mono">LIMIT 10</span>
        </div>
        {topRisk.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-white border-b border-gray-300">
                <tr className="text-[10px] text-gray-500 uppercase tracking-widest">
                  <th className="px-4 py-2 font-bold">Transaction ID</th>
                  <th className="px-4 py-2 font-bold">Customer</th>
                  <th className="px-4 py-2 font-bold">Amount</th>
                  <th className="px-4 py-2 font-bold">Action</th>
                  <th className="px-4 py-2 font-bold">P(fraud)</th>
                  <th className="px-4 py-2 font-bold">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topRisk.map((r: any) => (
                  <tr key={r.txn_id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-2 font-mono text-[11px] text-gray-600">{r.txn_id.slice(0, 16)}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-gray-600">{r.customer_id}</td>
                    <td className="px-4 py-2 font-mono font-bold text-gray-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: r.currency || 'USD' }).format(r.amount)}
                    </td>
                    <td className="px-4 py-2"><DecisionBadge action={r.action} size="xs" /></td>
                    <td className="px-4 py-2">
                      <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-sm
                        ${r.p_fraud >= 0.7 ? 'bg-red-50 text-red-700' : r.p_fraud >= 0.4 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                        {(r.p_fraud * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-gray-500">{Number(r.latency_ms).toFixed(1)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center p-8">
            <p className="text-gray-400 text-xs uppercase tracking-widest">No high-risk transactions detected</p>
          </div>
        )}
      </div>
    </div>
  );
}
