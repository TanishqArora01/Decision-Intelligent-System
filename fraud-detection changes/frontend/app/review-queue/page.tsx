'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/index';
import type { ReviewCase } from '@/lib/types';
import { formatDistanceToNow, parseISO } from 'date-fns';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export default function ReviewQueuePage() {
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState('');
  const [myOnly, setMyOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { page: 1, page_size: 20 };
      if (status) params.status = status;
      if (myOnly) params.assigned_to_me = true;
      const data = await api.queue.list(params);
      setCases(data.items ?? []);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [status, myOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      await api.queue.sync();
      await load();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Workspace 07</p>
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
            Review Queue
          </h1>
        </div>
        <Button onClick={() => void sync()} disabled={syncing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync from Decisions
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          options={STATUS_TABS}
          value={status}
          onChange={setStatus}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={myOnly} onChange={(e) => setMyOnly(e.target.checked)} className="accent-emerald-500" />
          Assigned to Me
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : cases.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <p className="text-text-secondary">
            Review pipeline clear. Sync from active decisions or modify filter bounds.
          </p>
        </div>
      ) : (
        <div className="glass-panel divide-y divide-slate-800">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/review-queue/${c.id}`}
              className="flex items-center justify-between px-4 py-4 transition hover:bg-white/[0.02]"
            >
              <div>
                <p className="font-mono text-sm">{c.txn_id}</p>
                <p className="text-xs text-text-muted">
                  {c.customer_id} · P(fraud) {((c.p_fraud ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase text-amber-400">{c.status}</p>
                <p className="text-[10px] text-text-muted">
                  {c.created_at ? formatDistanceToNow(parseISO(c.created_at), { addSuffix: true }) : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
