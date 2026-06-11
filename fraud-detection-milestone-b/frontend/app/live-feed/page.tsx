'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Activity, Pause, Play, Trash2, Zap } from 'lucide-react';
import { connectDecisionStream } from '../../lib/api';
import { DecisionBadge, FraudScoreBar } from '../../components/index';
import type { SSEDecision } from '../../lib/types';
import { formatDistanceToNow, parseISO } from 'date-fns';

const MAX_ROWS = 200;

export default function LiveFeedPage() {
  const [events,  setEvents]  = useState<SSEDecision[]>([]);
  const [paused,  setPaused]  = useState(false);
  const [filter,  setFilter]  = useState<string>('ALL');
  const [connected, setConnected] = useState(false);
  const pausedRef = useRef(false);
  const bufRef    = useRef<SSEDecision[]>([]);

  useEffect(() => {
    const disconnect = connectDecisionStream((ev: SSEDecision) => {
      if (ev.type === 'connected') { setConnected(true); return; }
      if (ev.type === 'keepalive') return;
      if (ev.type !== 'decision')  return;
      if (pausedRef.current) {
        bufRef.current = [ev, ...bufRef.current].slice(0, 50);
        return;
      }
      setEvents(prev => [ev, ...prev].slice(0, MAX_ROWS));
    });
    return disconnect;
  }, []);

  const togglePause = () => {
    if (paused) {
      // Flush buffer
      setEvents(prev => [...bufRef.current, ...prev].slice(0, MAX_ROWS));
      bufRef.current = [];
    }
    pausedRef.current = !paused;
    setPaused(p => !p);
  };

  const clear = () => { setEvents([]); bufRef.current = []; };

  const visible = filter === 'ALL'
    ? events
    : events.filter(e => e.action === filter);

  const counts = events.reduce((acc, e) => {
    if (e.action) acc[e.action] = (acc[e.action] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const FILTERS = ['ALL', 'APPROVE', 'BLOCK', 'STEP_UP_AUTH', 'MANUAL_REVIEW'];
  const FILTER_LABELS: Record<string, string> = {
    ALL: 'All', APPROVE: 'Approve', BLOCK: 'Block',
    STEP_UP_AUTH: 'Step-Up', MANUAL_REVIEW: 'Review',
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Live Decision Feed
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {connected
              ? <span className="text-green-600">● Connected — streaming in real-time</span>
              : <span className="text-amber-600">○ Connecting…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={togglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${paused
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
            {paused ? <><Play className="w-3.5 h-3.5" /> Resume ({bufRef.current.length})</> :
                      <><Pause className="w-3.5 h-3.5" /> Pause</>}
          </button>
          <button onClick={clear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              bg-gray-100 text-gray-600 hover:bg-gray-200">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 flex-wrap">
        {FILTERS.map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
              ${filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
            {FILTER_LABELS[f]} {f !== 'ALL' && counts[f] ? `(${counts[f]})` : ''}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">
          Showing {visible.length} of {events.length} events
        </span>
      </div>

      {/* Feed table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Activity className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">Waiting for transactions…</p>
            <p className="text-sm mt-1">Decisions appear here in real-time once the pipeline is running</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Transaction</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Action</th>
                  <th className="px-4 py-3 text-left w-36">P(fraud)</th>
                  <th className="px-4 py-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map((ev, i) => (
                  <tr key={`${ev.txn_id}-${i}`}
                    className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                      {ev.decided_at
                        ? formatDistanceToNow(parseISO(ev.decided_at), { addSuffix: true })
                        : 'just now'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                      {(ev.txn_id ?? '').slice(0, 12)}…
                    </td>
                    <td className="px-4 py-2.5 text-xs">{ev.customer_id}</td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {ev.currency} {Number(ev.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <DecisionBadge action={ev.action ?? ''} size="xs" />
                    </td>
                    <td className="px-4 py-2.5 w-36">
                      <FraudScoreBar score={ev.p_fraud ?? 0} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-500 font-mono">
                      {Number(ev.latency_ms ?? 0).toFixed(0)}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
