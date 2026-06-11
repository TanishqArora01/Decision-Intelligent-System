'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { api } from '../../../lib/api';
import {
  DecisionBadge, FraudScoreBar, PriorityBadge, StatusBadge, Spinner,
} from '../../../components/index';
import type { ReviewCase, CaseVerdict } from '../../../lib/types';

const VERDICTS: { value: CaseVerdict; label: string; color: string }[] = [
  { value: 'CONFIRMED_FRAUD', label: 'Confirmed Fraud',  color: 'red'   },
  { value: 'FALSE_POSITIVE',  label: 'False Positive',   color: 'green' },
  { value: 'INCONCLUSIVE',    label: 'Inconclusive',     color: 'gray'  },
];

function SignalRow({ label, value, children }: { label: string; value?: string | number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="text-sm font-medium text-gray-900">{children ?? value}</div>
    </div>
  );
}

export default function CaseDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [c,       setC]       = useState<ReviewCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [verdict, setVerdict] = useState<CaseVerdict | ''>('');
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.queue.get(id).then(data => { setC(data); setNotes(data.analyst_notes ?? ''); })
       .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const assign = async () => {
    if (!c) return;
    setSaving(true);
    try { const updated = await api.queue.assign(c.id); setC(updated); }
    catch { } finally { setSaving(false); }
  };

  const resolve = async () => {
    if (!c || !verdict) return;
    setSaving(true);
    try {
      const updated = await api.queue.resolve(c.id, verdict, notes);
      setC(updated);
    } catch { } finally { setSaving(false); }
  };

  const setPriority = async (p: number) => {
    if (!c) return;
    const updated = await api.queue.priority(c.id, p);
    setC(updated);
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!c)      return <div className="p-6 text-gray-500">Case not found</div>;

  const isResolved = c.status === 'RESOLVED';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Back to queue
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Case Review</h1>
          <p className="text-gray-500 text-sm mt-0.5 font-mono">{c.txn_id}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <StatusBadge status={c.status} />
          <PriorityBadge priority={c.priority} />
          {!isResolved && (
            <div className="flex gap-1">
              {[1,2,3].map(p => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`w-7 h-7 rounded text-xs font-bold transition-colors
                    ${c.priority === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ML Signals */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-1">
          <h2 className="font-semibold text-gray-800 mb-3">ML Risk Signals</h2>
          <SignalRow label="Customer">{c.customer_id}</SignalRow>
          <SignalRow label="Amount">${c.amount.toLocaleString()} {c.currency}</SignalRow>
          <SignalRow label="Channel">{c.channel || '—'}</SignalRow>
          <SignalRow label="Country">{c.country_code || '—'}</SignalRow>
          <SignalRow label="P(fraud)">
            <div className="flex items-center gap-3 w-40">
              <FraudScoreBar score={c.p_fraud} />
            </div>
          </SignalRow>
          <SignalRow label="Confidence">{(c.confidence * 100).toFixed(1)}%</SignalRow>
          <SignalRow label="Graph Risk">
            <span className={c.graph_risk_score > 0.5 ? 'text-red-600' : 'text-gray-900'}>
              {(c.graph_risk_score * 100).toFixed(1)}%
            </span>
          </SignalRow>
          <SignalRow label="Anomaly Score">
            <span className={c.anomaly_score > 0.6 ? 'text-red-600' : 'text-gray-900'}>
              {(c.anomaly_score * 100).toFixed(1)}%
            </span>
          </SignalRow>
          <SignalRow label="Model">
            <DecisionBadge action={c.model_action} size="xs" />
          </SignalRow>
          <SignalRow label="Model Version">
            <span className="font-mono text-xs">{c.model_version || '—'}</span>
          </SignalRow>
        </div>

        {/* Explanation */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Decision Explanation</h2>
          {Object.keys(c.explanation ?? {}).length ? (
            <dl className="space-y-2">
              {Object.entries(c.explanation).map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                  <dt className="text-xs font-medium text-gray-500 capitalize">
                    {k.replace(/_/g, ' ')}
                  </dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-gray-400 text-sm">No explanation available</p>
          )}
        </div>
      </div>

      {/* Analyst action */}
      {!isResolved ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Analyst Action</h2>

          {!c.assigned_to && (
            <button onClick={assign} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              <User className="w-4 h-4" /> Assign to me
            </button>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Verdict</label>
            <div className="flex gap-2 flex-wrap">
              {VERDICTS.map(v => (
                <button key={v.value} onClick={() => setVerdict(v.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                    ${verdict === v.value
                      ? v.color === 'red'   ? 'bg-red-600 text-white border-red-600'
                      : v.color === 'green' ? 'bg-green-600 text-white border-green-600'
                      :                      'bg-gray-600 text-white border-gray-600'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Analyst Notes</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this case…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <button onClick={resolve} disabled={!verdict || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
              bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            <CheckCircle className="w-4 h-4" />
            {saving ? 'Saving…' : 'Resolve Case'}
          </button>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-green-800">Case Resolved</h2>
          </div>
          <p className="text-sm text-green-700">
            Verdict: <strong>{(c.verdict ?? '').replace('_', ' ')}</strong>
          </p>
          {c.analyst_notes && <p className="text-sm text-green-700 mt-1">{c.analyst_notes}</p>}
        </div>
      )}
    </div>
  );
}
