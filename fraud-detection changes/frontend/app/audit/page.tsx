'use client';

import { useState } from 'react';
import { FileSearch, Search } from 'lucide-react';
import { queryAudit } from '@/lib/db';
import { OutcomeBadge } from '@/components/ui/outcome-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AuditRecord } from '@/lib/db';
import { fmtCurrency } from '@/lib/utils';

const OUTCOMES = ['ALL', 'APPROVE', 'BLOCK', 'STEP_UP_AUTH', 'MANUAL_REVIEW'] as const;

export default function AuditPage() {
  const [txnId, setTxnId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [outcome, setOutcome] = useState<string>('ALL');
  const [minPFraud, setMinPFraud] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [results, setResults] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const executeQuery = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const rows = await queryAudit({
        txnId: txnId || undefined,
        accountId: accountId || undefined,
        outcome: outcome === 'ALL' ? undefined : outcome,
        minPFraud: minPFraud / 100,
        from: dateFrom ? new Date(dateFrom).getTime() : undefined,
        to: dateTo ? new Date(dateTo).getTime() + 86400000 : undefined,
        limit: 200,
      });
      setResults(rows);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Workspace 09</p>
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <FileSearch className="h-8 w-8 text-emerald-400" />
          Audit Trail
        </h1>
        <p className="mt-1 text-sm text-text-secondary">Digital forensics — queries execute against local IndexedDB ledger.</p>
      </header>

      <div className="glass-panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="metric-label mb-1.5 block">Transaction ID</label>
          <Input value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="TXN_…" />
        </div>
        <div>
          <label className="metric-label mb-1.5 block">Account Reference ID</label>
          <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="ACC_…" />
        </div>
        <div>
          <label className="metric-label mb-1.5 block">Outcome Classification</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-bg-secondary px-3 py-2 text-sm"
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="metric-label mb-1.5 block">Min P(fraud) — {(minPFraud).toFixed(0)}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={minPFraud}
            onChange={(e) => setMinPFraud(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>
        <div>
          <label className="metric-label mb-1.5 block">Date From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="metric-label mb-1.5 block">Date To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <Button onClick={() => void executeQuery()} disabled={loading} className="gap-2">
        <Search className="h-4 w-4" />
        {loading ? 'Querying…' : 'Execute Ledger Query'}
      </Button>

      <div className="glass-panel overflow-hidden">
        {!searched ? (
          <p className="p-8 text-center text-sm text-text-muted">Configure filters and execute ledger query.</p>
        ) : results.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">No records match the current bounds.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3">Txn</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">P(fraud)</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">AML</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/60">
                  <td className="px-4 py-2 font-mono text-xs">{r.txnId}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.accountId}</td>
                  <td className="px-4 py-2 font-mono text-xs">{fmtCurrency(r.amount)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-amber-400">{(r.pFraud * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2">
                    <OutcomeBadge outcome={r.outcome} />
                  </td>
                  <td className="px-4 py-2 font-mono text-[10px]">{r.amlCategory}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-text-muted">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
