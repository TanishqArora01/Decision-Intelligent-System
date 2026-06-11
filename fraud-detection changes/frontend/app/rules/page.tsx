'use client';

import { SEEDED_POLICIES } from '@/lib/constants/policies';

export default function RulesPage() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Workspace 06</p>
        <h1 className="font-display text-3xl font-semibold">Rules Engine</h1>
        <p className="mt-1 text-sm text-text-secondary">ML boundaries and deterministic governance policies.</p>
      </header>

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-bg-secondary/80 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3">Policy Name</th>
              <th className="px-4 py-3">Target Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">24h Hits</th>
            </tr>
          </thead>
          <tbody>
            {SEEDED_POLICIES.map((p) => (
              <tr key={p.name} className="border-b border-slate-800/60 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-secondary">{p.stage}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      p.status === 'ACTIVE'
                        ? 'rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400'
                        : 'rounded border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-text-muted'
                    }
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">{p.hits24h.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
