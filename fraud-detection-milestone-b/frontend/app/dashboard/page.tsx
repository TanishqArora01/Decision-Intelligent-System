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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Last 24 hours · auto-refreshes every 30s</p>
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Fraud rate trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Fraud Rate Trend (24h)</h2>
          {rateData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rateData}>
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Block rate']} />
                <Line type="monotone" dataKey="block_rate_pct" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No data yet — waiting for decisions
            </div>
          )}
        </div>

        {/* Action pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Action Distribution</h2>
          {actionData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={actionData} dataKey="count" nameKey="action"
                  cx="50%" cy="50%" outerRadius={80} label={({ action, pct }: any) => `${pct}%`}>
                  {actionData.map((entry: any) => (
                    <Cell key={entry.action} fill={ACTION_COLORS[entry.action] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={(val) => val.replace('_', ' ')} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Top risk */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Highest Risk Transactions (last hour)</h2>
        {topRisk.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Transaction</th>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">P(fraud)</th>
                  <th className="pb-2">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topRisk.map((r: any) => (
                  <tr key={r.txn_id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{r.txn_id.slice(0, 12)}…</td>
                    <td className="py-2 pr-4 text-xs">{r.customer_id}</td>
                    <td className="py-2 pr-4 font-medium">${Number(r.amount).toLocaleString()}</td>
                    <td className="py-2 pr-4"><DecisionBadge action={r.action} size="xs" /></td>
                    <td className="py-2 pr-4">
                      <span className={`font-mono font-bold text-xs
                        ${r.p_fraud >= 0.7 ? 'text-red-600' : r.p_fraud >= 0.4 ? 'text-amber-600' : 'text-green-600'}`}>
                        {(r.p_fraud * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">{Number(r.latency_ms).toFixed(0)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">No high-risk transactions in the last hour</p>
        )}
      </div>
    </div>
  );
}
