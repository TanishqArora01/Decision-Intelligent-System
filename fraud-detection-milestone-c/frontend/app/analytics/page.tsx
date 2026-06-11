'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import { BarChart2, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { KpiCard, Spinner } from '../../components/index';
import { format, parseISO } from 'date-fns';

const HOURS_OPTIONS = [1, 6, 24, 48, 168];

export default function AnalyticsPage() {
  const [hours,    setHours]    = useState(24);
  const [rateData, setRateData] = useState<any[]>([]);
  const [latency,  setLatency]  = useState<any>({});
  const [abData,   setAbData]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const gran = hours <= 2 ? 'minute' : hours <= 48 ? 'hour' : 'day';
      const [rate, lat, ab] = await Promise.all([
        api.analytics.fraudRate(hours, gran),
        api.analytics.latency(Math.min(hours, 24)),
        api.analytics.abCompare(hours).catch(() => ({ data: [] })),
      ]);
      setRateData((rate.data ?? []).map((r: any) => ({
        ...r,
        time: r.bucket ? format(parseISO(r.bucket),
          gran === 'minute' ? 'HH:mm' : gran === 'day' ? 'MMM dd' : 'MM/dd HH:mm') : '',
      })));
      setLatency(lat ?? {});
      setAbData(ab.data ?? []);
    } catch { } finally { setLoading(false); }
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-purple-600" />
            Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Model performance and fraud trend analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {HOURS_OPTIONS.map(h => (
              <button key={h} onClick={() => setHours(h)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                  ${hours === h ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
                {h < 24 ? `${h}h` : h === 24 ? '1d' : h === 48 ? '2d' : '7d'}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Latency KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="p50 Latency" value={`${latency.p50 ?? 0}ms`} color="green" />
        <KpiCard title="p95 Latency" value={`${latency.p95 ?? 0}ms`} color="amber" />
        <KpiCard title="p99 Latency" value={`${latency.p99 ?? 0}ms`} color="red"   />
        <KpiCard title="Avg Latency" value={`${latency.avg ?? 0}ms`} color="blue"  sub={`${latency.total ?? 0} decisions`} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          {/* Fraud rate trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Fraud Rate + Decision Volume</h2>
            {rateData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={rateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine yAxisId="left" y={5} stroke="#ef4444" strokeDasharray="4 4"
                    label={{ value: 'Alert 5%', fill: '#ef4444', fontSize: 10 }} />
                  <Line yAxisId="left"  type="monotone" dataKey="block_rate_pct"
                    stroke="#ef4444" strokeWidth={2} dot={false} name="Block Rate %" />
                  <Line yAxisId="left"  type="monotone" dataKey="avg_p_fraud"
                    stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg P(fraud)" />
                  <Bar  yAxisId="right" dataKey="total" fill="#e0e7ff" name="Decision Volume" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                No data for this period
              </div>
            )}
          </div>

          {/* A/B experiment */}
          {abData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">A/B Experiment — Control vs Treatment</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <th className="pb-2 text-left pr-6">Variant</th>
                      <th className="pb-2 text-right pr-4">Decisions</th>
                      <th className="pb-2 text-right pr-4">Block Rate</th>
                      <th className="pb-2 text-right pr-4">Approved</th>
                      <th className="pb-2 text-right pr-4">Step-Up</th>
                      <th className="pb-2 text-right pr-4">Avg P(fraud)</th>
                      <th className="pb-2 text-right">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {abData.map((r: any) => (
                      <tr key={r.ab_variant} className="hover:bg-gray-50">
                        <td className="py-2 pr-6 font-semibold capitalize">{r.ab_variant}</td>
                        <td className="py-2 pr-4 text-right">{r.total?.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right">
                          <span className={r.block_rate_pct > 5 ? 'text-red-600 font-semibold' : ''}>
                            {r.block_rate_pct}%
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right text-green-600">{r.approved?.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right text-amber-600">{r.step_up?.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right font-mono text-xs">{r.avg_p_fraud}</td>
                        <td className="py-2 text-right font-mono text-xs">{r.avg_latency_ms}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
