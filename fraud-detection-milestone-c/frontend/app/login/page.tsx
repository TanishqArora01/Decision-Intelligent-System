'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const DEMO_ACCOUNTS = [
    { label: 'Admin',        username: 'admin',    password: 'admin2024!',   role: 'ADMIN' },
    { label: 'Analyst',      username: 'analyst1', password: 'analyst2024!', role: 'ANALYST' },
    { label: 'Ops Manager',  username: 'ops1',     password: 'ops2024!',     role: 'OPS_MANAGER' },
    { label: 'Bank Partner', username: 'partner1', password: 'partner2024!', role: 'BANK_PARTNER' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'signup') {
        await api.auth.signup({ username, email, password });
      }
      await api.auth.login(username, password);
      const me   = await api.auth.me();
      localStorage.setItem('user', JSON.stringify(me));
      setUser(me as any);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? (mode === 'signup' ? 'Signup failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Image src="/ritam-guard-logo.png" alt="Ritam Guard" width={52} height={52} className="w-12 h-12 rounded-xl object-cover" priority />
          </div>
          <h1 className="text-3xl font-bold text-white">Ritam Guard</h1>
          <p className="text-blue-300 mt-1 text-sm">Decision Intelligence Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {mode === 'signup' ? 'Create user account' : 'Sign in to your account'}
          </h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 rounded-lg border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${mode === 'signup' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text" required autoFocus
                value={username} onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700
                disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Sign up as user' : 'Sign in')}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 border-t pt-5">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Demo accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button key={acc.username}
                  onClick={() => { setUsername(acc.username); setPassword(acc.password); }}
                  className="text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300
                    hover:bg-blue-50 transition-colors">
                  <span className="block text-xs font-medium text-gray-800">{acc.label}</span>
                  <span className="block text-xs text-gray-500">{acc.username}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
