'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, Shield, User } from 'lucide-react';
import { NeuralBackground } from '@/components/auth/neural-background';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { checkApiHealth, friendlyApiError } from '@/lib/api-health';
import { useAuth } from '@/lib/auth-context';

const DEMO_ACCOUNTS = [
  { label: 'Admin', username: 'admin', password: 'admin2024!' },
  { label: 'Analyst', username: 'analyst1', password: 'analyst2024!' },
  { label: 'Ops Manager', username: 'ops1', password: 'ops2024!' },
  { label: 'Bank Partner', username: 'partner1', password: 'partner2024!' },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const probeApi = useCallback(async () => {
    setApiStatus('checking');
    const ok = await checkApiHealth(5);
    setApiStatus(ok ? 'online' : 'offline');
    return ok;
  }, []);

  useEffect(() => {
    probeApi();
    const id = setInterval(() => {
      if (apiStatus === 'offline') probeApi();
    }, 10_000);
    return () => clearInterval(id);
  }, [probeApi, apiStatus]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (apiStatus !== 'online') {
        const ok = await probeApi();
        if (!ok) {
          setError('Platform services are still starting. Please wait a moment and try again.');
          return;
        }
      }
      if (mode === 'signup') await api.auth.signup({ username, email, password });
      await api.auth.login(username, password);
      const me = await api.auth.me();
      localStorage.setItem('user', JSON.stringify(me));
      setUser(me);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
    setLoading(true);
    try {
      if (apiStatus !== 'online') await probeApi();
      await api.auth.login(u, p);
      const me = await api.auth.me();
      localStorage.setItem('user', JSON.stringify(me));
      setUser(me);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-bg-primary">
      <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/10 via-transparent to-accent-cyan/10 animate-drift" />
      <NeuralBackground />

      <div className="relative z-10 grid w-full lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden flex-col justify-center px-12 lg:flex xl:px-20"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Fraud IQ</p>
          <h1 className="mt-4 max-w-lg font-display text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Decision Intelligence <span className="text-gradient">OS</span>
          </h1>
          <p className="mt-6 max-w-md text-text-secondary">
            Data-driven operational intelligence with real-time decisioning, streaming pipelines, and
            explainable fraud analysis—built for mission-critical financial infrastructure.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center justify-center p-6 lg:p-12"
        >
          <div className="glass-panel-accent w-full max-w-md p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-cyan to-accent-purple">
                  <Shield className="h-5 w-5 text-bg-primary" />
                </div>
                <div>
                  <p className="font-semibold">Secure access</p>
                  <p className="text-xs text-text-muted">Enterprise workspace</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {apiStatus === 'checking' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
                    <span className="text-text-muted">Connecting</span>
                  </>
                )}
                {apiStatus === 'online' && (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    <span className="text-emerald-400">Gateway Network: Active</span>
                  </>
                )}
                {apiStatus === 'offline' && (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    <span className="text-amber-400">Gateway Network: Starting</span>
                  </>
                )}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-border-primary p-1">
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg py-2 text-sm font-medium capitalize transition ${
                    mode === m ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <div className="mt-6 border-t border-border-primary pt-6">
              <p className="metric-label mb-3">Quick access</p>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((d) => (
                  <Button
                    key={d.username}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    onClick={() => quickLogin(d.username, d.password)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
