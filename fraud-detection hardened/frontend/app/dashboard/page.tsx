'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, XCircle, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { format, parseISO } from 'date-fns';

const ACTION_COLORS: Record<string, string> = {
  APPROVE:'#22c55e', BLOCK:'#ef4444', STEP_UP_AUTH:'#f59e0b', MANUAL_REVIEW:'#8b5cf6',
};
function fmtNum(n: number|undefined|null) {
  if (n==null||isNaN(n as number)) return '—';
  if ((n as number)>=1e6) return ((n as number)/1e6).toFixed(1)+'M';
  if ((n as number)>=1e3) return ((n as number)/1e3).toFixed(1)+'K';
  return String(n);
}
function fmtPct(n:number|undefined|null){ return (n==null||isNaN(n as number)) ? '—' : `${n}%`; }
function fmtMs(n:number|undefined|null){  return (n==null||isNaN(n as number)) ? '—' : `${n}ms`; }

function KpiCard({ title, value, sub, icon:Icon, color='blue' }:
  { title:string; value:string|number; sub?:string; icon?:React.FC<any>; color?:string }) {
  const colors:Record<string,string> = {
    blue:'bg-blue-50 text-blue-600', green:'bg-green-50 text-green-600',
    red:'bg-red-50 text-red-600', amber:'bg-amber-50 text-amber-600', purple:'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      {Icon && <div className={`p-2.5 rounded-lg ${colors[color]??colors.blue}`}><Icon className="w-5 h-5"/></div>}
      <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-3 w-24 bg-gray-200 rounded mb-3"/>
      <div className="h-8 w-20 bg-gray-200 rounded mb-2"/>
      <div className="h-2 w-16 bg-gray-100 rounded"/>
    </div>
  );
}
function DecisionBadge({ action }:{ action:string }) {
  const s:Record<string,string> = {
    APPROVE:'bg-green-100 text-green-800', BLOCK:'bg-red-100 text-red-800',
    STEP_UP_AUTH:'bg-amber-100 text-amber-800', MANUAL_REVIEW:'bg-purple-100 text-purple-800',
  };
  const labels:Record<string,string> = { APPROVE:'Approve',BLOCK:'Block',STEP_UP_AUTH:'Step-Up',MANUAL_REVIEW:'Review' };
  return <span className={`inline-flex items-center font-semibold rounded-full px-2 py-0.5 text-xs ${s[action]??'bg-gray-100 text-gray-700'}`}>{labels[action]??action}</span>;
}

export default function DashboardPage() {
  const [overview,   setOverview]   = useState<any>(null);
  const [rateData,   setRateData]   = useState<any[]>([]);
  const [actionData, setActionData] = useState<any[]>([]);
  const [topRisk,    setTopRisk]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const load = useCallback(async () => {
    try {
      const [ov,rate,actions,risk] = await Promise.all([
        api.analytics.overview(),
        api.analytics.fraudRate(24,'hour'),
        api.analytics.actions(24),
        api.analytics.topRisk(1),
      ]);
      setOverview(ov);
      setRateData((rate.data??[]).map((r:any)=>({...r, time:r.bucket?format(parseISO(r.bucket),'HH:mm'):''})));
      setActionData(actions.data??[]);
      setTopRisk(risk.data??[]);
      setError('');
    } catch(err:any) {
      if (loading) setError(err.message??'Failed to load analytics');
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const ov = overview ?? {};

  if (loading) return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div><div className="h-7 w-32 bg-gray-200 rounded animate-pulse mb-1"/><div className="h-4 w-56 bg-gray-100 rounded animate-pulse"/></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(8)].map((_,i)=><KpiSkeleton key={i}/>)}</div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"><div className="h-48 bg-gray-100 rounded"/></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Last 24 hours · auto-refreshes every 30s</p>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5"/>{error}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Decisions"  value={fmtNum(ov.total_decisions)}  icon={Activity}      color="blue"/>
        <KpiCard title="Block Rate"       value={fmtPct(ov.block_rate_pct)}   icon={XCircle}       color="red"   sub="fraud actions"/>
        <KpiCard title="Avg P(fraud)"     value={ov.avg_p_fraud!=null?(ov.avg_p_fraud as number).toFixed(3):'—'} icon={TrendingUp} color="amber"/>
        <KpiCard title="p95 Latency"      value={fmtMs(ov.p95_latency_ms)}   icon={Zap}           color="green"/>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Approved"      value={fmtNum(ov.approved)}      icon={CheckCircle}   color="green"/>
        <KpiCard title="Blocked"       value={fmtNum(ov.blocked)}       icon={XCircle}       color="red"/>
        <KpiCard title="Step-Up Auth"  value={fmtNum(ov.step_up)}       icon={Activity}      color="amber"/>
        <KpiCard title="Manual Review" value={fmtNum(ov.manual_review)} icon={AlertTriangle} color="purple"/>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Fraud Rate Trend (24h)</h2>
          {rateData.length>0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rateData}>
                <XAxis dataKey="time" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:11}}/>
                <Tooltip formatter={(v:any)=>[`${v}%`,'Block rate']}/>
                <Line type="monotone" dataKey="block_rate_pct" stroke="#3b82f6" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
              <Activity className="w-8 h-8 mb-2 opacity-30"/>No data yet — waiting for decisions
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Action Distribution</h2>
          {actionData.length>0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={actionData} dataKey="count" nameKey="action" cx="50%" cy="50%" outerRadius={80} label={({pct}:any)=>`${pct}%`}>
                  {actionData.map((e:any)=><Cell key={e.action} fill={ACTION_COLORS[e.action]??'#94a3b8'}/>)}
                </Pie>
                <Tooltip/><Legend formatter={(v)=>v.replace('_',' ')}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data yet</div>}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Highest Risk Transactions (last hour)</h2>
        {topRisk.length>0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="pb-2 pr-4">Transaction</th><th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">Amount</th><th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">P(fraud)</th><th className="pb-2">Latency</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {topRisk.map((r:any)=>(
                  <tr key={r.txn_id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{String(r.txn_id).slice(0,12)}…</td>
                    <td className="py-2 pr-4 text-xs">{r.customer_id}</td>
                    <td className="py-2 pr-4 font-medium">${Number(r.amount??0).toLocaleString()}</td>
                    <td className="py-2 pr-4"><DecisionBadge action={r.action}/></td>
                    <td className="py-2 pr-4">
                      <span className={`font-mono font-bold text-xs ${(r.p_fraud??0)>=0.7?'text-red-600':(r.p_fraud??0)>=0.4?'text-amber-600':'text-green-600'}`}>
                        {((r.p_fraud??0)*100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">{Number(r.latency_ms??0).toFixed(0)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-400 text-sm text-center py-8">No high-risk transactions in the last hour</p>}
      </div>
    </div>
  );
}
