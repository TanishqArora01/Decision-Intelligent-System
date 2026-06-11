'use client';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Key, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/index';

const ROLE_OPTIONS = ['ANALYST', 'OPS_MANAGER', 'ADMIN', 'BANK_PARTNER'];
const ROLE_COLORS: Record<string, string> = {
  ADMIN:        'bg-red-100 text-red-700',
  OPS_MANAGER:  'bg-purple-100 text-purple-700',
  ANALYST:      'bg-blue-100 text-blue-700',
  BANK_PARTNER: 'bg-green-100 text-green-700',
};

export default function UsersPage() {
  const [tab,       setTab]       = useState<'users' | 'keys'>('users');
  const [users,     setUsers]     = useState<any[]>([]);
  const [apiKeys,   setApiKeys]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [newKey,    setNewKey]    = useState<string | null>(null);

  // New user form
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('ANALYST');
  const [orgId,    setOrgId]    = useState('');
  const [saving,   setSaving]   = useState(false);

  // New key
  const [keyName,  setKeyName]  = useState('');

  useEffect(() => {
    Promise.all([api.users.list(), api.apiKeys.list()])
      .then(([u, k]) => { setUsers(u); setApiKeys(k); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const u = await api.users.create({ username, email, password, role, org_id: orgId || null });
      setUsers(prev => [u, ...prev]);
      setShowForm(false); setUsername(''); setEmail(''); setPassword(''); setOrgId('');
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (user: any) => {
    const updated = await api.users.update(user.id, { is_active: !user.is_active });
    setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, is_active: updated.is_active } : u));
  };

  const createApiKey = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const k = await api.apiKeys.create(keyName);
      setNewKey(k.key);
      setApiKeys(prev => [k, ...prev]);
      setKeyName('');
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const revokeKey = async (id: string) => {
    await api.apiKeys.revoke(id);
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> User Management
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">ADMIN only</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['users', 'keys'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
            {t === 'users' ? `Users (${users.length})` : `API Keys (${apiKeys.filter(k => k.is_active).length})`}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <>
          <button onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add User
          </button>

          {showForm && (
            <form onSubmit={createUser} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-gray-800">New User</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  ['Username', username, setUsername, 'text', 'analyst2'],
                  ['Email',    email,    setEmail,    'email','analyst2@example.com'],
                  ['Password', password, setPassword, 'password', '••••••••'],
                  ['Org ID (for Bank Partners)', orgId, setOrgId, 'text', 'bank-xyz'],
                ].map(([label, val, setter, type, ph]: any) => (
                  <div key={label as string}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                    <input type={type} value={val} onChange={e => setter(e.target.value)}
                      placeholder={ph} required={label !== 'Org ID (for Bank Partners)'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                  <select value={role} onChange={e => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Creating…' : 'Create User'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Org</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.username}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{u.org_id || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleActive(u)}
                        className="text-xs text-blue-600 hover:underline">
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'keys' && (
        <>
          {newKey && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-800 text-sm">API Key created — copy now, won't show again</span>
              </div>
              <code className="block bg-white border border-green-200 rounded px-3 py-2 text-xs font-mono break-all">
                {newKey}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(newKey); }}
                className="mt-2 text-xs text-green-700 hover:underline">Copy to clipboard</button>
            </div>
          )}

          <form onSubmit={createApiKey} className="flex gap-2">
            <input value={keyName} onChange={e => setKeyName(e.target.value)}
              placeholder="Key name (e.g. prod-integration)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={!keyName || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              <Key className="w-4 h-4" /> Generate Key
            </button>
          </form>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Last Used</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {apiKeys.map((k: any) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{k.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${k.is_active ? 'text-green-600' : 'text-red-500'}`}>
                        {k.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{k.created_at?.slice(0,10)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{k.last_used_at?.slice(0,10) ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {k.is_active && (
                        <button onClick={() => revokeKey(k.id)}
                          className="text-xs text-red-600 hover:underline flex items-center gap-1 ml-auto">
                          <Trash2 className="w-3 h-3" /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
