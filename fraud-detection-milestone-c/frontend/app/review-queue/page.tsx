'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, UserCheck } from 'lucide-react';
import { api } from '../../lib/api';
import {
  DecisionBadge, FraudScoreBar, PriorityBadge, StatusBadge, EmptyState, Spinner,
} from '../../components/index';
import type { ReviewCase } from '../../lib/types';
import { formatDistanceToNow, parseISO } from 'date-fns';

const STATUSES = ['', 'OPEN', 'IN_REVIEW', 'RESOLVED'];

export default function ReviewQueuePage() {
  const [cases,   setCases]   = useState<ReviewCase[]>([]);
  const [total,   setTotal]   = useState(0);
  const [openCt,  setOpenCt]  = useState(0);
  const [revCt,   setRevCt]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status,  setStatus]  = useState('');
  const [myOnly,  setMyOnly]  = useState(false);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 20 };
      if (status)  params.status         = status;
      if (myOnly)  params.assigned_to_me = true;
      const data = await api.queue.list(params);
      setCases(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setOpenCt(data.open_count ?? 0);
      setRevCt(data.in_review_count ?? 0);
    } catch { } finally { setLoading(false); }
  }, [page, status, myOnly]);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    try { await api.queue.sync(); await load(); } catch { } finally { setSyncing(false); }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Review Queue
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {openCt} open · {revCt} in review · {total} total
          </p>
        </div>
        <button onClick={sync} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
            bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync from decisions
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {STATUSES.map(s => (
            <button key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={myOnly} onChange={e => { setMyOnly(e.target.checked); setPage(1); }}
            className="rounded border-gray-300 text-blue-600" />
          Assigned to me
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : cases.length === 0 ? (
        <EmptyState title="No cases found" description="Sync from decisions or change filters" icon={AlertTriangle} />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Priority</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left w-36">P(fraud)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cases.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 text-xs">{c.customer_id}</p>
                        <p className="text-gray-400 text-xs font-mono">{c.txn_id.slice(0,12)}…</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ${c.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 w-36"><FraudScoreBar score={c.p_fraud} /></td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {c.created_at ? formatDistanceToNow(parseISO(c.created_at), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/review-queue/${c.id}`}
                        className="text-xs font-medium text-blue-600 hover:underline">
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40 hover:bg-gray-50">
                Previous
              </button>
              <span className="text-xs text-gray-500">Page {page} of {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages}
                className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40 hover:bg-gray-50">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
