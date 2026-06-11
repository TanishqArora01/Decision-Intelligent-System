// lib/api.ts — JWT auth, token refresh, SSE via Authorization header (not query param)
const BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8400')
  : (process.env.BACKEND_INTERNAL_URL ?? 'http://app-backend:8400');

function getTokens() {
  if (typeof window === 'undefined') return { access: null, refresh: null };
  return { access: localStorage.getItem('access_token'), refresh: localStorage.getItem('refresh_token') };
}
function setTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
  document.cookie = `access_token=${access}; path=/; SameSite=Strict`;
}
export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  if (typeof document !== 'undefined')
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

let _refreshPromise: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const { refresh } = getTokens();
    if (!refresh) return null;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) { clearTokens(); return null; }
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      return data.access_token as string;
    } catch { return null; }
    finally { _refreshPromise = null; }
  })();
  return _refreshPromise;
}

async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const { access } = getTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (access) headers['Authorization'] = `Bearer ${access}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401 && retry) {
    const t = await refreshAccessToken();
    if (t) return apiFetch<T>(path, options, false);
    clearTokens();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const b = await res.json(); detail = b.detail ?? b.message ?? detail; } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: async (username: string, password: string) => {
      const data = await apiFetch<{ access_token: string; refresh_token: string; role: string; username: string }>(
        '/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }
      );
      setTokens(data.access_token, data.refresh_token);
      return data;
    },
    me: () => apiFetch<{ id: string; username: string; role: string; org_id: string | null }>('/auth/me'),
    logout: () => { clearTokens(); },
  },
  decisions: {
    list: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]));
      return apiFetch<{ items: any[]; total: number; page: number; pages: number }>(`/decisions?${qs}`);
    },
  },
  queue: {
    list: (params?: Record<string, string|number|boolean>) => {
      const qs = params ? '?'+new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)])) : '';
      return apiFetch<any>(`/review-queue${qs}`);
    },
    get:      (id: string) => apiFetch<any>(`/review-queue/${id}`),
    assign:   (id: string, assigned_to?: string) =>
      apiFetch<any>(`/review-queue/${id}/assign`,{method:'PATCH',body:JSON.stringify({assigned_to})}),
    resolve:  (id: string, verdict: string, notes: string) =>
      apiFetch<any>(`/review-queue/${id}/resolve`,{method:'PATCH',body:JSON.stringify({verdict,analyst_notes:notes})}),
    priority: (id: string, priority: number) =>
      apiFetch<any>(`/review-queue/${id}/priority`,{method:'PATCH',body:JSON.stringify({priority})}),
    sync: () => apiFetch<any>('/review-queue/sync-from-decisions',{method:'POST'}),
  },
  analytics: {
    overview:  () => apiFetch<any>('/analytics/overview'),
    fraudRate: (hours=24,granularity='hour') => apiFetch<any>(`/analytics/fraud-rate?hours=${hours}&granularity=${granularity}`),
    actions:   (hours=24) => apiFetch<any>(`/analytics/actions?hours=${hours}`),
    latency:   (hours=1)  => apiFetch<any>(`/analytics/latency?hours=${hours}`),
    topRisk:   (hours=1)  => apiFetch<any>(`/analytics/top-risk?hours=${hours}`),
    abCompare: (hours=24) => apiFetch<any>(`/analytics/ab-comparison?hours=${hours}`),
  },
  users: {
    list:   () => apiFetch<any[]>('/users'),
    create: (d:any) => apiFetch<any>('/users',{method:'POST',body:JSON.stringify(d)}),
    update: (id:string,d:any) => apiFetch<any>(`/users/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
  },
  apiKeys: {
    list:   () => apiFetch<any[]>('/api-keys'),
    create: (name:string) => apiFetch<any>('/api-keys',{method:'POST',body:JSON.stringify({name})}),
    revoke: (id:string)   => apiFetch<any>(`/api-keys/${id}`,{method:'DELETE'}),
  },
};

// SSE — auth via Authorization header, NOT ?token= query param
// Auto-reconnects with exponential backoff on disconnect
export function connectDecisionStream(
  onEvent: (e:any)=>void,
  onConnected?: ()=>void,
  onDisconnected?: ()=>void,
): ()=>void {
  let stopped = false;
  let retryDelay = 1000;
  let controller: AbortController|null = null;

  async function connect() {
    if (stopped) return;
    const { access } = getTokens();
    if (!access) return;
    controller = new AbortController();
    try {
      onDisconnected?.();
      const res = await fetch(`${BASE}/decisions/stream`, {
        headers: { 'Authorization': `Bearer ${access}` },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);
      onConnected?.();
      retryDelay = 1000;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) { try { onEvent(JSON.parse(line.slice(6))); } catch {} }
        }
      }
    } catch (err:any) {
      if (stopped || err?.name==='AbortError') return;
      onDisconnected?.();
      retryDelay = Math.min(retryDelay*2, 30_000);
      setTimeout(connect, retryDelay);
    }
  }
  connect();
  return () => { stopped=true; controller?.abort(); };
}
