'use client';

import { useState } from 'react';
import { Key, Settings2, Users } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TEAM_ROWS = [
  { email: 'admin@fraudiq.io', role: 'ADMIN', tenant: 'Global', status: 'Active' },
  { email: 'analyst1@fraudiq.io', role: 'ANALYST', tenant: 'NA-Retail', status: 'Active' },
  { email: 'ops@fraudiq.io', role: 'OPS_MANAGER', tenant: 'EMEA', status: 'Active' },
  { email: 'partner@bank.io', role: 'BANK_PARTNER', tenant: 'Partner-AX', status: 'Active' },
];

export default function SettingsPage() {
  const { env: environment, setEnv: setEnvironment, streamingLive, setStreamingLive, theme, setTheme } = useWorkspaceStore();
  const [apiToken, setApiToken] = useState('••••••••••••••••••••••••');

  const generateToken = () => {
    const t = `fiq_${Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('')}`;
    setApiToken(t);
  };

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Workspace 10</p>
        <h1 className="font-display text-3xl font-semibold">User Management & System Settings</h1>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold">Team Accounts</h2>
        </div>
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Permission Group</th>
                <th className="px-4 py-3">Tenant Segment</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_ROWS.map((r) => (
                <tr key={r.email} className="border-b border-slate-800/60">
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-400">{r.role}</td>
                  <td className="px-4 py-3 text-text-secondary">{r.tenant}</td>
                  <td className="px-4 py-3">
                    <span className="text-emerald-400">{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="surface-card p-5">
          <p className="metric-label mb-3">Developer Access Key Generator</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input readOnly value={apiToken} className="font-mono text-xs" />
            <Button onClick={generateToken} className="shrink-0 gap-2">
              <Key className="h-4 w-4" />
              Generate API Token
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold">Advanced Settings</h2>
        </div>
        <div className="surface-card space-y-6 p-6">
          <div>
            <p className="metric-label mb-3">Environment Segment</p>
            <div className="flex flex-wrap gap-2">
              {(['production', 'staging', 'sandbox'] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`rounded-lg border px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
                    environment === env
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-800 text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>

        <div className="flex items-center justify-between border-t border-bg-border pt-6">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-xs text-text-muted">Light mode for bank admin preferences</p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-lg border border-bg-border px-3 py-1.5 text-small capitalize"
          >
            {theme}
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-bg-border pt-6">
          <div>
            <p className="font-medium">Live Dashboard Ingestion Stream</p>
            <p className="text-xs text-text-muted">Freeze data mutations across all workspaces</p>
          </div>
            <button
              type="button"
              onClick={() => setStreamingLive(!streamingLive)}
              className={`relative h-7 w-12 rounded-full transition ${streamingLive ? 'bg-emerald-500/30' : 'bg-white/10'}`}
              aria-label="Toggle live stream"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${streamingLive ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <p className="metric-label mb-3">Endpoints Panel</p>
            <div className="space-y-2 font-mono text-xs">
              <code className="block rounded-lg border border-slate-800 bg-bg-secondary px-4 py-3 text-cyan-400">
                POST /api/v1/decision
              </code>
              <p className="text-text-muted">Gateway: 8002 · Micro-Brain: 8400</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
