'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

const DEMO = [
  { label: 'Admin',        u: 'admin',    p: 'admin2024!' },
  { label: 'Analyst',      u: 'analyst1', p: 'analyst2024!' },
  { label: 'Ops Manager',  u: 'ops1',     p: 'ops2024!' },
  { label: 'Bank Partner', u: 'partner1', p: 'partner2024!' },
];

export default function LoginPage() {
  const router  = useRouter();
  const params  = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // Clear error whenever user edits either field
  useEffect(() => { setError(''); }, [username, password]);

  const doLogin = async (u: string, p: string) => {
    if (!u || !p) { setError('Username and password required'); return; }
    setLoading(true);
    try {
      await api.auth.login(u, p);
      const me = await api.auth.me();
      localStorage.setItem('user', JSON.stringify(me));
      router.push(params.get('redirect') || '/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Invalid credentials');
    } finally { setLoading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doLogin(username, password); };
  const quickFill = (u: string, p: string) => { setUsername(u); setPassword(p); setError(''); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">FraudGuard</h1>
          <p className="text-blue-300 mt-1 text-sm">Decision Intelligence Portal</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 mb-4 text-sm" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input id="username" type="text" required autoFocus autoComplete="username"
                value={username} onChange={e => setUsername(e.target.value)} disabled={loading}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-gray-50"
                placeholder="Enter your username" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input id="password" type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-gray-50"
                placeholder="Enter your password" />
            </div>
            <button type="submit" disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : 'Sign in'}
            </button>
          </form>
          <div className="mt-6 border-t pt-5">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Demo accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map(acc => (
                <button key={acc.u} type="button" onClick={() => quickFill(acc.u, acc.p)} disabled={loading}
                  className="text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50">
                  <span className="block text-xs font-medium text-gray-800">{acc.label}</span>
                  <span className="block text-xs text-gray-500">{acc.u}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
