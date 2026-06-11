'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { AuthContext, type AuthUser } from '@/lib/auth-context';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');
      const onLogin = window.location.pathname === '/login';

      if (token) {
        document.cookie = `dip_session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      if (stored && token && !onLogin) {
        try {
          setUser(JSON.parse(stored));
          const me = await api.auth.me();
          setUser(me as AuthUser);
          localStorage.setItem('user', JSON.stringify(me));
        } catch {
          api.auth.logout();
          setUser(null);
        }
      } else if (stored && onLogin) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          setUser(null);
        }
      }
      setReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const isLogin = pathname === '/login';
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');
    if (!hasToken && !isLogin) router.replace('/login');
    if (hasToken && isLogin) router.replace('/dashboard');
  }, [ready, pathname, router]);

  if (!ready && pathname !== '/login') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}
