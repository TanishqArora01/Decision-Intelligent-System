'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, AlertCircle, Loader2, Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { checkApiHealth, friendlyApiError } from '@/lib/api-health';
import { useAuth } from '@/lib/auth-context';

const DEMO = [
  { label: 'Admin', username: 'admin', password: 'admin2024!' },
  { label: 'Analyst', username: 'analyst1', password: 'analyst2024!' },
  { label: 'Ops', username: 'ops1', password: 'ops2024!' },
];

export function AuthForm({ mode: initialMode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode === 'sign-up' ? 'signup' : 'login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [plan, setPlan] = useState('growth');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gateway, setGateway] = useState<'checking' | 'online' | 'offline'>('checking');

  const probe = useCallback(async () => {
    setGateway('checking');
    const ok = await checkApiHealth(3);
    setGateway(ok ? 'online' : 'offline');
    return ok;
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  const finish = async () => {
    const me = await api.auth.me();
    localStorage.setItem('user', JSON.stringify(me));
    setUser(me);
    router.push('/mission-control');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (gateway === 'offline' && !(await probe())) {
        setError('Gateway network is starting. Retry in a few seconds.');
        return;
      }
      if (mode === 'signup') await api.auth.signup({ username, email, password });
      await api.auth.login(username, password);
      await finish();
    } catch (err: unknown) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary">
            <Activity className="h-5 w-5 text-text-inverted" />
          </div>
          <div>
            <p className="font-semibold">DecisionOS</p>
            <p className="text-micro text-text-muted">Autonomous risk operations</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-micro">
          <span
            className={`h-2 w-2 rounded-full ${gateway === 'online' ? 'animate-pulse bg-semantic-approve' : 'bg-semantic-stepup'}`}
          />
          <span className={gateway === 'online' ? 'text-semantic-approve' : 'text-text-muted'}>
            Gateway {gateway === 'online' ? 'Active' : gateway === 'checking' ? '…' : 'Starting'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-semantic-block/30 bg-semantic-block/10 px-3 py-2 text-small text-semantic-block">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {mode === 'signup' && (
        <>
          <label className="metric-label mb-1.5 block">Workspace name</label>
          <Input
            className="mb-4"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder="your-bank"
          />
          <label className="metric-label mb-1.5 block">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="mb-4 w-full rounded-lg border border-bg-border bg-bg-elevated px-3 py-2 text-small"
          >
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="scale">Scale</option>
          </select>
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="metric-label mb-1.5 block">Username</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input className="pl-10" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
        </div>
        {mode === 'signup' && (
          <div>
            <label className="metric-label mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input className="pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
        )}
        <div>
          <label className="metric-label mb-1.5 block">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input className="pl-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? 'Sign in' : 'Create workspace'}
        </Button>
      </form>

      {mode === 'login' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <Button
              key={d.username}
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await api.auth.login(d.username, d.password);
                  await finish();
                } catch (err: unknown) {
                  setError(friendlyApiError(err));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {d.label}
            </Button>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-small text-text-muted">
        {mode === 'login' ? (
          <>
            No account?{' '}
            <Link href="/sign-up" className="text-brand-primary hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Have an account?{' '}
            <Link href="/sign-in" className="text-brand-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
